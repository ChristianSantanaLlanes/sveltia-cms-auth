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
site/src/js/transition.js    abrir un producto: la tarjeta se convierte en la ficha
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

## Abrir un producto

Pulsar «Configurar» no salta al configurador: lo convierte. La tarjeta y la ficha marcan con
`data-morph` las cinco cosas que tienen en común —foto, kanji, nombre, frase y botón— y
`js/transition.js` les pone el mismo `view-transition-name` en los dos extremos, así que el
navegador anima uno hasta el otro con la View Transitions API; `css/transition.css` decide cómo
viaja cada uno. El modelo se cambia antes de arrancar (el configurador está fuera de pantalla) para
que la foto de destino ya esté decodificada, con un tope de 300 ms para no dejar el clic colgado.

Sin View Transitions, o con `prefers-reduced-motion: reduce`, el comportamiento es el de siempre:
mismo cambio de modelo y mismo scroll, sin animación.

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
