import fs from 'node:fs';
import path from 'node:path';
import { ProxyAgent, fetch as ufetch, setGlobalDispatcher } from 'undici';
setGlobalDispatcher(new ProxyAgent({ uri: process.env.HTTPS_PROXY, requestTls: { ca: fs.readFileSync('/root/.ccr/ca-bundle.crt') } }));
const OUT = process.argv[2] || '/tmp/katana-raw';
fs.mkdirSync(OUT, { recursive: true });
const UA = 'KatanaStoreResearchBot/1.0 (https://github.com/ChristianSantanaLlanes/sveltia-cms-auth; christiansantanallanes@gmail.com) undici/6';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function apiJson(url) {
  for (let a = 0; a < 5; a++) {
    const r = await ufetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
    const t = await r.text();
    if (t.startsWith('{')) return JSON.parse(t);
    await sleep(3000 * (a + 1));
  }
  throw new Error('rate limited');
}
const CATS = {
  hero: ['Category:Katana', 'Category:Nihontō', 'Category:Japanese sword blades'],
  hamon: ['Category:Hamon (swords)', 'Category:Japanese sword blades', 'Category:Kissaki'],
  forge: ['Category:Japanese swordsmithing', 'Category:Swordsmiths', 'Category:Blacksmiths at work'],
  tsuba: ['Category:Tsuba', 'Category:Tsuba in the Metropolitan Museum of Art'],
  tsuka: ['Category:Tsuka (Japanese sword handles)', 'Category:Menuki', 'Category:Fuchi and kashira'],
  saya: ['Category:Saya (Japanese sword scabbards)', 'Category:Koshirae'],
  display: ['Category:Katanakake', 'Category:Japanese swords in museums'],
};
const creditsPath = path.join(OUT, 'credits.json');
const records = fs.existsSync(creditsPath) ? JSON.parse(fs.readFileSync(creditsPath, 'utf8')) : [];
const have = new Set(records.map((r) => r.url));
let i = 900;
for (const [slot, cats] of Object.entries(CATS)) {
  for (const cat of cats) {
    const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=categorymembers&gcmtitle=${encodeURIComponent(cat)}&gcmtype=file&gcmlimit=40&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=2400`;
    let j;
    try { j = await apiJson(api); } catch (e) { console.log('FETCHFAIL', cat, e.message); continue; }
    await sleep(1200);
    const pages = Object.values(j.query?.pages || {});
    for (const p of pages) {
      const info = p.imageinfo?.[0];
      if (!info || !/image\/(jpeg|png)/.test(info.mime)) continue;
      if (info.width < 1400) continue;
      const src = info.thumburl || info.url;
      if (have.has(src)) continue;
      have.add(src);
      const ext = /\.png$/i.test(src) ? '.png' : '.jpg';
      const name = `${slot}-${i++}${ext}`;
      try {
        const rr = await ufetch(src, { headers: { 'user-agent': UA }, redirect: 'follow' });
        if (!rr.ok) continue;
        const buf = Buffer.from(await rr.arrayBuffer());
        if (buf.length < 80_000) continue;
        fs.writeFileSync(path.join(OUT, name), buf);
        records.push({ file: name, slot, src: 'commons', url: src, w: info.thumbwidth || info.width, h: info.thumbheight || info.height,
          title: p.title, creator: info.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, '').slice(0, 80),
          license: info.extmetadata?.LicenseShortName?.value, page: info.descriptionurl, bytes: buf.length });
      } catch {}
    }
    console.log(`${slot} <- ${cat}: ${records.length} total`);
  }
}
fs.writeFileSync(creditsPath, JSON.stringify(records, null, 2));
console.log('total', records.length);
