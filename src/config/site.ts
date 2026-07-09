export const site = {
  name: 'AI-Sphere',
  url: 'https://ai-sphere.ru',
  locale: 'ru_RU',
  description: 'ИИ-чат с доступом к ChatGPT, Claude, Gemini, DeepSeek и другим моделям. Без VPN, с оплатой в рублях.',
  ogImage: 'https://ai-sphere.ru/og-image.png',
} as const;

export const navigation = {
  product: [
    { href: '/', label: 'Чат' },
    { href: '/prices', label: 'Тарифы' },
    { href: '/models', label: 'Модели' },
  ],
  company: [
    { href: '/about', label: 'О нас' },
    { href: '/contacts', label: 'Контакты' },
    { href: '/faq', label: 'FAQ' },
    { href: '/security', label: 'Безопасность' },
  ],
  legal: [
    { href: '/offer', label: 'Пользовательское соглашение' },
    { href: '/privacy', label: 'Политика конфиденциальности' },
  ],
} as const;
