import { expect, test } from '@playwright/test';

const representativeRoutes = [
  '/',
  '/nejroset-online/',
  '/models/gpt-5/',
  '/company/openai/',
  '/blog/guides/chatgpt-v-rossii-kak-polzovatsya-2026/',
  '/news/',
];

test('public templates expose one H1 and a self canonical without overflow', async ({ page }) => {
  test.setTimeout(180_000);
  await page.route('**/api/public/models', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/public/task-templates*', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, json: { detail: 'Unauthorized' } }));
  await page.route('**/api/events**', (route) => route.fulfill({ status: 204, body: '' }));

  for (const width of [320, 390, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of representativeRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('h1')).toHaveCount(1);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical).toBe(`https://ai-sphere.ru${route}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${route} overflows at ${width}px`).toBeLessThanOrEqual(1);
    }
  }
});

test('service routes are noindex', async ({ request }) => {
  for (const route of ['/admin/', '/callback/', '/works/', '/projects/']) {
    const response = await request.get(route);
    expect(response.ok(), `${route} should return a successful HTML response`).toBeTruthy();
    const html = await response.text();
    const robotsTag = html.match(/<meta[^>]+name="robots"[^>]*>/i)?.[0];
    expect(robotsTag, `${route} should expose robots metadata in the source HTML`).toContain('noindex');
  }
});
