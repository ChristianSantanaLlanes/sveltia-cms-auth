// Slices a full-page screenshot into overlapping viewport tiles for review.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const [src, outDir, tileHRaw] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const meta = await sharp(src).metadata();
const tileH = Number(tileHRaw || 900);
const step = Math.round(tileH * 0.92);
let i = 0;
for (let y = 0; y < meta.height; y += step) {
  const h = Math.min(tileH, meta.height - y);
  if (h < 120) break;
  const out = path.join(outDir, `${path.basename(src, '.png')}-t${String(i).padStart(2, '0')}.png`);
  await sharp(src).extract({ left: 0, top: y, width: meta.width, height: h }).resize({ width: Math.min(meta.width, 1100) }).png({ quality: 80, compressionLevel: 9 }).toFile(out);
  i++;
}
console.log(`${i} tiles from ${src} (${meta.width}x${meta.height})`);
