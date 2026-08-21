import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { BlogCategory, BlogPost, BlogPostMeta } from '@/types/blog-post';

const BLOG_DIR = path.join(process.cwd(), 'src', 'content', 'blog');

const CATEGORIES: BlogCategory[] = ['guides', 'reviews', 'analysis', 'cases'];

/** Estimate reading time (ru text ~ 3 chars/syllable, ~ 200 words/min) */
function estimateReadingTime(content: string): number {
  const chars = content.replace(/\s+/g, ' ').trim().length;
  // Russian: ~10 chars/second, ~600 chars/min reading
  return Math.max(1, Math.round(chars / 600));
}

/** Parse one .md file into a BlogPost */
function parseMdFile(filePath: string, category: BlogCategory): BlogPost | null {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  const meta = data as Partial<BlogPostMeta>;
  if (!meta.slug || !meta.title) return null;

  // Only include ready posts in production
  const slug = meta.slug;

  return {
    title: meta.title || slug,
    slug,
    category,
    description: meta.description || '',
    date: meta.date || '',
    updatedAt: meta.updatedAt,
    verifiedAt: meta.verifiedAt,
    author: meta.author || 'AI-Sphere',
    image: meta.image,
    tags: meta.tags || [],
    status: meta.status || 'draft',
    index: meta.index !== false,
    canonical: meta.canonical,
    relatedSeoPages: meta.relatedSeoPages || [],
    relatedPosts: meta.relatedPosts || [],
    sourceUrls: meta.sourceUrls || [],
    url: `/blog/${category}/${slug}`,
    content,
    readingTime: estimateReadingTime(content),
  };
}

/** Get all blog posts, optionally filtered by status */
export function getAllBlogPosts(status?: 'draft' | 'review' | 'ready'): BlogPost[] {
  const posts: BlogPost[] = [];

  for (const category of CATEGORIES) {
    const dir = path.join(BLOG_DIR, category);
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const post = parseMdFile(path.join(dir, file), category);
      if (post) posts.push(post);
    }
  }

  // Sort by date descending
  posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (status) {
    return posts.filter(p => p.status === status);
  }
  return posts;
}

/** Get a single post by category + slug */
export function getBlogPost(category: string, slug: string): BlogPost | null {
  // Validate category
  if (!CATEGORIES.includes(category as BlogCategory)) return null;

  const filePath = path.join(BLOG_DIR, category, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  return parseMdFile(filePath, category as BlogCategory);
}

/** Get posts by category */
export function getBlogPostsByCategory(category: BlogCategory | string): BlogPost[] {
  return getAllBlogPosts().filter(p => p.category === category);
}

/** Get all slugs for generateStaticParams */
export function getAllBlogSlugs(): { category: string; slug: string }[] {
  return getAllBlogPosts().map(p => ({ category: p.category, slug: p.slug }));
}

/** Get all categories that have published posts */
export function getActiveCategories(): BlogCategory[] {
  const posts = getAllBlogPosts();
  return CATEGORIES.filter(c => posts.some(p => p.category === c));
}

/** Get related SEO pages for cross-linking */
export function getRelatedSeoPages(post: BlogPost): string[] {
  return post.relatedSeoPages || [];
}
