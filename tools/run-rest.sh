#!/bin/bash
cd /home/user/sveltia-cms-auth/tools
export NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt
while ps -eo args | grep -q "[n]ode fetch-targeted"; do sleep 10; done
echo "=== crawl ==="
WANT='{"hamon":26,"forge":24,"saya":24,"display":24,"detail":24,"tsuka":24}' node fetch-crawl.mjs
echo "=== met2 ==="
WANT='{"display":26,"tsuka":26,"detail":26,"saya":26}' node fetch-met2.mjs
echo "=== verify ==="
node verify-images.mjs | tail -40
echo "=== sheets ==="
node contact-sheet.mjs
echo "=== ALL DONE ==="
