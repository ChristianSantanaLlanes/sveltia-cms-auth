// Lighthouse mobile/desktop runner against a URL, prints key metrics as JSON.
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const url = process.argv[2];
const formFactor = process.argv[3] || 'mobile';
const outJson = process.argv[4];
const runs = Number(process.argv[5] || 1);

const chrome = await chromeLauncher.launch({
  chromePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server'],
});

const results = [];
for (let i = 0; i < runs; i++) {
  const runnerResult = await lighthouse(url, {
    port: chrome.port,
    output: 'json',
    logLevel: 'error',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    formFactor,
    screenEmulation: formFactor === 'mobile'
      ? { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false }
      : { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
    throttling: formFactor === 'mobile'
      ? { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4, requestLatencyMs: 562.5, downloadThroughputKbps: 1474.56, uploadThroughputKbps: 675 }
      : { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1, requestLatencyMs: 150, downloadThroughputKbps: 9216, uploadThroughputKbps: 9216 },
    emulatedUserAgent: formFactor === 'mobile'
      ? 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'
      : undefined,
  });
  const lhr = runnerResult.lhr;
  results.push({
    perf: Math.round((lhr.categories.performance.score || 0) * 100),
    a11y: Math.round((lhr.categories.accessibility.score || 0) * 100),
    bp: Math.round((lhr.categories['best-practices'].score || 0) * 100),
    seo: Math.round((lhr.categories.seo.score || 0) * 100),
    lcp: lhr.audits['largest-contentful-paint'].numericValue,
    fcp: lhr.audits['first-contentful-paint'].numericValue,
    cls: lhr.audits['cumulative-layout-shift'].numericValue,
    tbt: lhr.audits['total-blocking-time'].numericValue,
    si: lhr.audits['speed-index'].numericValue,
    bytes: lhr.audits['total-byte-weight']?.numericValue,
  });
  if (outJson && i === 0) fs.writeFileSync(outJson, JSON.stringify(lhr));
}
await chrome.kill();
const med = (k) => results.map((r) => r[k]).sort((a, b) => a - b)[Math.floor(results.length / 2)];
const summary = { url, formFactor, runs: results.length,
  perf: med('perf'), a11y: med('a11y'), bp: med('bp'), seo: med('seo'),
  lcp: Math.round(med('lcp')), fcp: Math.round(med('fcp')), cls: +med('cls').toFixed(3), tbt: Math.round(med('tbt')), si: Math.round(med('si')), bytes: Math.round(med('bytes') || 0) };
console.log(JSON.stringify(summary, null, 2));
