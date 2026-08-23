// Apply a manual visual-review decision map: {"file.jpg": "delete" | "<newslot>"}.
import fs from 'node:fs';
import path from 'node:path';

const OUT = '/tmp/katana-raw';
const CREDITS = path.join(OUT, 'credits.json');
const map = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let records = JSON.parse(fs.readFileSync(CREDITS, 'utf8'));
const out = [];
let deleted = 0, moved = 0;
for (const r of records) {
  const d = map[r.file];
  if (!d) { out.push(r); continue; }
  const p = path.join(OUT, r.file);
  if (d === 'delete') {
    if (fs.existsSync(p)) fs.unlinkSync(p);
    deleted++;
    continue;
  }
  const num = r.file.replace(/^[a-z]+-/, '');
  let target = `${d}-${num}`;
  let n = 1;
  while (fs.existsSync(path.join(OUT, target))) target = `${d}-${n++}${num}`;
  if (fs.existsSync(p)) fs.renameSync(p, path.join(OUT, target));
  out.push({ ...r, file: target, slot: d, reslotted_from: r.slot });
  moved++;
}
fs.writeFileSync(CREDITS, JSON.stringify(out, null, 2));
const c = {};
for (const r of out) c[r.slot] = (c[r.slot] || 0) + 1;
console.log(`deleted ${deleted}, reslotted ${moved}`);
console.log(c, 'total', out.length);
