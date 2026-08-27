const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const requiredAssets = ['public/og-image.png', 'public/logo.png', 'public/favicon.svg'];
for (const asset of requiredAssets) {
  if (!fs.existsSync(path.join(root, asset))) throw new Error(`Missing public asset: ${asset}`);
}

const sitemap = fs.readFileSync(path.join(root, 'src/app/sitemap.xml/route.ts'), 'utf8');
for (const route of ['/chat', '/about', '/contacts', '/authors', '/search']) {
  if (sitemap.includes(`site.url}/${route.slice(1)}`)) throw new Error(`Sitemap contains missing route: ${route}`);
}
if (!sitemap.includes('seoContentMap')) throw new Error('Sitemap must include SEO content');

const exportedSitemap = path.join(root, 'out', 'sitemap.xml');
if (fs.existsSync(exportedSitemap)) {
  const xml = fs.readFileSync(exportedSitemap, 'utf8');
  const locations = [...xml.matchAll(/<loc>https:\/\/ai-sphere\.ru([^<]*)<\/loc>/g)].map(match => decodeURIComponent(match[1]));
  if (locations.length === 0) throw new Error('Exported sitemap is empty');
  for (const location of locations) {
    const relative = location.replace(/^\/+|\/+$/g, '');
    const page = relative ? path.join(root, 'out', relative, 'index.html') : path.join(root, 'out', 'index.html');
    if (!fs.existsSync(page)) throw new Error(`Sitemap URL has no exported page: ${location}`);
  }
}
console.log('Route and public asset validation passed');
