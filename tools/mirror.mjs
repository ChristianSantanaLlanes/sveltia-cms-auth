// Local plain-HTTP mirror of a remote origin so a browser that cannot trust the
// egress proxy CA can still render the real page. Node terminates TLS upstream.
import http from 'node:http';
import fs from 'node:fs';
import { ProxyAgent, fetch as ufetch, setGlobalDispatcher } from 'undici';

const ORIGIN = process.env.MIRROR_ORIGIN || 'https://www.apple.com';
const PORT = Number(process.env.MIRROR_PORT || 8099);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const HOST_RE = /(apple\.com|cdn-apple\.com|mzstatic\.com|edgekey\.net|apple\.co)$/;

if (process.env.HTTPS_PROXY) {
  setGlobalDispatcher(new ProxyAgent({ uri: process.env.HTTPS_PROXY, requestTls: { ca: fs.readFileSync('/root/.ccr/ca-bundle.crt') } }));
}

const cache = new Map();

const rewrite = (body) =>
  body
    .replace(/https?:\\?\/\\?\/([a-z0-9.-]+)/gi, (m, host) => (HOST_RE.test(host) ? `/_m/${host}` : m))
    .replace(/(^|[^:a-z])\/\/([a-z0-9.-]+\.(?:apple\.com|cdn-apple\.com|mzstatic\.com))/gi, (m, pre, host) => `${pre}/_m/${host}`);

const server = http.createServer(async (req, res) => {
  let target;
  const m = req.url.match(/^\/_m\/([^/]+)(\/.*)?$/);
  if (m) target = `https://${m[1]}${m[2] || '/'}`;
  else target = `${ORIGIN}${req.url}`;

  const key = target;
  try {
    let entry = cache.get(key);
    if (!entry) {
      const upstream = await ufetch(target, {
        headers: { 'user-agent': req.headers['user-agent'] || UA, accept: req.headers.accept || '*/*', 'accept-language': 'en-US,en;q=0.9' },
        redirect: 'follow',
      });
      const ct = upstream.headers.get('content-type') || 'application/octet-stream';
      const isText = /text\/|javascript|json|xml|svg/.test(ct);
      const buf = Buffer.from(await upstream.arrayBuffer());
      entry = { status: upstream.status, ct, body: isText ? Buffer.from(rewrite(buf.toString('utf8')), 'utf8') : buf };
      cache.set(key, entry);
    }
    res.writeHead(entry.status, { 'content-type': entry.ct, 'cache-control': 'public, max-age=600', 'access-control-allow-origin': '*' });
    res.end(entry.body);
  } catch (e) {
    res.writeHead(502, { 'content-type': 'text/plain' });
    res.end(`mirror error: ${e.message}`);
  }
});
server.listen(PORT, '127.0.0.1', () => console.log(`mirror ${ORIGIN} -> http://127.0.0.1:${PORT}`));
