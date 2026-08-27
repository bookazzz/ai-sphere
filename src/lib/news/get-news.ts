import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { NewsArticle, NewsArticleMeta, NewsCategory, NewsSection } from '@/types/news';
import { NEWS_CATEGORIES } from '@/types/news';
import { stripMarkdownH1 } from '@/lib/seo';

const NEWS_DIR = path.join(process.cwd(), 'src', 'content', 'news');

/** Estimate reading time */
function estimateReadingTime(content: string): number {
  const chars = content.replace(/\s+/g, ' ').trim().length;
  return Math.max(1, Math.round(chars / 600));
}

/** Parse markdown sections from content */
function parseSections(content: string): NewsSection[] {
  const sections: NewsSection[] = [];
  const lines = content.split('\n');
  let currentSection: NewsSection | null = null;

  for (const line of lines) {
    const h2Match = line.match(/^## (.+)/);
    if (h2Match) {
      if (currentSection) sections.push(currentSection);
      currentSection = { title: h2Match[1], content: '', type: 'text' };
      continue;
    }
    if (currentSection) {
      currentSection.content += line + '\n';
    }
  }
  if (currentSection) sections.push(currentSection);

  return sections;
}

/** Parse one .md file into a NewsArticle */
function parseNewsFile(filePath: string, subdir: string = ''): NewsArticle | null {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content: markdownContent } = matter(raw);
  const content = stripMarkdownH1(markdownContent);

  const meta = data as Partial<NewsArticleMeta & { summary?: string, isResearch?: boolean }>;
  if (!meta.slug || !meta.title) return null;

  const isResearch = meta.isResearch === true;
  const urlPath = `/news/${meta.slug}`;

  // Defensive: coerce string-encoded arrays to real arrays
  function ensureArray(val: unknown): string[] {
    if (Array.isArray(val)) return val.filter((v): v is string => typeof v === 'string');
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val.replace(/'/g, '"'));
        if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string');
      } catch { /* not JSON, treat as single-item */ }
      return [val];
    }
    return [];
  }

  // Extract summary: first paragraph before first ##
  const contentParts = content.split('\n## ');
  const firstPart = contentParts[0]?.trim() || '';
  // First paragraph is the summary
  const paragraphs = firstPart.split('\n\n').filter(p => p.trim());
  const summary = meta.summary || paragraphs[0]?.trim() || content.substring(0, 200);
  const restContent = contentParts.slice(1).join('\n## ').trim();

  const fullContent = restContent ? `${summary}\n\n## ${restContent}` : content;

  return {
    slug: meta.slug,
    title: meta.title,
    seoTitle: meta.seoTitle,
    description: meta.description || '',
    datePublished: meta.datePublished || '',
    dateModified: meta.dateModified,
    author: meta.author || 'AI-Sphere',
    category: meta.category || 'general',
    tags: ensureArray(meta.tags),
    sourceUrls: ensureArray(meta.sourceUrls),
    eventKey: meta.eventKey,
    factCheckedAt: meta.factCheckedAt,
    reviewStatus: meta.reviewStatus,
    primaryKeyword: meta.primaryKeyword,
    primarySourceUrl: meta.primarySourceUrl || ensureArray(meta.sourceUrls)?.[0],
    relatedModels: ensureArray(meta.relatedModels),
    relatedCompanies: ensureArray(meta.relatedCompanies),
    relatedPages: ensureArray(meta.relatedPages),
    image: meta.image,
    imageAlt: meta.imageAlt,
    status: meta.status || 'draft',
    index: meta.index !== false,
    canonical: meta.canonical,
    isResearch,
    subdir: subdir,
    url: urlPath,
    summary,
    sections: parseSections(fullContent),
    content: fullContent,
    readingTime: estimateReadingTime(fullContent),
  };
}

/** Get all news articles, optionally filtered by status */
export function getAllNews(status?: 'draft' | 'review' | 'ready' | 'blocked'): NewsArticle[] {
  if (!fs.existsSync(NEWS_DIR)) return [];

  const articles: NewsArticle[] = [];

  function scanDir(dir: string, subdir: string = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath, path.join(subdir, entry.name));
      } else if (entry.name.endsWith('.md')) {
        const article = parseNewsFile(fullPath, subdir);
        if (article) articles.push(article);
      }
    }
  }

  scanDir(NEWS_DIR);
  articles.sort((a, b) => new Date(b.datePublished).getTime() - new Date(a.datePublished).getTime());

  if (status) {
    return articles.filter(a => a.status === status);
  }
  return articles;
}

/** Get a single news article by slug (searches recursively) */
export function getNewsArticle(slug: string): NewsArticle | null {
  if (!fs.existsSync(NEWS_DIR)) return null;

  // Search recursively for the slug
  function findFile(dir: string, subdir: string = ''): { path: string; subdir: string } | null {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = findFile(fullPath, path.join(subdir, entry.name));
        if (found) return found;
      } else if (entry.name === `${slug}.md`) {
        return { path: fullPath, subdir };
      }
    }
    return null;
  }

  const found = findFile(NEWS_DIR);
  if (!found) return null;
  return parseNewsFile(found.path, found.subdir);
}

/** Get news by category */
export function getNewsByCategory(category: NewsCategory): NewsArticle[] {
  return getAllNews('ready').filter(a => a.index !== false && a.category === category);
}

/** Get all slugs for generateStaticParams */
export function getAllNewsSlugs(): string[] {
  return getAllNews('ready').map(a => a.slug);
}

/** Get recent news (last N days) for sitemap-news */
export function getRecentNews(days: number = 2): NewsArticle[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return getAllNews('ready').filter(a => a.index !== false).filter(a => {
    const d = new Date(a.datePublished);
    return d >= cutoff;
  });
}

/** Get active categories that have published news */
export function getActiveNewsCategories(): NewsCategory[] {
  const articles = getAllNews('ready').filter(a => a.index !== false);
  return NEWS_CATEGORIES.filter(c => articles.some(a => a.category === c));
}

/**
 * Get news related to specific models, companies, or categories.
 * Returns up to `limit` articles sorted by date.
 */
export function getRelatedNews(params: {
  models?: string[];
  companies?: string[];
  categories?: string[];
  excludeSlug?: string;
  limit?: number;
}): NewsArticle[] {
  const { models = [], companies = [], categories = [], excludeSlug, limit = 5 } = params;
  const all = getAllNews('ready').filter(a => a.index !== false);

  const matched = all.filter(a => {
    if (excludeSlug && a.slug === excludeSlug) return false;

    // Check explicit relations
    const modelMatch = models.some(m => (a.relatedModels || []).some(rm => rm.toLowerCase() === m.toLowerCase()));
    const companyMatch = companies.some(c => (a.relatedCompanies || []).some(rc => rc.toLowerCase() === c.toLowerCase()));
    const categoryMatch = categories.some(cat => a.category === cat);

    // Fallback: match category by model/company name if no explicit relations
    const implicitCategoryMatch = !modelMatch && !companyMatch && !categoryMatch
      ? [...models, ...companies].some(e => a.category === e.toLowerCase())
      : false;

    return modelMatch || companyMatch || categoryMatch || implicitCategoryMatch;
  });

  return matched.slice(0, limit);
}
