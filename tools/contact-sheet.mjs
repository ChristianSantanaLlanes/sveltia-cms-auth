// Build one labelled contact sheet per slot so the images can be reviewed visually.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const OUT = '/tmp/katana-raw';
const SHEETS = path.join(OUT, 'sheets');
fs.mkdirSync(SHEETS, { recursive: true });
let records = JSON.parse(fs.readFileSync(path.join(OUT, 'credits.json'), 'utf8'));
for (const shard of fs.readdirSync(OUT).filter((f) => /^credits-.*\.json$/.test(f))) {
  const known = new Set(records.map((r) => r.file));
  for (const r of JSON.parse(fs.readFileSync(path.join(OUT, shard), 'utf8'))) if (!known.has(r.file)) records.push(r);
}
records = records.filter((r) => fs.existsSync(path.join(OUT, r.file)));
const slots = process.argv.slice(2).length ? process.argv.slice(2) : [...new Set(records.map((r) => r.slot))];
const CELL = 260, COLS = 5, LABEL = 22;

for (const slot of slots) {
  const rs = records.filter((r) => r.slot === slot);
  if (!rs.length) continue;
  const rows = Math.ceil(rs.length / COLS);
  const W = COLS * CELL, H = rows * (CELL + LABEL);
  const comps = [];
  for (let i = 0; i < rs.length; i++) {
    const x = (i % COLS) * CELL, y = Math.floor(i / COLS) * (CELL + LABEL);
    const p = path.join(OUT, rs[i].file);
    try {
      const buf = await sharp(p).resize(CELL - 8, CELL - 8, { fit: 'contain', background: '#111' }).jpeg().toBuffer();
      comps.push({ input: buf, left: x + 4, top: y + 4 });
    } catch { continue; }
    const label = rs[i].file.replace(/\.(jpg|png)$/, '');
    const svg = `<svg width="${CELL}" height="${LABEL}"><rect width="100%" height="100%" fill="#000"/><text x="4" y="15" font-family="monospace" font-size="13" fill="#fff">${label}</text></svg>`;
    comps.push({ input: Buffer.from(svg), left: x, top: y + CELL });
  }
  const out = path.join(SHEETS, `${slot}.png`);
  await sharp({ create: { width: W, height: H, channels: 3, background: '#222' } }).composite(comps).png().toFile(out);
  console.log(out, rs.length, 'images');
}
