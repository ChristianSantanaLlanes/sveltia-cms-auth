// Openverse harvest, photographs only, commercially reusable licences.
import { apiJson, download, loadRecords, saveRecords, counts, nextNamer, hashIndex, sleep } from './lib-fetch.mjs';

const WANT = { hamon: 14, forge: 14, saya: 14, display: 14, detail: 14, tsuka: 14 };
const QUERIES = {
  hamon: ['hamon katana', 'katana hamon temper line', 'japanese sword blade close up', 'nihonto blade', 'jihada', 'hada japanese steel', 'kissaki', 'sword temper line', 'japanese blade macro', 'katana blade detail', 'sword steel grain'],
  forge: ['japanese swordsmith', 'swordsmith japan forging', 'katana forging', 'tatara steel', 'tamahagane', 'blacksmith forging sparks', 'blacksmith anvil hammer', 'japanese blacksmith forge', 'sword forging fire', 'forge charcoal smithy', 'bladesmith forging'],
  saya: ['saya scabbard katana', 'urushi lacquer scabbard', 'koshirae', 'japanese sword scabbard', 'lacquered scabbard japan', 'katana saya', 'urushi lacquer japan'],
  display: ['katanakake', 'katana sword stand', 'samurai sword museum', 'japanese sword exhibition', 'katana display', 'japanese sword rack', 'samurai armour museum sword', 'nihonto exhibition'],
  detail: ['togishi', 'japanese sword polishing', 'menuki', 'fuchi kashira', 'habaki', 'seppa sword fitting', 'mekugi', 'japanese sword fittings', 'kozuka', 'sword polisher japan'],
  tsuka: ['tsuka katana handle', 'tsukamaki', 'katana handle wrap', 'samurai sword grip', 'sword hilt ray skin', 'same skin sword handle', 'japanese sword hilt', 'ito wrap sword'],
};
const OK = new Set(['cc0', 'pdm', 'by', 'by-sa']);
const BAD = /clip ?art|vector|icon|logo|drawing|illustration|sketch|painting|woodblock|ukiyo|render|3d|anime|manga|cartoon|toy|cosplay|sticker|png |emoji|pattern|font|map |diagram|coloring|silhouette|scan|book page|title page/i;

const records = loadRecords();
const seenUrl = new Set(records.map((r) => r.url));
const hashes = hashIndex(records);
const name = nextNamer(records, 3000);
const have = counts(records);
const fails = [];

for (const [slot, queries] of Object.entries(QUERIES)) {
  for (const q of queries) {
    if ((have[slot] || 0) >= WANT[slot]) break;
    // Openverse's category/size facets are sparsely populated, so filter client-side instead.
    let j;
    const results = [];
    for (const page of [1, 2]) {
      const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page=${page}&page_size=20&license_type=commercial&mature=false`;
      try { j = await apiJson(url, { tries: 3, base: 1500 }); }
      catch (e) { fails.push(`openverse "${q}" p${page}: ${e.message.slice(0, 60)}`); break; }
      results.push(...(j.results || []));
      if ((j.results || []).length < 20) break;
      await sleep(400);
    }
    for (const x of results) {
      if ((have[slot] || 0) >= WANT[slot]) break;
      if (!OK.has(x.license)) continue;
      if ((x.width || 0) < 1400) continue;
      const t = `${x.title || ''} ${x.source || ''} ${(x.tags || []).map((z) => z.name).join(' ')}`;
      if (BAD.test(t)) continue;
      if (seenUrl.has(x.url)) continue;
      seenUrl.add(x.url);
      const ext = /\.png(\?|$)/i.test(x.url) ? '.png' : '.jpg';
      const cand = { slot, src: 'openverse', url: x.url, w: x.width, h: x.height, title: x.title,
        creator: x.creator, license: `${x.license}-${x.license_version || ''}`, page: x.foreign_landing_url, query: q };
      try {
        const rec = await download(cand, name(slot, ext), { seenHashes: hashes });
        if (rec) { records.push(rec); have[slot] = (have[slot] || 0) + 1; console.log(`ov ${slot} <- ${rec.file} ${(rec.bytes/1024|0)}KB "${(x.title||'').slice(0,50)}"`); }
      } catch {}
      await sleep(200);
    }
    console.log(`ov query "${q}" (${slot}) scanned ${results.length} -> have ${have[slot] || 0}`);
    saveRecords(records);
    await sleep(400);
  }
}
saveRecords(records);
console.log('FINAL', counts(records), 'total', records.length);
if (fails.length) console.log('FAILS:\n' + fails.join('\n'));
