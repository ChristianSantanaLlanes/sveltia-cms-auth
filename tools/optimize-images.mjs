// Turns curated raw photos into responsive AVIF/WebP/JPEG sets under site/src/static/img.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const mapPath = process.argv[2] || new URL('./image-map.json', import.meta.url).pathname;
const OUT = process.argv[3] || new URL('../site/src/static/img', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const inventory = [];

for (const item of map) {
  const { name, src, widths = [640, 1024, 1600], ratio, position = 'attention', fallbackWidth } = item;
  if (!fs.existsSync(src)) { console.log(`MISSING ${src}`); continue; }
  const base = sharp(src, { failOn: 'none' }).rotate();
  const meta = await base.metadata();
  // Fondo dominante: media de una esquina, para encajar sin bandas de color falso.
  const strip = async (region) => (await sharp(src, { failOn: 'none' }).rotate().extract(region).stats()).channels.map((c) => c.mean);
  const S = 10;
  const strips = await Promise.all([
    strip({ left: 0, top: 0, width: meta.width, height: S }),
    strip({ left: 0, top: meta.height - S, width: meta.width, height: S }),
    strip({ left: 0, top: 0, width: S, height: meta.height }),
    strip({ left: meta.width - S, top: 0, width: S, height: meta.height }),
  ]);
  const median = (arr) => { const a = [...arr].sort((x, y) => x - y); return (a[1] + a[2]) / 2; };
  const bg = item.background || {
    r: Math.round(median(strips.map((v) => v[0]))),
    g: Math.round(median(strips.map((v) => v[1]))),
    b: Math.round(median(strips.map((v) => v[2]))),
  };
  for (const w of widths) {
    const h = ratio ? Math.round(w / ratio) : null;
    const fit = item.fit || 'cover';
    const inner = item.pad ? Math.round(w * (1 - item.pad * 2)) : w;
    const innerH = h ? (item.pad ? Math.round(h * (1 - item.pad * 2)) : h) : null;
    const resize = h
      ? { width: inner, height: innerH, fit, position, background: bg, withoutEnlargement: false, kernel: 'lanczos3' }
      : { width: inner, fit: 'inside', withoutEnlargement: false, kernel: 'lanczos3' };
    const pipe = () => {
      let p = sharp(src, { failOn: 'none' }).rotate();
      // Fondos de museo casi blancos: los llevamos a blanco puro para que las seis fichas
      // compartan exactamente el mismo fondo y el relleno no deje costura.
      if (item.whiten) {
        const lift = Math.min(1.3, 255 / Math.max(200, (bg.r + bg.g + bg.b) / 3));
        p = p.linear(lift, -(lift - 1) * 8);
      }
      if (item.rotate) p = p.rotate(item.rotate, { background: item.whiten ? '#ffffff' : bg });
      p = p.resize(resize);
      if (item.pad && h) p = p.extend({ top: Math.round((h - innerH) / 2), bottom: h - innerH - Math.round((h - innerH) / 2), left: Math.round((w - inner) / 2), right: w - inner - Math.round((w - inner) / 2), background: item.whiten ? '#ffffff' : bg, extendWith: item.whiten ? 'background' : 'copy' });
      return w <= 900 ? p.sharpen({ sigma: 0.4 }) : p;
    };
    await pipe().avif({ quality: item.avifQuality ?? 44, effort: 4, chromaSubsampling: '4:2:0' }).toFile(path.join(OUT, `${name}-${w}.avif`));
    await pipe().webp({ quality: item.webpQuality ?? 70, effort: 5 }).toFile(path.join(OUT, `${name}-${w}.webp`));
    if (w === (fallbackWidth || widths[widths.length - 1])) {
      await pipe().jpeg({ quality: 76, mozjpeg: true, progressive: true }).toFile(path.join(OUT, `${name}-${w}.jpg`));
    }
  }
  // Tiny blurred placeholder as a data URI (for progressive backgrounds).
  let lqipPipe = sharp(src, { failOn: 'none' }).rotate();
  if (item.rotate) lqipPipe = lqipPipe.rotate(item.rotate, { background: bg });
  const lqip = await lqipPipe.resize({ width: 24, ...(ratio ? { height: Math.round(24 / ratio), fit: item.fit || 'cover', position, background: bg } : {}) }).blur(1.2).webp({ quality: 40 }).toBuffer();
  const sizes = {};
  for (const w of widths) {
    const h = ratio ? Math.round(w / ratio) : null;
    sizes[w] = { avif: fs.statSync(path.join(OUT, `${name}-${w}.avif`)).size, webp: fs.statSync(path.join(OUT, `${name}-${w}.webp`)).size, h };
  }
  inventory.push({ name, source: src, srcW: meta.width, srcH: meta.height, ratio: ratio || +(meta.width / meta.height).toFixed(3), widths, sizes, lqip: `data:image/webp;base64,${lqip.toString('base64')}`, credit: item.credit || null, alt: item.alt || '' });
  console.log(`${name}: ${widths.map((w) => `${w}px ${(sizes[w].avif / 1024).toFixed(0)}kB avif`).join(', ')}`);
}
fs.writeFileSync(path.join(OUT, 'inventory.json'), JSON.stringify(inventory, null, 2));
console.log(`\n${inventory.length} image sets in ${OUT}`);
