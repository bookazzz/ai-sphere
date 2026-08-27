#!/usr/bin/env node
/** One-time, idempotent migration: page templates own H1. */
const fs = require('fs');
const path = require('path');

const roots = [
  path.join(__dirname, '..', 'src', 'content', 'blog'),
  path.join(__dirname, '..', 'src', 'content', 'news'),
];
let changed = 0;

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.md')) {
      const source = fs.readFileSync(full, 'utf8');
      const end = source.indexOf('\n---', 4);
      if (end < 0) continue;
      const bodyStart = end + 4;
      const frontmatter = source.slice(0, bodyStart);
      const body = source.slice(bodyStart)
        .replace(/(^|\r?\n)#\s+[^\r\n]+(?=\r?\n|$)/g, '$1')
        .replace(/^(\r?\n){3,}/, '\n\n');
      const next = frontmatter + body;
      if (next !== source) { fs.writeFileSync(full, next); changed += 1; }
    }
  }
}

for (const root of roots) walk(root);
console.log(`Removed Markdown H1 from ${changed} content files.`);
