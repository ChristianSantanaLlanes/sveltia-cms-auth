import { apiJson, grabRetry, loadRecords, saveRecords, sleep } from './km-lib.mjs';

const QS = ['katana','japanese sword','tsuba','wakizashi','tachi','koshirae','sword mounting japan','saya scabbard japan','tsuka hilt japan','sword blade japan','menuki','fuchi kashira'];
const pool = new Map();
for (const q of QS) {
  for (let page = 1; page <= 3; page++) {
    let o;
    try { o = await apiJson(`https://api.vam.ac.uk/v2/objects/search?q=${encodeURIComponent(q)}&images_exist=1&page_size=100&page=${page}&q_place_name=Japan`); } catch { break; }
    const rs = o.records || []; if (!rs.length) break;
    for (const r of rs) if (!pool.has(r.systemNumber)) pool.set(r.systemNumber, r);
    await sleep(400);
    if (rs.length < 100) break;
  }
  console.log(`vam "${q}" pool=${pool.size}`);
}

const BAD = /print|woodblock|ukiyo|netsuke|inro|painting|drawing|book|photograph of|ceramic|textile|kimono|robe|fan |screen|scroll|bowl|vase|teapot|European|rapier|smallsword/i;
function slotFor(r) {
  const t = `${r.objectType||''} ${r._primaryTitle||''}`.toLowerCase();
  if (/tsuba|sword guard/.test(t)) return 'tsuba';
  if (/menuki|fuchi|kashira|tsuka|hilt|grip|handle/.test(t)) return 'tsuka';
  if (/saya|scabbard|sheath/.test(t)) return 'saya';
  if (/sword and scabbard|mounting|koshirae|sword set|daisho/.test(t)) return 'hero';
  if (/blade/.test(t)) return 'hamon';
  if (/sword|katana|wakizashi|tachi|tanto|dagger/.test(t)) return 'product';
  return 'detail';
}
const cands = [];
for (const r of pool.values()) {
  const id = r._primaryImageId; if (!id) continue;
  const label = `${r.objectType||''} ${r._primaryTitle||''}`;
  if (BAD.test(label)) continue;
  if (!/japan/i.test(r._primaryPlace || '')) continue;
  cands.push({ slot: slotFor(r), url: `https://framemark.vam.ac.uk/collections/${id}/full/full/0/default.jpg`,
    title: (r._primaryTitle || r.objectType || 'Japanese sword') + ` (${r.accessionNumber})`,
    creator: r._primaryMaker?.name || 'Unknown', license: 'V&A image — public domain / open access',
    page: `https://collections.vam.ac.uk/item/${r.systemNumber}/`, source: 'vam' });
}
const bySlot = {}; for (const c of cands) (bySlot[c.slot] ||= []).push(c);
console.log('cands by slot:', Object.fromEntries(Object.entries(bySlot).map(([k,v])=>[k,v.length])));

const CAPS = { hero: 40, product: 40, hamon: 20, tsuba: 12, tsuka: 12, saya: 12, detail: 8, display: 8 };
const picked = []; for (const [s,l] of Object.entries(bySlot)) picked.push(...l.slice(0, CAPS[s] ?? 8));

const records = loadRecords();
const seen = new Set(records.map(r=>r.sha)); const used = new Set(records.map(r=>r.file));
let i = 0, ok = 0;
for (const c of picked) {
  let name; do { name = `vam-${c.slot}-${String(i++).padStart(3,'0')}.jpg`; } while (used.has(name));
  used.add(name);
  const res = await grabRetry(c, name, { seen, minBytes: 60_000 });
  if (res.rec) { records.push(res.rec); ok++; console.log(`OK  ${name} ${res.rec.w}x${res.rec.h}  ${c.title.slice(0,55)}`); saveRecords(records); }
  else console.log(`--  ${c.title.slice(0,45)} :: ${res.skip}`);
  await sleep(250);
}
saveRecords(records);
const cnt={}; for(const r of records) cnt[r.slot]=(cnt[r.slot]||0)+1;
console.log(`\nvam new=${ok} TOTAL ${records.length}`, JSON.stringify(cnt));
