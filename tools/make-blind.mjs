// Builds every blind A/B pair for a round: our piece shots vs the mapped Apple tiles.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SCRATCH = '/tmp/claude-0/-home-user-sveltia-cms-auth/1330c57c-df42-5ebc-aecf-14a4f255d383/scratchpad';
const round = Number(process.argv[2] || 1);
const only = process.argv[3] ? process.argv[3].split(',') : null;
const SHOTS = `${SCRATCH}/shots/r${round}`;
const OUT = `${SCRATCH}/blind/r${round}`;
const KEYS = `${SCRATCH}/blind-keys/r${round}`;
const map = JSON.parse(fs.readFileSync(`${SCRATCH}/ref/tile-map.json`, 'utf8')).matches;
const WIDTH = 1000;
const MAX_H = 2200;
// zonas a tapar (fracciones x,y,w,h) por pieza: marcas identificables
const MASKS = {
  nav: [[0.0, 0.0, 0.22, 0.34], [0.78, 0.0, 0.22, 0.34]],
  cart: [[0.0, 0.0, 0.22, 0.2], [0.78, 0.0, 0.22, 0.2]],
  footer: [[0.0, 0.0, 0.3, 0.08]],
};

const tilePath = (viewport, t) => `${SCRATCH}/ref/tiles-${viewport}/apple-${viewport}-full-${t}.png`;

async function refBuffer(piece, viewport) {
  const tiles = (map[piece]?.[viewport] || []).map((t) => tilePath(viewport, t)).filter((p) => fs.existsSync(p));
  if (!tiles.length) return null;
  const parts = await Promise.all(tiles.map((p) => sharp(p).resize({ width: WIDTH }).toBuffer()));
  const metas = await Promise.all(parts.map((b) => sharp(b).metadata()));
  const height = metas.reduce((s, m) => s + m.height, 0);
  let top = 0;
  const composites = parts.map((input, i) => { const c = { input, left: 0, top }; top += metas[i].height; return c; });
  return sharp({ create: { width: WIDTH, height, channels: 3, background: '#ffffff' } }).composite(composites).png().toBuffer();
}

async function normalize(buf, height, masks) {
  const meta = await sharp(buf).metadata();
  const h = Math.min(height, meta.height);
  let img = sharp(buf).extract({ left: 0, top: 0, width: WIDTH, height: h });
  if (masks?.length) {
    const overlays = masks.map(([x, y, w, hh]) => ({
      input: { create: { width: Math.max(4, Math.round(WIDTH * w)), height: Math.max(4, Math.round(h * hh)), channels: 3, background: '#9a9a9a' } },
      left: Math.round(WIDTH * x), top: Math.round(h * y),
    }));
    img = sharp(await img.png().toBuffer()).composite(overlays);
  }
  return img.png({ compressionLevel: 9 }).toBuffer();
}

const pieces = Object.keys(map).filter((p) => !only || only.includes(p));
const made = [];
for (const piece of pieces) {
  for (const viewport of ['desktop', 'mobile']) {
    const ourFile = path.join(SHOTS, `piece-${piece}-${viewport}.png`);
    if (!fs.existsSync(ourFile)) { made.push({ piece, viewport, skipped: 'sin captura nuestra' }); continue; }
    const ref = await refBuffer(piece, viewport);
    if (!ref) { made.push({ piece, viewport, skipped: 'sin tile de referencia' }); continue; }
    const ourBuf = await sharp(ourFile).resize({ width: WIDTH }).toBuffer();
    const hOurs = (await sharp(ourBuf).metadata()).height;
    const hRef = (await sharp(ref).metadata()).height;
    const H = Math.min(hOurs, hRef, MAX_H);
    const [a, b] = await Promise.all([normalize(ourBuf, H, MASKS[piece]), normalize(ref, H, MASKS[piece])]);
    // orden pseudoaleatorio pero determinista: depende de pieza, viewport y ronda
    // Misma asignación A/B en ambos viewports para que un solo crítico pueda juzgar los dos.
    const hash = [...`${piece}${round}`].reduce((s, c) => (s * 31 + c.charCodeAt(0)) % 9973, 7);
    const oursFirst = hash % 2 === 0;
    const dir = path.join(OUT, piece);
    fs.mkdirSync(dir, { recursive: true });
    fs.mkdirSync(KEYS, { recursive: true });
    await sharp(oursFirst ? a : b).toFile(path.join(dir, `A-${viewport}.png`));
    await sharp(oursFirst ? b : a).toFile(path.join(dir, `B-${viewport}.png`));
    fs.writeFileSync(path.join(KEYS, `${piece}.json`), JSON.stringify({ ours: oursFirst ? 'A' : 'B', piece, round }));
    made.push({ piece, viewport, dir, ours: oursFirst ? 'A' : 'B', size: `${WIDTH}x${H}` });
  }
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(made, null, 2));
console.log(JSON.stringify(made.filter((m) => m.skipped), null, 2));
console.log(`${made.filter((m) => m.dir).length} pares ciegos en ${OUT}`);
