# Contrato de construcción — KUROGANE (tienda de katanas)

Landing + tienda estática que debe **ganar a apple.com/airpods-pro** en diseño y en Lighthouse móvil.
Todo el copy va en **español (es-ES)**, tono: preciso, artesanal, sin adjetivos vacíos, sin emojis.

## Estructura del repo

```
site/src/shell.html        # cabecera + huecos (no la toques salvo que se te pida)
site/src/manifest.json     # orden de secciones y CSS
site/src/sections/<id>.html  # markup de cada pieza  <-- una pieza = un archivo
site/src/css/<id>.css        # estilos de esa pieza
site/src/js/ui/<id>.js       # comportamiento de esa pieza (export function init<Id>())
site/src/js/catalog.js       # datos de producto y precios (NO editar sin motivo)
site/src/js/store.js         # carrito, pedidos, persistencia (NO editar sin motivo)
site/src/js/validate.js      # reglas de validación de checkout
site/src/static/img/         # imágenes ya optimizadas (avif/webp/jpg)
```

Compilar: `node tools/build.mjs` → `site/dist/`. Servir: `node tools/serve.mjs site/dist 8080`.

## Reglas duras

1. **Cero dependencias externas.** Nada de CDN, frameworks, iconos remotos ni Google Fonts. Tipografía = stack del sistema (`--font-sans`).
2. **Nada de placeholders.** Ni bloques de color, ni `lorem`, ni `<div class="img">`. Toda imagen es una foto real de `site/src/static/img/`.
3. **Imágenes**: siempre `<picture>` con AVIF + WebP + fallback JPEG, `width`/`height` explícitos, `decoding="async"`, `loading="lazy"` (excepto la imagen LCP del hero, que lleva `fetchpriority="high"` y NO lleva lazy), y `sizes` correcto.
4. **Tokens**: usa las variables de `css/tokens.css`. No inventes colores sueltos ni `!important`.
5. **Sin CLS**: toda imagen y todo contenedor de altura variable con `aspect-ratio` o dimensiones.
6. **Accesibilidad**: landmarks correctos, `alt` descriptivo real, foco visible, objetivos ≥44px, contraste AA, overlays con foco atrapado y `Esc` para cerrar, `aria-live` para cambios de carrito.
7. **Movimiento**: respeta `prefers-reduced-motion`. Animaciones solo con `transform`/`opacity`.
8. **JS**: módulos ES, sin globals salvo el objeto de depuración `window.KG`. Nada de `innerHTML` con datos del usuario sin escapar.
9. **Presupuesto**: CSS total inlineado < 60 kB sin comprimir; JS bundle < 32 kB minificado.

## IDs obligatorios (los usa el arnés de captura y los tests)

| pieza | elemento raíz |
|---|---|
| nav | `<header id="top-nav">` |
| hero | `<section id="hero">` |
| trust | `<section id="trust">` |
| story-hamon | `<section id="hamon">` |
| story-forge | `<section id="forge">` |
| story-tsuba | `<section id="tsuba">` |
| catálogo | `<section id="catalogo">` |
| configurador | `<section id="configurador">` |
| specs | `<section id="specs">` |
| faq | `<section id="faq">` |
| footer | `<footer id="footer">` |
| carrito | `<aside id="cart-panel">` dentro de `#cart` |
| checkout | `<section id="checkout-panel">` dentro de `#checkout` |

Ganchos de comportamiento (data-attributes, no clases):
`[data-cart-open]`, `[data-cart-close]`, `[data-cart-count]`, `[data-checkout-open]`,
`[data-add-to-cart]` (con `data-product`), `[data-qty-inc]` / `[data-qty-dec]` / `[data-remove]` (con `data-key`),
`[data-option]` (con `data-group` y `data-value`), `[data-engraving]`, `[data-price]`, `[data-config-total]`.

## API disponible (importa, no reimplementes)

```js
import { PRODUCTS, OPTION_GROUPS, DEFAULT_VARIANTS, priceOf, formatPrice, describeVariants, productById, optionById } from '../catalog.js';
import { state, subscribe, addItem, setQty, removeItem, clearCart, totals, placeOrder } from '../store.js';
import { validateField, luhn, cardBrand } from '../validate.js';
```

`subscribe(fn)` llama a `fn(state)` al suscribirse y en cada cambio. Persiste solo en `localStorage`.

## Requisitos funcionales (esto se testea de verdad)

- **Catálogo**: 6 productos reales del array `PRODUCTS`, con foto, precio formateado y acción que lleva al configurador con ese producto seleccionado.
- **Configurador**: 4 grupos de opciones + grabado opcional; el precio se recalcula al vuelo con `priceOf`; la imagen/resumen refleja la selección; añade al carrito con la configuración exacta.
- **Carrito**: panel lateral con líneas, cantidades (+/−, máx 9), borrar, subtotal, envío (gratis desde 2.000 €), total con IVA desglosado, estado vacío digno, contador en el nav, persistencia al recargar.
- **Checkout**: pasos contacto → envío → pago → revisión → confirmación. Validación campo a campo con `validate.js` (incluye Luhn en tarjeta y caducidad), errores accesibles, resumen del pedido, `placeOrder()` genera referencia y limpia carrito, pantalla de confirmación con referencia y fecha estimada.

## Referencia visual

Capturas reales de apple.com/airpods-pro para estudiar (no copiar literalmente, superar):
- Desktop, tiles: `/tmp/claude-0/-home-user-sveltia-cms-auth/1330c57c-df42-5ebc-aecf-14a4f255d383/scratchpad/ref/tiles-desktop/apple-desktop-full-tNN.png`
- Móvil, tiles: `/tmp/claude-0/-home-user-sveltia-cms-auth/1330c57c-df42-5ebc-aecf-14a4f255d383/scratchpad/ref/tiles-mobile/apple-mobile-full-tNN.png`
- Fold: `/tmp/claude-0/-home-user-sveltia-cms-auth/1330c57c-df42-5ebc-aecf-14a4f255d383/scratchpad/ref/apple-desktop-fold.png`, `/tmp/claude-0/-home-user-sveltia-cms-auth/1330c57c-df42-5ebc-aecf-14a4f255d383/scratchpad/ref/apple-mobile-fold.png`

Lo que hace fuerte a esa página y hay que igualar o superar: titulares enormes con tracking negativo,
imagen a sangre que respira, ritmo claro/oscuro entre secciones, medida de línea corta, jerarquía brutal
entre eyebrow / titular / cuerpo, y cero ruido decorativo.

## Contrato de imágenes (nombres garantizados)

Todas viven en `/assets/img/` una vez compilado. Para cada nombre existen `-<ancho>.avif` y `-<ancho>.webp`,
más un `.jpg` en el ancho mayor como último recurso.

| nombre | anchos | proporción | uso |
|---|---|---|---|
| `hero-wide` | 1280, 1920, 2560 | 16:9 | imagen LCP del hero en desktop |
| `hero-tall` | 640, 960, 1280 | 3:4 | hero en móvil |
| `prod-mumei`, `prod-kurogane`, `prod-hanabira`, `prod-arashi`, `prod-tsuki`, `prod-ryujin` | 480, 800, 1200 | 4:5 | tarjetas de catálogo, configurador, carrito |
| `hamon` | 800, 1400, 2000 | 16:9 | sección del temple |
| `forge` | 800, 1400, 2000 | 16:9 | sección de forja |
| `tsuba` | 600, 1000 | 1:1 | sección de guarnición |
| `tsuka` | 600, 1000 | 1:1 | detalle de empuñadura |
| `saya` | 800, 1400 | 16:9 | detalle de vaina |
| `polish` | 800, 1400 | 16:9 | pulido/togishi |
| `display` | 800, 1400 | 16:9 | katana en soporte |

`site/src/static/img/inventory.json` lleva, por imagen, el `lqip` (data URI diminuto), la proporción real y el
crédito de la foto. Los créditos se listan en el footer.

Ejemplo de uso correcto (no lazy en el hero):

```html
<picture>
  <source type="image/avif" srcset="/assets/img/hero-wide-1280.avif 1280w, /assets/img/hero-wide-1920.avif 1920w, /assets/img/hero-wide-2560.avif 2560w" sizes="100vw">
  <source type="image/webp" srcset="/assets/img/hero-wide-1280.webp 1280w, /assets/img/hero-wide-1920.webp 1920w" sizes="100vw">
  <img src="/assets/img/hero-wide-2560.jpg" width="2560" height="1440" alt="Hoja de katana ..." fetchpriority="high" decoding="async">
</picture>
```
