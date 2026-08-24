#!/usr/bin/env bash
# Ciclo completo de una ronda: compila, sirve, captura, testea, mide y arma los pares ciegos.
set -uo pipefail
ROUND="${1:-2}"
ROOT=/home/user/sveltia-cms-auth
SCRATCH=/tmp/claude-0/-home-user-sveltia-cms-auth/1330c57c-df42-5ebc-aecf-14a4f255d383/scratchpad
SHOTS="$SCRATCH/shots/r$ROUND"
mkdir -p "$SHOTS"
cd "$ROOT"
NP="env -u HTTPS_PROXY -u https_proxy"

echo "== build =="
node tools/build.mjs || exit 1
curl -s --noproxy 127.0.0.1 -o /dev/null http://127.0.0.1:8080/ || { nohup node tools/serve.mjs "$ROOT/site/dist" 8080 > /tmp/serve.log 2>&1 & sleep 1; }

echo "== auditoría =="
$NP node tools/audit.mjs 2>&1 | tail -6

echo "== e2e escritorio =="
$NP node tools/e2e.mjs http://127.0.0.1:8080/ desktop 2>&1 | tail -3
echo "== e2e móvil =="
$NP node tools/e2e.mjs http://127.0.0.1:8080/ mobile 2>&1 | tail -3

echo "== capturas por pieza =="
$NP node tools/shot.mjs http://127.0.0.1:8080/ "$SHOTS" both tools/pieces.json 2>&1 | tail -3
$NP node tools/shot-overlays.mjs http://127.0.0.1:8080/ "$SHOTS" 2>&1 | tail -3

echo "== pares ciegos =="
node tools/make-blind.mjs "$ROUND" 2>&1 | tail -2

echo "== lighthouse móvil =="
$NP node tools/lh.mjs http://127.0.0.1:8080/ mobile /tmp/lh-ours-mobile.json 3 | tee "$SCRATCH/lh-ours-mobile-r$ROUND.json"
