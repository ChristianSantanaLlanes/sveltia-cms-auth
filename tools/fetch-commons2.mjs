// Wikimedia Commons harvest: file search + real category discovery. Polite rate limiting.
import { apiJson, download, loadRecords, saveRecords, counts, nextNamer, hashIndex, sleep } from './lib-fetch.mjs';

const WANT = { hamon: 14, forge: 14, saya: 14, display: 14, detail: 14, tsuka: 14 };
const API = 'https://commons.wikimedia.org/w/api.php';
const GAP = 1400;

const SEARCHES = {
  hamon: ['hamon katana blade', 'hamon nihonto', 'japanese sword blade detail', 'kissaki', 'jihada hada sword', 'katana blade closeup', 'nihonto blade polished'],
  forge: ['japanese swordsmith forging', 'katana forging', 'tatara tamahagane', 'swordsmith japan hammer', 'blacksmith forging sparks anvil', 'japanese blacksmith workshop', 'sword forge fire'],
  saya: ['katana saya scabbard', 'japanese sword scabbard lacquer', 'koshirae mounting sword', 'urushi lacquer scabbard', 'wakizashi koshirae'],
  display: ['katanakake sword stand', 'japanese sword museum display', 'katana on stand', 'nihonto exhibition museum', 'samurai sword display case'],
  detail: ['togishi sword polisher', 'japanese sword polishing', 'menuki', 'fuchi kashira', 'habaki', 'seppa sword fitting', 'japanese sword fittings detail'],
  tsuka: ['tsuka japanese sword hilt', 'tsukamaki ito wrap', 'katana handle same skin', 'japanese sword grip ray skin', 'samurai sword hilt wrap'],
};
const CAT_SEEDS = {
  hamon: ['Hamon', 'Japanese sword blades', 'Kissaki'],
  forge: ['Japanese swordsmithing', 'Swordsmiths', 'Tatara', 'Blacksmiths at work', 'Forging'],
  saya: ['Saya', 'Koshirae', 'Scabbards', 'Urushi'],
  display: ['Katanakake', 'Japanese swords in museums', 'Swords in museums'],
  detail: ['Menuki', 'Fuchi', 'Kashira', 'Habaki', 'Japanese sword mountings', 'Sword polishing'],
  tsuka: ['Tsuka', 'Japanese sword hilts', 'Tsukamaki', 'Same (ray skin)'],
};
const BAD = /\.(svg|pdf|tif|djvu|ogv|webm|gif)$/i;
const BADTXT = /drawing|illustration|woodblock|ukiyo|print|map|diagram|logo|icon|coat of arms|scan|page |manuscript|book|text|chart|graph|font|poster|painting|sketch|engraving|cartoon|anime|manga|cosplay|toy|replica plastic|screenshot/i;

const records = loadRecords();
const seenUrl = new Set(records.map((r) => r.url));
const hashes = hashIndex(records);
const name = nextNamer(records, 4000);
const have = counts(records);
const fails = [];

function usable(p) {
  const info = p.imageinfo?.[0];
  if (!info || !/image\/(jpeg|png)/.test(info.mime || '')) return null;
  if (info.width < 1400) return null;
  if (BAD.test(p.title) || BADTXT.test(p.title)) return null;
  return info;
}

async function take(slot, pages, tag) {
  let added = 0;
  for (const p of pages) {
    if ((have[slot] || 0) >= WANT[slot]) break;
    const info = usable(p);
    if (!info) continue;
    const src = info.thumburl || info.url;
    if (seenUrl.has(src) || seenUrl.has(info.url)) continue;
    seenUrl.add(src);
    const ext = /\.png$/i.test(info.url) ? '.png' : '.jpg';
    const cand = { slot, src: 'commons', url: src, w: info.thumbwidth || info.width, h: info.thumbheight || info.height,
      title: p.title, creator: info.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, '').slice(0, 80),
      license: info.extmetadata?.LicenseShortName?.value, page: info.descriptionurl, via: tag };
    if (/^(GFDL|CC BY-NC|CC BY-ND|Fair use|non-free)/i.test(cand.license || '')) continue;
    try {
      const rec = await download(cand, name(slot, ext), { seenHashes: hashes });
      if (rec) { records.push(rec); have[slot] = (have[slot] || 0) + 1; added++; console.log(`cw ${slot} <- ${rec.file} ${(rec.bytes/1024|0)}KB ${p.title.slice(0,60)}`); }
    } catch {}
    await sleep(400);
  }
  return added;
}

// --- pass 1: file search ---
for (const [slot, qs] of Object.entries(SEARCHES)) {
  for (const q of qs) {
    if ((have[slot] || 0) >= WANT[slot]) break;
    const url = `${API}?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrnamespace=6&gsrlimit=30&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=2400`;
    let j;
    try { j = await apiJson(url, { tries: 6, base: 4000 }); } catch (e) { fails.push(`commons search "${q}": ${e.message.slice(0,60)}`); continue; }
    await sleep(GAP);
    const n = await take(slot, Object.values(j.query?.pages || {}), `search:${q}`);
    console.log(`search "${q}" (${slot}) +${n} -> ${have[slot] || 0}`);
  }
}
saveRecords(records);

// --- pass 2: discover real categories, then pull members ---
const catsFor = {};
for (const [slot, seeds] of Object.entries(CAT_SEEDS)) {
  if ((have[slot] || 0) >= WANT[slot]) continue;
  catsFor[slot] = [];
  for (const seed of seeds) {
    const url = `${API}?action=query&format=json&list=search&srsearch=${encodeURIComponent(seed)}&srnamespace=14&srlimit=8`;
    let j;
    try { j = await apiJson(url, { tries: 5, base: 4000 }); } catch (e) { fails.push(`commons catsearch "${seed}": ${e.message.slice(0,60)}`); continue; }
    await sleep(GAP);
    for (const s of j.query?.search || []) catsFor[slot].push(s.title);
  }
  catsFor[slot] = [...new Set(catsFor[slot])];
  console.log(`categories for ${slot}:`, catsFor[slot].join(' | '));
}

for (const [slot, cats] of Object.entries(catsFor)) {
  for (const cat of cats) {
    if ((have[slot] || 0) >= WANT[slot]) break;
    const url = `${API}?action=query&format=json&generator=categorymembers&gcmtitle=${encodeURIComponent(cat)}&gcmtype=file&gcmlimit=40&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=2400`;
    let j;
    try { j = await apiJson(url, { tries: 5, base: 4000 }); } catch (e) { fails.push(`commons cat "${cat}": ${e.message.slice(0,60)}`); continue; }
    await sleep(GAP);
    const n = await take(slot, Object.values(j.query?.pages || {}), `cat:${cat}`);
    console.log(`cat ${cat} (${slot}) +${n} -> ${have[slot] || 0}`);
  }
}
saveRecords(records);
console.log('FINAL', counts(records), 'total', records.length);
if (fails.length) console.log('FAILS:\n' + fails.join('\n'));
