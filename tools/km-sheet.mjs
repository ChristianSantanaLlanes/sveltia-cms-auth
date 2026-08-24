// Contact sheets for this agent's set. contact-sheet.mjs was rewritten by the other
// agent to hardcode /tmp/katana-raw and ignore argv, so this keeps arg support.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const RAW = process.argv[2] || '/tmp/katana-museum';
const OUT = process.argv[3] || '/tmp/katana-museum-sheets';
fs.mkdirSync(OUT, { recursive: true });
let records = JSON.parse(fs.readFileSync(path.join(RAW, 'credits.json'), 'utf8'))
  .filter((r) => fs.existsSync(path.join(RAW, r.file)));
const bySlot = {};
for (const r of records) (bySlot[r.slot] ||= []).push(r);
const CELL = 300, COLS = 5, LABEL = 24;
for (const [slot, rs] of Object.entries(bySlot)) {
  const rows = Math.ceil(rs.length / COLS);
  const W = COLS * CELL, H = rows * (CELL + LABEL);
  const comps = [];
  for (let i = 0; i < rs.length; i++) {
    const x = (i % COLS) * CELL, y = Math.floor(i / COLS) * (CELL + LABEL);
    try {
      const buf = await sharp(path.join(RAW, rs[i].file))
        .resize(CELL - 8, CELL - 8, { fit: 'contain', background: '#151515' }).jpeg({ quality: 88 }).toBuffer();
      comps.push({ input: buf, left: x + 4, top: y + 4 });
    } catch { continue; }
    const lab = `${rs[i].file.replace(/\.jpg$/, '')} ${rs[i].w}x${rs[i].h}`;
    comps.push({ input: Buffer.from(`<svg width="${CELL}" height="${LABEL}"><rect width="100%" height="100%" fill="#000"/><text x="4" y="17" font-family="monospace" font-size="12" fill="#0f0">${lab}</text></svg>`), left: x, top: y + CELL });
  }
  const out = path.join(OUT, `sheet-${slot}.png`);
  await sharp({ create: { width: W, height: H, channels: 3, background: '#222' } }).composite(comps).png({ compressionLevel: 9 }).toFile(out);
  console.log(`${slot}: ${rs.length} -> ${out}`);
}
