# KUROGANE — tienda de katanas

Landing + tienda estática construida para medirse con `apple.com/airpods-pro`: mismo listón visual,
mejor Lighthouse. Sin frameworks, sin dependencias en tiempo de ejecución, sin peticiones a terceros.

## Cómo se monta

```
site/src/shell.html          cabecera y huecos
site/src/manifest.json       orden de secciones, CSS crítico vs diferido
site/src/sections/*.html     una pieza por archivo
site/src/css/*.css           el CSS de esa pieza
site/src/js/ui/*.js          el comportamiento de esa pieza
site/src/js/catalog.js       catálogo, opciones y reglas de precio
site/src/js/store.js         carrito, pedidos y persistencia (localStorage)
site/src/js/validate.js      validación de checkout (incluye Luhn)
site/src/static/img/         imágenes optimizadas + inventory.json con créditos
```

```bash
node tools/build.mjs                     # compila a site/dist
node tools/serve.mjs site/dist 8080      # servidor con brotli y cache inmutable
```

El build inlinea el CSS crítico (nav, hero, franja de datos), deja el resto en `/assets/rest.css`
sin bloquear el pintado, empaqueta el JS con esbuild e inyecta los créditos de foto en el pie
a partir de `inventory.json`.

## Cómo se verifica

```bash
tools/round.sh 1              # build + capturas + e2e + Lighthouse + pares ciegos
node tools/e2e.mjs http://127.0.0.1:8080/ desktop   # recorrido de compra real
node tools/audit.mjs                                 # estructura, accesibilidad, presupuestos
node tools/lh.mjs http://127.0.0.1:8080/ mobile /tmp/lh.json 3
```

- `tools/e2e.mjs` recorre catálogo → configurador → carrito → checkout → pedido con Playwright,
  y comprueba precios, persistencia tras recarga, validación y referencia del pedido.
- `tools/audit.mjs` falla si hay imágenes sin `alt`, ids duplicados, desbordes horizontales,
  recursos externos o si se pasa del presupuesto de CSS/JS.
- `tools/make-blind.mjs` recorta nuestra pieza y la zona equivalente de la referencia al mismo
  tamaño, tapa las marcas identificables, baraja el orden y guarda la clave fuera de la carpeta
  que ve el crítico.

## Fotografía

Todas las fotos son reales, de fuentes de acceso abierto (Openverse, Wikimedia Commons,
The Metropolitan Museum of Art, Art Institute of Chicago). Los créditos y licencias viven en
`site/src/static/img/inventory.json` y se publican en el pie de la página.

## Aviso

Tienda de demostración: no hay cobros reales ni pasarela de pago. Los datos de producto son
ficticios y las fotos pertenecen a sus autores.
