#!/usr/bin/env node
const origin = new URL(process.argv[2] || process.env.SEO_LIVE_ORIGIN || 'https://ai-sphere.ru').origin;
const fs = require('fs');
const path = require('path');
const checks = ['/', '/models/', '/prices/', '/blog/', '/news/', '/robots.txt', '/sitemap.xml', '/sitemap-news.xml', '/build-info.json'];
const errors = [];

async function read(pathname, redirect = 'follow') {
  const response = await fetch(`${origin}${pathname}`, { redirect, headers: { 'User-Agent': 'AI-Sphere-SEO-Smoke/1.0' } });
  return { response, text: await response.text() };
}

(async () => {
  const localBuildPath = path.join(__dirname, '..', 'public', 'build-info.json');
  const localBuild = fs.existsSync(localBuildPath) ? JSON.parse(fs.readFileSync(localBuildPath, 'utf8')) : null;
  let remoteBuild = null;
  for (const pathname of checks) {
    try {
      const { response, text } = await read(pathname);
      if (!response.ok) errors.push(`${pathname}: HTTP ${response.status}`);
      if (pathname.endsWith('/') && !/<link\b[^>]*rel=["']canonical["'][^>]*>/i.test(text)) errors.push(`${pathname}: canonical missing`);
      if (pathname === '/build-info.json' && response.ok) {
        try { remoteBuild = JSON.parse(text); } catch { errors.push('/build-info.json: invalid JSON'); }
      }
      if (pathname.endsWith('/') && response.ok) {
        const refs = [...text.matchAll(/<(?:img|script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/gi)]
          .map((match) => match[1]).filter((value) => value.startsWith('/')).slice(0, 60);
        for (const ref of new Set(refs)) {
          const asset = await fetch(`${origin}${ref}`);
          if (!asset.ok) errors.push(`${pathname}: asset ${ref} returned ${asset.status}`);
        }
      }
    } catch (error) { errors.push(`${pathname}: ${error.message}`); }
  }

  if (localBuild?.commit && localBuild.commit !== 'unknown' && remoteBuild?.commit !== localBuild.commit) {
    errors.push(`deployment drift: local ${localBuild.commit} vs production ${remoteBuild?.commit || 'unknown'}`);
  }

  const localSitemapPath = path.join(__dirname, '..', 'out', 'sitemap.xml');
  if (fs.existsSync(localSitemapPath)) {
    const localUrls = new Set([...fs.readFileSync(localSitemapPath, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
    const remoteSitemap = (await read('/sitemap.xml')).text;
    const remoteUrls = new Set([...remoteSitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
    for (const url of localUrls) if (!remoteUrls.has(url)) errors.push(`deployment route drift: ${url} is absent in production sitemap`);
  }

  try {
    const www = await fetch(`https://www.${new URL(origin).hostname}/`, { redirect: 'manual' });
    if (![301, 308].includes(www.status) || www.headers.get('location') !== `${origin}/`) {
      errors.push(`www redirect is invalid: HTTP ${www.status} -> ${www.headers.get('location') || 'none'}`);
    }
  } catch (error) { errors.push(`www HTTPS failed: ${error.message}`); }

  const robots = (await read('/robots.txt')).text;
  for (const sitemap of [`${origin}/sitemap.xml`, `${origin}/sitemap-news.xml`]) {
    if (!robots.includes(`Sitemap: ${sitemap}`)) errors.push(`robots.txt does not declare ${sitemap}`);
  }

  if (errors.length) {
    console.error(`Live SEO smoke failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`Live SEO smoke passed for ${origin}.`);
})().catch((error) => { console.error(error); process.exit(1); });
