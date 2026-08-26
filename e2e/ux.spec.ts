import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const models = [
  {
    id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'DeepSeek',
    price_input: 1, price_output: 2, price_unit: 0, fixed_price: 0, vision: false,
    is_active: true, is_visible: true, input_modalities: ['text'], output_modalities: ['text'],
    supported_parameters: {}, auto_route_enabled: false,
  },
  {
    id: 'test/cheap-image', name: 'Cheap Image Generator With A Very Long Name', provider: 'Test',
    price_input: 0, price_output: 0, price_unit: 0, fixed_price: 4, vision: false,
    is_active: true, is_visible: true, input_modalities: ['text'], output_modalities: ['image'],
    supported_parameters: {}, auto_route_enabled: true,
  },
  {
    id: 'test/video', name: 'Video Generator', provider: 'Test',
    price_input: 0, price_output: 0, price_unit: 0, fixed_price: 20, vision: false,
    is_active: true, is_visible: true, input_modalities: ['text', 'video'], output_modalities: ['video'],
    supported_parameters: {}, auto_route_enabled: true,
  },
];

async function mockCommon(page: import('@playwright/test').Page, loggedIn = false) {
  await page.route('**/api/public/models', route => route.fulfill({ json: models }));
  await page.route('**/api/auth/me', route => loggedIn
    ? route.fulfill({ json: { id: 1, email: 'ux@example.com', name: 'UX', credits: 100 } })
    : route.fulfill({ status: 401, json: { detail: 'Unauthorized' } }));
  await page.route('**/api/chat/sessions', route => route.fulfill({ json: [] }));
  await page.route('**/api/public/task-templates*', route => route.fulfill({ json: [
    { id: 1, slug: 'explain', title: 'РћР±СЉСЏСЃРЅРёС‚СЊ С‚РµРјСѓ', description: 'РџРѕРЅСЏС‚РЅРѕ Рё РїРѕ С€Р°РіР°Рј', category: 'text', task_type: 'explain', prompt_template: '{input}', example_input: 'РљРІР°РЅС‚РѕРІР°СЏ С„РёР·РёРєР°', example_output: 'РџСЂРѕСЃС‚РѕРµ РѕР±СЉСЏСЃРЅРµРЅРёРµ', required_input: 'Р’РІРµРґРёС‚Рµ С‚РµРјСѓ', preview_url: '', default_parameters: {}, preferred_model: '', fallback_models: [], estimated_credits_label: '1вЂ“5 РєСЂРµРґРёС‚РѕРІ', is_featured: true, usage_count: 4 },
    { id: 2, slug: 'create-image', title: 'РЎРѕР·РґР°С‚СЊ РёР·РѕР±СЂР°Р¶РµРЅРёРµ', description: 'РљР°СЂС‚РёРЅРєР° РїРѕ РѕРїРёСЃР°РЅРёСЋ', category: 'image', task_type: 'create_image', prompt_template: '/image {input}', example_input: 'РџРѕСЃС‚РµСЂ РєРѕС„РµР№РЅРё', example_output: 'Р“РѕС‚РѕРІРѕРµ РёР·РѕР±СЂР°Р¶РµРЅРёРµ', required_input: 'РћРїРёС€РёС‚Рµ РёР·РѕР±СЂР°Р¶РµРЅРёРµ', preview_url: '', default_parameters: { aspect_ratio: '1:1', resolution: '1K' }, preferred_model: '', fallback_models: [], estimated_credits_label: 'С‚РѕС‡РЅР°СЏ С†РµРЅР°', is_featured: true, usage_count: 3 },
  ] }));
  await page.route('**/api/tasks/estimate', route => route.fulfill({ json: { task_type: 'create_image', kind: 'image', effective_model: 'test/cheap-image', effective_model_name: 'Cheap Image', credits_min: 4, credits_max: 4, exact: true, parameters: {}, fallback_models: [] } }));
  await page.route('**/api/events', route => route.fulfill({ status: 204, body: '' }));
  await page.route('**/api/events/batch', route => route.fulfill({ json: { accepted: 1, duplicates: 0 } }));
  await page.route('**/api/engagement/campaigns*', route => route.fulfill({ json: [] }));
  await page.route('**/api/engagement/surveys*', route => route.fulfill({ json: [] }));
  await page.route('**/api/experiments/assignments*', route => route.fulfill({ json: { assignment: null } }));
  await page.route('**/api/progress', route => route.fulfill({ json: {
    xp: 35, level: 'РќРѕРІРёС‡РѕРє', next_level: 'РСЃСЃР»РµРґРѕРІР°С‚РµР»СЊ', next_level_xp: 100,
    progress_pct: 35, monthly_bonus_credits: 4, monthly_bonus_limit: 20,
    rewards_blocked: false, missions: [], achievements: [],
  } }));
  await page.route('**/api/billing/plans', route => route.fulfill({ json: [
    { id: '1', name: 'РЎС‚Р°СЂС‚', price: 9900, credits: 100, bonus: 0, popular: false },
    { id: '2', name: 'РћРїС‚РёРјСѓРј', price: 29900, credits: 350, bonus: 20, popular: false },
    { id: '3', name: 'Р РµРєРѕРјРµРЅРґСѓРµРјС‹Р№', price: 59900, credits: 800, bonus: 100, popular: true },
    { id: '4', name: 'РњР°РєСЃРёРјСѓРј', price: 99900, credits: 1500, bonus: 300, popular: false },
  ] }));
}

async function mockSpeechRecognition(page: import('@playwright/test').Page, transcript: string) {
  await page.addInitScript(({ text }) => {
    class FakeSpeechRecognition {
      lang = '';
      interimResults = false;
      continuous = false;
      onresult: ((event: any) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: any) => void) | null = null;

      start() {
        setTimeout(() => {
          const result: any = [{ transcript: text }];
          result.isFinal = true;
          this.onresult?.({ resultIndex: 0, results: [result] });
          setTimeout(() => this.onend?.(), 20);
        }, 20);
      }

      stop() {
        setTimeout(() => this.onend?.(), 0);
      }
    }
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: FakeSpeechRecognition });
    Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, value: FakeSpeechRecognition });
  }, { text: transcript });
}

function successfulChatStream() {
  return 'data: {"type":"content","content":"ok"}\n\ndata: {"type":"done","credits_spent":0}\n\ndata: [DONE]\n\n';
}

test('layout never creates page-level horizontal overflow', async ({ page }) => {
  await mockCommon(page);
  for (const width of [320, 390, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('main.chat')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `unexpected overflow at ${width}px`).toBeLessThanOrEqual(1);
  }
});

test('task-first flow shows modes, scenario context and exact estimate', async ({ page }) => {
  await mockCommon(page);
  await page.goto('/');
  await page.getByRole('tab', { name: 'РР·РѕР±СЂР°Р¶РµРЅРёСЏ' }).click();
  await page.locator('.task-card').filter({ hasText: 'РЎРѕР·РґР°С‚СЊ РёР·РѕР±СЂР°Р¶РµРЅРёРµ' }).click();
  await expect(page.locator('.task-context')).toContainText('РћРїРёС€РёС‚Рµ РёР·РѕР±СЂР°Р¶РµРЅРёРµ');
  await expect(page.locator('.chat__cost-hint--live')).toContainText('4 РєСЂРµРґРёС‚РѕРІ');
  await expect(page.getByRole('button', { name: 'Р’С‹Р±СЂР°С‚СЊ РјРѕРґРµР»СЊ' })).toContainText('AIвЂ‘Sphere СЂРµРєРѕРјРµРЅРґСѓРµС‚');
});

test('mobile balance action opens four credit packages without sidebar', async ({ page }) => {
  await mockCommon(page, true);
  await page.route('**/api/billing/top-up', route => route.fulfill({ json: { payment_id: 'pay-1', payment_url: 'http://127.0.0.1:3100/payment-test' } }));
  await page.route('**/payment-test', route => route.fulfill({ contentType: 'text/html', body: '<h1>Platega test redirect</h1>' }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('aside.sidebar')).not.toHaveClass(/sidebar--mobile-open/);
  await page.locator('.chat__mobile-balance').click();
  await expect(page.locator('.pricing-modal__card')).toHaveCount(4);
  await expect(page.locator('.pricing-modal__trust')).toContainText('Р‘РµР· РїРѕРґРїРёСЃРєРё');
  await page.locator('.pricing-modal__btn').first().click();
  await expect(page).toHaveURL(/payment-test/);
});

test.skip('legacy password authentication flow (removed)', async ({ page }) => {
  await mockCommon(page, false);
  let authenticated = false;
  let dispatchBody: any = null;
  await page.unroute('**/api/auth/me');
  await page.route('**/api/auth/me', route => authenticated
    ? route.fulfill({ json: { id: 1, email: 'ux@example.com', name: 'UX', credits: 100 } })
    : route.fulfill({ status: 401, json: { detail: 'Unauthorized' } }));
  await page.route('**/api/auth/login', async route => {
    authenticated = true;
    await route.fulfill({ json: { user: { id: 1, email: 'ux@example.com', name: 'UX', credits: 100 } } });
  });
  await page.route('**/api/chat/dispatch', async route => {
    dispatchBody = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'data: {"type":"content","content":"Р“РѕС‚РѕРІРѕ"}\n\ndata: {"type":"done","credits_spent":1}\n\ndata: [DONE]\n\n' });
  });
  await page.goto('/');
  await page.locator('.task-card').filter({ hasText: 'РћР±СЉСЏСЃРЅРёС‚СЊ С‚РµРјСѓ' }).click();
  await page.locator('textarea.chat__input').fill('РџРѕС‡РµРјСѓ РЅРµР±Рѕ СЃРёРЅРµРµ?');
  await page.locator('.chat__input-icon--submit').click();
  await page.locator('input[type="email"]').fill('ux@example.com');
  await page.locator('input[type="password"]').fill('safe-password');
  await page.getByRole('button', { name: 'Р’РѕР№С‚Рё', exact: true }).last().click();
  await expect.poll(() => dispatchBody).not.toBeNull();
  await expect(page.getByText('Р“РѕС‚РѕРІРѕ')).toBeVisible();
  expect(dispatchBody.template_id).toBe(1);
  expect(dispatchBody.task_type).toBe('explain');
  expect(dispatchBody.messages.at(-1).content).toBe('РџРѕС‡РµРјСѓ РЅРµР±Рѕ СЃРёРЅРµРµ?');
});

test('authentication offers OAuth providers and no password registration', async ({ page }) => {
  await mockCommon(page, false);
  await page.goto('/');
  await page.locator('.sidebar__login-btn').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.auth-modal__social-btn')).toHaveCount(2);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.locator('input[type="email"]')).toHaveCount(0);
});

test('voice input punctuates the transcript before dispatch', async ({ page }) => {
  await mockSpeechRecognition(page, 'РїСЂРёРІРµС‚ СЂР°СЃСЃРєР°Р¶Рё РєР°Рє СЂР°Р±РѕС‚Р°РµС‚ РЅРµР№СЂРѕСЃРµС‚СЊ');
  await mockCommon(page, true);
  let dispatchBody: any = null;
  await page.route('**/api/chat/voice/punctuate', route => route.fulfill({ json: {
    result: 'РџСЂРёРІРµС‚! Р Р°СЃСЃРєР°Р¶Рё, РєР°Рє СЂР°Р±РѕС‚Р°РµС‚ РЅРµР№СЂРѕСЃРµС‚СЊ.', applied: true,
  } }));
  await page.route('**/api/chat/dispatch', async route => {
    dispatchBody = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: successfulChatStream() });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Р“РѕР»РѕСЃРѕРІРѕР№ РІРІРѕРґ' }).click();
  await expect.poll(() => dispatchBody).not.toBeNull();
  expect(dispatchBody.messages.at(-1).content).toBe('РџСЂРёРІРµС‚! Р Р°СЃСЃРєР°Р¶Рё, РєР°Рє СЂР°Р±РѕС‚Р°РµС‚ РЅРµР№СЂРѕСЃРµС‚СЊ.');
});

test('voice input sends the raw transcript when punctuation is unavailable', async ({ page }) => {
  await mockSpeechRecognition(page, 'РїСЂРѕРІРµСЂРєР° РіРѕР»РѕСЃРѕРІРѕРіРѕ РІРІРѕРґР°');
  await mockCommon(page, true);
  let dispatchBody: any = null;
  await page.route('**/api/chat/voice/punctuate', route => route.fulfill({
    status: 503, json: { detail: 'Temporarily unavailable' },
  }));
  await page.route('**/api/chat/dispatch', async route => {
    dispatchBody = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: successfulChatStream() });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Р“РѕР»РѕСЃРѕРІРѕР№ РІРІРѕРґ' }).click();
  await expect.poll(() => dispatchBody).not.toBeNull();
  expect(dispatchBody.messages.at(-1).content).toBe('РїСЂРѕРІРµСЂРєР° РіРѕР»РѕСЃРѕРІРѕРіРѕ РІРІРѕРґР°');
});

test('model picker exposes capability tags and remains keyboard accessible', async ({ page }) => {
  await mockCommon(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Р’С‹Р±СЂР°С‚СЊ РјРѕРґРµР»СЊ' }).click();
  await expect(page.getByText('РљР°СЂС‚РёРЅРєРё', { exact: true })).toBeVisible();
  await expect(page.getByText('Р’РёРґРµРѕ-РІС…РѕРґ', { exact: true })).toBeVisible();
  await page.keyboard.press('Tab');
  const accessibility = await new AxeBuilder({ page }).exclude('script').analyze();
  expect(accessibility.violations.filter(item => ['critical', 'serious'].includes(item.impact || ''))).toEqual([]);
});

test('automatic image route renders a media card without changing selected LLM', async ({ page }) => {
  await mockCommon(page, true);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  await page.route('**/api/chat/dispatch', route => route.fulfill({
    status: 200,
    contentType: 'text/event-stream',
    body: [
      'data: {"type":"route","intent":"image","requested_model":"deepseek/deepseek-v4-flash","effective_model":"test/cheap-image","effective_model_name":"Cheap Image"}\n\n',
      'data: {"type":"generation","generation":{"id":"job-1","kind":"image","status":"completed","requested_model":"deepseek/deepseek-v4-flash","effective_model":"test/cheap-image","effective_model_name":"Cheap Image","parameters":{"resolution":"1K","aspect_ratio":"1:1"},"assets":[{"id":"0","type":"image","media_type":"image/png","url":"/api/generations/job-1/assets/0"}],"error":"","credits_spent":4,"expires_at":"2099-01-01T00:00:00Z"}}\n\n',
      'data: {"type":"done","credits_spent":4}\n\n',
      'data: [DONE]\n\n',
    ].join(''),
  }));
  await page.route('**/api/generations/job-1/assets/0', route => route.fulfill({ body: png, contentType: 'image/png' }));
  await page.goto('/');
  await page.locator('textarea.chat__input').fill('РЎРіРµРЅРµСЂРёСЂСѓР№ РёР·РѕР±СЂР°Р¶РµРЅРёРµ РєРѕС‚Р°');
  await page.getByRole('button', { name: 'РћС‚РїСЂР°РІРёС‚СЊ' }).click();
  await expect(page.getByText('РЎРіРµРЅРµСЂРёСЂРѕРІР°РЅРѕ С‡РµСЂРµР· Cheap Image')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Р’С‹Р±СЂР°С‚СЊ РјРѕРґРµР»СЊ' })).toContainText('AIвЂ‘Sphere СЂРµРєРѕРјРµРЅРґСѓРµС‚');
  await expect(page.locator('.chat__generation-card')).toHaveScreenshot('image-generation-card.png');
});

test('product admin overview is usable on desktop and mobile', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ json: {
    id: 99, email: 'owner@example.com', name: 'Owner', credits: 0, is_admin: true,
  } }));
  await page.route('**/api/admin/growth/overview*', route => route.fulfill({ json: {
    freshness: '2026-08-24T12:00:00Z', sample_size: 240, sample_warning: false,
    metrics: {
      unique_visitors: 240, registrations: 56, activation_24h_pct: 48.2,
      median_time_to_value_seconds: 95, successful_tasks: 174, task_failure_pct: 3.1,
      dau: 62, wau: 188, mau: 510, paying_users: 18, revenue_rub: 48200,
      model_cost_rub_estimate: 9700, gross_margin_pct_estimate: 79.9,
      first_payment_users: 14, repeat_payment_users: 4,
      retention_d1_pct: 31, retention_d7_pct: 18, retention_d30_pct: 9,
    },
    alerts: [{ severity: 'warning', title: 'РћРїР»Р°С‚С‹ С‚СЂРµР±СѓСЋС‚ РІРЅРёРјР°РЅРёСЏ', value: '6 РѕС‚РєР°Р·РѕРІ', target: 'blockers/payment' }],
  } }));
  await page.route('**/api/admin/growth/funnel*', route => route.fulfill({ json: { stages: [
    { event: 'landing_view', stage: 'Р’РёР·РёС‚', users: 240, conversion_pct: 100, dropped: 0 },
    { event: 'task_started', stage: 'РќР°С‡Р°Р»Рѕ Р·Р°РґР°С‡Рё', users: 126, conversion_pct: 52.5, dropped: 114 },
    { event: 'result_success', stage: 'РЈСЃРїРµС€РЅС‹Р№ СЂРµР·СѓР»СЊС‚Р°С‚', users: 88, conversion_pct: 69.8, dropped: 38 },
  ] } }));

  for (const width of [320, 390, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'РћР±Р·РѕСЂ РїСЂРѕРµРєС‚Р°' })).toBeVisible();
    await expect(page.getByText('РђРєС‚РёРІР°С†РёСЏ Р·Р° 24 С‡Р°СЃР°')).toBeVisible();
    await expect(page.getByText('48.2%')).toBeVisible();
    await expect(page.getByText('1. Р’РёР·РёС‚')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `admin overflow at ${width}px`).toBeLessThanOrEqual(1);
    if (width <= 768) {
      const menuButton = page.getByRole('button', { name: 'РњРµРЅСЋ', exact: true });
      await expect(menuButton).toBeVisible();
      await menuButton.click();
      await expect(page.getByRole('button', { name: /Р§С‚Рѕ РјРµС€Р°РµС‚/ })).toBeVisible();
      await page.getByRole('button', { name: 'Р—Р°РєСЂС‹С‚СЊ РјРµРЅСЋ' }).click();
      await expect(page.locator('.admin-sidebar')).not.toHaveClass(/admin-sidebar--open/);
    }
    if (width === 1280) {
      const accessibility = await new AxeBuilder({ page }).include('.admin-main').withTags(['wcag2aa']).analyze();
      expect(accessibility.violations.filter(item => item.id === 'color-contrast')).toEqual([]);
    }
  }
});

test('admin model economics stays inside the viewport on mobile and tablet', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ json: {
    id: 99, email: 'owner@example.com', name: 'Owner', credits: 0, is_admin: true,
  } }));
  const baseModel = {
    id: 18, name: 'DeepSeek V4 Flash', provider: 'deepseek', or_model_id: 'deepseek/deepseek-v4-flash', category: 'fast',
    or_input_cost: .056, or_output_cost: .112, price_input: .5, price_output: .99, price_unit: .74, price_mode: 'separate',
    credits_in_1k: .5, credits_out_1k: .99, markup_factor: 2.5, margin: 80.08, margin_min: .8,
    is_unprofitable: false, is_active: true, is_visible: true, vision: false, request_count: 0, error_count: 0,
    input_modalities: ['text'], output_modalities: ['text'], supported_parameters: {}, openrouter_pricing: {}, auto_route_enabled: false,
    or_last_synced_at: '2026-08-25T12:00:00Z', unit_basis: '1K input + 1K output', provider_cost_usd_unit: .000168,
    provider_cost_rub_unit: .018522, revenue_credits_unit: 1.49, revenue_rub_unit: .124167,
    payment_fee_rub_unit: .006208, profit_rub_unit: .099437,
  };
  await page.route('**/api/admin/models', route => route.fulfill({ json: Array.from({ length: 30 }, (_, index) => ({
    ...baseModel, id: baseModel.id + index, name: index ? `DeepSeek V4 Flash ${index + 1}` : baseModel.name,
    or_model_id: `${baseModel.or_model_id}-${index + 1}`,
  })) }));
  await page.route('**/api/admin/models/economics', route => route.fulfill({ json: {
    guard_passed: true, actual_period_days: 30, actual: [], tasks: [], models: [], plans: [],
    assumptions: { target_margin_pct: 80, guard_plan_name: 'РџСЂРµРјРёСѓРј', cheapest_credit_rub: .083333,
      usd_rub_rate: 95, fx_safety_factor: 1.1, payment_fee_pct: 5, openrouter_funding_fee_pct: 5.5 },
  } }));

  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/admin');
    await page.getByRole('button', { name: 'РњРµРЅСЋ', exact: true }).click();
    await page.getByRole('button', { name: /РњРѕРґРµР»Рё$/ }).click();
    await expect(page.getByRole('heading', { name: 'РњРѕРґРµР»Рё' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'OpenRouter $ / 1M С‚РѕРєРµРЅРѕРІ' })).toBeVisible();
    await expect(page.getByLabel('Input С†РµРЅР° DeepSeek V4 Flash', { exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `models page overflow at ${width}px`).toBeLessThanOrEqual(1);
    const tableScroll = await page.locator('.admin__table-wrapper').last().evaluate(element => ({
      client: element.clientWidth, scroll: element.scrollWidth,
    }));
    expect(tableScroll.scroll).toBeGreaterThan(tableScroll.client);
    const topScroll = page.locator('.admin__table-scroll-top');
    await expect(topScroll).toHaveClass(/admin__table-scroll-top--visible/);
    await topScroll.evaluate(element => { element.scrollLeft = 220; element.dispatchEvent(new Event('scroll')); });
    await expect.poll(() => page.locator('.admin__model-table').evaluate(element => element.scrollLeft)).toBeGreaterThan(0);

    if (width === 320) {
      await page.locator('.admin-content').evaluate(element => { element.scrollTop = element.scrollHeight; });
      const backToModels = page.getByRole('button', { name: 'Рљ РЅР°С‡Р°Р»Сѓ С‚Р°Р±Р»РёС†С‹ РјРѕРґРµР»РµР№' });
      await expect(backToModels).toBeVisible();
      await backToModels.click();
      await expect.poll(() => page.locator('.admin-content').evaluate(element => element.scrollTop)).toBeLessThan(900);
    }
  }
});

test('admin can replace automatic task routing with a preferred model', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ json: {
    id: 99, email: 'owner@example.com', name: 'Owner', credits: 0, is_admin: true,
  } }));
  await page.route('**/api/admin/growth/overview*', route => route.fulfill({ json: { metrics: {}, alerts: [], sample_size: 0 } }));
  await page.route('**/api/admin/growth/funnel*', route => route.fulfill({ json: { stages: [] } }));
  await page.route('**/api/admin/integrations/status', route => route.fulfill({ json: {
    openrouter: { configured: true, visible_models: 2, unavailable_models: 0 }, payments: { configured: true, provider: 'Platega' },
    funnel: {}, analytics: {}, features: {},
  } }));
  const template = {
    id: 1, slug: 'explain', title: 'РћР±СЉСЏСЃРЅРёС‚СЊ С‚РµРјСѓ', description: '', category: 'text', task_type: 'explain',
    prompt_template: '{input}', example_input: '', example_output: '', required_input: 'РўРµРјР°', preview_url: '',
    default_parameters: {}, preferred_model: '', fallback_models: [], estimated_credits_label: '',
    is_featured: true, is_active: true, sort_order: 10, usage_count: 2,
  };
  let savedPreferred = '';
  await page.route('**/api/admin/task-templates', route => route.fulfill({ json: [template] }));
  await page.route(/\/api\/admin\/task-templates\/\d+$/, async route => {
    savedPreferred = route.request().postDataJSON().preferred_model;
    await route.fulfill({ json: { ...template, preferred_model: savedPreferred } });
  });
  const adminModels = ['DeepSeek V4 Flash', 'GPT-5 Mini'].map((name, index) => ({
    id: index + 1, name, provider: index ? 'openai' : 'deepseek',
    or_model_id: index ? 'openai/gpt-5-mini' : 'deepseek/deepseek-v4-flash', category: 'general',
    is_active: true, is_visible: true, input_modalities: ['text'], output_modalities: ['text'],
    recommended_priority: index + 1, availability_status: 'available', catalog_miss_count: 0, error_count: 0,
  }));
  await page.route('**/api/admin/models', route => route.fulfill({ json: adminModels }));

  await page.setViewportSize({ width: 1280, height: 850 });
  await page.goto('/admin');
  await page.getByRole('button', { name: /РЎС†РµРЅР°СЂРёРё Рё СЃРµСЂРІРёСЃС‹$/ }).click();
  const preferred = page.getByLabel('РћСЃРЅРѕРІРЅР°СЏ РјРѕРґРµР»СЊ РґР»СЏ РћР±СЉСЏСЃРЅРёС‚СЊ С‚РµРјСѓ');
  await expect(preferred).toHaveValue('');
  await preferred.selectOption('openai/gpt-5-mini');
  await expect.poll(() => savedPreferred).toBe('openai/gpt-5-mini');
  await expect(preferred).toHaveValue('openai/gpt-5-mini');
  await page.getByRole('button', { name: 'Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ' }).click();
  await expect(page.getByLabel('РћСЃРЅРѕРІРЅР°СЏ РјРѕРґРµР»СЊ СЃС†РµРЅР°СЂРёСЏ')).toHaveValue('openai/gpt-5-mini');
});

