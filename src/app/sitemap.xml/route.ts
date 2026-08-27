import { NextResponse } from 'next/server';
import { getAllNews } from '@/lib/news/get-news';
import { getAllBlogPosts } from '@/lib/blog/get-posts';
import { site } from '@/config/site';
import { seoContentMap } from '@/content/seo';
import { getAllCompanySlugs } from '@/content/companies';
import { getAllModelHubSlugs } from '@/content/models';
import { NEWS_PAGE_SIZE } from '@/lib/news/pagination';

export const dynamic = 'force-static';

export async function GET() {
  const buildDate = new Date().toISOString();
  const staticPages = [
    { url: `${site.url}/`, priority: '1.0', changefreq: 'daily', lastmod: buildDate },
    { url: `${site.url}/models/`, priority: '0.9', changefreq: 'daily', lastmod: buildDate },
    { url: `${site.url}/prices/`, priority: '0.8', changefreq: 'daily', lastmod: buildDate },
    { url: `${site.url}/popular/`, priority: '0.7', changefreq: 'daily', lastmod: buildDate },
    { url: `${site.url}/blog/`, priority: '0.7', changefreq: 'daily', lastmod: buildDate },
    { url: `${site.url}/news/`, priority: '0.8', changefreq: 'hourly', lastmod: buildDate },
    { url: `${site.url}/offer/`, priority: '0.4', changefreq: 'monthly', lastmod: '2026-07-19' },
    { url: `${site.url}/privacy/`, priority: '0.4', changefreq: 'monthly', lastmod: '2026-07-19' },
  ];

  const seoPages = Object.values(seoContentMap)
    .filter(p => p.index !== false && p.contentStatus === 'ready')
    .map(p => ({
      url: `${site.url}/${p.slug}/`, priority: '0.8', changefreq: 'weekly',
      lastmod: p.updatedAt || p.dateModified || p.datePublished,
    }));

  const companyPages = getAllCompanySlugs().map(slug => ({url:`${site.url}/company/${slug}/`, priority:'0.6', changefreq:'monthly', lastmod: undefined}));
  const modelPages = getAllModelHubSlugs().map(slug => ({url:`${site.url}/models/${slug}/`, priority:'0.7', changefreq:'weekly', lastmod: undefined}));

  const blogPosts = getAllBlogPosts('ready').filter(p => p.index !== false).map(p => ({
    url: `${site.url}${p.url}/`,
    priority: '0.6',
    changefreq: 'weekly',
    lastmod: p.updatedAt || p.date,
  }));

  const newsArticles = getAllNews('ready').filter(a => a.index !== false).map(a => ({
    url: `${site.url}${a.url}/`,
    priority: '0.7',
    changefreq: 'daily',
    lastmod: a.dateModified || a.datePublished,
  }));
  const newsCategories = [...new Set(getAllNews('ready').filter(a => a.index !== false).map(a => a.category))]
    .map(slug => ({url:`${site.url}/news/category/${slug}/`, priority:'0.6', changefreq:'daily', lastmod: buildDate}));
  const newsPageCount = Math.ceil(newsArticles.length / NEWS_PAGE_SIZE);
  const newsPages = Array.from({ length: Math.max(0, newsPageCount - 1) }, (_, index) => ({
    url: `${site.url}/news/page/${index + 2}/`, priority: '0.5', changefreq: 'daily', lastmod: buildDate,
  }));

  const all = [...staticPages, ...seoPages, ...companyPages, ...modelPages, ...blogPosts, ...newsCategories, ...newsPages, ...newsArticles];
  const unique = [...new Map(all.map(page => [page.url, page])).values()];
  const urls = unique.map(p => `
  <url>
    <loc>${p.url}</loc>
    ${p.lastmod ? `<lastmod>${new Date(p.lastmod).toISOString()}</lastmod>` : ''}
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>`;

  return new NextResponse(xml.trim(), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
