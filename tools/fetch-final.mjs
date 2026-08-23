// Last gap-filling pass: precise Commons file searches + generic Openverse forge photography.
import { apiJson, download, loadRecords, saveRecords, counts, nextNamer, hashIndex, sleep } from './lib-fetch.mjs';

const API = 'https://commons.wikimedia.org/w/api.php';
const WANT = JSON.parse(process.env.WANT || '{"tsuka":16,"forge":16,"hamon":16}');
const COMMONS = {
  tsuka: ['tsuka katana', 'Antique Japanese samurai katana tsuka', "tsuka same", 'tsuka ito', 'fuchi tsuba tsuka',
    'katana tsuka handle wrap', 'Tsuka.JPG', 'samurai sword handle antique', 'wakizashi tsuka handle'],
  hamon: ['Tanto-1942.266.4794', 'hamon katana blade', 'yakiba blade', 'kissaki katana', 'boshi kissaki blade',
    'nihonto blade detail', 'japanese sword blade macro polished'],
  forge: ['刀鍛冶', 'swordsmith japan work forge', 'blacksmith at work forge fire', 'bladesmith forging blade',
    'forge fire coals smithy', 'blacksmith hammering anvil', 'tatara iron sand smelting'],
};
const OPENVERSE = {
  tsuka: ['katana tsuka', 'samurai sword handle', 'japanese sword handle wrap', 'katana grip'],
  forge: ['blacksmith', 'forge fire', 'blacksmith anvil', 'forging hot metal', 'smithy workshop'],
  hamon: ['katana blade detail', 'japanese sword blade'],
};
const BADEXT = /\.(svg|pdf|tif|djvu|ogv|webm|gif)$/i;
const BADTXT = /drawing|illustration|woodblock|ukiyo|map|diagram|logo|icon|scan|manuscript|book|poster|painting|sketch|engraving|cartoon|anime|manga|cosplay|screenshot|grave|certificate|monument|costume|chart|graph|soldier|military|aircraft|helmet|armor|armour|toy|plastic|replica/i;
const OKLIC = new Set(['cc0', 'pdm', 'by', 'by-sa']);

const records = loadRecords();
const seenUrl = new Set(records.map((r) => r.url));
const hashes = hashIndex(records);
const name = nextNamer(records, 8000);
const have = counts(records);
const fails = [];

for (const [slot, queries] of Object.entries(COMMONS)) {
  for (const q of queries) {
    if ((have[slot] || 0) >= WANT[slot]) break;
    let j;
    try {
      j = await apiJson(`${API}?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrnamespace=6&gsrlimit=40&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=2400`, { tries: 6, base: 4000 });
    } catch (e) { fails.push(`commons3 "${q}": ${e.message.slice(0, 60)}`); continue; }
    await sleep(1400);
    let added = 0;
    for (const p of Object.values(j.query?.pages || {})) {
      if ((have[slot] || 0) >= WANT[slot]) break;
      const info = p.imageinfo?.[0];
      if (!info || !/image\/(jpeg|png)/.test(info.mime || '')) continue;
      if (info.width < 1400) continue;
      if (BADEXT.test(p.title) || BADTXT.test(p.title)) continue;
      const src = info.thumburl || info.url;
      if (seenUrl.has(src) || seenUrl.has(info.url)) continue;
      seenUrl.add(src);
      const lic = info.extmetadata?.LicenseShortName?.value || '';
      if (/NC|ND|Fair use|non-free/i.test(lic)) continue;
      const cand = { slot, src: 'commons', url: src, w: info.thumbwidth || info.width, h: info.thumbheight || info.height,
        title: p.title, creator: info.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, '').slice(0, 80),
        license: lic, page: info.descriptionurl, via: `final:${q}` };
      try {
        const rec = await download(cand, name(slot, /\.png$/i.test(info.url) ? '.png' : '.jpg'), { seenHashes: hashes });
        if (rec) { records.push(rec); have[slot] = (have[slot] || 0) + 1; added++; console.log(`f-cw ${slot} <- ${rec.file} ${(rec.bytes/1024|0)}KB ${p.title.slice(0,60)}`); }
      } catch {}
      await sleep(350);
    }
    console.log(`f-cw "${q}" (${slot}) +${added} -> ${have[slot] || 0}`);
    saveRecords(records);
  }
}

for (const [slot, queries] of Object.entries(OPENVERSE)) {
  for (const q of queries) {
    if ((have[slot] || 0) >= WANT[slot]) break;
    const results = [];
    for (const page of [1, 2]) {
      try {
        const j = await apiJson(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page=${page}&page_size=20&license_type=commercial&mature=false`, { tries: 4, base: 2500 });
        results.push(...(j.results || []));
        if ((j.results || []).length < 20) break;
      } catch (e) { fails.push(`openverse3 "${q}": ${e.message.slice(0, 60)}`); break; }
      await sleep(500);
    }
    let added = 0;
    for (const x of results) {
      if ((have[slot] || 0) >= WANT[slot]) break;
      if (!OKLIC.has(x.license) || (x.width || 0) < 1400) continue;
      const t = `${x.title || ''} ${(x.tags || []).map((z) => z.name).join(' ')}`;
      if (BADTXT.test(t)) continue;
      if (seenUrl.has(x.url)) continue;
      seenUrl.add(x.url);
      const cand = { slot, src: 'openverse', url: x.url, w: x.width, h: x.height, title: x.title, creator: x.creator,
        license: `${x.license}-${x.license_version || ''}`, page: x.foreign_landing_url, via: `final-ov:${q}` };
      try {
        const rec = await download(cand, name(slot, /\.png(\?|$)/i.test(x.url) ? '.png' : '.jpg'), { seenHashes: hashes });
        if (rec) { records.push(rec); have[slot] = (have[slot] || 0) + 1; added++; console.log(`f-ov ${slot} <- ${rec.file} ${(rec.bytes/1024|0)}KB "${(x.title||'').slice(0,50)}"`); }
      } catch {}
      await sleep(250);
    }
    console.log(`f-ov "${q}" (${slot}) +${added} -> ${have[slot] || 0}`);
    saveRecords(records);
  }
}
saveRecords(records);
console.log('FINAL', counts(records), 'total', records.length);
if (fails.length) console.log('FAILS:\n' + fails.join('\n'));
