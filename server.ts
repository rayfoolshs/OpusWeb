import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import dns from 'node:dns/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MAX_SCORE_BYTES = 15 * 1024 * 1024; // 15 MB

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] >= 224) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) {
      return true;
    }
    if (lower.startsWith('::ffff:')) {
      return isPrivateIp(lower.slice(7));
    }
  }
  return false;
}

async function assertSafePublicUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL format.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS web links are supported.');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('Local or internal network addresses are not permitted.');
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error('Private IP addresses are not permitted.');
    }
    return parsed;
  }

  const resolved = await dns.lookup(hostname, { all: true });
  if (!resolved.length) {
    throw new Error('Could not resolve hostname.');
  }
  for (const record of resolved) {
    if (isPrivateIp(record.address)) {
      throw new Error('Resolved address points to a private network.');
    }
  }

  return parsed;
}

function normalizeWebLink(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  // Convert standard GitHub blob links to raw.githubusercontent.com automatically
  const ghBlobMatch = trimmed.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i);
  if (ghBlobMatch) {
    const [, owner, repo, branch, filePath] = ghBlobMatch;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
  }
  return trimmed;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/fetch-score', async (req, res) => {
    const rawParam = typeof req.query.url === 'string' ? req.query.url : '';
    if (!rawParam.trim()) {
      res.status(400).json({ error: 'Missing "url" query parameter.' });
      return;
    }

    const normalizedUrl = normalizeWebLink(rawParam);

    try {
      const targetUrl = await assertSafePublicUrl(normalizedUrl);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const upstream = await fetch(targetUrl.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'OpusWeb-ScoreFetcher/1.0',
          Accept: '*/*',
        },
        redirect: 'follow',
      });

      clearTimeout(timeout);

      if (!upstream.ok) {
        res.status(502).json({
          error: `Remote server returned HTTP ${upstream.status} ${upstream.statusText}`,
        });
        return;
      }

      const contentLengthHeader = upstream.headers.get('content-length');
      if (contentLengthHeader && Number(contentLengthHeader) > MAX_SCORE_BYTES) {
        res.status(413).json({ error: 'Score file exceeds the 15 MB size limit.' });
        return;
      }

      const arrayBuffer = await upstream.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_SCORE_BYTES) {
        res.status(413).json({ error: 'Score file exceeds the 15 MB size limit.' });
        return;
      }

      const disposition = upstream.headers.get('content-disposition') || '';
      let filename = '';
      const fnMatch = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
      if (fnMatch?.[1]) {
        filename = decodeURIComponent(fnMatch[1]);
      } else {
        const pathPart = targetUrl.pathname.split('/').pop() || 'score.musicxml';
        filename = decodeURIComponent(pathPart);
      }

      const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Score-Filename', filename);
      res.setHeader('Cache-Control', 'no-store');
      res.send(Buffer.from(arrayBuffer));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch score from web link.';
      res.status(400).json({ error: message });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OpusWeb server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
