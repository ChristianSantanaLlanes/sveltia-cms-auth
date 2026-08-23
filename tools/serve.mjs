// Static server for site/dist with brotli/gzip + immutable asset caching.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = process.argv[2] || new URL('../site/dist', import.meta.url).pathname;
const PORT = Number(process.argv[3] || 8080);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.avif': 'image/avif', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const COMPRESSIBLE = /text\/|javascript|json|svg|manifest/;
const cache = new Map();

http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(ROOT, url);
  if (url.endsWith('/')) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) && fs.existsSync(`${file}.html`)) file = `${file}.html`;
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    return res.end('not found');
  }
  const ext = path.extname(file);
  const type = TYPES[ext] || 'application/octet-stream';
  const accept = req.headers['accept-encoding'] || '';
  const enc = COMPRESSIBLE.test(type) ? (/br/.test(accept) ? 'br' : /gzip/.test(accept) ? 'gzip' : null) : null;
  const key = `${file}:${enc}:${fs.statSync(file).mtimeMs}`;
  let body = cache.get(key);
  if (!body) {
    const raw = fs.readFileSync(file);
    body = enc === 'br' ? zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } })
      : enc === 'gzip' ? zlib.gzipSync(raw, { level: 9 }) : raw;
    cache.set(key, body);
  }
  const headers = { 'content-type': type, 'content-length': body.length,
    'cache-control': /\.(avif|webp|jpg|png|woff2|svg)$/.test(ext) ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate' };
  if (enc) headers['content-encoding'] = enc;
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}).listen(PORT, '127.0.0.1', () => console.log(`serving ${ROOT} on http://127.0.0.1:${PORT}`));
