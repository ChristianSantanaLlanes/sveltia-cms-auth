// Screenshots our site: full page + per-piece clips, desktop and mobile.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const [url, outDir, modeArg, piecesPath] = process.argv.slice(2);
const modes = modeArg && modeArg !== 'both' ? [modeArg] : ['desktop', 'mobile'];
fs.mkdirSync(outDir, { recursive: true });
const pieces = piecesPath && fs.existsSync(piecesPath) ? JSON.parse(fs.readFileSync(piecesPath, 'utf8')) : [];
const only = process.env.ONLY_PIECES ? process.env.ONLY_PIECES.split(',') : null;

const VP = {
  desktop: { width: 1440, height: 900, dsf: 1, mobile: false },
  mobile: { width: 390, height: 844, dsf: 2, mobile: true },
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb', '--font-render-hinting=none'] });
const report = [];

for (const mode of modes) {
  const vp = VP[mode];
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dsf,
    isMobile: vp.mobile, hasTouch: vp.mobile, reducedMotion: 'reduce',
    userAgent: vp.mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate(async () => {
    document.querySelectorAll('.reveal').forEach((n) => n.classList.add('is-in'));
    const step = window.innerHeight * 0.9;
    for (let y = 0; y < document.body.scrollHeight; y += step) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 90)); }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 200));
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, `ours-${mode}-fold.png`) });
  await page.screenshot({ path: path.join(outDir, `ours-${mode}-full.png`), fullPage: true });

  for (const piece of pieces) {
    if (only && !only.includes(piece.id)) continue;
    try {
      if (piece.id !== 'nav') {
        await page.evaluate(() => {
          document.querySelectorAll('#top-nav, [data-nav-sub]').forEach((n) => { n.dataset.shotHidden = '1'; n.style.visibility = 'hidden'; });
        });
      }
      if (piece.prep) await page.evaluate(piece.prep);
      await page.waitForTimeout(piece.wait || 350);
      const el = await page.$(piece.selector);
      if (!el) { report.push({ mode, piece: piece.id, error: `selector not found: ${piece.selector}` }); continue; }
      if (!piece.overlay) { await el.scrollIntoViewIfNeeded().catch(() => {}); }
      await page.waitForTimeout(250);
      const file = path.join(outDir, `piece-${piece.id}-${mode}.png`);
      if (piece.overlay) {
        // Los paneles llevan animación continua: recortamos por caja en vez de esperar a que se estabilicen.
        const box = await el.boundingBox();
        if (!box) throw new Error('sin caja para recortar');
        await page.screenshot({ path: file, animations: 'disabled', clip: {
          x: Math.max(0, box.x), y: Math.max(0, box.y),
          width: Math.min(box.width, vp.width - Math.max(0, box.x)),
          height: Math.min(box.height, vp.height - Math.max(0, box.y)),
        } });
      } else {
        await el.screenshot({ path: file, animations: 'disabled' });
      }
      report.push({ mode, piece: piece.id, file });
      if (piece.cleanup) await page.evaluate(piece.cleanup);
      await page.evaluate(() => {
        document.querySelectorAll('[data-shot-hidden]').forEach((n) => { n.style.visibility = ''; delete n.dataset.shotHidden; });
      });
      await page.waitForTimeout(120);
    } catch (e) {
      report.push({ mode, piece: piece.id, error: e.message.split('\n')[0] });
    }
  }
  if (errors.length) report.push({ mode, consoleErrors: errors.slice(0, 10) });
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(outDir, 'shot-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.filter((r) => r.error || r.consoleErrors), null, 2) || '[]');
console.log(`shots in ${outDir}`);
