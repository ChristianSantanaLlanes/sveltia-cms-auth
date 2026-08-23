// Downloads real katana photography from Openverse + Wikimedia Commons.
import fs from 'node:fs';
import path from 'node:path';
import { ProxyAgent, fetch as ufetch, setGlobalDispatcher } from 'undici';

setGlobalDispatcher(new ProxyAgent({ uri: process.env.HTTPS_PROXY, requestTls: { ca: fs.readFileSync('/root/.ccr/ca-bundle.crt') } }));

const OUT = process.argv[2] || '/tmp/katana-raw';
fs.mkdirSync(OUT, { recursive: true });
const UA = 'katana-store-image-bot/1.0 (research; contact via repo)';

const SLOTS = {
  hero: ['katana sword', 'japanese sword blade', 'nihonto katana'],
  hamon: ['hamon blade', 'katana hamon temper line', 'japanese sword blade close up'],
  forge: ['japanese swordsmith forging', 'blacksmith forging sword sparks', 'katana forging tatara'],
  tsuba: ['tsuba sword guard', 'japanese tsuba', 'katana handguard'],
  tsuka: ['katana handle tsuka ito', 'japanese sword hilt wrap', 'samurai sword grip'],
  saya: ['katana saya scabbard', 'japanese sword scabbard lacquer'],
  display: ['katana on stand', 'samurai sword display katanakake', 'japanese sword museum'],
  detail: ['sword polishing japanese', 'japanese sword fittings menuki', 'katana kissaki tip'],
};

const OK_LICENSES = new Set(['cc0', 'pdm', 'by', 'by-sa']);
const seen = new Set();
const records = [];

async function openverse(q, slot) {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=20&license_type=all-cc,commercial&size=large`;
  try {
    const r = await ufetch(url, { headers: { 'user-agent': UA } });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.results || [])
      .filter((x) => OK_LICENSES.has(x.license) && (x.width || 0) >= 1200)
      .map((x) => ({ slot, src: 'openverse', url: x.url, w: x.width, h: x.height, title: x.title, creator: x.creator, license: `${x.license}-${x.license_version}`, page: x.foreign_landing_url }));
  } catch { return []; }
}

async function commons(q, slot) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrnamespace=6&gsrlimit=20&prop=imageinfo&iiprop=url|size|mime|extmetadata`;
  try {
    const r = await ufetch(url, { headers: { 'user-agent': UA } });
    if (!r.ok) return [];
    const j = await r.json();
    const pages = Object.values(j.query?.pages || {});
    return pages
      .map((p) => p.imageinfo?.[0])
      .filter((i) => i && /image\/(jpeg|png|webp)/.test(i.mime) && i.width >= 1400)
      .map((i) => ({ slot, src: 'commons', url: i.url, w: i.width, h: i.height,
        title: i.extmetadata?.ObjectName?.value?.replace(/<[^>]+>/g, ''),
        creator: i.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, '').slice(0, 80),
        license: i.extmetadata?.LicenseShortName?.value, page: i.descriptionurl }));
  } catch { return []; }
}

const all = [];
for (const [slot, queries] of Object.entries(SLOTS)) {
  for (const q of queries) {
    const [a, b] = await Promise.all([openverse(q, slot), commons(q, slot)]);
    all.push(...a, ...b);
  }
  console.log(`queried ${slot}: total candidates ${all.length}`);
}

let i = 0;
for (const c of all) {
  if (seen.has(c.url)) continue;
  seen.add(c.url);
  const ext = (c.url.split('?')[0].match(/\.(jpe?g|png|webp)$/i) || ['.jpg'])[0].toLowerCase().replace('.jpeg', '.jpg');
  const name = `${c.slot}-${String(i++).padStart(3, '0')}${ext}`;
  try {
    const r = await ufetch(c.url, { headers: { 'user-agent': UA }, redirect: 'follow' });
    if (!r.ok) continue;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 60_000) continue;
    fs.writeFileSync(path.join(OUT, name), buf);
    records.push({ file: name, ...c, bytes: buf.length });
  } catch {}
}
fs.writeFileSync(path.join(OUT, 'credits.json'), JSON.stringify(records, null, 2));
console.log(`downloaded ${records.length} images to ${OUT}`);
