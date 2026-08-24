// Turns curated picks into tools/image-map.json, resolving credits from the raw metadata.
import fs from 'node:fs';
import path from 'node:path';

const RAW = '/tmp/katana-raw';
const records = JSON.parse(fs.readFileSync(path.join(RAW, 'credits.json'), 'utf8'));
for (const shard of fs.readdirSync(RAW).filter((f) => /^credits-.*\.json$/.test(f))) {
  const known = new Set(records.map((r) => r.file));
  for (const r of JSON.parse(fs.readFileSync(path.join(RAW, shard), 'utf8'))) if (!known.has(r.file)) records.push(r);
}
const byStem = new Map(records.map((r) => [r.file.replace(/\.[a-z]+$/i, ''), r]));
const find = (stem) => {
  const rec = byStem.get(stem);
  if (!rec) throw new Error(`sin metadatos: ${stem}`);
  const file = path.join(RAW, rec.file);
  if (!fs.existsSync(file)) throw new Error(`falta el fichero: ${file}`);
  return { src: file, credit: { title: rec.title || rec.file, creator: rec.creator || '', license: rec.license || '', page: rec.page || rec.url } };
};

const PICKS = [
  { name: 'hero-wide', stem: 'hamon-929', widths: [1280, 1920, 2560], ratio: 16 / 9, position: 'centre', avifQuality: 38,
    alt: 'Filo de una katana en primer plano: la línea de temple recorre el acero pulido como una nube blanca.' },
  { name: 'hero-tall', stem: 'display-2013', widths: [640, 960, 1280], ratio: 3 / 4, position: 'centre', avifQuality: 42,
    alt: 'Hoja de katana completa sobre fondo negro: la curvatura entera, del habaki a la punta.' },
  { rotate: -90, fit: 'contain', pad: 0.06, whiten: true, name: 'prod-mumei', stem: 'hamon-3022', widths: [480, 800, 1200], ratio: 4 / 5, position: 'centre',
    alt: 'Katana Mumei con su montura sobre fondo claro.' },
  { rotate: -90, fit: 'contain', pad: 0.06, whiten: true, name: 'prod-kurogane', stem: 'display-2007', widths: [480, 800, 1200], ratio: 4 / 5, position: 'centre',
    alt: 'Katana Kurogane montada, con empuñadura trenzada y saya oscura.' },
  { rotate: -90, fit: 'contain', pad: 0.06, whiten: true, name: 'prod-hanabira', stem: 'hamon-3010', widths: [480, 800, 1200], ratio: 4 / 5, position: 'centre',
    alt: 'Katana Hanabira con koshirae completo y hoja pulida.' },
  { rotate: -90, fit: 'contain', pad: 0.06, whiten: true, name: 'prod-arashi', stem: 'hamon-3011', widths: [480, 800, 1200], ratio: 4 / 5, position: 'centre',
    alt: 'Katana Arashi: hoja de acero plegado con su montura.' },
  { rotate: -90, fit: 'contain', pad: 0.06, whiten: true, name: 'prod-tsuki', stem: 'hamon-3009', widths: [480, 800, 1200], ratio: 4 / 5, position: 'centre',
    alt: 'Katana Tsuki con su montura completa sobre fondo claro de estudio.' },
  { rotate: -90, fit: 'contain', pad: 0.06, whiten: true, name: 'prod-ryujin', stem: 'display-2008', widths: [480, 800, 1200], ratio: 4 / 5, position: 'centre',
    alt: 'Katana Ryūjin montada: empuñadura trenzada, tsuba de hierro y saya lacada, sobre fondo claro.' },
  { name: 'hamon', stem: 'hamon-927', widths: [800, 1400, 2000], ratio: 16 / 9, position: 'centre',
    alt: 'Macro del filo templado: la martensita blanca del hamon contra el acero oscuro del lomo.' },
  { name: 'forge', stem: 'forge-940', widths: [800, 1400, 2000], ratio: 16 / 9, position: 'centre',
    alt: 'Fragua encendida: el acero al rojo entre las brasas junto a las tenazas del herrero.' },
  { name: 'tsuba', stem: 'detail-2022', widths: [600, 1000], ratio: 1, position: 'centre',
    alt: 'Tsuba de hierro forjado con incrustaciones de oro sobre fondo neutro.' },
  { name: 'tsuka', stem: 'tsuka-1012', widths: [600, 1000], ratio: 1, position: 'attention',
    alt: 'Pareja de menuki de metal labrado, los adornos que van bajo el trenzado de la empuñadura.' },
  { fit: 'cover', name: 'saya', stem: 'display-2010', widths: [800, 1400], ratio: 16 / 9, position: 'centre',
    alt: 'Katana montada con su saya lacada y el cordón de seda anudado, sobre fondo gris de estudio.' },
  { name: 'polish', stem: 'hamon-2024', widths: [800, 1400], ratio: 16 / 9, position: 'centre',
    alt: 'Hoja recién pulida sobre fondo gris, con el reflejo limpio del acero.' },
  { fit: 'cover', name: 'display', stem: 'display-2005', widths: [800, 1400], ratio: 16 / 9, position: 'centre',
    alt: 'Katana desnuda mostrando la curvatura completa de la hoja.' },
];

const map = PICKS.map((p) => {
  const { src, credit } = find(p.stem);
  return { name: p.name, src, widths: p.widths, ratio: p.ratio, position: p.position, avifQuality: p.avifQuality, rotate: p.rotate, fit: p.fit, pad: p.pad, whiten: p.whiten, alt: p.alt, credit };
});
fs.writeFileSync(new URL('./image-map.json', import.meta.url), JSON.stringify(map, null, 2));
console.log(`image-map.json con ${map.length} imágenes`);
