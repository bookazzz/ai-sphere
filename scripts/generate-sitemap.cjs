#!/usr/bin/env node
/**
 * Генерация sitemap.xml для статического экспорта.
 * Запускается как prebuild-шаг.
 */
const fs = require('fs');
const path = require('path');

const SEO_DIR = path.join(__dirname, '..', 'src', 'content', 'seo');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const SITE_URL = 'https://ai-sphere.ru';

const staticPages = [
  { url: '', priority: 1.0, changefreq: 'daily' },
  { url: 'prices', priority: 0.9, changefreq: 'weekly' },
  { url: 'models', priority: 0.9, changefreq: 'weekly' },
  { url: 'about', priority: 0.7, changefreq: 'monthly' },
  { url: 'contacts', priority: 0.6, changefreq: 'monthly' },
  { url: 'faq', priority: 0.8, changefreq: 'weekly' },
  { url: 'security', priority: 0.7, changefreq: 'monthly' },
  { url: 'offer', priority: 0.5, changefreq: 'monthly' },
  { url: 'privacy', priority: 0.5, changefreq: 'monthly' },
];

function walkDir(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(full));
    else if (entry.name.endsWith('.ts') && entry.name !== 'index.ts') results.push(full);
  }
  return results;
}

function parsePage(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

  const slugMatch = content.match(/slug:\s*['"]([^'"]+)['"]/);
  const slug = slugMatch ? slugMatch[1] : null;

  const indexMatch = content.match(/index:\s*(true|false)/);
  const index = indexMatch ? indexMatch[1] === 'true' : true;

  const csMatch = content.match(/contentStatus:\s*['"]([^'"]+)['"]/);
  const contentStatus = csMatch ? csMatch[1] : null;

  const updatedMatch = content.match(/updatedAt:\s*['"]([^'"]+)['"]/);
  const updatedAt = updatedMatch ? updatedMatch[1] : null;

  return { slug, index, contentStatus, updatedAt };
}

// ─── Main ───

const files = walkDir(SEO_DIR);
const pages = files.map(parsePage).filter(p => p.slug);

const today = new Date().toISOString().split('T')[0];

let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

// Static pages
for (const page of staticPages) {
  xml += `  <url>\n`;
  xml += `    <loc>${SITE_URL}/${page.url}</loc>\n`;
  xml += `    <lastmod>${today}</lastmod>\n`;
  xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
  xml += `    <priority>${page.priority.toFixed(1)}</priority>\n`;
  xml += `  </url>\n`;
}

// SEO pages
for (const page of pages) {
  // Only indexable, ready pages
  if (page.index === false) continue;
  if (page.contentStatus && page.contentStatus !== 'ready') continue;

  xml += `  <url>\n`;
  xml += `    <loc>${SITE_URL}/${page.slug}</loc>\n`;
  xml += `    <lastmod>${page.updatedAt || today}</lastmod>\n`;
  xml += `    <changefreq>weekly</changefreq>\n`;
  xml += `    <priority>0.8</priority>\n`;
  xml += `  </url>\n`;
}

xml += `</urlset>\n`;

const outputPath = path.join(PUBLIC_DIR, 'sitemap.xml');
fs.writeFileSync(outputPath, xml, 'utf-8');
console.log(`✅ sitemap.xml generated: ${SITE_URL} (${pages.filter(p => p.index !== false && (!p.contentStatus || p.contentStatus === 'ready')).length} seo + ${staticPages.length} static = ${staticPages.length + pages.filter(p => p.index !== false && (!p.contentStatus || p.contentStatus === 'ready')).length} total)`);
