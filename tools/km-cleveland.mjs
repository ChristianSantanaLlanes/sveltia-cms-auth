import { apiJson, grab, loadRecords, saveRecords, sleep, OUT } from './km-lib.mjs';

const QS = ['japanese sword','tsuba','sword guard','sword mounting','sword blade','sword hilt','katana','tachi','dagger japan','menuki','kozuka','scabbard japan'];
const seenId = new Map();
for (const q of QS) {
  for (const skip of [0,100,200,300]) {
    let o; try { o = await apiJson(`https://openaccess-api.clevelandart.org/api/artworks/?q=${encodeURIComponent(q)}&has_image=1&limit=100&skip=${skip}`); } catch { break; }
    const d = o.data||[]; if (!d.length) break;
    for (const a of d) if (!seenId.has(a.id)) seenId.set(a.id, a);
    await sleep(200);
  }
  console.log(`cle q="${q}" pool=${seenId.size}`);
}

const isJapan = (a) => /japan/i.test((a.culture||[]).join(' ') + ' ' + (a.title||''));
const BAD = /rapier|schiavona|smallsword|small sword|court sword|hunting sword|executioner|broadsword|partisan|mace|helmet|tulwar|barong|silapa|two-handed|hand-and-a-half|pillow sword|cavalry|cup from|parade sword|print|drawing|painting|netsuke|inro/i;

function slotFor(a) {
  const t = (a.title||'').toLowerCase();
  const w = +a.images.print.width, h = +a.images.print.height, ar = w/h;
  if (/sword guard|tsuba/.test(t)) return 'tsuba';
  if (/fuchi|kashira|menuki|hilt collar|hilt pommel|hilt/.test(t)) return 'tsuka';
  if (/scabbard|saya|sheath/.test(t)) return 'saya';
  if (/mounting|koshirae|sword and scabbard/.test(t)) return ar > 2.2 ? 'hero' : 'product';
  if (/blade|katana|tachi|wakizashi|tanto|sword/.test(t)) return ar > 2.5 ? 'hero' : 'product';
  return 'detail';
}

const cands = [];
for (const a of seenId.values()) {
  if (a.type !== 'Arms and Armor' && a.type !== 'Metalwork' && a.type !== 'Lacquer') continue;
  if (a.share_license_status !== 'CC0') continue;
  if (!a.images?.print) continue;
  if (+a.images.print.width < 2000) continue;
  if (!isJapan(a)) continue;
  if (BAD.test(a.title||'')) continue;
  cands.push({ slot: slotFor(a), url: a.images.print.url, title: a.title,
    creator: (a.creators||[]).map(c=>c.description).join('; ') || 'Unknown, Japan',
    license: 'CC0', page: a.url, source: 'clevelandart' });
}
const bySlot = {}; for (const c of cands) (bySlot[c.slot] ||= []).push(c);
console.log('candidates by slot:', Object.fromEntries(Object.entries(bySlot).map(([k,v])=>[k,v.length])));

// Cap tsuba so it doesn't drown everything else
const CAPS = { tsuba: 22, tsuka: 14, hero: 40, product: 40, saya: 12, detail: 12 };
const picked = [];
for (const [s, list] of Object.entries(bySlot)) picked.push(...list.slice(0, CAPS[s] ?? 10));

const records = loadRecords();
const seen = new Set(records.map(r=>r.sha));
const used = new Set(records.map(r=>r.file));
let i = 0;
for (const c of picked) {
  let name; do { name = `cle-${c.slot}-${String(i++).padStart(3,'0')}.jpg`; } while (used.has(name));
  used.add(name);
  const res = await grab(c, name, { seen });
  if (res.rec) { records.push(res.rec); console.log(`OK  ${name} ${res.rec.w}x${res.rec.h} ${c.title.slice(0,50)}`); }
  else console.log(`--  ${c.title.slice(0,45)} :: ${res.skip}`);
}
saveRecords(records);
const cnt = {}; for (const r of records) cnt[r.slot]=(cnt[r.slot]||0)+1;
console.log('\nTOTAL', records.length, JSON.stringify(cnt));
