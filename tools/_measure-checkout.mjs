import { chromium } from 'playwright-core';
const url = process.argv[2] || 'http://127.0.0.1:8080/';
const VPS = [
  { name: 'desktop-1440x900', width: 1440, height: 900, mobile: false },
  { name: 'desktop-1440x800', width: 1440, height: 800, mobile: false },
  { name: 'laptop-1280x720', width: 1280, height: 720, mobile: false },
  { name: 'mobile-390x844', width: 390, height: 844, mobile: true },
  { name: 'mobile-390x700', width: 390, height: 700, mobile: true },
];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
for (const vp of VPS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => { if (!window.KG.state.items.length) window.KG.addItem({ productId: 'hanabira' }); window.KG.openCheckout(); });
  await page.waitForTimeout(900);
  const out = await page.evaluate((step) => {
    const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right), h: Math.round(b.height) }; };
    const panel = document.querySelector('#checkout-panel');
    const main = document.querySelector('.checkout__main');
    const foot = document.querySelector('.checkout__foot');
    const next = document.querySelector('[data-step-next]');
    const fields = document.querySelector('[data-step-panel="1"] .fields');
    const aside = document.querySelector('.checkout__aside');
    const sumFine = document.querySelector('.sum__fine');
    return {
      vh: innerHeight, vw: innerWidth,
      panel: r(panel), main: r(main), foot: r(foot), next: r(next), fieldsBottom: r(fields), aside: r(aside), sumFine: r(sumFine),
      mainScroll: main ? { sh: main.scrollHeight, ch: main.clientHeight, st: main.scrollTop } : null,
      asideScroll: aside ? { sh: aside.scrollHeight, ch: aside.clientHeight } : null,
      deadBand: fields && foot ? Math.round(foot.getBoundingClientRect().top - fields.getBoundingClientRect().bottom) : null,
      asideDead: aside && sumFine ? Math.round(aside.getBoundingClientRect().bottom - sumFine.getBoundingClientRect().bottom) : null,
    };
  });
  console.log(vp.name, JSON.stringify(out, null, 1));
  await ctx.close();
}
await browser.close();
