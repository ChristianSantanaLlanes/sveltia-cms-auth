#!/usr/bin/env node
/**
 * Walks the whole purchase funnel against the dev server and asserts the
 * behaviour a shopper depends on: filters narrow results, options change the
 * price, and an order can actually be placed.
 *
 *   node tools/funnel-test.mjs
 */
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:5173';
const CHROME = '/opt/pw-browsers/chromium';
const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`);
};

const browser = await chromium.launch({ args: ['--no-sandbox'], executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });

// 1. Home
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
const sections = await page.locator('section').count();
check('home renders one section per model', sections >= 4, `${sections} sections`);
check('hero CTA points at the configurator', (await page.locator('a[href="/design/vela-3"]').count()) > 0);

// 2. Inventory
await page.goto(BASE + '/inventory', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const allCards = await page.locator('[data-testid="vehicle-card"]').count();
check('inventory lists vehicles', allCards > 0, `${allCards} cards on first screen`);

const headline = (await page.locator('[data-testid="result-count"]').first().innerText()).trim();
check('result count is stated', /\d+\s+results?/i.test(headline), headline);

// filter by model
await page.goto(BASE + '/inventory?model=vela-x', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const filteredHeadline = (await page.locator('[data-testid="result-count"]').first().innerText()).trim();
const filteredCards = await page.locator('[data-testid="vehicle-card"]').count();
const titles = await page.locator('[data-testid="vehicle-card"]').allInnerTexts();
check('URL filter narrows the results', filteredHeadline !== headline, `${headline} → ${filteredHeadline}`);
check('every filtered card matches the filter', filteredCards > 0 && titles.every((t) => t.includes('Vela X')), `${filteredCards} cards`);

// empty state
await page.goto(BASE + '/inventory?model=vela-x&maxPrice=30000', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const emptyCards = await page.locator('[data-testid="vehicle-card"]').count();
const bodyText = await page.locator('main').innerText();
check('impossible filters produce an empty state, not a blank page', emptyCards === 0 && /no |0 results|clear|reset/i.test(bodyText));

// 3. Configurator
await page.goto(BASE + '/design/vela-3', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const priceOf = async () => {
  const el = page.locator('[data-testid="price-total"]').first();
  if (await el.count()) return (await el.innerText()).replace(/[^\d]/g, '');
  const txt = await page.locator('main').innerText();
  return (txt.match(/\$[\d,]+/g) || []).join('|');
};
const basePrice = await priceOf();

await page.locator('[data-testid="trim-performance"]').first().click();
await page.waitForTimeout(900);
const trimPrice = await priceOf();
check('choosing a trim changes the price', trimPrice !== basePrice, `${basePrice} → ${trimPrice}`);

const paintBefore = await page.locator('svg[role="img"]').first().getAttribute('aria-label');
await page.locator('[data-testid="paint-ember-red"]').first().click();
await page.waitForTimeout(900);
const paintAfter = await page.locator('svg[role="img"]').first().getAttribute('aria-label');
check('choosing a paint repaints the car', paintBefore !== paintAfter, `${paintBefore} → ${paintAfter}`);

const beforeWheel = await priceOf();
await page.locator('[data-testid="wheel-arachnid-20"]').first().click();
await page.waitForTimeout(900);
check('choosing wheels changes the price', (await priceOf()) !== beforeWheel);

// 4. Checkout
await page.goto(BASE + '/checkout', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.locator('[data-testid="place-order"]').first().click();
await page.waitForTimeout(700);
const errorCount = await page.locator('[role="alert"]').count();
check('submitting an empty form shows field errors', errorCount > 0, `${errorCount} messages`);
check('failed submit does not navigate away', page.url().includes('/checkout'));

const fill = async (label, value) => {
  const field = page.getByLabel(label, { exact: false }).first();
  if (await field.count()) { await field.fill(value); return true; }
  return false;
};
const filled = [];
for (const [label, value] of [
  ['First name', 'Ada'], ['Last name', 'Lovelace'], ['Email address', 'ada@example.com'], ['Phone number', '4155550123'],
  ['Street address', '2500 Mission College Blvd'], ['City', 'Santa Clara'], ['ZIP code', '95054'],
  ['Card number', '4242424242424242'], ['Expiry', '12/29'], ['Security code', '123'], ['Name on card', 'Ada Lovelace'],
]) filled.push([label, await fill(label, value)]);
check('every checkout field is labelled and fillable', filled.every(([, ok]) => ok), filled.filter(([, ok]) => !ok).map(([l]) => l).join(', ') || 'all fields found');

const stateSelect = page.getByLabel('State', { exact: false }).first();
if (await stateSelect.count()) await stateSelect.selectOption({ label: 'California' }).catch(async () => { await stateSelect.selectOption('CA').catch(() => {}); });
check('the state select offers real options', (await stateSelect.inputValue()) !== '', await stateSelect.inputValue());
for (const box of await page.locator('input[type="checkbox"]').all()) await box.check().catch(() => {});
await page.locator('[data-testid="place-order"]').first().click();
await page.waitForTimeout(2500);
check('a completed form places the order', /\/order\//.test(page.url()), page.url().replace(BASE, ''));
const confirmation = await page.locator('main').innerText();
check('confirmation states an order number', /[A-Z]{2,}-?\d{3,}|order\s*#?\s*\w{5,}/i.test(confirmation));

check('no uncaught errors during the walkthrough', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
