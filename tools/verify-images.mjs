// Merge harvest shards, verify every file with sharp, drop corrupt/undersized new files.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const OUT = '/tmp/katana-raw';
const CREDITS = path.join(OUT, 'credits.json');
// Files harvested before this session are numbered below 2000; report on them but never delete
// them for being small — only for being unreadable.
const isLegacy = (f) => Number((f.match(/-(\d+)\./) || [])[1] || 0) < 2000;

let records = JSON.parse(fs.readFileSync(CREDITS, 'utf8'));
// merge shards
for (const shard of fs.readdirSync(OUT).filter((f) => /^credits-.*\.json$/.test(f))) {
  const extra = JSON.parse(fs.readFileSync(path.join(OUT, shard), 'utf8'));
  const known = new Set(records.map((r) => r.file));
  for (const r of extra) if (!known.has(r.file)) { records.push(r); known.add(r.file); }
  console.log(`merged ${shard}: +${extra.length} candidates`);
}

// dedupe identical bytes across sources
const bySha = new Map();
const dupes = [];
for (const r of records) {
  if (!r.sha) continue;
  if (bySha.has(r.sha) && bySha.get(r.sha) !== r.file) dupes.push(r.file);
  else bySha.set(r.sha, r.file);
}

const removed = [];
const kept = [];
const report = [];
for (const r of records) {
  const p = path.join(OUT, r.file);
  if (!fs.existsSync(p)) { removed.push([r.file, 'missing file']); continue; }
  if (dupes.includes(r.file)) { fs.unlinkSync(p); removed.push([r.file, 'duplicate bytes']); continue; }
  const bytes = fs.statSync(p).size;
  try {
    const m = await sharp(p).metadata();
    if (!m.width || !m.height) throw new Error('no dimensions');
    await sharp(p).resize(64).toBuffer(); // forces a real decode
    const strict = !isLegacy(r.file);
    if (strict && (m.width < 1400 || bytes < 120_000)) {
      fs.unlinkSync(p); removed.push([r.file, `too small ${m.width}x${m.height} ${(bytes/1024|0)}KB`]); continue;
    }
    r.w = m.width; r.h = m.height; r.bytes = bytes; r.format = m.format;
    kept.push(r);
    report.push(`${r.file}\t${m.width}x${m.height}\t${(bytes/1024|0)}KB\t${r.slot}\t${r.src}`);
  } catch (e) {
    fs.unlinkSync(p); removed.push([r.file, 'corrupt: ' + e.message.slice(0, 60)]);
  }
}

// orphan files on disk with no credit record
const known = new Set(kept.map((r) => r.file));
for (const f of fs.readdirSync(OUT)) {
  if (/\.json$/.test(f)) continue;                                   // credits + review maps
  if (fs.statSync(path.join(OUT, f)).isDirectory()) continue;        // contact sheets
  if (!known.has(f)) { fs.unlinkSync(path.join(OUT, f)); removed.push([f, 'orphan (no credit record)']); }
}

fs.writeFileSync(CREDITS, JSON.stringify(kept, null, 2));
for (const shard of fs.readdirSync(OUT).filter((f) => /^credits-.*\.json$/.test(f))) fs.unlinkSync(path.join(OUT, shard));

const counts = {};
for (const r of kept) counts[r.slot] = (counts[r.slot] || 0) + 1;
console.log(report.join('\n'));
console.log('\nREMOVED:', removed.length);
for (const [f, why] of removed) console.log('  -', f, why);
console.log('\nCOUNTS', counts, 'total', kept.length);
