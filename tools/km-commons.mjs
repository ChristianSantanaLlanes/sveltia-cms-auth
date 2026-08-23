import { apiJson, grab, loadRecords, saveRecords, sleep } from './km-lib.mjs';

// Only the four categories assigned to this agent (+ their subcategories).
const ROOTS = [
  ['hero', 'Category:Katana blades'],
  ['hero', 'Category:Nihonto in museums'],
  ['product', 'Category:Swords in the Tokyo National Museum'],
  ['product', 'Category:Japanese sword mountings in the Metropolitan Museum of Art'],
];

const API = 'https://commons.wikimedia.org/w/api.php';
async function members(cat) {
  const u = `${API}?action=query&format=json&generator=categorymembers&gcmtitle=${encodeURIComponent(cat)}&gcmtype=file|subcat&gcmlimit=500&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=3000`;
  return apiJson(u, { tries: 10, base: 6000 });
}

const files = new Map();
const visited = new Set();
const queue = ROOTS.map(([s, c]) => [s, c, 0]);
while (queue.length) {
  const [slot, cat, depth] = queue.shift();
  if (visited.has(cat)) continue;
  visited.add(cat);
  let o;
  try { o = await members(cat); } catch (e) { console.log('FAIL', cat, e.message.slice(0, 60)); continue; }
  await sleep(2500);
  const pages = Object.values(o.query?.pages || {});
  let f = 0, s = 0;
  for (const p of pages) {
    if (p.imageinfo) {
      const i = p.imageinfo[0];
      if (!/image\/(jpeg|png)/.test(i.mime)) continue;
      if (i.width < 2000) continue;
      if (!files.has(p.title)) { files.set(p.title, { slot, page: p, info: i }); f++; }
    } else if (depth < 2 && /^Category:/.test(p.title) && !/painting|print|ukiyo|drawing|book|document|armour|armor|helmet|arrow|bow |naginata|yari|spear/i.test(p.title)) {
      queue.push([slot, p.title, depth + 1]); s++;
    }
  }
  console.log(`${cat} (d${depth}): +${f} files, +${s} subcats | pool=${files.size}`);
}

const BAD = /ukiyo|woodblock|print|drawing|painting|scroll|map|diagram|logo|coat of arms|\.svg|poster|book|page|manuscript|label|plaque|sign|text|cosplay|replica|plastic|toy/i;
const cands = [];
for (const [title, { slot, page, info }] of files) {
  if (BAD.test(title)) continue;
  const t = title.replace(/^File:/, '');
  let s = slot;
  const lt = t.toLowerCase();
  if (/tsuba|guard/.test(lt)) s = 'tsuba';
  else if (/hamon|kissaki|hada|jihada|temper|boshi/.test(lt)) s = 'hamon';
  else if (/tsuka|menuki|fuchi|kashira|hilt|handle|grip/.test(lt)) s = 'tsuka';
  else if (/saya|scabbard|sheath/.test(lt)) s = 'saya';
  else if (/koshirae|mounting|mount/.test(lt)) s = 'product';
  else if (/museum|display|stand|exhibit|case/.test(lt)) s = 'display';
  const em = info.extmetadata || {};
  const strip = (v) => (v?.value || '').replace(/<[^>]+>/g, '').trim().slice(0, 120);
  cands.push({ slot: s, url: info.thumburl || info.url, title: t.replace(/\.(jpe?g|png)$/i, ''),
    creator: strip(em.Artist) || strip(em.Credit) || 'Unknown',
    license: strip(em.LicenseShortName) || 'see page', page: info.descriptionurl, source: 'wikimedia-commons' });
}
console.log('\ncandidates:', cands.length);

const records = loadRecords();
const seen = new Set(records.map((r) => r.sha));
const used = new Set(records.map((r) => r.file));
let i = 0;
for (const c of cands) {
  let name; do { name = `wc-${c.slot}-${String(i++).padStart(3, '0')}.jpg`; } while (used.has(name));
  used.add(name);
  const res = await grab(c, name, { seen });
  if (res.rec) { records.push(res.rec); console.log(`OK  ${name} ${res.rec.w}x${res.rec.h}  ${c.title.slice(0, 60)}`); }
  else console.log(`--  ${c.title.slice(0, 45)} :: ${res.skip}`);
  saveRecords(records);
}
const cnt = {}; for (const r of records) cnt[r.slot] = (cnt[r.slot] || 0) + 1;
console.log('\nTOTAL', records.length, JSON.stringify(cnt));
