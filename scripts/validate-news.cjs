#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const ROOT = path.join(__dirname, '..');
const NEWS_DIR = path.join(ROOT, 'src', 'content', 'news');
const files = [];
const errors = [];
const warnings = [];
const eventKeys = new Map();

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.md')) files.push(full);
  }
}

function isIsoDate(value) {
  return typeof value === 'string'
    ? /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2}))?$/.test(value)
    : value instanceof Date && !Number.isNaN(value.valueOf());
}

walk(NEWS_DIR);
for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  let parsed;
  try { parsed = matter(fs.readFileSync(file, 'utf8')); }
  catch (error) { errors.push(`${rel}: invalid frontmatter (${error.message})`); continue; }
  const data = parsed.data;
  const filename = path.basename(file, '.md');
  if (!data.slug) errors.push(`${rel}: missing slug`);
  else if (filename !== data.slug) errors.push(`${rel}: filename must match slug "${data.slug}"`);
  if (!['draft', 'review', 'ready', 'blocked'].includes(data.status)) errors.push(`${rel}: invalid status "${data.status}"`);
  if (data.status !== 'blocked' && (!data.title || !data.description || !data.datePublished)) errors.push(`${rel}: title, description and datePublished are required`);
  if (data.datePublished && !isIsoDate(data.datePublished)) errors.push(`${rel}: datePublished must be ISO-8601`);
  if (data.dateModified && !isIsoDate(data.dateModified)) errors.push(`${rel}: dateModified must be ISO-8601`);
  if (/^#\s+/m.test(parsed.content)) errors.push(`${rel}: Markdown H1 is forbidden; the page template renders H1`);

  const schemaVersion = String(data.schema_version || data.schemaVersion || 'legacy');
  const passedCurrentGate = ['3.2', '3.3'].includes(schemaVersion) && data.reviewStatus === 'passed'
    && Boolean(data.eventKey) && Boolean(data.factCheckedAt);
  if (passedCurrentGate) {
    const seoTitle = String(data.seoTitle || '');
    const description = String(data.description || '');
    if (!seoTitle || seoTitle.length > 65) errors.push(`${rel}: seoTitle must contain at most 65 characters`);
    if (description.length < 120 || description.length > 165) errors.push(`${rel}: description must contain 120-165 characters`);
    if (!Array.isArray(data.sourceUrls) || data.sourceUrls.length === 0) errors.push(`${rel}: sourceUrls is required`);
    if (!data.eventKey) errors.push(`${rel}: eventKey is required`);
    if (!data.factCheckedAt) errors.push(`${rel}: factCheckedAt is required`);
    if (!data.image || !data.imageAlt) errors.push(`${rel}: individual image and imageAlt are required`);
    if (data.eventKey) {
      const previous = eventKeys.get(data.eventKey);
      if (previous) errors.push(`${rel}: duplicate eventKey also used by ${previous}`);
      eventKeys.set(data.eventKey, rel);
    }
  } else if (data.status === 'ready') {
    warnings.push(`${rel}: pre-gate article; recheck before keeping it indexed`);
  }
}

for (const warning of warnings.slice(0, 20)) console.warn(`WARN ${warning}`);
if (warnings.length > 20) console.warn(`WARN ...and ${warnings.length - 20} more legacy articles`);
if (errors.length) {
  console.error(`News validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`News validation passed: ${files.length} files checked (${warnings.length} legacy warnings).`);
