// Depth-limited Commons category crawl over curated nihonto roots; files classified by title.
import { apiJson, download, loadRecords, saveRecords, counts, nextNamer, hashIndex, sleep } from './lib-fetch.mjs';

const API = 'https://commons.wikimedia.org/w/api.php';
const WANT = JSON.parse(process.env.WANT || '{"hamon":18,"forge":18,"saya":18,"display":18,"detail":18,"tsuka":18}');
const ROOTS = [
  'Category:Collections of the Nagoya Touken World',
  'Category:Japanese Sword Museum',
  'Category:Swords in the Tokyo National Museum',
  'Category:Sword-making in Japan',
  'Category:Tatara furnaces',
  'Category:Japanese sword mountings',
  'Category:Bizen Osafune Sword Museum',
  'Category:Seki Sword Tradition Museum',
];
const MAXDEPTH = 2;
const BADEXT = /\.(svg|pdf|tif|djvu|ogv|webm|gif)$/i;
const BADTXT = /drawing|illustration|woodblock|ukiyo|ukiyoe|map|diagram|logo|icon|scan|manuscript|book|poster|painting|sketch|engraving|cartoon|anime|manga|cosplay|screenshot|絵|浮世/i;

function slotOf(title) {
  const t = title;
  if (/tsuba|鍔|鐔/i.test(t)) return null;                       // already covered
  if (/menuki|目貫|fuchi|縁|kashira|頭|habaki|ハバキ|seppa|切羽|mekugi|目釘|kozuka|小柄|kogai|笄|polish|研|togishi/i.test(t)) return 'detail';
  if (/tsuka|柄巻|ito.?maki|samegawa|鮫皮|hilt|grip/i.test(t)) return 'tsuka';
  if (/koshirae|拵|saya|鞘|scabbard|sageo|下緒|kojiri/i.test(t)) return 'saya';
  if (/hamon|刃文|kissaki|切先|鋒|boshi|帽子|jihada|地鉄|地肌|hada|blade|刀身|nakago|茎/i.test(t)) return 'hamon';
  if (/forge|forging|smith|鍛|tatara|たたら|anvil|hammer|火造|工房/i.test(t)) return 'forge';
  if (/museum|博物館|美術館|exhibit|展示|katanakake|刀掛/i.test(t)) return 'display';
  return null;
}

const records = loadRecords();
const seenUrl = new Set(records.map((r) => r.url));
const hashes = hashIndex(records);
const name = nextNamer(records, 6000);
const have = counts(records);
const fails = [];
const visited = new Set();

async function members(cat, type) {
  const url = `${API}?action=query&format=json&generator=categorymembers&gcmtitle=${encodeURIComponent(cat)}&gcmtype=${type}&gcmlimit=100` +
    (type === 'file' ? '&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=2400' : '');
  const j = await apiJson(url, { tries: 6, base: 4000 });
  await sleep(1400);
  return Object.values(j.query?.pages || {});
}

async function crawl(cat, depth) {
  if (visited.has(cat) || depth > MAXDEPTH) return;
  visited.add(cat);
  if (Object.keys(WANT).every((s) => (have[s] || 0) >= WANT[s])) return;
  let files = [];
  try { files = await members(cat, 'file'); } catch (e) { fails.push(`crawl files "${cat}": ${e.message.slice(0, 50)}`); }
  for (const p of files) {
    const slot = slotOf(p.title);
    if (!slot || !WANT[slot] || (have[slot] || 0) >= WANT[slot]) continue;
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
      license: lic, page: info.descriptionurl, via: `crawl:${cat}` };
    try {
      const rec = await download(cand, name(slot, /\.png$/i.test(info.url) ? '.png' : '.jpg'), { seenHashes: hashes });
      if (rec) { records.push(rec); have[slot] = (have[slot] || 0) + 1; console.log(`crawl ${slot} <- ${rec.file} ${(rec.bytes/1024|0)}KB ${p.title.slice(0,70)}`); }
    } catch {}
    await sleep(350);
  }
  saveRecords(records);
  console.log(`crawl ${cat} (d${depth}) files=${files.length} counts=${JSON.stringify(have)}`);
  let subs = [];
  try { subs = await members(cat, 'subcat'); } catch (e) { fails.push(`crawl subcats "${cat}": ${e.message.slice(0, 50)}`); }
  for (const s of subs) await crawl(s.title, depth + 1);
}

for (const root of ROOTS) await crawl(root, 0);
saveRecords(records);
console.log('FINAL', counts(records), 'total', records.length);
if (fails.length) console.log('FAILS:\n' + fails.join('\n'));
