export const site = {
  name: 'AI-Sphere',
  url: 'https://ai-sphere.ru',
  locale: 'ru_RU',
  description: 'ИИ-чат с доступом к ChatGPT, Claude, Gemini, DeepSeek и другим моделям. Без VPN, с оплатой в рублях.',
  ogImage: 'https://ai-sphere.ru/og/ai-sphere-platform.png',
} as const;

export const navigation = {
  product: [
    { href: '/', label: 'Чат' },
    { href: '/prices', label: 'Тарифы' },
    { href: '/models', label: 'Модели' },
    { href: '/nejroset-dlya-dokumentov', label: 'Работа с документами' },
  ],
  company: [
    { href: '/news', label: 'Новости' },
    { href: '/company/openai', label: 'OpenAI' },
    { href: '/company/anthropic', label: 'Anthropic' },
    { href: '/company/mistral-ai', label: 'Mistral AI' },
    { href: '/blog', label: 'Блог' },
  ],
  legal: [
    { href: '/offer', label: 'Пользовательское соглашение' },
    { href: '/privacy', label: 'Политика конфиденциальности' },
  ],
} as const;
