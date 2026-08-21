import { NextResponse } from 'next/server';
import { getAllNews } from '@/lib/news/get-news';
import { site } from '@/config/site';

export const dynamic = 'force-static';

export async function GET() {
  const articles = getAllNews('ready');
  const now = new Date();
  const cutoff = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  // Only articles from last 2 days (Google News Sitemap requirement)
  const recentArticles = articles.filter(a => {
    const d = new Date(a.datePublished);
    return d >= cutoff && !a.isResearch;  // exclude research from news sitemap
  });

  const urls = recentArticles.map(a => `
  <url>
    <loc>${site.url}${a.url}</loc>
    <news:news>
      <news:publication>
        <news:name>AI-Sphere</news:name>
        <news:language>ru</news:language>
      </news:publication>
      <news:publication_date>${new Date(a.datePublished).toISOString()}</news:publication_date>
      <news:title><![CDATA[${a.title}]]></news:title>
    </news:news>
  </url>`).join('\n');

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
>${urls}
</urlset>`;

  return new NextResponse(sitemap.trim(), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
