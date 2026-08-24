/** El puente entre el catálogo y el configurador: abrir un producto no salta,
 *  se transforma. La tarjeta y la ficha tienen cinco cosas en común —la foto,
 *  el kanji, el nombre, la frase y el botón— y las dos las marcan con
 *  `data-morph="shot|kanji|name|claim|cta"`. Aquí se les pone el mismo
 *  `view-transition-name` en los dos extremos del viaje: para el navegador
 *  dejan de ser dos elementos que se cruzan y pasan a ser uno solo que cambia
 *  de sitio, de tamaño y de encuadre.
 *
 *  Cómo viaja cada uno se decide en css/transition.css. Donde no hay View
 *  Transitions, o con `prefers-reduced-motion: reduce`, no pasa nada: el
 *  cambio ocurre igual, sin animación. */

/** Tope de espera por la foto de destino. Mejor animar con un fotograma pobre
 *  que dejar el clic sin respuesta. */
const PHOTO_MS = 300;

let running = false;

/** Solo se anima lo que se está viendo: una tarjeta fuera de pantalla no tiene
 *  fotograma de salida que animar. */
const inView = (node) => {
  const box = node.getBoundingClientRect();
  return box.bottom > 0 && box.top < window.innerHeight;
};

export const canMorph = (card) => !running
  && !!card
  && !!document.startViewTransition
  && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  && inView(card);

/** Bautiza (o desbautiza) los elementos marcados dentro de `root`. */
const rename = (root, on) => {
  for (const node of root.querySelectorAll('[data-morph]')) {
    node.style.setProperty('view-transition-name', on ? `kg-${node.dataset.morph}` : '');
  }
};

/** La foto de la ficha es `lazy` y vive fuera de pantalla: sin esto el
 *  navegador ni la pide, y el destino de la animación sería un marco vacío. */
const photoReady = (detail) => new Promise((done) => {
  const img = detail.querySelector('[data-config-img]');
  if (!img || !img.decode) { done(); return; }
  img.loading = 'eager';
  const timer = setTimeout(done, PHOTO_MS);
  const settle = () => { clearTimeout(timer); done(); };
  img.decode().then(settle, settle);
});

/** Abre un producto como si la tarjeta se convirtiera en la ficha.
 *  `select` cambia de modelo y `land` deja la ficha delante; los dos se
 *  ejecutan aunque la animación no llegue a correr. */
export async function morphToDetail({ card, detail, select, land }) {
  const html = document.documentElement;
  running = true;
  html.dataset.morphing = '';
  try {
    // El modelo cambia antes del fotograma de salida: el configurador está
    // fuera de pantalla, así que nadie ve el cambio, y cuando la animación
    // aterriza la foto nueva ya está descargada y decodificada.
    select();
    await photoReady(detail);
    rename(card, true);

    const view = document.startViewTransition(() => {
      rename(card, false);
      rename(detail, true);
      land();
    });
    await view.finished.catch(() => {});
  } catch {
    land();
  }
  rename(card, false);
  rename(detail, false);
  delete html.dataset.morphing;
  running = false;
}
