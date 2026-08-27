#!/usr/bin/env node
/**
 * Audit the exported site. This intentionally uses only Node built-ins so it can
 * run in CI immediately after `next build`.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'out');
const ORIGIN = 'https://ai-sphere.ru';
const PRIVATE_ROUTES = ['/admin/', '/callback/', '/works/', '/projects/'];
const errors = [];
const warnings = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function decode(value = '') {
  return value
    .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}

function attrs(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)]
    .map((match) => [match[1].toLowerCase(), decode(match[2])]));
}

function routeFor(file) {
  const rel = path.relative(OUT, file).replace(/\\/g, '/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -10)}/`.replace(/\/+/g, '/');
  return `/${rel.replace(/\.html$/, '')}/`.replace(/\/+/g, '/');
}

function normalizeRoute(raw, currentRoute = '/') {
  if (!raw || /^(#|mailto:|tel:|javascript:)/i.test(raw)) return null;
  let url;
  try { url = new URL(raw, `${ORIGIN}${currentRoute}`); } catch { return null; }
  if (url.origin !== ORIGIN || url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/')) return null;
  const pathname = decodeURIComponent(url.pathname).replace(/\/+/g, '/');
  if (/\.[a-z0-9]{2,8}$/i.test(pathname)) return pathname;
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

if (!fs.existsSync(OUT)) {
  console.error('SEO audit: out/ not found. Run `npm run build` first.');
  process.exit(1);
}

const htmlFiles = walk(OUT).filter((file) => file.endsWith('.html') && !file.endsWith('404.html'));
const pages = htmlFiles.map((file) => {
  const html = fs.readFileSync(file, 'utf8');
  const route = routeFor(file);
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const metaTags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => attrs(m[0]));
  const linkTags = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => attrs(m[0]));
  const description = metaTags.find((tag) => tag.name === 'description')?.content || '';
  const robots = metaTags.find((tag) => tag.name === 'robots')?.content?.toLowerCase() || '';
  const canonical = linkTags.find((tag) => tag.rel?.toLowerCase() === 'canonical')?.href || '';
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map((m) => decode(m[1].replace(/<[^>]+>/g, '')));
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)]
    .map((m) => normalizeRoute(decode(m[1]), route)).filter(Boolean);
  return { file, html, route, title, description, robots, canonical, h1s, links, indexable: !robots.includes('noindex') };
});

const routes = new Set(pages.map((page) => page.route));
const assets = new Set(walk(OUT).map((file) => `/${path.relative(OUT, file).replace(/\\/g, '/')}`));
const duplicates = { title: new Map(), description: new Map(), h1: new Map() };

for (const page of pages) {
  const label = page.route;
  if (PRIVATE_ROUTES.includes(page.route) && page.indexable) errors.push(`${label}: service page must be noindex`);
  if (!page.indexable) continue;

  if (!page.title) errors.push(`${label}: missing title`);
  if (page.title.length > 65) errors.push(`${label}: title is ${page.title.length} characters (max 65)`);
  if (page.title.length && page.title.length < 30) warnings.push(`${label}: title is only ${page.title.length} characters`);
  if (!page.description) errors.push(`${label}: missing meta description`);
  if (page.description.length > 165) errors.push(`${label}: description is ${page.description.length} characters (max 165)`);
  if (page.description.length && page.description.length < 80) warnings.push(`${label}: description is only ${page.description.length} characters`);
  if (page.h1s.length !== 1) errors.push(`${label}: expected exactly one H1, found ${page.h1s.length}`);

  const expectedCanonical = `${ORIGIN}${page.route}`;
  if (!page.canonical) errors.push(`${label}: missing canonical`);
  else if (page.canonical !== expectedCanonical) errors.push(`${label}: canonical ${page.canonical} must be ${expectedCanonical}`);

  for (const [field, value] of [['title', page.title], ['description', page.description], ['h1', page.h1s[0]]]) {
    if (!value) continue;
    const existing = duplicates[field].get(value) || [];
    existing.push(label);
    duplicates[field].set(value, existing);
  }

  for (const target of page.links) {
    if (target.endsWith('/')) {
      if (!routes.has(target)) errors.push(`${label}: broken internal link to ${target}`);
    } else if (!assets.has(target)) {
      errors.push(`${label}: missing internal asset ${target}`);
    }
  }

  for (const match of page.html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const schema = JSON.parse(match[1].replace(/&quot;/g, '"'));
      const nodes = Array.isArray(schema?.['@graph']) ? schema['@graph'] : [schema];
      for (const node of nodes) {
        const type = node?.['@type'];
        if (type && /^[a-z]/.test(type)) errors.push(`${label}: JSON-LD type must use Schema.org casing (${type})`);
        for (const field of ['datePublished', 'dateModified']) {
          if (node?.[field] && Number.isNaN(Date.parse(node[field]))) errors.push(`${label}: JSON-LD ${field} is not ISO-8601`);
        }
      }
    } catch (error) {
      errors.push(`${label}: invalid JSON-LD (${error.message})`);
    }
  }
}

for (const [field, values] of Object.entries(duplicates)) {
  for (const [value, foundRoutes] of values) {
    if (foundRoutes.length > 1) errors.push(`duplicate ${field} on ${foundRoutes.join(', ')}: "${value.slice(0, 100)}"`);
  }
}

const inbound = new Map();
for (const page of pages.filter((candidate) => candidate.indexable)) {
  for (const target of new Set(page.links)) inbound.set(target, (inbound.get(target) || 0) + 1);
}
const nonCommercialTopLevel = new Set(['/blog/', '/news/', '/models/', '/prices/', '/popular/', '/offer/', '/privacy/']);
for (const page of pages.filter((candidate) => candidate.indexable)) {
  const entityPage = /^\/(models|company)\/[^/]+\/$/.test(page.route);
  const seoLanding = /^\/[^/]+\/$/.test(page.route) && !nonCommercialTopLevel.has(page.route);
  if ((entityPage || seoLanding) && !inbound.get(page.route)) errors.push(`${page.route}: orphaned commercial/entity page`);
}

const sitemapPath = path.join(OUT, 'sitemap.xml');
if (!fs.existsSync(sitemapPath)) {
  errors.push('sitemap.xml is missing from export');
} else {
  const sitemap = fs.readFileSync(sitemapPath, 'utf8');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  for (const value of urls) {
    const route = normalizeRoute(value);
    const page = pages.find((candidate) => candidate.route === route);
    if (!page) errors.push(`sitemap URL has no exported HTML: ${value}`);
    else if (!page.indexable) errors.push(`sitemap contains noindex URL: ${value}`);
    else if (page.canonical !== value) errors.push(`sitemap/canonical mismatch: ${value} vs ${page.canonical}`);
  }
}

for (const warning of [...new Set(warnings)]) console.warn(`WARN ${warning}`);
if (errors.length) {
  console.error(`SEO audit failed with ${errors.length} error(s):`);
  for (const error of [...new Set(errors)]) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`SEO audit passed: ${pages.length} HTML pages checked.`);
