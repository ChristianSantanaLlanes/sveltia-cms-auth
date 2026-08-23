// Renders tools/progress.json into a publishable status page.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(here, 'progress.json'), 'utf8'));
const OUT = process.argv[2] || '/tmp/claude-0/-home-user-sveltia-cms-auth/1330c57c-df42-5ebc-aecf-14a4f255d383/scratchpad/progress.html';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ms = (v) => (v == null ? '—' : v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`);
const mb = (v) => (v == null ? '—' : `${(v / 1048576).toFixed(2)} MB`);

const STATUS = {
  pending: { label: 'en cola', cls: 'pending' },
  building: { label: 'construyendo', cls: 'building' },
  judging: { label: 'en juicio', cls: 'judging' },
  lost: { label: 'perdida', cls: 'lost' },
  won: { label: 'ganada a ciegas', cls: 'won' },
};

const ours = data.metrics.ours;
const apple = data.metrics.apple;
const delta = (o, a, lowerBetter = false) => {
  if (o == null || a == null) return '';
  const better = lowerBetter ? o < a : o > a;
  const factor = lowerBetter ? (a / o) : (o / a);
  return `<span class="delta ${better ? 'up' : 'down'}">${better ? '▲' : '▼'} ${factor >= 2 ? `${factor.toFixed(1)}×` : `${Math.abs(Math.round((factor - 1) * 100))}%`}</span>`;
};

const pieceRows = data.pieces.map((p) => {
  const st = STATUS[p.status] || STATUS.pending;
  const rounds = (p.rounds || []).map((r, i) => `
      <li class="round ${r.winner === 'ours' ? 'is-win' : 'is-loss'}">
        <span class="round__n">R${i + 1}</span>
        <span class="round__verdict">${r.winner === 'ours' ? 'elige la nuestra' : 'elige la de Apple'}</span>
        <p class="round__gap">${esc(r.gap || '')}</p>
      </li>`).join('');
  return `
  <article class="piece piece--${st.cls}">
    <header class="piece__head">
      <h3 class="piece__name">${esc(p.name)}</h3>
      <span class="pill pill--${st.cls}">${st.label}</span>
      <span class="piece__count">${(p.rounds || []).length} ronda${(p.rounds || []).length === 1 ? '' : 's'}</span>
    </header>
    ${p.note ? `<p class="piece__note">${esc(p.note)}</p>` : ''}
    ${rounds ? `<ol class="rounds">${rounds}</ol>` : ''}
  </article>`;
}).join('');

const html = `<title>Bitácora KUROGANE</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@500;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=Roboto+Mono:wght@400;500&display=swap">
<style>
:root {
  --paper: #f2efe9;
  --paper-2: #e8e4dc;
  --card: #fbfaf7;
  --ink: #17161a;
  --ink-2: #4a4750;
  --ink-3: #7d7986;
  --rule: rgba(23, 22, 26, .14);
  --ai: #26456e;
  --ai-soft: rgba(38, 69, 110, .1);
  --tetsu: #7a5c3e;
  --win: #2f6b4f;
  --loss: #9a3324;
  --shadow: 0 1px 2px rgba(20,18,26,.06), 0 12px 30px rgba(20,18,26,.07);
  --display: "Shippori Mincho B1", "Hiragino Mincho ProN", Georgia, serif;
  --body: "Zen Kaku Gothic New", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --mono: "Roboto Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}
:root:not([data-theme="light"]) { }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --paper: #121114;
    --paper-2: #191819;
    --card: #1c1b1e;
    --ink: #eeebe4;
    --ink-2: #b3afa8;
    --ink-3: #85818b;
    --rule: rgba(238, 235, 228, .16);
    --ai: #8fb3e0;
    --ai-soft: rgba(143, 179, 224, .12);
    --tetsu: #c39a6b;
    --win: #6fbf95;
    --loss: #e08b78;
    --shadow: 0 1px 2px rgba(0,0,0,.4), 0 16px 40px rgba(0,0,0,.35);
  }
}
:root[data-theme="dark"] {
  --paper: #121114; --paper-2: #191819; --card: #1c1b1e;
  --ink: #eeebe4; --ink-2: #b3afa8; --ink-3: #85818b;
  --rule: rgba(238, 235, 228, .16);
  --ai: #8fb3e0; --ai-soft: rgba(143, 179, 224, .12); --tetsu: #c39a6b;
  --win: #6fbf95; --loss: #e08b78;
  --shadow: 0 1px 2px rgba(0,0,0,.4), 0 16px 40px rgba(0,0,0,.35);
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--paper); color: var(--ink);
  font-family: var(--body); font-size: 16px; line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
.wrap { width: min(100% - 2.5rem, 980px); margin-inline: auto; padding-block: clamp(2.5rem, 6vw, 4.5rem); display: flex; flex-direction: column; gap: clamp(2rem, 4vw, 3rem); }
.head { display: flex; flex-direction: column; gap: .9rem; }
.stamp { font-family: var(--mono); font-size: .74rem; letter-spacing: .18em; text-transform: uppercase; color: var(--ink-3); display: flex; gap: .8rem; flex-wrap: wrap; align-items: center; }
.stamp b { color: var(--tetsu); font-weight: 500; }
h1 { font-family: var(--display); font-weight: 700; font-size: clamp(1.9rem, 4.6vw, 3rem); line-height: 1.15; letter-spacing: -.01em; margin: 0; text-wrap: balance; }
.sub { color: var(--ink-2); max-width: 62ch; margin: 0; }
.metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 1px; background: var(--rule); border: 1px solid var(--rule); border-radius: 14px; overflow: hidden; box-shadow: var(--shadow); }
.metric { background: var(--card); padding: 1.1rem 1.2rem; display: flex; flex-direction: column; gap: .35rem; }
.metric__k { font-family: var(--mono); font-size: .7rem; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-3); }
.metric__v { font-family: var(--display); font-size: 1.85rem; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1; }
.metric__ref { font-size: .8rem; color: var(--ink-3); font-variant-numeric: tabular-nums; }
.delta { font-family: var(--mono); font-size: .78rem; }
.delta.up { color: var(--win); }
.delta.down { color: var(--loss); }
h2 { font-family: var(--display); font-size: 1.25rem; font-weight: 700; margin: 0 0 .9rem; letter-spacing: .01em; }
.pieces { display: flex; flex-direction: column; gap: .75rem; }
.piece { background: var(--card); border: 1px solid var(--rule); border-radius: 12px; padding: 1rem 1.1rem; box-shadow: var(--shadow); }
.piece__head { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
.piece__name { font-family: var(--display); font-size: 1.05rem; font-weight: 700; margin: 0; flex: 1 1 auto; }
.piece__count { font-family: var(--mono); font-size: .74rem; color: var(--ink-3); }
.piece__note { margin: .55rem 0 0; color: var(--ink-2); font-size: .92rem; }
.pill { font-family: var(--mono); font-size: .68rem; letter-spacing: .12em; text-transform: uppercase; padding: .25rem .6rem; border-radius: 999px; border: 1px solid currentColor; }
.pill--pending { color: var(--ink-3); }
.pill--building { color: var(--tetsu); }
.pill--judging { color: var(--ai); background: var(--ai-soft); border-color: transparent; }
.pill--lost { color: var(--loss); }
.pill--won { color: var(--win); }
.rounds { list-style: none; margin: .85rem 0 0; padding: 0; display: flex; flex-direction: column; gap: .5rem; }
.round { display: grid; grid-template-columns: auto 1fr; gap: .2rem .7rem; padding-left: .8rem; border-left: 2px solid var(--rule); }
.round.is-win { border-left-color: var(--win); }
.round.is-loss { border-left-color: var(--loss); }
.round__n { font-family: var(--mono); font-size: .74rem; color: var(--ink-3); }
.round__verdict { font-size: .84rem; font-weight: 500; }
.round.is-win .round__verdict { color: var(--win); }
.round.is-loss .round__verdict { color: var(--loss); }
.round__gap { grid-column: 2; margin: 0; font-size: .86rem; color: var(--ink-2); }
.log { border-top: 1px solid var(--rule); padding-top: 1rem; display: flex; flex-direction: column; gap: .6rem; }
.log__row { display: grid; grid-template-columns: 4.2rem 1fr; gap: .8rem; align-items: baseline; }
.log__t { font-family: var(--mono); font-size: .76rem; color: var(--ink-3); font-variant-numeric: tabular-nums; }
.log__x { margin: 0; font-size: .92rem; color: var(--ink-2); }
.imgbank { display: flex; gap: 1.5rem; flex-wrap: wrap; font-family: var(--mono); font-size: .8rem; color: var(--ink-2); }
.imgbank b { font-family: var(--display); font-size: 1.4rem; color: var(--ink); display: block; }
footer { color: var(--ink-3); font-size: .8rem; font-family: var(--mono); border-top: 1px solid var(--rule); padding-top: 1rem; }
@media (prefers-reduced-motion: no-preference) { .piece { transition: border-color 240ms ease; } }
</style>
<div class="wrap">
  <header class="head">
    <p class="stamp"><b>${esc(data.phase)}</b> <span>actualizado ${esc(data.updated)}</span></p>
    <h1>${esc(data.headline)}</h1>
    <p class="sub">Cada pieza se construye y se juzga por separado. El crítico ve la nuestra y la de Apple sin etiquetas, elige una y nombra la brecha que queda. Se repite hasta que elige la nuestra.</p>
  </header>

  <section>
    <h2>Lighthouse móvil</h2>
    <div class="metrics">
      <div class="metric"><span class="metric__k">Performance</span><span class="metric__v">${ours ? ours.perf : '—'} ${delta(ours?.perf, apple.perf)}</span><span class="metric__ref">Apple ${apple.perf}</span></div>
      <div class="metric"><span class="metric__k">LCP</span><span class="metric__v">${ours ? ms(ours.lcp) : '—'} ${delta(ours?.lcp, apple.lcp, true)}</span><span class="metric__ref">Apple ${ms(apple.lcp)}</span></div>
      <div class="metric"><span class="metric__k">Bloqueo total</span><span class="metric__v">${ours ? ms(ours.tbt) : '—'} ${delta(ours?.tbt, apple.tbt, true)}</span><span class="metric__ref">Apple ${ms(apple.tbt)}</span></div>
      <div class="metric"><span class="metric__k">Peso</span><span class="metric__v">${ours ? mb(ours.bytes) : '—'} ${delta(ours?.bytes, apple.bytes, true)}</span><span class="metric__ref">Apple ${mb(apple.bytes)}</span></div>
    </div>
  </section>

  <section>
    <h2>Piezas</h2>
    <div class="pieces">${pieceRows || '<p class="sub">Aún sin piezas en juicio.</p>'}</div>
  </section>

  <section>
    <h2>Banco de imágenes</h2>
    <div class="imgbank">
      <span><b>${data.images.raw}</b> descargadas</span>
      <span><b>${data.images.curated}</b> seleccionadas</span>
      <span><b>${data.images.optimized}</b> optimizadas AVIF/WebP</span>
    </div>
  </section>

  <section>
    <h2>Bitácora</h2>
    <div class="log">
      ${data.log.map((l) => `<div class="log__row"><span class="log__t">${esc(l.t)}</span><p class="log__x">${esc(l.text)}</p></div>`).join('')}
    </div>
  </section>

  <footer>KUROGANE · rama claude/katana-store-landing-qsodw2 · medidas con Lighthouse simulado, móvil, 4× CPU</footer>
</div>`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`progress page -> ${OUT} (${(html.length / 1024).toFixed(1)}kB)`);
