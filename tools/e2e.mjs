// Functional gate: catalog -> configurator -> cart -> checkout -> order, for real.
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const url = process.argv[2] || 'http://127.0.0.1:8080/';
const mode = process.argv[3] || 'desktop';
const results = [];
const check = async (name, fn) => {
  try { const detail = await fn(); results.push({ name, pass: true, detail: detail || '' }); }
  catch (e) { results.push({ name, pass: false, detail: e.message.split('\n')[0].slice(0, 200) }); }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const ctx = await browser.newContext(mode === 'mobile'
  ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }
  : { viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const jsErrors = [];
page.on('pageerror', (e) => jsErrors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') jsErrors.push(m.text()); });
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

await check('la página carga sin errores de JS', async () => {
  assert(jsErrors.length === 0, `errores: ${jsErrors.slice(0, 3).join(' | ')}`);
});

await check('el catálogo pinta los 6 productos', async () => {
  const n = await page.locator('#catalogo [data-product-card]').count();
  assert(n >= 6, `solo ${n} tarjetas`);
  return `${n} tarjetas`;
});

await check('cada tarjeta muestra una foto real cargada', async () => {
  await page.locator('#catalogo').scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  const broken = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('#catalogo img')];
    return imgs.filter((i) => !i.complete || i.naturalWidth < 40).map((i) => i.currentSrc || i.src);
  });
  assert(broken.length === 0, `imágenes rotas: ${broken.slice(0, 3).join(', ')}`);
});

await check('elegir producto desde el catálogo lleva al configurador', async () => {
  await page.locator('#catalogo [data-product-card]').nth(2).locator('[data-configure]').first().click();
  await page.waitForTimeout(600);
  const active = await page.getAttribute('#configurador', 'data-product');
  assert(active, 'el configurador no expone data-product');
  return `producto activo: ${active}`;
});

await check('cambiar una opción actualiza el precio', async () => {
  const before = await page.locator('[data-config-total]').first().innerText();
  await page.locator('#configurador [data-option][data-group="edge"][data-value="damascus"]').first().click();
  await page.waitForTimeout(350);
  const after = await page.locator('[data-config-total]').first().innerText();
  assert(before !== after, `el precio no cambió (${before})`);
  return `${before} -> ${after}`;
});

await check('añadir al carrito actualiza el contador', async () => {
  await page.locator('#configurador [data-add-to-cart]').first().click();
  await page.waitForTimeout(500);
  const count = await page.locator('[data-cart-count]').first().innerText();
  assert(Number(count.replace(/\D/g, '')) >= 1, `contador = ${count}`);
  return `contador ${count}`;
});

await check('el panel del carrito abre y muestra la línea con su configuración', async () => {
  const panel = page.locator('#cart-panel');
  if (!(await panel.isVisible())) {
    const open = page.locator('[data-cart-open]:visible').first();
    await open.click();
    await page.waitForTimeout(500);
  }
  const visible = await page.locator('#cart-panel').isVisible();
  assert(visible, 'el panel no es visible');
  const line = await page.locator('#cart-panel [data-cart-line]').count();
  assert(line >= 1, 'no hay líneas en el carrito');
  const txt = await page.locator('#cart-panel').innerText();
  assert(/Damasco|damascus/i.test(txt), 'la configuración elegida no aparece en la línea');
  return `${line} línea(s)`;
});

await check('sumar cantidad recalcula el total', async () => {
  const before = await page.locator('#cart-panel [data-cart-total]').first().innerText();
  await page.locator('#cart-panel [data-qty-inc]').first().click();
  await page.waitForTimeout(400);
  const after = await page.locator('#cart-panel [data-cart-total]').first().innerText();
  assert(before !== after, `total sin cambios (${before})`);
  return `${before} -> ${after}`;
});

await check('el carrito sobrevive a una recarga', async () => {
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const count = await page.locator('[data-cart-count]').first().innerText();
  assert(Number(count.replace(/\D/g, '')) >= 2, `contador tras recarga = ${count}`);
  return `contador ${count}`;
});

await check('el checkout rechaza datos inválidos', async () => {
  await page.evaluate(() => window.KG.openCheckout());
  await page.waitForTimeout(600);
  await page.fill('#checkout-panel [name="email"]', 'no-es-un-email');
  await page.locator('#checkout-panel [data-step-next]').first().click();
  await page.waitForTimeout(350);
  const err = await page.locator('#checkout-panel [data-error]:not(:empty)').count();
  assert(err >= 1, 'no se mostró ningún error de validación');
  return `${err} error(es) mostrados`;
});

await check('el checkout completo genera un pedido con referencia', async () => {
  const fill = async (sel, val) => { const el = page.locator(`#checkout-panel ${sel}`); if (await el.count()) await el.first().fill(val); };
  await fill('[name="email"]', 'kenshin@example.com');
  await fill('[name="name"]', 'Kenshin Himura');
  await fill('[name="phone"]', '600123456');
  await page.locator('#checkout-panel [data-step-next]').first().click();
  await page.waitForTimeout(400);
  await fill('[name="address"]', 'Calle Mayor 12');
  await fill('[name="city"]', 'Valencia');
  await fill('[name="zip"]', '46002');
  const country = page.locator('#checkout-panel [name="country"]');
  if (await country.count()) await country.first().selectOption({ index: 1 }).catch(() => country.first().fill('España'));
  await page.locator('#checkout-panel [data-step-next]:visible').first().click();
  await page.waitForTimeout(400);
  await fill('[name="holder"]', 'KENSHIN HIMURA');
  await fill('[name="card"]', '4242 4242 4242 4242');
  await fill('[name="expiry"]', '12/30');
  await fill('[name="cvc"]', '123');
  const age = page.locator('#checkout-panel [name="age"]');
  if (await age.count()) await age.first().check().catch(() => {});
  await page.locator('#checkout-panel [data-step-next]:visible').first().click();
  await page.waitForTimeout(400);
  const place = page.locator('#checkout-panel [data-place-order]');
  if (await place.count()) await place.first().click();
  await page.waitForTimeout(900);
  const txt = await page.locator('#checkout-panel').innerText();
  const ref = txt.match(/KG-\d{8}-\d{3}/);
  assert(ref, `no aparece la referencia del pedido. Texto: ${txt.slice(0, 200)}`);
  return `pedido ${ref[0]}`;
});

await check('tras el pedido el carrito queda vacío', async () => {
  const count = await page.evaluate(() => window.KG.state.items.length);
  assert(count === 0, `quedan ${count} líneas`);
});

await check('sin errores de JS al final del recorrido', async () => {
  assert(jsErrors.length === 0, `errores: ${jsErrors.slice(0, 3).join(' | ')}`);
});

await browser.close();
const failed = results.filter((r) => !r.pass);
fs.writeFileSync(`/tmp/e2e-${mode}.json`, JSON.stringify(results, null, 2));
for (const r of results) console.log(`${r.pass ? 'OK  ' : 'FALLA'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
console.log(`\n${results.length - failed.length}/${results.length} pasan (${mode})`);
process.exit(failed.length ? 1 : 0);
