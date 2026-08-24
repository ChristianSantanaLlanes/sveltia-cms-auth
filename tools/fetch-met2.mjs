// Focused Met pull for the slots that stayed weak: katanakake stands, hilts, fittings, koshirae.
import { apiJson, download, loadRecords, saveRecords, counts, nextNamer, hashIndex, sleep } from './lib-fetch.mjs';

const WANT = JSON.parse(process.env.WANT || '{"display":24,"tsuka":24,"detail":24,"saya":24}');
const QUERIES = [
  { q: 'sword stand japanese lacquer', slot: 'display' },
  { q: 'katana kake sword rack', slot: 'display' },
  { q: 'japanese sword grip tsuka', slot: 'tsuka' },
  { q: 'sword hilt japanese lacquer', slot: 'tsuka' },
  { q: 'japanese sword hilt collar', slot: 'detail' },
  { q: 'menuki sword grip ornaments', slot: 'detail' },
  { q: 'japanese scabbard lacquer', slot: 'saya' },
  { q: 'koshirae mounting katana', slot: 'saya' },
];
const records = loadRecords();
const seenUrl = new Set(records.map((r) => r.url));
const hashes = hashIndex(records);
const name = nextNamer(records, 7000);
const have = counts(records);
const fails = [];
const BADT = /smallsword|rapier|European|hunting sword|firearm|revolver|rifle|pistol|helmet|armor for|saddle|stirrup/i;

for (const { q, slot } of QUERIES) {
  if ((have[slot] || 0) >= WANT[slot]) continue;
  let s;
  try { s = await apiJson(`https://collectionapi.metmuseum.org/public/collection/v1/search?q=${encodeURIComponent(q)}&hasImages=true`); }
  catch (e) { fails.push(`met2 "${q}": ${e.message.slice(0, 60)}`); continue; }
  let added = 0, scanned = 0;
  for (const id of (s.objectIDs || []).slice(0, 120)) {
    if ((have[slot] || 0) >= WANT[slot]) break;
    let o;
    try { o = await apiJson(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`, { tries: 3, base: 800 }); } catch { continue; }
    scanned++;
    if (!o.isPublicDomain || !o.primaryImage) continue;
    const t = `${o.title || ''} ${o.objectName || ''}`.replace(/<[^>]+>/g, '');
    if (!/japan/i.test(`${o.culture} ${t}`)) continue;
    if (BADT.test(`${t} ${o.culture}`)) continue;
    // keep only objects whose own name matches the slot we are filling
    const ok = {
      display: /stand|rack|kake|mounting for/i,
      tsuka: /hilt|grip|tsuka/i,
      detail: /menuki|fuchi|kashira|habaki|seppa|collar|pommel|ornament|kozuka|kogai/i,
      saya: /scabbard|saya|koshirae|mounting/i,
    }[slot];
    if (!ok.test(t)) continue;
    if (seenUrl.has(o.primaryImage)) continue;
    seenUrl.add(o.primaryImage);
    const cand = { slot, src: 'met', url: o.primaryImage, title: t, creator: o.artistDisplayName || 'Unknown (Japanese)',
      license: 'CC0 1.0 (Met Open Access)', page: o.objectURL, credit: o.creditLine, via: `met2:${q}` };
    try {
      const rec = await download(cand, name(slot, '.jpg'), { seenHashes: hashes });
      if (rec) { records.push(rec); have[slot] = (have[slot] || 0) + 1; added++; console.log(`met2 ${slot} <- ${rec.file} ${(rec.bytes/1024|0)}KB ${t.slice(0,55)}`); }
    } catch {}
    await sleep(120);
  }
  console.log(`met2 "${q}" (${slot}) scanned ${scanned} +${added} -> ${have[slot] || 0}`);
  saveRecords(records);
}
saveRecords(records);
console.log('FINAL', counts(records), 'total', records.length);
if (fails.length) console.log('FAILS:\n' + fails.join('\n'));
