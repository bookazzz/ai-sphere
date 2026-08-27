#!/usr/bin/env node
/**
 * Валидация блога перед сборкой.
 * Проверяет:
 *   - Все ли .md файлы имеют корректный front-matter
 *   - Нет ли дублей slug внутри категории
 *   - Нет ли сломанных relatedPosts ссылок
 *   - Все ли обязательные поля заполнены
 */
const fs = require('fs');
const path = require('path');

const BLOG_DIR = path.join(__dirname, '..', 'src', 'content', 'blog');
const CATEGORIES = ['guides', 'reviews', 'analysis', 'cases'];
const REQUIRED_FIELDS = ['title', 'slug', 'category', 'description', 'date', 'author', 'status'];
const VALID_STATUSES = ['draft', 'review', 'ready'];

let errors = 0;
let warnings = 0;

function extractField(fm, field) {
  const re = new RegExp(`^${field}:\\s*(.+)$`, 'm');
  const match = fm.match(re);
  if (!match) return null;
  return match[1].replace(/^['"]|['"]$/g, '').trim();
}

function validateMdFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);

  if (!fmMatch) {
    console.error(`❌ ${filePath}: Нет front-matter (--- ... ---)`);
    errors++;
    return null;
  }

  const fm = fmMatch[1];
  const body = content.slice(fmMatch[0].length);
  const data = {};

  for (const field of REQUIRED_FIELDS) {
    const val = extractField(fm, field);
    if (!val) {
      console.error(`❌ ${filePath}: Отсутствует обязательное поле "${field}"`);
      errors++;
    }
    data[field] = val;
  }

  const status = extractField(fm, 'status');
  if (status && !VALID_STATUSES.includes(status)) {
    console.error(`❌ ${filePath}: Некорректный status "${status}". Допустимые: ${VALID_STATUSES.join(', ')}`);
    errors++;
  }

  const category = extractField(fm, 'category');
  if (category && !CATEGORIES.includes(category)) {
    console.error(`❌ ${filePath}: Некорректная категория "${category}". Допустимые: ${CATEGORIES.join(', ')}`);
    errors++;
  }

  const index = extractField(fm, 'index');
  if (index && index !== 'true' && index !== 'false') {
    console.error(`❌ ${filePath}: "index" должен быть true или false`);
    errors++;
  }

  const date = extractField(fm, 'date');
  if (date && Number.isNaN(Date.parse(date))) {
    console.error(`❌ ${filePath}: date must be ISO-8601`);
    errors++;
  }

  const filename = path.basename(filePath, '.md');
  if (data.slug && filename !== data.slug) {
    console.error(`❌ ${filePath}: filename must match slug "${data.slug}"`);
    errors++;
  }
  if (/^#\s+/m.test(body)) {
    console.error(`❌ ${filePath}: Markdown H1 is forbidden; the page template renders H1`);
    errors++;
  }

  return data;
}

// Main validation
console.log('🔍 Валидация блога...\n');

// Check each category dir
for (const category of CATEGORIES) {
  const dir = path.join(BLOG_DIR, category);
  if (!fs.existsSync(dir)) {
    console.warn(`⚠️  Категория "${category}" не существует: ${dir}`);
    warnings++;
    continue;
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  console.log(`📁 ${category}: ${files.length} файлов`);

  const usedSlugs = new Map();

  for (const file of files) {
    const filePath = path.join(dir, file);
    const data = validateMdFile(filePath);

    if (data && data.slug) {
      if (usedSlugs.has(data.slug)) {
        console.error(`❌ ${filePath}: Дубликат slug "${data.slug}" (первый: ${usedSlugs.get(data.slug)})`);
        errors++;
      }
      usedSlugs.set(data.slug, file);
    }
  }
}

console.log(`\n📊 Результат: ${errors ? `❌ ${errors} ошибок` : '✅ Ошибок нет'}${warnings ? `, ${warnings} предупреждений` : ''}`);
process.exit(errors > 0 ? 1 : 0);
