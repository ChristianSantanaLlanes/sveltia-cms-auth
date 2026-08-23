// Captura los paneles superpuestos (carrito y checkout) con su estado preparado.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const [url, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const VP = { desktop: { width: 1440, height: 900, dsf: 1, mobile: false }, mobile: { width: 390, height: 844, dsf: 2, mobile: true } };

const JOBS = [
  {
    id: 'cart',
    selector: '#cart-panel',
    prep: () => {
      window.KG.addItem({ productId: 'hanabira' });
      window.KG.addItem({ productId: 'ryujin', variants: { blade: '74', edge: 'mirror', tsuba: 'kiku', saya: 'shu' }, engraving: '一期一会' });
      window.KG.openCart();
    },
  },
  {
    id: 'checkout',
    selector: '#checkout-panel',
    prep: () => {
      if (!window.KG.state.items.length) window.KG.addItem({ productId: 'hanabira' });
      window.KG.openCheckout();
    },
  },
];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'] });
const report = [];
for (const [mode, vp] of Object.entries(VP)) {
  for (const job of JOBS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dsf,
      isMobile: vp.mobile, hasTouch: vp.mobile,
      userAgent: vp.mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined,
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.evaluate(() => { document.querySelectorAll('#top-nav, [data-nav-sub]').forEach((n) => { n.style.visibility = 'hidden'; }); });
    await page.evaluate(job.prep);
    await page.waitForTimeout(1400);
    const file = path.join(outDir, `piece-${job.id}-${mode}.png`);
    try {
      const box = await page.locator(job.selector).boundingBox();
      if (!box || box.width < 4) throw new Error(`sin caja (${JSON.stringify(box)})`);
      await page.screenshot({ path: file, animations: 'disabled', clip: {
        x: Math.max(0, box.x), y: Math.max(0, box.y),
        width: Math.min(box.width, vp.width - Math.max(0, box.x)),
        height: Math.min(box.height, vp.height - Math.max(0, box.y)),
      } });
      report.push({ mode, piece: job.id, file });
    } catch (e) {
      report.push({ mode, piece: job.id, error: e.message.split('\n')[0] });
    }
    await ctx.close();
  }
}
await browser.close();
console.log(JSON.stringify(report, null, 2));
