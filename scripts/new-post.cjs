#!/usr/bin/env node
/**
 * Создание новой статьи блога.
 * Использование: node scripts/new-post.cjs
 *
 * Интерактивно запрашивает поля и создаёт .md файл в src/content/blog/{category}/
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const BLOG_DIR = path.join(__dirname, '..', 'src', 'content', 'blog');
const CATEGORIES = ['news', 'guides', 'reviews', 'analysis', 'cases'];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
  console.log('\n📝 Создание новой статьи блога\n');

  // Category
  console.log('Категории:');
  CATEGORIES.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
  const catIdx = await ask(`Выберите категорию (1-${CATEGORIES.length}): `);
  const category = CATEGORIES[parseInt(catIdx) - 1] || CATEGORIES[0];
  console.log(`  → ${category}\n`);

  // Slug
  const slug = await ask('Slug (латиница, дефисы): ');
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    console.error('❌ Некорректный slug. Используйте латиницу и дефисы.');
    rl.close();
    return;
  }

  // Check for duplicates
  const filePath = path.join(BLOG_DIR, category, `${slug}.md`);
  if (fs.existsSync(filePath)) {
    console.error(`❌ Файл уже существует: ${filePath}`);
    rl.close();
    return;
  }

  const title = await ask('Заголовок (title): ');
  const description = await ask('Описание (description): ');
  const author = await ask('Автор (по умолч. AI-Sphere): ') || 'AI-Sphere';

  const today = new Date().toISOString().split('T')[0];
  const status = 'draft';
  const index = 'true';

  const template = `---
title: ${title}
slug: ${slug}
category: ${category}
description: ${description}
date: ${today}
updatedAt: ${today}
author: ${author}
image: /blog/${slug}.jpg
tags:
  - ${category}
status: ${status}
index: ${index}
canonical: /blog/${category}/${slug}
relatedSeoPages: []
relatedPosts: []
---

## Введение

Напишите введение...

## Основная часть

Напишите основную часть статьи...

## Заключение

Напишите заключение...
`;

  // Create directory if needed
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, template, 'utf-8');
  console.log(`\n✅ Статья создана: ${filePath}`);
  console.log(`   URL: https://ai-sphere.ru/blog/${category}/${slug}`);
  console.log(`   Статус: ${status} (не забудь поменять на "ready" перед публикацией)`);

  rl.close();
}

main().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
