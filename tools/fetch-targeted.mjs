// Second pass: specialist nihonto vocabulary against Commons (search + incategory) and Openverse.
import { apiJson, download, loadRecords, saveRecords, counts, nextNamer, hashIndex, sleep } from './lib-fetch.mjs';

const API = 'https://commons.wikimedia.org/w/api.php';
const WANT = JSON.parse(process.env.WANT || '{"hamon":16,"forge":16,"saya":16,"display":16,"detail":16,"tsuka":16}');

const COMMONS = {
  tsuka: ['tsukamaki', 'tsuka ito wrap', 'samegawa ray skin', 'katana tsuka handle', 'japanese sword hilt wrapping',
    'incategory:"Tsuka"', 'incategory:"Japanese sword mountings"', 'katana grip detail', 'wakizashi tsuka'],
  hamon: ['hamon', 'yakiba', 'suguha hamon', 'gunome', 'choji midare', 'boshi kissaki', 'sunagashi blade',
    'horimono blade carving', 'japanese blade polished detail', 'incategory:"Japanese sword blades"', 'nihonto hamon detail', 'katana blade macro'],
  forge: ['swordsmith', 'bladesmith forging', 'blacksmith forge fire', 'anvil hammer sparks', 'tatara furnace steel',
    'katana forging demonstration', 'japanese forge smithy', 'incategory:"Japanese swordsmithing"', 'hot iron forging workshop', 'forging steel glowing'],
  detail: ['habaki', 'seppa sword', 'fuchi kashira sword', 'mekugi', 'togishi polisher', 'japanese sword polishing stone',
    'menuki ornament', 'incategory:"Menuki"', 'sword fittings japanese macro'],
  saya: ['saya scabbard japanese', 'kojiri', 'kurikata sageo', 'lacquered saya urushi', 'incategory:"Saya"',
    'incategory:"Koshirae"', 'katana koshirae detail'],
  display: ['katanakake', 'sword stand japanese', 'japanese sword museum exhibit', 'incategory:"Katanakake"',
    'nihonto display case', 'samurai sword collection museum'],
};
const OPENVERSE = {
  tsuka: ['tsuka', 'tsukamaki', 'katana handle', 'sword hilt japanese', 'ray skin sword handle', 'samurai sword handle'],
  hamon: ['hamon', 'yakiba katana', 'katana blade', 'nihonto', 'japanese blade steel', 'sword blade macro'],
  forge: ['blacksmith forge', 'bladesmith', 'forging steel sparks', 'anvil blacksmith', 'smithy fire', 'swordsmith', 'forge glowing metal', 'blacksmith hammer'],
  detail: ['habaki', 'sword fittings japanese', 'menuki', 'fuchi', 'sword polishing stone', 'japanese sword detail'],
  saya: ['saya katana', 'scabbard lacquer', 'koshirae wakizashi', 'urushi lacquer'],
  display: ['katana stand', 'sword museum', 'samurai exhibition', 'katanakake'],
};

const BADTXT = /drawing|illustration|woodblock|ukiyo|print|map|diagram|logo|icon|coat of arms|scan|manuscript|book|text|chart|graph|font|poster|painting|sketch|engraving|cartoon|anime|manga|cosplay|screenshot|relief|stele|smallsword|rapier|European|sabre|saber|epee/i;
const BADEXT = /\.(svg|pdf|tif|djvu|ogv|webm|gif)$/i;
const OKLIC = new Set(['cc0', 'pdm', 'by', 'by-sa']);

const records = loadRecords();
const seenUrl = new Set(records.map((r) => r.url));
const hashes = hashIndex(records);
const name = nextNamer(records, 5000);
const have = counts(records);
const fails = [];

for (const [slot, queries] of Object.entries(COMMONS)) {
  for (const q of queries) {
    if ((have[slot] || 0) >= WANT[slot]) break;
    const url = `${API}?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrnamespace=6&gsrlimit=30&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=2400`;
    let j;
    try { j = await apiJson(url, { tries: 6, base: 4000 }); } catch (e) { fails.push(`commons "${q}": ${e.message.slice(0, 60)}`); continue; }
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
        license: lic, page: info.descriptionurl, via: `search2:${q}` };
      try {
        const rec = await download(cand, name(slot, /\.png$/i.test(info.url) ? '.png' : '.jpg'), { seenHashes: hashes });
        if (rec) { records.push(rec); have[slot] = (have[slot] || 0) + 1; added++; console.log(`cw2 ${slot} <- ${rec.file} ${(rec.bytes/1024|0)}KB ${p.title.slice(0,60)}`); }
      } catch {}
      await sleep(400);
    }
    console.log(`cw2 "${q}" (${slot}) +${added} -> ${have[slot] || 0}`);
    saveRecords(records);
  }
}

// Direct pulls from nihonto-specific Commons categories discovered in pass 1.
const CATS = {
  hamon: ['Category:Hamon', 'Category:Kissaki', 'Category:Kissaki (katana)', 'Category:Kissaki (tachi)', 'Category:Kissaki (wakizashi)', 'Category:Boshi', 'Category:Fukura', 'Category:Mune', 'Category:Japanese sword blades'],
  detail: ['Category:Habaki', 'Category:Koiguchi', 'Category:Menuki', 'Category:Fuchi', 'Category:Kashira', 'Category:Seppa', 'Category:Mekugi', 'Category:Japanese sword polishing'],
  tsuka: ['Category:Tsuka', 'Category:Tsukamaki', 'Category:Samegawa', 'Category:Japanese sword hilts', 'Category:Katana', 'Category:Nihonto'],
  saya: ['Category:Saya', 'Category:Kojiri', 'Category:Kurikata', 'Category:Sageo', 'Category:Koshirae'],
  forge: ['Category:Sword-making in Japan', 'Category:Swordsmiths from Japan', 'Category:Tatara furnaces', 'Category:Japanese swordsmithing', 'Category:Blacksmiths', 'Category:Forging', 'Category:Forges', 'Category:Anvils', 'Category:Blacksmiths at work'],
  display: ['Category:Katanakake', 'Category:Japanese swords in museums'],
};
for (const [slot, cats] of Object.entries(CATS)) {
  for (const cat of cats) {
    if ((have[slot] || 0) >= WANT[slot]) break;
    const url = `${API}?action=query&format=json&generator=categorymembers&gcmtitle=${encodeURIComponent(cat)}&gcmtype=file&gcmlimit=40&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=2400`;
    let j;
    try { j = await apiJson(url, { tries: 6, base: 4000 }); } catch (e) { fails.push(`commons cat "${cat}": ${e.message.slice(0, 60)}`); continue; }
    await sleep(1400);
    const pages = Object.values(j.query?.pages || {});
    if (!pages.length) { console.log(`cat ${cat}: empty or missing`); continue; }
    let added = 0;
    for (const p of pages) {
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
        license: lic, page: info.descriptionurl, via: `cat2:${cat}` };
      try {
        const rec = await download(cand, name(slot, /\.png$/i.test(info.url) ? '.png' : '.jpg'), { seenHashes: hashes });
        if (rec) { records.push(rec); have[slot] = (have[slot] || 0) + 1; added++; console.log(`cat2 ${slot} <- ${rec.file} ${(rec.bytes/1024|0)}KB ${p.title.slice(0,60)}`); }
      } catch {}
      await sleep(400);
    }
    console.log(`cat2 ${cat} (${slot}) +${added} -> ${have[slot] || 0}`);
    saveRecords(records);
  }
}

for (const [slot, queries] of Object.entries(OPENVERSE)) {
  for (const q of queries) {
    if ((have[slot] || 0) >= WANT[slot]) break;
    const results = [];
    for (const page of [1, 2]) {
      try {
        const j = await apiJson(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page=${page}&page_size=20&license_type=commercial&mature=false`, { tries: 3, base: 1500 });
        results.push(...(j.results || []));
        if ((j.results || []).length < 20) break;
      } catch (e) { fails.push(`openverse2 "${q}": ${e.message.slice(0, 60)}`); break; }
      await sleep(400);
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
        license: `${x.license}-${x.license_version || ''}`, page: x.foreign_landing_url, via: `ov2:${q}` };
      try {
        const rec = await download(cand, name(slot, /\.png(\?|$)/i.test(x.url) ? '.png' : '.jpg'), { seenHashes: hashes });
        if (rec) { records.push(rec); have[slot] = (have[slot] || 0) + 1; added++; console.log(`ov2 ${slot} <- ${rec.file} ${(rec.bytes/1024|0)}KB "${(x.title||'').slice(0,50)}"`); }
      } catch {}
      await sleep(250);
    }
    console.log(`ov2 "${q}" (${slot}) +${added} -> ${have[slot] || 0}`);
    saveRecords(records);
  }
}
saveRecords(records);
console.log('FINAL', counts(records), 'total', records.length);
if (fails.length) console.log('FAILS:\n' + fails.join('\n'));
