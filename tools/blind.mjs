// Builds a blind A/B pair: our crop vs the reference crop, same width and height,
// optional masking of identifying marks. The answer key lands outside the critic's folder.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [ourPng, refPng, outDir, seedRaw, keyDir, maskSpec] = process.argv.slice(2);
const seed = Number(seedRaw || 0);
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(keyDir, { recursive: true });

const WIDTH = 1000;
const MAX_H = 2400;

// mask spec: "x,y,w,h;x,y,w,h" in fractions of width/height, applied to BOTH images
const masks = (maskSpec || '').split(';').filter(Boolean).map((s) => s.split(',').map(Number));

const norm = async (file, height) => {
  const buf = await sharp(file, { failOn: 'none' }).resize({ width: WIDTH }).toBuffer();
  const meta = await sharp(buf).metadata();
  const h = Math.min(height, meta.height);
  let img = sharp(buf).extract({ left: 0, top: 0, width: WIDTH, height: h });
  if (masks.length) {
    const overlays = masks.map(([x, y, w, hh]) => ({
      input: { create: { width: Math.max(2, Math.round(WIDTH * w)), height: Math.max(2, Math.round(h * hh)), channels: 3, background: '#8a8a8a' } },
      left: Math.round(WIDTH * x), top: Math.round(h * y),
    }));
    img = sharp(await img.png().toBuffer()).composite(overlays);
  }
  return img.png({ compressionLevel: 9 }).toBuffer();
};

const heightOf = async (f) => {
  const m = await sharp(f, { failOn: 'none' }).resize({ width: WIDTH }).toBuffer().then((b) => sharp(b).metadata());
  return m.height;
};
const H = Math.min(await heightOf(ourPng), await heightOf(refPng), MAX_H);

const [ours, ref] = await Promise.all([norm(ourPng, H), norm(refPng, H)]);
const oursFirst = seed % 2 === 0;
await sharp(oursFirst ? ours : ref).toFile(path.join(outDir, 'A.png'));
await sharp(oursFirst ? ref : ours).toFile(path.join(outDir, 'B.png'));
fs.writeFileSync(path.join(keyDir, `${path.basename(outDir)}.json`), JSON.stringify({ A: oursFirst ? 'ours' : 'reference', B: oursFirst ? 'reference' : 'ours', ourPng, refPng, height: H }, null, 2));
console.log(`blind ${path.basename(outDir)}: ${WIDTH}x${H} (${oursFirst ? 'A=ours' : 'B=ours'})`);
