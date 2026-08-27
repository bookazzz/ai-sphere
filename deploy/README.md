# Production SEO checklist

Before reloading nginx, issue or renew one certificate containing both hostnames:

```bash
sudo certbot --nginx -d ai-sphere.ru -d www.ai-sphere.ru
sudo nginx -t
sudo systemctl reload nginx
```

After deployment run `npm run seo:check-live -- https://ai-sphere.ru`. Compare
`/build-info.json` with the commit that was deployed; a mismatch means production
is serving an older export.
