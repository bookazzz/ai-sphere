#!/usr/bin/env node
/**
 * Генерация sitemap.xml для статического экспорта.
 * Запускается как prebuild-шаг.
 */
const fs = require('fs');
const path = require('path');

const SEO_DIR = path.join(__dirname, '..', 'src', 'content', 'seo');
const BLOG_DIR = path.join(__dirname, '..', 'src', 'content', 'blog');
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
  { url: 'blog', priority: 0.8, changefreq: 'weekly' },
];

function walkDir(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
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
  const indexMatch = content.match(/index:\s*(true|false)/);
  const statusMatch = content.match(/contentStatus:\s*['"]([^'"]+)['"]/);
  const updatedMatch = content.match(/updatedAt:\s*['"]([^'"]+)['"]/);

  if (!slugMatch) return null;

  return {
    slug: slugMatch[1],
    index: indexMatch ? indexMatch[1] === 'true' : true,
    contentStatus: statusMatch ? statusMatch[1] : null,
    updatedAt: updatedMatch ? updatedMatch[1] : null,
  };
}

/**
 * Parse a Markdown blog post with front-matter (gray-matter format).
 * Returns { slug, category, index, status } or null.
 */
function parseBlogMd(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Simple front-matter parser (no gray-matter dep needed in scripts)
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;

  const fm = fmMatch[1];
  const slug = extractField(fm, 'slug');
  const category = extractField(fm, 'category');
  const status = extractField(fm, 'status') || 'draft';
  const indexRaw = extractField(fm, 'index');
  const updatedAt = extractField(fm, 'updatedAt') || extractField(fm, 'date');

  if (!slug || !category) return null;

  return {
    slug: slug.trim(),
    category: category.trim(),
    status: status.trim(),
    index: indexRaw ? indexRaw.trim() === 'true' : true,
    updatedAt: updatedAt ? updatedAt.trim() : null,
    priority: getBlogPriority(category.trim()),
  };
}

function extractField(fm, field) {
  const re = new RegExp(`^${field}:\\s*(.+)$`, 'm');
  const match = fm.match(re);
  if (!match) return null;
  // Remove quotes
  return match[1].replace(/^['"]|['"]$/g, '').trim();
}

function getBlogPriority(category) {
  switch (category) {
    case 'guides': return 0.7;
    case 'reviews': return 0.7;
    case 'cases': return 0.7;
    case 'news': return 0.6;
    case 'analysis': return 0.6;
    default: return 0.6;
  }
}

function walkBlogDir(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkBlogDir(full));
    else if (entry.name.endsWith('.md')) results.push(full);
  }
  return results;
}

// ──────────────── Main ────────────────

const today = new Date().toISOString().split('T')[0];

// Parse SEO pages
const seoFiles = walkDir(SEO_DIR);
const seoPages = seoFiles.map(parsePage).filter(p => p && p.slug);

// Parse blog posts
const blogFiles = walkBlogDir(BLOG_DIR);
const blogPages = blogFiles.map(parseBlogMd).filter(p => p && p.slug);

let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

// Static pages
for (const page of staticPages) {
  xml += `  <url>\n`;
  xml += `    <loc>${SITE_URL}/${page.url}</loc>\n`;
  xml += `    <lastmod>${today}</lastmod>\n`;
  xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
  xml += `    <priority>${page.priority.toFixed(1)}</priority>\n`;
  xml += `  </url>\n`;
}

// SEO pages (only indexable, ready)
for (const page of seoPages) {
  if (page.index === false) continue;
  if (page.contentStatus && page.contentStatus !== 'ready') continue;
  xml += `  <url>\n`;
  xml += `    <loc>${SITE_URL}/${page.slug}</loc>\n`;
  xml += `    <lastmod>${page.updatedAt || today}</lastmod>\n`;
  xml += `    <changefreq>weekly</changefreq>\n`;
  xml += `    <priority>0.8</priority>\n`;
  xml += `  </url>\n`;
}

// Blog posts (only status=ready && index=true)
for (const page of blogPages) {
  if (page.status !== 'ready') continue;
  if (!page.index) continue;
  xml += `  <url>\n`;
  xml += `    <loc>${SITE_URL}/blog/${page.category}/${page.slug}</loc>\n`;
  xml += `    <lastmod>${page.updatedAt || today}</lastmod>\n`;
  xml += `    <changefreq>weekly</changefreq>\n`;
  xml += `    <priority>${page.priority.toFixed(1)}</priority>\n`;
  xml += `  </url>\n`;
}

xml += '</urlset>\n';

const outputPath = path.join(PUBLIC_DIR, 'sitemap.xml');
fs.writeFileSync(outputPath, xml, 'utf-8');

const blogReady = blogPages.filter(p => p.status === 'ready').length;
const blogDraft = blogPages.filter(p => p.status === 'draft').length;
console.log(`✅ sitemap.xml → ${SITE_URL}`);
console.log(`   Статика: ${staticPages.length} | SEO: ${seoPages.filter(p => p.index !== false && (!p.contentStatus || p.contentStatus === 'ready')).length} | Блог: ${blogReady} (${blogDraft} черновиков)`);
