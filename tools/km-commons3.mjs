import { apiJson, grabRetry, loadRecords, saveRecords, sleep } from './km-lib.mjs';
// Flat, curated, capped. No recursion -> no replica/iaito/kenjutsu drift.
const CATS = [
  ['product','Category:Swords of Japan in the Tokyo National Museum',20],
  ['product','Category:Tachi in the Tokyo National Museum',10],
  ['product','Category:Katana in the Metropolitan Museum of Art',10],
  ['product','Category:Wakizashi in the Metropolitan Museum of Art',10],
  ['hero','Category:Tachi',18],
  ['hero','Category:Katana',18],
  ['hero','Category:Wakizashi',14],
  ['hero','Category:Daisho',10],
  ['hero','Category:Odachi',4],
  ['product','Category:Tanto',12],
  ['saya','Category:Shirasaya',8],
  ['hamon','Category:Hada (nihonto)',8],
  ['hamon','Category:Boshi',8],
  ['detail','Category:Habaki',8],
  ['tsuka','Category:Kashira in the Metropolitan Museum of Art',8],
];
const API='https://commons.wikimedia.org/w/api.php';
const files=new Map();
for (const [slot,cat,cap] of CATS){
  let o; try{ o=await apiJson(`${API}?action=query&format=json&generator=categorymembers&gcmtitle=${encodeURIComponent(cat)}&gcmtype=file&gcmlimit=500&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=3000`,{tries:10,base:5000}); }
  catch(e){ console.log('FAIL',cat,e.message.slice(0,40)); continue; }
  await sleep(1600);
  const got=Object.values(o.query?.pages||{}).filter(p=>p.imageinfo&&/image\/(jpeg|png)/.test(p.imageinfo[0].mime)&&p.imageinfo[0].width>=2000);
  let n=0;
  for(const p of got){ if(n>=cap) break; if(files.has(p.title)) continue; files.set(p.title,{slot,info:p.imageinfo[0]}); n++; }
  console.log(`${cat}: ${got.length} eligible, took ${n} | pool=${files.size}`);
}
const BAD=/ukiyo|woodblock|print|drawing|painting|scroll|diagram|logo|poster|manuscript|label|plaque|cosplay|replica|iaito|plastic|toy|statue|monument|map|portrait|chart|certificate|origami|anime|manga|costume|festival|parade|reenact|shop|store|display case of|book/i;
const cands=[];
for(const [title,{slot,info}] of files){
  if(BAD.test(title)) continue;
  const t=title.replace(/^File:/,'').replace(/\.(jpe?g|png)$/i,''); const lt=t.toLowerCase();
  let s=slot;
  if(/tsuba|sword guard/.test(lt)) s='tsuba';
  else if(/hamon|kissaki|hada|jihada|boshi|temper/.test(lt)) s='hamon';
  else if(/tsuka|menuki|fuchi|kashira|hilt|habaki/.test(lt)) s='tsuka';
  else if(/saya|scabbard|sheath|shirasaya/.test(lt)) s='saya';
  else if(/koshirae|mounting/.test(lt)) s='product';
  const em=info.extmetadata||{}; const strip=v=>(v?.value||'').replace(/<[^>]+>/g,'').trim().slice(0,120);
  cands.push({slot:s,url:info.thumburl||info.url,title:t,creator:strip(em.Artist)||strip(em.Credit)||'Unknown',
    license:strip(em.LicenseShortName)||'see page',page:info.descriptionurl,source:'wikimedia-commons'});
}
console.log('\ncandidates:',cands.length);
const records=loadRecords(); const seen=new Set(records.map(r=>r.sha)); const used=new Set(records.map(r=>r.file));
let i=200, ok=0;
for(const c of cands){
  let name; do{ name=`wc-${c.slot}-${String(i++).padStart(3,'0')}.jpg`; }while(used.has(name));
  used.add(name);
  const res=await grabRetry(c,name,{seen,tries:5,base:5000});
  if(res.rec){records.push(res.rec);ok++;console.log(`OK  ${name} ${res.rec.w}x${res.rec.h}  ${c.title.slice(0,55)}`);saveRecords(records);}
  else console.log(`--  ${c.title.slice(0,45)} :: ${res.skip}`);
  await sleep(900);
}
saveRecords(records);
const cnt={};for(const r of records)cnt[r.slot]=(cnt[r.slot]||0)+1;
console.log(`\nnew=${ok} TOTAL ${records.length}`,JSON.stringify(cnt));
