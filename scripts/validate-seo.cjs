#!/usr/bin/env node
/**
 * Валидация SEO-страниц перед сборкой.
 * Запускается как prebuild-шаг. При ошибках — process.exit(1).
 */
const fs = require('fs');
const path = require('path');

const SEO_DIR = path.join(__dirname, '..', 'src', 'content', 'seo');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const REQUIRED_SECTIONS = {
  model: ['capabilities', 'modelComparison', 'limitations', 'howToRun', 'promptExamples'],
  tool: ['stepByStep', 'resultExamples', 'supportedFormats'],
  'use-case': ['useCases', 'promptExamples', 'recommendedModels'],
  guide: ['tableOfContents', 'stepByStep', 'troubleshooting'],
  comparison: ['methodology', 'ratingTable', 'recommendations'],
};

let errors = [];
let warnings = [];

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
  const page = { file: filePath, content };

  // Поддержка как одинарных, так и двойных кавычек
  const slugMatch = content.match(/slug:\s*['"]([^'"]+)['"]/);
  page.slug = slugMatch ? slugMatch[1] : null;

  const typeMatch = content.match(/type:\s*['"]([^'"]+)['"]/);
  page.type = typeMatch ? typeMatch[1] : null;

  const indexMatch = content.match(/index:\s*(true|false)/);
  page.index = indexMatch ? indexMatch[1] === 'true' : true;

  const contentStatusMatch = content.match(/contentStatus:\s*['"]([^'"]+)['"]/);
  page.contentStatus = contentStatusMatch ? contentStatusMatch[1] : null;

  const canonicalMatch = content.match(/canonical:\s*['"]([^'"]+)['"]/);
  page.canonical = canonicalMatch ? canonicalMatch[1] : null;

  /********** SECTIONS **********/
  // Find the sections: [...] block by matching balanced brackets
  const sectionsStart = content.match(/sections:\s*(\[)/);
  if (sectionsStart) {
    const fromIdx = sectionsStart.index + sectionsStart[0].length - 1;
    let depth = 1, i = fromIdx;
    while (depth > 0 && i < content.length) {
      i++;
      if (content[i] === '[') depth++;
      else if (content[i] === ']') depth--;
    }
    const sectionsBody = content.substring(fromIdx, i);
    const sectionTypes = [...sectionsBody.matchAll(/type:\s*['"](\w+)['"]/g)].map(m => m[1]);
    page.sectionTypes = sectionTypes;
  } else {
    page.sectionTypes = [];
  }

  /********** relatedPages **********/
  // Match relatedPages: [...] block too
  const rpMatch = content.match(/relatedPages:\s*(\[)/);
  if (rpMatch) {
    const fromIdx = rpMatch.index + rpMatch[0].length - 1;
    let depth = 1, i = fromIdx;
    while (depth > 0 && i < content.length) {
      i++;
      if (content[i] === '[') depth++;
      else if (content[i] === ']') depth--;
    }
    const rpBody = content.substring(fromIdx, i);
    page.relatedPages = [...rpBody.matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]);
  } else {
    page.relatedPages = [];
  }

  return page;
}

function validateRequiredSections(page) {
  if (!page.type || !REQUIRED_SECTIONS[page.type]) return;
  const missing = REQUIRED_SECTIONS[page.type].filter(r => !page.sectionTypes.includes(r));
  if (missing.length > 0) {
    errors.push(`${page.slug || '???'}: missing required sections [${missing.join(', ')}] (type: ${page.type})`);
  }
}

function validateCanonical(page) {
  if (!page.canonical || !page.slug) return;
  const expectedSlug = page.canonical.replace('https://ai-sphere.ru/', '');
  if (expectedSlug !== page.slug) {
    errors.push(`${page.slug}: canonical "${page.canonical}" doesn't match slug "${page.slug}"`);
  }
}

function validateRelatedPages(page, allSlugs) {
  for (const related of page.relatedPages) {
    if (!allSlugs.includes(related)) {
      errors.push(`${page.slug || '???'}: relatedPages "${related}" does not match any existing page`);
    }
  }
}

function validateSitemapCoverage(pages) {
  const sitemapPath = path.join(PUBLIC_DIR, 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) {
    warnings.push('sitemap.xml not found — coverage check skipped');
    return;
  }

  const sitemapContent = fs.readFileSync(sitemapPath, 'utf-8');
  const sitemapSlugs = [...sitemapContent.matchAll(/<loc>https:\/\/ai-sphere\.ru\/([^<]+)<\/loc>/g)].map(m => m[1]);

  const validPages = pages.filter(p => p.slug);
  const indexableSlugs = new Set(validPages.filter(p => p.index !== false).map(p => p.slug));

  for (const slug of sitemapSlugs) {
    if (slug === '') continue;
    if (!indexableSlugs.has(slug)) {
      const page = validPages.find(p => p.slug === slug);
      if (page && page.index === false) {
        errors.push(`${slug}: has index=false but found in sitemap`);
      }
    }
  }

  for (const slug of indexableSlugs) {
    if (slug && !sitemapSlugs.includes(slug)) {
      errors.push(`${slug}: indexable but missing from sitemap`);
    }
  }
}

// ─── Main ───

const files = walkDir(SEO_DIR);
if (files.length === 0) {
  console.error('❌ No SEO content files found in', SEO_DIR);
  process.exit(1);
}

const pages = files.map(parsePage);
const allSlugs = pages.map(p => p.slug).filter(Boolean);

console.log(`🔍 Validating ${pages.length} SEO pages...`);

for (const page of pages) {
  // Проверка: draft/review не должны быть index=true
  if (page.contentStatus && (page.contentStatus === 'draft' || page.contentStatus === 'review') && page.index !== false) {
    errors.push(`${page.slug || '???'}: contentStatus is "${page.contentStatus}" but index is not false — page would be indexed with incomplete content`);
  }
  // Проверка: ready должен иметь index=true
  if (page.contentStatus === 'ready' && page.index === false) {
    warnings.push(`${page.slug}: contentStatus is "ready" but index is false`);
  }

  // relatedPages проверяем для всех страниц
  validateRelatedPages(page, allSlugs);
  // canonical проверяем для всех
  if (page.canonical) validateCanonical(page);

  // Обязательные секции — только для индексируемых
  if (page.index !== false) {
    if (page.type) validateRequiredSections(page);
  }
}

validateSitemapCoverage(pages);

if (warnings.length > 0) {
  for (const w of warnings) console.warn(`  ⚠️  ${w}`);
}

if (errors.length > 0) {
  console.error(`\n❌ ${errors.length} validation error(s):`);
  for (const e of errors) {
    console.error(`   • ${e}`);
  }
  process.exit(1);
} else {
  console.log(`✅ All ${pages.length} pages validated successfully`);
}
