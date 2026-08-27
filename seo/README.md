# SEO operations

`semantic-map.json` is the reviewed source of truth for the first commercial
clusters. The old `clusters.yaml` is historical input only and must not be used
for generation without relevance cleanup and SERP-overlap clustering.

- `npm run seo:audit` checks the exported HTML, canonicals, H1, metadata,
  structured data, links and sitemap consistency.
- `npm run seo:check-live -- https://ai-sphere.ru` runs the post-deploy smoke
  check against production.
- `npm run seo:keys` expands the reviewed seed set. It requires the server-only
  `KEYSO_API_TOKEN`; responses are cached for seven days and requests are sent
  no faster than one per second.

Google Search Console and Yandex Webmaster remain the source of truth for real
impressions, indexing and clicks. Keys.so is used for discovery and position
monitoring, not as a traffic forecast.
