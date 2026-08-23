// Objective gate on the built page: structure, accessibility, budgets and image hygiene.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const url = process.argv[2] || 'http://127.0.0.1:8080/';
const DIST = '/home/user/sveltia-cms-auth/site/dist';
const problems = [];
const note = (level, msg) => problems.push({ level, msg });

const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const js = fs.existsSync(path.join(DIST, 'assets/app.js')) ? fs.readFileSync(path.join(DIST, 'assets/app.js'), 'utf8') : '';
const cssSize = (html.match(/<style>([\s\S]*?)<\/style>/)?.[1] || '').length;
if (cssSize > 61440) note('error', `CSS inlineado ${(cssSize / 1024).toFixed(1)}kB > 60kB de presupuesto`);
if (js.length > 40960) note('error', `JS ${(js.length / 1024).toFixed(1)}kB > 40kB de presupuesto`);
// Solo cuentan los RECURSOS externos (bloquean o filtran datos); los enlaces de crédito no.
const resourceHits = [...html.matchAll(/(?:src|srcset|href)="(https?:\/\/[^"]+)"/gi)]
  .map((m) => m[1])
  .filter((u) => !/kurogane\.example|schema\.org|www\.w3\.org/.test(u))
  .filter((u) => {
    const idx = html.indexOf(u);
    const before = html.slice(Math.max(0, idx - 200), idx);
    return !/<a\s[^>]*$/i.test(before);
  });
if (resourceHits.length) note('error', `recursos externos en el HTML: ${[...new Set(resourceHits)].join(', ')}`);
const filler = html.replace(/placeholder="[^"]*"/gi, '');
if (/lorem ipsum|texto de ejemplo/i.test(filler) || /\bTODO\b|\bFIXME\b/.test(filler)) note('error', 'quedan marcadores de relleno en el HTML');

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
for (const [mode, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: mode === 'mobile' ? 2 : 1, isMobile: mode === 'mobile', hasTouch: mode === 'mobile' });
  const page = await ctx.newPage();
  const failed = [];
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  page.on('pageerror', (e) => note('error', `[${mode}] error de JS: ${e.message.slice(0, 120)}`));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.9;
    for (let y = 0; y < document.body.scrollHeight; y += step) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(600);
  for (const f of [...new Set(failed)]) note('error', `[${mode}] petición fallida: ${f}`);

  const audit = await page.evaluate(() => {
    const out = { noAlt: [], tinyTargets: [], dupIds: [], headingJumps: [], overflow: null, missingDims: [], brokenImgs: [], hiddenFocus: 0 };
    const ids = new Map();
    document.querySelectorAll('[id]').forEach((el) => { ids.set(el.id, (ids.get(el.id) || 0) + 1); });
    out.dupIds = [...ids].filter(([, n]) => n > 1).map(([id]) => id);
    document.querySelectorAll('img').forEach((img) => {
      if (img.getAttribute('alt') === null && img.getAttribute('aria-hidden') !== 'true') out.noAlt.push(img.currentSrc || img.src);
      if (!img.getAttribute('width') || !img.getAttribute('height')) out.missingDims.push(img.currentSrc || img.src);
      if (img.complete && img.naturalWidth < 20) out.brokenImgs.push(img.currentSrc || img.src);
    });
    let last = 0;
    document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((h) => {
      const level = Number(h.tagName[1]);
      if (last && level > last + 1) out.headingJumps.push(`${h.tagName} tras H${last}: ${h.textContent.trim().slice(0, 40)}`);
      last = level;
    });
    document.querySelectorAll('a, button, [role="button"], input, select').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      if ((r.height < 32 || r.width < 32) && !el.closest('nav[aria-label="Migas"], footer')) {
        out.tinyTargets.push(`${el.tagName}.${el.className?.toString().split(' ')[0] || ''} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    });
    out.overflow = document.documentElement.scrollWidth > window.innerWidth + 1
      ? `scrollWidth ${document.documentElement.scrollWidth} > viewport ${window.innerWidth}` : null;
    out.h1Count = document.querySelectorAll('h1').length;
    return out;
  });
  if (audit.overflow) note('error', `[${mode}] la página desborda en horizontal: ${audit.overflow}`);
  if (audit.dupIds.length) note('error', `[${mode}] ids duplicados: ${audit.dupIds.join(', ')}`);
  if (audit.h1Count !== 1) note('warn', `[${mode}] hay ${audit.h1Count} elementos H1 (debería haber 1)`);
  audit.noAlt.slice(0, 6).forEach((s) => note('error', `[${mode}] imagen sin alt: ${s.split('/').pop()}`));
  audit.brokenImgs.slice(0, 6).forEach((s) => note('error', `[${mode}] imagen que no carga: ${s.split('/').pop()}`));
  audit.missingDims.slice(0, 6).forEach((s) => note('warn', `[${mode}] imagen sin width/height: ${s.split('/').pop()}`));
  audit.headingJumps.slice(0, 5).forEach((s) => note('warn', `[${mode}] salto de encabezado: ${s}`));
  if (mode === 'mobile') audit.tinyTargets.slice(0, 8).forEach((s) => note('warn', `[móvil] objetivo táctil pequeño: ${s}`));
  await ctx.close();
}
await browser.close();

const errors = problems.filter((p) => p.level === 'error');
fs.writeFileSync('/tmp/audit.json', JSON.stringify(problems, null, 2));
for (const p of problems) console.log(`${p.level === 'error' ? 'ERROR' : 'aviso'}  ${p.msg}`);
console.log(`\n${errors.length} errores, ${problems.length - errors.length} avisos`);
process.exit(errors.length ? 1 : 0);
