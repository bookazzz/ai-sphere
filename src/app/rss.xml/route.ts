import { NextResponse } from 'next/server';
import { getAllNews } from '@/lib/news/get-news';
import { site } from '@/config/site';

export const dynamic = 'force-static';

export async function GET() {
  const articles = getAllNews('ready');

  const items = articles.map(a => `
    <item>
      <title><![CDATA[${a.title}]]></title>
      <link>${site.url}/news/${a.slug}</link>
      <guid isPermaLink="true">${site.url}/news/${a.slug}</guid>
      <pubDate>${new Date(a.datePublished).toUTCString()}</pubDate>
      <description><![CDATA[${a.description}]]></description>
      <category>${a.category}</category>
      <author>${a.author}</author>
    </item>`).join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Новости AI | AI-Sphere</title>
    <link>${site.url}/news</link>
    <description>Последние новости из мира искусственного интеллекта и нейросетей</description>
    <language>ru</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${site.url}/rss.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;

  return new NextResponse(rss.trim(), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
