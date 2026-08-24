// Shared helpers for katana image harvesting.
import fs from 'node:fs';
import path from 'node:path';
import { ProxyAgent, fetch as ufetch, setGlobalDispatcher } from 'undici';

setGlobalDispatcher(new ProxyAgent({ uri: process.env.HTTPS_PROXY, requestTls: { ca: fs.readFileSync('/root/.ccr/ca-bundle.crt') } }));

export const OUT = '/tmp/katana-raw';
export const CREDITS = path.join(OUT, 'credits.json');
export const UA = 'KatanaStoreResearchBot/1.0 (https://github.com/ChristianSantanaLlanes/sveltia-cms-auth; christiansantanallanes@gmail.com) undici/6';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export { ufetch };

fs.mkdirSync(OUT, { recursive: true });

export function loadRecords() {
  return fs.existsSync(CREDITS) ? JSON.parse(fs.readFileSync(CREDITS, 'utf8')) : [];
}
export function saveRecords(records) {
  // A shard lets two harvesters run in parallel without clobbering credits.json.
  const target = process.env.CREDITS_SHARD ? path.join(OUT, process.env.CREDITS_SHARD) : CREDITS;
  if (process.env.CREDITS_SHARD) {
    const baseFiles = new Set((fs.existsSync(CREDITS) ? JSON.parse(fs.readFileSync(CREDITS, 'utf8')) : []).map((r) => r.file));
    fs.writeFileSync(target, JSON.stringify(records.filter((r) => !baseFiles.has(r.file)), null, 2));
  } else {
    fs.writeFileSync(target, JSON.stringify(records, null, 2));
  }
}
export function counts(records) {
  const c = {};
  for (const r of records) c[r.slot] = (c[r.slot] || 0) + 1;
  return c;
}

// Fetch JSON with retries + backoff (handles 429 from Wikimedia).
export async function apiJson(url, { tries = 6, base = 2000 } = {}) {
  let last;
  for (let a = 0; a < tries; a++) {
    try {
      const r = await ufetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(25000) });
      const t = await r.text();
      if (r.ok && (t.startsWith('{') || t.startsWith('['))) return JSON.parse(t);
      last = `${r.status} ${t.slice(0, 100)}`;
    } catch (e) { last = e.message; }
    await sleep(base * (a + 1) + Math.random() * 800);
  }
  throw new Error('apiJson failed: ' + last);
}

// Download one candidate. Returns record or null. Dedupes by url + by content hash.
import crypto from 'node:crypto';
export function hashIndex(records) {
  const h = new Set();
  for (const r of records) if (r.sha) h.add(r.sha);
  return h;
}

export async function download(cand, name, { minBytes = 120_000, seenHashes } = {}) {
  const r = await ufetch(cand.url, { headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(60000) });
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < minBytes) return null;
  const sha = crypto.createHash('sha1').update(buf).digest('hex');
  if (seenHashes?.has(sha)) return null;
  seenHashes?.add(sha);
  fs.writeFileSync(path.join(OUT, name), buf);
  return { file: name, ...cand, bytes: buf.length, sha };
}

export function nextNamer(records, base) {
  const used = new Set(records.map((r) => r.file));
  let i = base;
  return (slot, ext) => {
    let n;
    do { n = `${slot}-${i++}${ext}`; } while (used.has(n));
    used.add(n);
    return n;
  };
}
