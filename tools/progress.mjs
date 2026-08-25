#!/usr/bin/env node
/**
 * Renders progress/index.html from progress/state.json, inlining the latest
 * captures from .shots as JPEG data URIs so the page stands alone.
 *
 *   node tools/progress.mjs
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, '.shots');
const STATE = path.join(ROOT, 'progress', 'state.json');
const OUT = path.join(ROOT, 'progress', 'index.html');

const STATUS = {
  queued:    { label: 'Queued',     tone: 'idle' },
  building:  { label: 'Building',   tone: 'work' },
  reviewing: { label: 'In review',  tone: 'work' },
  revising:  { label: 'Revising',   tone: 'warn' },
  lost:      { label: 'Critic picked Tesla', tone: 'warn' },
  won:       { label: 'Ours wins',  tone: 'good' },
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function thumb(name, width) {
  const file = path.join(SHOTS, `${name}.png`);
  if (!existsSync(file)) return null;
  const buf = await sharp(file).resize({ width, withoutEnlargement: true }).jpeg({ quality: 68, mozjpeg: true }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

function git(cmd, fallback = '') {
  try { return execSync(cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { return fallback; }
}

const state = JSON.parse(readFileSync(STATE, 'utf8'));

// Merge per-piece verdicts dropped by the critics into .progress/<id>.json
const PROG = path.join(ROOT, '.progress');
if (existsSync(PROG)) {
  for (const file of readdirSync(PROG).filter((f) => f.endsWith('.json'))) {
    let patch;
    try { patch = JSON.parse(readFileSync(path.join(PROG, file), 'utf8')); } catch { continue; }
    const piece = state.pieces.find((p) => p.id === patch.id);
    if (!piece) continue;
    Object.assign(piece, {
      status: patch.status ?? piece.status,
      rounds: patch.rounds ?? piece.rounds,
      verdict: patch.verdict ?? piece.verdict,
      gap: patch.gap ?? piece.gap,
    });
    if (patch.log) {
      state.log = state.log || [];
      for (const entry of patch.log) {
        if (!state.log.some((l) => l.t === entry.t && l.msg === entry.msg)) state.log.push(entry);
      }
    }
  }
  state.log = (state.log || []).sort((a, b) => String(a.t).localeCompare(String(b.t)));
}
const stamp = state.updated || new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const branch = git('git rev-parse --abbrev-ref HEAD', 'unknown');
const commit = git('git rev-parse --short HEAD', '—');
const commitCount = git('git rev-list --count HEAD', '0');

const won = state.pieces.filter((p) => p.status === 'won').length;
const total = state.pieces.length;
const pct = Math.round((won / total) * 100);

const shotNames = [...new Set(state.pieces.flatMap((p) => p.shots || []))];
const gallery = [];
for (const name of shotNames) {
  const src = await thumb(name, name.includes('mobile') ? 300 : 760);
  if (src) gallery.push({ name, src, mobile: name.includes('mobile') });
}

const rows = state.pieces.map((p) => {
  const st = STATUS[p.status] || STATUS.queued;
  const dots = Array.from({ length: Math.max(p.rounds, 0) }, () => '<i></i>').join('');
  return `
      <tr>
        <th scope="row">
          <span class="piece">${esc(p.name)}</span>
          <span class="detail">${esc(p.detail)}</span>
        </th>
        <td><span class="chip ${st.tone}">${esc(st.label)}</span></td>
        <td class="rounds"><span class="dots">${dots || '<i class="empty"></i>'}</span><span class="count">${p.rounds}</span></td>
        <td class="gap">${p.gap ? esc(p.gap) : '<span class="muted">—</span>'}</td>
      </tr>`;
}).join('');

const logRows = (state.log || []).slice(-14).reverse().map((l) => `
      <li><time>${esc(l.t)}</time><span>${esc(l.msg)}</span></li>`).join('');

const html = `<title>Vela Build Sheet</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root {
  --ground: #ffffff;
  --plate: #f5f6f7;
  --plate-2: #eceef0;
  --line: #d9dcdf;
  --line-soft: #e7e9eb;
  --text: #15171b;
  --text-2: #5d636d;
  --text-3: #8b919a;
  --accent: #2f55d4;
  --good: #14764f;
  --warn: #97650f;
  --idle: #7d838c;
  --shadow: 0 1px 2px rgba(16, 18, 22, .06), 0 10px 28px rgba(16, 18, 22, .06);
}
:root:not([data-theme="light"]) { }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --ground: #0d0e11;
    --plate: #15171b;
    --plate-2: #1b1e23;
    --line: #292d34;
    --line-soft: #21252b;
    --text: #f1f2f4;
    --text-2: #9aa1ab;
    --text-3: #6d747e;
    --accent: #6d8dff;
    --good: #4fbb8a;
    --warn: #d6a343;
    --idle: #757c86;
    --shadow: 0 1px 2px rgba(0, 0, 0, .5), 0 16px 40px rgba(0, 0, 0, .35);
  }
}
:root[data-theme="dark"] {
  --ground: #0d0e11;
  --plate: #15171b;
  --plate-2: #1b1e23;
  --line: #292d34;
  --line-soft: #21252b;
  --text: #f1f2f4;
  --text-2: #9aa1ab;
  --text-3: #6d747e;
  --accent: #6d8dff;
  --good: #4fbb8a;
  --warn: #d6a343;
  --idle: #757c86;
  --shadow: 0 1px 2px rgba(0, 0, 0, .5), 0 16px 40px rgba(0, 0, 0, .35);
}

* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--ground);
  color: var(--text);
  font-family: 'Archivo', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-size: 15px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}
.wrap { max-width: 1080px; margin: 0 auto; padding: clamp(24px, 5vw, 56px) clamp(16px, 4vw, 40px) 96px; }
.mono { font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace; }

header.masthead { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-end; justify-content: space-between; padding-bottom: 20px; border-bottom: 1px solid var(--line); }
.brand { display: flex; flex-direction: column; gap: 6px; }
.eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: var(--text-3); }
h1 { margin: 0; font-size: clamp(28px, 4.4vw, 40px); font-weight: 700; letter-spacing: -.025em; line-height: 1.05; text-wrap: balance; }
.sub { color: var(--text-2); max-width: 58ch; margin: 8px 0 0; }
.meta { display: grid; gap: 4px; text-align: right; font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--text-3); }
.meta b { color: var(--text-2); font-weight: 500; }

.tally { display: flex; align-items: baseline; gap: 12px; margin: 28px 0 10px; }
.tally .n { font-size: 44px; font-weight: 700; letter-spacing: -.03em; font-variant-numeric: tabular-nums; line-height: 1; }
.tally .of { color: var(--text-2); font-size: 15px; }
.bar { height: 6px; background: var(--plate-2); border-radius: 99px; overflow: hidden; }
.bar > span { display: block; height: 100%; width: ${pct}%; background: var(--accent); border-radius: 99px; transition: width .4s cubic-bezier(.16,1,.3,1); }

.notice { margin: 32px 0 0; padding: 18px 20px; background: var(--plate); border: 1px solid var(--line-soft); border-left: 3px solid var(--warn); border-radius: 4px; }
.notice h2 { margin: 0 0 6px; font-size: 12px; letter-spacing: .18em; text-transform: uppercase; font-family: 'IBM Plex Mono', monospace; font-weight: 500; color: var(--warn); }
.notice p { margin: 0; color: var(--text-2); font-size: 14px; }

section { margin-top: 44px; }
h2.section { font-size: 12px; letter-spacing: .18em; text-transform: uppercase; font-family: 'IBM Plex Mono', monospace; font-weight: 500; color: var(--text-3); margin: 0 0 14px; }

.table-scroll { overflow-x: auto; border: 1px solid var(--line-soft); border-radius: 6px; background: var(--plate); }
table { width: 100%; border-collapse: collapse; min-width: 640px; }
th, td { text-align: left; padding: 14px 16px; border-bottom: 1px solid var(--line-soft); vertical-align: top; font-weight: 400; }
tr:last-child th, tr:last-child td { border-bottom: 0; }
th[scope="row"] { width: 30%; }
.piece { display: block; font-weight: 600; letter-spacing: -.01em; }
.detail { display: block; color: var(--text-3); font-size: 13px; }
.chip { display: inline-block; padding: 3px 10px; border-radius: 99px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: .06em; border: 1px solid currentColor; white-space: nowrap; }
.chip.good { color: var(--good); }
.chip.warn { color: var(--warn); }
.chip.work { color: var(--accent); }
.chip.idle { color: var(--idle); }
.rounds { white-space: nowrap; }
.dots { display: inline-flex; gap: 3px; vertical-align: middle; margin-right: 8px; }
.dots i { width: 6px; height: 6px; border-radius: 99px; background: var(--accent); display: block; }
.dots i.empty { background: var(--line); }
.count { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--text-3); }
.gap { color: var(--text-2); font-size: 14px; }
.muted { color: var(--text-3); }

.shots { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 18px; }
.shot { border: 1px solid var(--line-soft); border-radius: 6px; overflow: hidden; background: var(--plate); box-shadow: var(--shadow); }
.shot img { display: block; width: 100%; height: auto; }
.shot.mobile img { max-width: 240px; margin: 0 auto; }
.shot figcaption { padding: 8px 12px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: .06em; color: var(--text-3); border-top: 1px solid var(--line-soft); }
.empty-shots { color: var(--text-3); font-size: 14px; }

ul.log { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; border: 1px solid var(--line-soft); border-radius: 6px; background: var(--plate); }
ul.log li { display: grid; grid-template-columns: 132px 1fr; gap: 16px; padding: 11px 16px; border-bottom: 1px solid var(--line-soft); font-size: 14px; }
ul.log li:last-child { border-bottom: 0; }
ul.log time { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--text-3); }
@media (max-width: 620px) {
  ul.log li { grid-template-columns: 1fr; gap: 2px; }
  header.masthead { flex-direction: column; align-items: flex-start; }
  .meta { text-align: left; }
}
footer { margin-top: 56px; padding-top: 18px; border-top: 1px solid var(--line); color: var(--text-3); font-size: 13px; }
</style>

<div class="wrap">
  <header class="masthead">
    <div class="brand">
      <span class="eyebrow">Vela Motors · build sheet</span>
      <h1>${esc(state.headline || 'Build in progress')}</h1>
      <p class="sub">${esc(state.note || '')}</p>
    </div>
    <div class="meta">
      <span><b>${esc(stamp)}</b></span>
      <span>branch <b>${esc(branch)}</b></span>
      <span>commit <b>${esc(commit)}</b> · ${esc(commitCount)} total</span>
      <span>phase <b>${esc(state.phase || '—')}</b></span>
    </div>
  </header>

  <div class="tally">
    <span class="n">${won}</span><span class="of">of ${total} pieces the critic has picked over the benchmark</span>
  </div>
  <div class="bar"><span></span></div>

  <div class="notice">
    <h2>Benchmark access</h2>
    <p>${esc(state.constraint || '')}</p>
  </div>

  <section>
    <h2 class="section">Pieces</h2>
    <div class="table-scroll">
      <table>
        <thead>
          <tr><th scope="col">Piece</th><th scope="col">Status</th><th scope="col">Rounds</th><th scope="col">Largest remaining gap</th></tr>
        </thead>
        <tbody>${rows}
        </tbody>
      </table>
    </div>
  </section>

  <section>
    <h2 class="section">Latest captures</h2>
    ${gallery.length ? `<div class="shots">${gallery.map((g) => `
      <figure class="shot${g.mobile ? ' mobile' : ''}"><img src="${g.src}" alt="${esc(g.name)} capture"><figcaption>${esc(g.name)}</figcaption></figure>`).join('')}
    </div>` : '<p class="empty-shots">No captures yet — the first screenshots land once the surface compiles.</p>'}
  </section>

  ${logRows ? `<section>
    <h2 class="section">Activity</h2>
    <ul class="log">${logRows}
    </ul>
  </section>` : ''}

  <footer>Regenerated by <span class="mono">tools/progress.mjs</span> after every round. Captures are Playwright screenshots of the running app at 1440×900 and 390×844.</footer>
</div>
`;

writeFileSync(OUT, html);
console.log(`progress/index.html — ${won}/${total} won, ${gallery.length} capture(s), ${(html.length / 1024).toFixed(0)} KB`);
