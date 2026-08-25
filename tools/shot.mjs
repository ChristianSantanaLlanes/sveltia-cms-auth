#!/usr/bin/env node
/**
 * Screenshot harness.
 *
 *   node tools/shot.mjs                 # every target
 *   node tools/shot.mjs hero grid       # named targets
 *   node tools/shot.mjs --list
 *
 * Writes PNGs to .shots/<target>.png against the dev server on 127.0.0.1:5173,
 * starting one if nothing is listening yet.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.shots');
const PORT = 5173;
const BASE = `http://127.0.0.1:${PORT}`;

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

/** @type {Record<string, {url:string, viewport:object, fullPage?:boolean, wait?:number, isMobile?:boolean, prep?:Function}>} */
export const TARGETS = {
  'home-desktop': { url: '/', viewport: DESKTOP },
  'home-desktop-full': { url: '/', viewport: DESKTOP, fullPage: true },
  'home-mobile': { url: '/', viewport: MOBILE, isMobile: true },
  'home-scroll-2': {
    url: '/', viewport: DESKTOP,
    prep: async (page) => { await page.mouse.wheel(0, 900); await page.waitForTimeout(1200); },
  },
  'home-scroll-3': {
    url: '/', viewport: DESKTOP,
    prep: async (page) => { await page.mouse.wheel(0, 1800); await page.waitForTimeout(1400); },
  },
  'home-nav-hover': {
    url: '/', viewport: DESKTOP,
    prep: async (page) => { await page.hover('header a, header button').catch(() => {}); await page.waitForTimeout(400); },
  },
  'home-mobile-menu': {
    url: '/', viewport: MOBILE, isMobile: true,
    prep: async (page) => {
      await page.click('[data-testid="menu-toggle"]').catch(() => {});
      await page.waitForTimeout(600);
    },
  },
  'inventory-desktop': { url: '/inventory', viewport: DESKTOP },
  'inventory-desktop-full': { url: '/inventory', viewport: DESKTOP, fullPage: true },
  'inventory-mobile': { url: '/inventory', viewport: MOBILE, isMobile: true },
  'inventory-loading': {
    url: '/inventory?slow=1', viewport: DESKTOP, wait: 120,
  },
  'inventory-empty': { url: '/inventory?model=vela-x&maxPrice=30000', viewport: DESKTOP },
  'inventory-filters-mobile': {
    url: '/inventory', viewport: MOBILE, isMobile: true,
    prep: async (page) => { await page.click('[data-testid="filter-toggle"]').catch(() => {}); await page.waitForTimeout(600); },
  },
  'design-desktop': { url: '/design/vela-3', viewport: DESKTOP },
  'design-desktop-full': { url: '/design/vela-3', viewport: DESKTOP, fullPage: true },
  'design-mobile': { url: '/design/vela-3', viewport: MOBILE, isMobile: true },
  'design-paint': {
    url: '/design/vela-3', viewport: DESKTOP,
    prep: async (page) => {
      await page.click('[data-testid="paint-ember-red"]').catch(() => {});
      await page.waitForTimeout(900);
    },
  },
  'design-wheels': {
    url: '/design/vela-3', viewport: DESKTOP,
    prep: async (page) => {
      await page.click('[data-testid="wheel-arachnid-20"]').catch(() => {});
      await page.waitForTimeout(900);
    },
  },
  'design-suv': { url: '/design/vela-y', viewport: DESKTOP },
  'checkout-desktop': { url: '/checkout', viewport: DESKTOP },
  'checkout-desktop-full': { url: '/checkout', viewport: DESKTOP, fullPage: true },
  'checkout-mobile': { url: '/checkout', viewport: MOBILE, isMobile: true },
  'checkout-errors': {
    url: '/checkout', viewport: DESKTOP,
    prep: async (page) => {
      await page.click('[data-testid="place-order"]').catch(() => {});
      await page.waitForTimeout(500);
    },
  },
  'order-confirmation': { url: '/order/demo', viewport: DESKTOP },
};

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' }, () => { socket.end(); resolve(true); });
    socket.on('error', () => resolve(false));
    socket.setTimeout(800, () => { socket.destroy(); resolve(false); });
  });
}

async function ensureServer() {
  if (await portOpen(PORT)) return null;
  const child = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
    cwd: ROOT, stdio: 'ignore', detached: false,
  });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await portOpen(PORT)) return child;
    await new Promise((r) => setTimeout(r, 400));
  }
  child.kill();
  throw new Error('dev server did not start on port 5173');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--list')) {
    console.log(Object.keys(TARGETS).join('\n'));
    return;
  }
  const names = args.filter((a) => !a.startsWith('-'));
  const wanted = names.length ? names : Object.keys(TARGETS);
  const unknown = wanted.filter((n) => !TARGETS[n]);
  if (unknown.length) throw new Error(`unknown target(s): ${unknown.join(', ')} — run --list`);

  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  const server = await ensureServer();
  const browser = await chromium.launch({ args: ['--no-sandbox', '--font-render-hinting=none', '--force-color-profile=srgb'] });

  const results = [];
  for (const name of wanted) {
    const t = TARGETS[name];
    const context = await browser.newContext({
      viewport: t.viewport,
      deviceScaleFactor: 1,
      isMobile: Boolean(t.isMobile),
      hasTouch: Boolean(t.isMobile),
      userAgent: t.isMobile
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
        : undefined,
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    try {
      await page.goto(BASE + t.url, { waitUntil: 'networkidle', timeout: 45_000 });
      await page.waitForTimeout(t.wait ?? 700);
      const overlay = await page.locator('vite-error-overlay').count();
      if (overlay) {
        const msg = await page.locator('vite-error-overlay').evaluate((el) => el.shadowRoot?.textContent?.slice(0, 400) ?? 'vite error');
        throw new Error(`vite error overlay on screen — the app does not compile:\n${msg}`);
      }
      if (t.prep) await t.prep(page);
      const file = path.join(OUT, `${name}.png`);
      await page.screenshot({ path: file, fullPage: Boolean(t.fullPage), animations: 'disabled' });
      results.push({ name, file, errors });
      console.log(`✓ ${name} → .shots/${name}.png${errors.length ? `  [${errors.length} console error(s)]` : ''}`);
      for (const e of errors.slice(0, 3)) console.log(`    ! ${e.slice(0, 200)}`);
    } catch (err) {
      console.log(`✗ ${name}: ${String(err.message).split('\n')[0]}`);
      results.push({ name, error: String(err.message) });
    }
    await context.close();
  }

  await browser.close();
  if (server) server.kill();
  const failed = results.filter((r) => r.error);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => { console.error(err); process.exit(1); });
