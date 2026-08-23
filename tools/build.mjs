// Assembles site/src (sections + css + js) into site/dist. Inlines critical CSS,
// bundles/minifies JS, and emits preload hints for the LCP image.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, '../site/src');
const DIST = path.join(here, '../site/dist');
const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));

const read = (p, fallback = '') => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : fallback);

fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });

// ---- CSS ------------------------------------------------------------------
const readCss = (name) => {
  const p = path.join(SRC, 'css', `${name}.css`);
  return fs.existsSync(p) ? `/* ${name} */\n${fs.readFileSync(p, 'utf8')}` : `/* missing ${name}.css */`;
};
// Lo que se ve en el primer pantallazo va inline; el resto viaja aparte y no bloquea el pintado.
const critical = manifest.criticalCss || manifest.css;
const deferred = manifest.css.filter((n) => !critical.includes(n));
const css = await esbuild.transform(critical.map(readCss).join('\n'), { loader: 'css', minify: true });
const cssRest = deferred.length
  ? await esbuild.transform(deferred.map(readCss).join('\n'), { loader: 'css', minify: true })
  : { code: '' };
if (cssRest.code) fs.writeFileSync(path.join(DIST, 'assets/rest.css'), cssRest.code);
else if (fs.existsSync(path.join(DIST, 'assets/rest.css'))) fs.unlinkSync(path.join(DIST, 'assets/rest.css'));

// ---- JS -------------------------------------------------------------------
const entry = path.join(SRC, manifest.entry);
let js = '';
if (fs.existsSync(entry)) {
  const out = await esbuild.build({
    entryPoints: [entry], bundle: true, format: 'esm', minify: true, target: ['es2020'], write: false,
  });
  js = out.outputFiles[0].text;
}
fs.writeFileSync(path.join(DIST, 'assets/app.js'), js);

// ---- HTML -----------------------------------------------------------------
const sections = manifest.sections.map((n) => read(path.join(SRC, 'sections', `${n}.html`), `<!-- ${n} pending -->`)).join('\n');
const overlays = manifest.overlays.map((n) => read(path.join(SRC, 'sections', `${n}.html`), `<!-- ${n} pending -->`)).join('\n');
const preload = read(path.join(SRC, 'preload.html'));
const jsonld = read(path.join(SRC, 'jsonld.html'));

let html = read(path.join(SRC, 'shell.html'))
  .replace('/*@css*/', css.code)
  .replace('<!--@sections-->', sections)
  .replace('<!--@overlays-->', overlays)
  .replace('<!--@preload-->', preload)
  .replace('<!--@jsonld-->', jsonld);

if (cssRest.code) {
  html = html.replace('</head>', `<link rel="stylesheet" href="/assets/rest.css" media="print" onload="this.media='all';this.onload=null"><noscript><link rel="stylesheet" href="/assets/rest.css"></noscript>\n</head>`);
}

// ---- créditos de fotografía (se rellenan solos desde el inventario) --------
const invPath = path.join(SRC, 'static/img/inventory.json');
if (fs.existsSync(invPath)) {
  const inv = JSON.parse(fs.readFileSync(invPath, 'utf8'));
  const seen = new Set();
  const credits = inv.map((i) => i.credit).filter((c) => {
    if (!c || !c.title) return false;
    const k = `${c.title}|${c.creator || ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const esc = (t) => String(t || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const list = credits.map((c) => `<li>${c.page ? `<a href="${esc(c.page)}" rel="noopener nofollow">${esc(c.title)}</a>` : esc(c.title)}${c.creator ? ` — ${esc(c.creator)}` : ''}${c.license ? ` (${esc(c.license)})` : ''}</li>`).join('');
  html = html.replace(/(<[^>]*id="photo-credits"[^>]*>)([\s\S]*?)(<\/[a-z]+>)/i, (m, open, _inner, close) => `${open}<ul class="credits__list">${list}</ul>${close}`);
}

html = html.replace(/\n\s*\n/g, '\n');
fs.writeFileSync(path.join(DIST, 'index.html'), html);

// ---- static passthrough ---------------------------------------------------
const copyDir = (from, to) => {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, e.name); const d = path.join(to, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
};
copyDir(path.join(SRC, 'static'), path.join(DIST, 'assets'));

const kb = (n) => `${(n / 1024).toFixed(1)}kB`;
console.log(`built: html ${kb(Buffer.byteLength(html))} (css inline ${kb(css.code.length)} + diferido ${kb(cssRest.code.length)}), js ${kb(js.length)}`);
