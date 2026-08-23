import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { ProxyAgent, fetch as ufetch, setGlobalDispatcher } from 'undici';

setGlobalDispatcher(new ProxyAgent({ uri: process.env.HTTPS_PROXY, requestTls: { ca: fs.readFileSync('/root/.ccr/ca-bundle.crt') } }));

export const OUT = '/tmp/katana-museum';
export const CREDITS = path.join(OUT, 'credits.json');
export const UA = 'KatanaStoreResearchBot/1.0 (https://github.com/ChristianSantanaLlanes/sveltia-cms-auth; christiansantanallanes@gmail.com) undici/8';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export { ufetch, sharp };
fs.mkdirSync(OUT, { recursive: true });

export const loadRecords = () => (fs.existsSync(CREDITS) ? JSON.parse(fs.readFileSync(CREDITS, 'utf8')) : []);
export const saveRecords = (r) => fs.writeFileSync(CREDITS, JSON.stringify(r, null, 2));

export async function apiJson(url, { tries = 8, base = 4000 } = {}) {
  let last;
  for (let a = 0; a < tries; a++) {
    try {
      const r = await ufetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
      const t = await r.text();
      if (r.ok && (t.startsWith('{') || t.startsWith('['))) return JSON.parse(t);
      last = `${r.status} ${t.slice(0, 80)}`;
    } catch (e) { last = e.message; }
    await sleep(base * (a + 1) + Math.random() * 1500);
  }
  throw new Error('apiJson failed: ' + last);
}

// Verify: opens, >=2000px wide, and not a near-empty flat image.
export async function verify(buf, minW = 2000) {
  const img = sharp(buf, { limitInputPixels: 800e6 });
  const m = await img.metadata();
  if (!m.width || !m.height) return { ok: false, why: 'no-meta' };
  if (m.width < minW) return { ok: false, why: `width ${m.width}<${minW}` };
  const st = await img.stats();
  // stdev across channels -- flat/blank scans have very low variance
  const sd = st.channels.reduce((a, c) => a + c.stdev, 0) / st.channels.length;
  if (sd < 12) return { ok: false, why: `flat stdev ${sd.toFixed(1)}` };
  return { ok: true, w: m.width, h: m.height, sd: +sd.toFixed(1), format: m.format };
}

export async function grab(cand, name, { minW = 2000, minBytes = 150_000, seen } = {}) {
  let buf;
  try {
    const r = await ufetch(cand.url, { headers: { 'user-agent': UA }, redirect: 'follow' });
    if (!r.ok) return { skip: `http ${r.status}` };
    buf = Buffer.from(await r.arrayBuffer());
  } catch (e) { return { skip: 'net ' + e.message.slice(0, 40) }; }
  if (buf.length < minBytes) return { skip: `small ${buf.length}` };
  const sha = crypto.createHash('sha1').update(buf).digest('hex');
  if (seen?.has(sha)) return { skip: 'dup' };
  let v;
  try { v = await verify(buf, minW); } catch (e) { return { skip: 'decode ' + e.message.slice(0, 40) }; }
  if (!v.ok) return { skip: v.why };
  seen?.add(sha);
  fs.writeFileSync(path.join(OUT, name), buf);
  return { rec: { file: name, slot: cand.slot, url: cand.url, w: v.w, h: v.h, title: cand.title, creator: cand.creator || '', license: cand.license, page: cand.page, source: cand.source, bytes: buf.length, sha } };
}

// Patient variant: retries 429/5xx from upload.wikimedia.org.
export async function grabRetry(cand, name, opts = {}) {
  const { tries = 6, base = 6000 } = opts;
  let last = 'unknown';
  for (let a = 0; a < tries; a++) {
    const res = await grab(cand, name, opts);
    if (res.rec) return res;
    last = res.skip;
    if (!/http (429|5\d\d)|net /.test(res.skip)) return res; // permanent reject
    await sleep(base * (a + 1) + Math.random() * 3000);
  }
  return { skip: last };
}
