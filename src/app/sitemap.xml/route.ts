import { NextResponse } from 'next/server';
import { getAllNews } from '@/lib/news/get-news';
import { getAllBlogPosts } from '@/lib/blog/get-posts';
import { site } from '@/config/site';

export const dynamic = 'force-static';

export async function GET() {
  const staticPages = [
    { url: site.url, priority: '1.0', changefreq: 'daily' },
    { url: `${site.url}/chat`, priority: '0.9', changefreq: 'weekly' },
    { url: `${site.url}/models`, priority: '0.9', changefreq: 'daily' },
    { url: `${site.url}/prices`, priority: '0.8', changefreq: 'daily' },
    { url: `${site.url}/blog`, priority: '0.7', changefreq: 'daily' },
    { url: `${site.url}/news`, priority: '0.8', changefreq: 'hourly' },
    { url: `${site.url}/about`, priority: '0.4', changefreq: 'monthly' },
    { url: `${site.url}/contacts`, priority: '0.3', changefreq: 'monthly' },
    { url: `${site.url}/faq`, priority: '0.5', changefreq: 'monthly' },
    { url: `${site.url}/security`, priority: '0.3', changefreq: 'monthly' },
    { url: `${site.url}/authors`, priority: '0.3', changefreq: 'monthly' },
    { url: `${site.url}/editorial-policy`, priority: '0.3', changefreq: 'monthly' },
    { url: `${site.url}/ai-content-policy`, priority: '0.3', changefreq: 'monthly' },
    { url: `${site.url}/sources-policy`, priority: '0.3', changefreq: 'monthly' },
  ];

  const blogPosts = getAllBlogPosts('ready').map(p => ({
    url: `${site.url}${p.url}`,
    priority: '0.6',
    changefreq: 'weekly',
  }));

  const newsArticles = getAllNews('ready').map(a => ({
    url: `${site.url}${a.url}`,
    priority: '0.7',
    changefreq: 'daily',
  }));

  const all = [...staticPages, ...blogPosts, ...newsArticles];
  const urls = all.map(p => `
  <url>
    <loc>${p.url}${p.url.endsWith('/') ? '' : '/'}</loc>
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
