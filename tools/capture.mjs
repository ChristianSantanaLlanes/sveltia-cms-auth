import { chromium } from 'playwright-core';

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const url = process.argv[2];
const outPrefix = process.argv[3];
const proxy = undefined; // localhost mirror: direct

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false },
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true },
};

const browser = await chromium.launch({
  executablePath: CHROME,
  proxy,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

for (const [name, vp] of Object.entries(VIEWPORTS)) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.deviceScaleFactor,
    isMobile: vp.isMobile,
    hasTouch: vp.isMobile,
    userAgent: vp.isMobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : undefined,
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(4000);
  // trigger lazy content
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 220));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${outPrefix}-${name}-fold.png` });
  await page.screenshot({ path: `${outPrefix}-${name}-full.png`, fullPage: true });
  console.log(`captured ${name}`);
  await ctx.close();
}
await browser.close();
