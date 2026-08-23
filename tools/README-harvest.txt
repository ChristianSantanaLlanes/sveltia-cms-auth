Katana image harvest pipeline (all output goes to /tmp/katana-raw):
  lib-fetch.mjs        shared proxy/undici setup, retries, download+dedupe helpers
  fetch-museums.mjs    Met Open Access + Art Institute of Chicago
  fetch-openverse.mjs  Openverse API, commercial-reuse licences only
  fetch-commons2.mjs   Wikimedia Commons file search + category discovery
  contact-sheet.mjs    builds /tmp/katana-raw/sheets/<slot>.png for visual review
  apply-review.mjs     applies a manual {file: "delete"|"<slot>"} decision map
  verify-images.mjs    merges shards, decodes every file with sharp, drops bad ones
Run from tools/ with: NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node <script>
