#!/usr/bin/env node
/**
 * Server-side Keys.so research with a disk cache and <= 1 request/second.
 * The API token is read only from KEYSO_API_TOKEN.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const map = require(path.join(ROOT, 'seo', 'semantic-map.json'));
const cacheDir = path.join(ROOT, 'datasets', 'seo', 'keys-cache');
const outputDir = path.join(ROOT, 'datasets', 'seo');
const token = process.env.KEYSO_API_TOKEN;
const bases = (process.env.KEYSO_BASES || 'msk,gru').split(',').map((value) => value.trim()).filter(Boolean);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (!token) {
  console.error('KEYSO_API_TOKEN is not configured. Rotate the exposed token, then set it in the server/CI environment.');
  process.exit(1);
}
fs.mkdirSync(cacheDir, { recursive: true });
fs.mkdirSync(outputDir, { recursive: true });

function cacheFile(url) {
  return path.join(cacheDir, `${crypto.createHash('sha256').update(url).digest('hex')}.json`);
}

async function request(url) {
  const file = cacheFile(url);
  if (fs.existsSync(file)) {
    const stat = fs.statSync(file);
    if (Date.now() - stat.mtimeMs < 7 * 24 * 60 * 60 * 1000) return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  const response = await fetch(url, { headers: { 'X-Keyso-TOKEN': token, Accept: 'application/json' } });
  if (response.status === 429) {
    const retryAfter = Math.max(Number(response.headers.get('retry-after') || 2), 1);
    await delay(retryAfter * 1000);
    return request(url);
  }
  if (!response.ok) throw new Error(`Keys.so ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const data = await response.json();
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  await delay(1100);
  return data;
}

(async () => {
  const results = [];
  for (const cluster of map.clusters) {
    for (const base of bases) {
      const params = new URLSearchParams({ base, keyword: cluster.query, sort: 'wsk|desc', page: '1', per_page: '100' });
      const data = await request(`https://api.keys.so/report/simple/similarkeys?${params}`);
      results.push({ query: cluster.query, targetUrl: cluster.url, base, total: data.total || 0, keywords: data.data || [] });
    }
  }
  const output = {
    generatedAt: new Date().toISOString(),
    source: 'Keys.so /report/simple/similarkeys',
    note: 'ws is broad frequency; prioritize wsk, intent fit, competition and conversion potential.',
    results,
  };
  const file = path.join(outputDir, `keys-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(file, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Saved ${results.length} Keys.so result sets to ${path.relative(ROOT, file)}`);
})().catch((error) => { console.error(error.message); process.exit(1); });

