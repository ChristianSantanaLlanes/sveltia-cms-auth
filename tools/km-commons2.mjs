import { apiJson, grabRetry, loadRecords, saveRecords, sleep } from './km-lib.mjs';

// Assigned categories that exist + real-name equivalents for the three that do not.
// Deliberately avoids the other agent's list (Katana, Nihontō, Japanese sword blades,
// Hamon (swords), Kissaki, Japanese swordsmithing, Swordsmiths, Tsuba, Tsuba in the MMA,
// Tsuka, Menuki, Fuchi and kashira, Saya, Koshirae, Katanakake, Japanese swords in museums).
const ROOTS = [
  ['product', 'Category:Swords in the Tokyo National Museum'],   // assigned, exists
  ['product', 'Category:Katana in the Metropolitan Museum of Art'],
  ['product', 'Category:Wakizashi in the Metropolitan Museum of Art'],
  ['tsuka',   'Category:Tosogu (Japanese sword fittings) in the Metropolitan Museum of Art'],
  ['hero',    'Category:Nihonto'],
  ['hero',    'Category:Swords of Japan'],
  ['hero',    'Category:Odachi'],
  ['hero',    'Category:Nodachi'],
  ['product', 'Category:Kazari tachi'],
  ['product', 'Category:Shirasaya'],
  ['hamon',   'Category:Hada (nihonto)'],
  ['hamon',   'Category:Boshi'],
  ['saya',    'Category:Koiguchi'],
  ['detail',  'Category:Habaki'],
];
const API = 'https://commons.wikimedia.org/w/api.php';

const files = new Map();
const visited = new Set();
const queue = ROOTS.map(([s, c]) => [s, c, 0]);
while (queue.length) {
  const [slot, cat, depth] = queue.shift();
  if (visited.has(cat)) continue;
  visited.add(cat);
  let o;
  try {
    o = await apiJson(`${API}?action=query&format=json&generator=categorymembers&gcmtitle=${encodeURIComponent(cat)}&gcmtype=file|subcat&gcmlimit=500&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=3000`, { tries: 10, base: 5000 });
  } catch (e) { console.log('FAIL', cat, e.message.slice(0, 50)); continue; }
  await sleep(1800);
  let f = 0, s = 0;
  for (const p of Object.values(o.query?.pages || {})) {
    if (p.imageinfo) {
      const i = p.imageinfo[0];
      if (!/image\/(jpeg|png)/.test(i.mime) || i.width < 2000) continue;
      if (!files.has(p.title)) { files.set(p.title, { slot, info: i }); f++; }
    } else if (depth < 2 && /^Category:/.test(p.title) && !/painting|ukiyo|print|drawing|book|armour|armor|helmet|arrow|bow |naginata|yari|spear|people|person|by author/i.test(p.title)) {
      queue.push([slot, p.title, depth + 1]); s++;
    }
  }
  console.log(`${cat} (d${depth}): +${f} files +${s} subcats | pool=${files.size}`);
}

const BAD = /ukiyo|woodblock|print|drawing|painting|scroll|diagram|logo|coat of arms|poster|manuscript|label|plaque|cosplay|replica|plastic|toy|statue|monument|shrine building|map|portrait|kanji chart|text|certificate|origami/i;
const cands = [];
for (const [title, { slot, info }] of files) {
  if (BAD.test(title)) continue;
  const t = title.replace(/^File:/, '').replace(/\.(jpe?g|png)$/i, '');
  const lt = t.toLowerCase();
  let s = slot;
  if (/tsuba|sword guard|handguard/.test(lt)) s = 'tsuba';
  else if (/hamon|kissaki|hada|jihada|boshi|temper|grain/.test(lt)) s = 'hamon';
  else if (/tsuka|menuki|fuchi|kashira|hilt|handle|grip|habaki/.test(lt)) s = 'tsuka';
  else if (/saya|scabbard|sheath|koiguchi|shirasaya/.test(lt)) s = 'saya';
  else if (/koshirae|mounting/.test(lt)) s = 'product';
  else if (/honkan|gallery|exhibit|display|case|stand|museum interior/.test(lt)) s = 'display';
  const em = info.extmetadata || {};
  const strip = (v) => (v?.value || '').replace(/<[^>]+>/g, '').trim().slice(0, 120);
  cands.push({ slot: s, url: info.thumburl || info.url, title: t,
    creator: strip(em.Artist) || strip(em.Credit) || 'Unknown',
    license: strip(em.LicenseShortName) || 'see page', page: info.descriptionurl, source: 'wikimedia-commons' });
}
console.log('\ncandidates:', cands.length);

const records = loadRecords();
const seen = new Set(records.map((r) => r.sha));
const used = new Set(records.map((r) => r.file));
let i = 100, ok = 0;
for (const c of cands) {
  let name; do { name = `wc-${c.slot}-${String(i++).padStart(3, '0')}.jpg`; } while (used.has(name));
  used.add(name);
  const res = await grabRetry(c, name, { seen });
  if (res.rec) { records.push(res.rec); ok++; console.log(`OK  ${name} ${res.rec.w}x${res.rec.h}  ${c.title.slice(0, 55)}`); saveRecords(records); }
  else console.log(`--  ${c.title.slice(0, 45)} :: ${res.skip}`);
  await sleep(1200);
}
saveRecords(records);
const cnt = {}; for (const r of records) cnt[r.slot] = (cnt[r.slot] || 0) + 1;
console.log(`\nnew=${ok} TOTAL ${records.length}`, JSON.stringify(cnt));
