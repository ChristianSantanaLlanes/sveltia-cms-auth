// Harvest public-domain Japanese sword photography from the Met + Art Institute of Chicago.
import { apiJson, download, loadRecords, saveRecords, counts, nextNamer, hashIndex, sleep } from './lib-fetch.mjs';

const WANT = { hamon: 12, forge: 12, saya: 12, display: 12, detail: 12, tsuka: 12 };
const MET_CAP = { hamon: 5, saya: 8, display: 8, detail: 8, tsuka: 8 }; // leave room for other sources

const records = loadRecords();
const seenUrl = new Set(records.map((r) => r.url));
const hashes = hashIndex(records);
const name = nextNamer(records, 2000);
const have = counts(records);
const metAdded = {};

function classify(o) {
  const t = `${o.title || ''} ${o.objectName || ''}`.replace(/<[^>]+>/g, '');
  if (/tsuba|sword guard/i.test(t)) return null;            // already well covered
  if (/kozuka|menuki|fuchi|kashira|habaki|seppa|mekugi|kojiri|kurikata|kogai|fitting/i.test(t)) return 'detail';
  if (/hilt|grip|tsuka|pommel/i.test(t)) return 'tsuka';
  if (/blade and mounting|blades and mounting|koshirae|mounting for/i.test(t)) return 'display';
  if (/scabbard|saya/i.test(t)) return 'saya';
  if (/^blade|blade for/i.test(t)) return 'hamon';
  if (/katana|tachi|wakizashi|tant[oō]|daish[oō]|sword/i.test(t)) return 'display';
  return null;
}

function isJapanese(o) {
  const s = `${o.culture || ''} ${o.title || ''} ${o.objectName || ''} ${o.artistDisplayName || ''}`;
  return /japan/i.test(s) || /katana|tachi|wakizashi|tant[oō]|tsuka|saya|koshirae|kozuka|menuki|fuchi|kashira|habaki|daish[oō]/i.test(s);
}

// ---------- Met ----------
const MET_QUERIES = [
  'japanese sword mounting', 'japanese sword hilt', 'japanese sword blade',
  'japanese sword fittings', 'scabbard japanese sword', 'japanese dagger scabbard',
  'japanese sword grip', 'blade and mounting katana',
];
const metIds = [];
const metSeen = new Set();
for (const q of MET_QUERIES) {
  try {
    const s = await apiJson(`https://collectionapi.metmuseum.org/public/collection/v1/search?q=${encodeURIComponent(q)}&hasImages=true`);
    for (const id of (s.objectIDs || []).slice(0, 220)) if (!metSeen.has(id)) { metSeen.add(id); metIds.push(id); }
    console.log(`met query "${q}": ${s.total} hits`);
  } catch (e) { console.log('MET SEARCH FAIL', q, e.message.slice(0, 80)); }
}
console.log('met candidate objects:', metIds.length);

let scanned = 0;
for (const id of metIds) {
  const done = Object.keys(MET_CAP).every((s) => (metAdded[s] || 0) >= MET_CAP[s] || (have[s] || 0) >= WANT[s]);
  if (done) break;
  let o;
  try { o = await apiJson(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`, { tries: 3, base: 800 }); }
  catch { continue; }
  scanned++;
  if (!o.isPublicDomain || !o.primaryImage || !isJapanese(o)) continue;
  const slot = classify(o);
  if (!slot || !MET_CAP[slot]) continue;
  if ((metAdded[slot] || 0) >= MET_CAP[slot]) continue;
  if ((have[slot] || 0) >= WANT[slot]) continue;
  if (seenUrl.has(o.primaryImage)) continue;
  seenUrl.add(o.primaryImage);
  const cand = {
    slot, src: 'met', url: o.primaryImage,
    title: (o.title || '').replace(/<[^>]+>/g, ''),
    creator: o.artistDisplayName || 'Unknown (Japanese)',
    license: 'CC0 1.0 (Met Open Access)', page: o.objectURL, credit: o.creditLine,
  };
  try {
    const rec = await download(cand, name(slot, '.jpg'), { seenHashes: hashes });
    if (rec) {
      records.push(rec);
      have[slot] = (have[slot] || 0) + 1;
      metAdded[slot] = (metAdded[slot] || 0) + 1;
      console.log(`met ${slot} <- ${rec.file} ${(rec.bytes/1024|0)}KB ${cand.title.slice(0,50)}`);
    }
  } catch {}
  await sleep(120);
}
console.log('met scanned', scanned, 'counts', counts(records));
saveRecords(records);

// ---------- Art Institute of Chicago ----------
const ARTIC_QUERIES = [
  { q: 'sword mounting japan', slots: ['saya', 'display'] },
  { q: 'sword guard fittings japan', slots: ['detail'] },
  { q: 'katana', slots: ['display', 'hamon'] },
  { q: 'sword hilt japan', slots: ['tsuka'] },
  { q: 'scabbard japan', slots: ['saya'] },
  { q: 'sword blade japan', slots: ['hamon', 'display'] },
];
const FIELDS = 'id,title,image_id,is_public_domain,artist_title,classification_title,department_title,medium_display,date_display';
for (const { q, slots } of ARTIC_QUERIES) {
  if (slots.every((s) => (have[s] || 0) >= WANT[s])) continue;
  let j;
  try {
    j = await apiJson(`https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(q)}&limit=60&fields=${FIELDS}`);
  } catch (e) { console.log('ARTIC FAIL', q, e.message.slice(0, 80)); continue; }
  for (const a of j.data || []) {
    if (!a.is_public_domain || !a.image_id) continue;
    const t = `${a.title || ''} ${a.classification_title || ''} ${a.department_title || ''} ${a.medium_display || ''}`;
    if (!/japan|katana|tsuba|tsuka|saya|koshirae|sword|blade|scabbard/i.test(t)) continue;
    if (/print|woodblock|painting|drawing|scroll|screen|book|textile|ceramic|photograph of|netsuke/i.test(t)) continue;
    const slot = classify({ title: a.title, objectName: a.classification_title }) || slots[0];
    if (!WANT[slot] || (have[slot] || 0) >= WANT[slot]) continue;
    const url = `https://www.artic.edu/iiif/2/${a.image_id}/full/2400,/0/default.jpg`;
    if (seenUrl.has(url)) continue;
    seenUrl.add(url);
    const cand = { slot, src: 'artic', url, title: a.title, creator: a.artist_title || 'Unknown (Japanese)',
      license: 'CC0 1.0 (AIC Public Domain)', page: `https://www.artic.edu/artworks/${a.id}` };
    try {
      const rec = await download(cand, name(slot, '.jpg'), { seenHashes: hashes });
      if (rec) { records.push(rec); have[slot] = (have[slot] || 0) + 1; console.log(`artic ${slot} <- ${rec.file} ${a.title?.slice(0,50)}`); }
    } catch {}
    await sleep(150);
  }
}
saveRecords(records);
console.log('FINAL', counts(records), 'total', records.length);
