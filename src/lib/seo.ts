import { site } from '@/config/site';

const BRAND_SUFFIX = ' | AI-Sphere';

export function withTrailingSlash(value: string): string {
  if (value === site.url) return `${site.url}/`;
  return value.endsWith('/') ? value : `${value}/`;
}

export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return withTrailingSlash(pathOrUrl);
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return withTrailingSlash(`${site.url}${path}`);
}

function truncateAtWord(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  const shortened = normalized.slice(0, maxLength + 1);
  const boundary = shortened.lastIndexOf(' ');
  const body = shortened.slice(0, boundary > maxLength * 0.65 ? boundary : maxLength).trim();
  return `${body.slice(0, Math.max(0, maxLength - 1))}…`;
}

export function seoTitle(value: string, includeBrand = true): string {
  const withoutBrand = value
    .replace(/\s*[|—–-]\s*AI-Sphere.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!includeBrand) return truncateAtWord(withoutBrand, 65);
  const available = 65 - BRAND_SUFFIX.length;
  return `${truncateAtWord(withoutBrand, available)}${BRAND_SUFFIX}`;
}

export function seoDescription(value: string): string {
  return truncateAtWord(value, 165);
}

export function schemaAuthor(name?: string): Record<string, string> {
  const author = (name || site.name).trim();
  if (/^AI[- ]?Sphere$/i.test(author)) {
    return { '@type': 'Organization', '@id': `${site.url}/#organization`, name: site.name };
  }
  return { '@type': 'Person', name: author };
}

export function stripMarkdownH1(content: string): string {
  return content
    .replace(/^#\s+.+(?:\r?\n|$)/gm, '')
    .replace(/^\s+/, '');
}
