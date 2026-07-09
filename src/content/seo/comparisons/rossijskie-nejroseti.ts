import { SeoPageContent } from '@/types/seo-page';

export const rossijskie_nejroseti: SeoPageContent = {
  slug: 'rossijskie-nejroseti',
  type: 'comparison',
  title: 'Российские нейросети',
  description: 'Российские нейросети — Яндекс, Сбер, VK, аналоги ChatGPT. Бесплатно, без регистрации.',
  subtitle: 'Российские нейросети — YandexGPT, GigaChat, нейросети VK. Сравнение возможностей и доступ к мировым моделям через AI-Sphere.',
  // ─── Hero-блок ───
  hero: {
    title: 'Российские нейросети',
    text: 'Российские нейросети — YandexGPT, GigaChat, нейросети VK. Сравнение возможностей и доступ к мировым моделям через AI-Sphere.',
    ctaText: 'Выбрать нейросеть',
  },
  canonical: 'https://ai-sphere.ru/rossijskie-nejroseti',
  index: true,
  updatedAt: '2026-07-07',
  sections: [
    {
      type: 'introduction',
      title: 'Обзор российских нейросетей',
      text: 'Российские компании активно развивают собственные нейросети: YandexGPT (Яндекс), GigaChat (Сбер), нейросети VK. Они хороши для базовых задач, но уступают мировым аналогам в сложных сценариях. AI-Sphere даёт доступ и к тем, и к другим.',
    },
    {
      type: 'methodology',
      title: 'Как мы сравнивали',
      criteria: [
        { name: 'Качество ответов', description: 'Точность, глубина и релевантность ответов на русском языке', weight: 5 },
        { name: 'Доступность', description: 'Наличие бесплатной версии, простота регистрации, работа без VPN', weight: 4 },
        { name: 'Широта знаний', description: 'Охват тем, понимание контекста, работа с файлами', weight: 4 },
        { name: 'Производительность', description: 'Скорость ответа, стабильность работы', weight: 3 },
        { name: 'Цена', description: 'Стоимость подписки, наличие бесплатного лимита', weight: 3 },
      ],
    },
    {
      type: 'ratingTable',
      title: 'Сравнение российских нейросетей',
      entries: [
        { name: 'AI-Sphere (ChatGPT, Claude, DeepSeek и др.)', rating: 9.2, pros: '20+ мировых моделей, без VPN, оплата в рублях, файлы, картинки', cons: 'Не все модели имеют русскую документацию', price: 'От 99 ₽ / есть бесплатные запросы' },
        { name: 'YandexGPT (Яндекс)', rating: 7.5, pros: 'Бесплатный доступ, интеграция с Алисой, хороший русский язык', cons: 'Ограниченные возможности, нет файлов, нет картинок', price: 'Бесплатно (базовый)' },
        { name: 'GigaChat (Сбер)', rating: 7.0, pros: 'Мультимодальность, интеграция с экосистемой Сбера', cons: 'Меньше моделей, медленнее работает', price: 'Бесплатно (базовый)' },
        { name: 'Нейросети VK', rating: 6.0, pros: 'Интеграция с VK, простой интерфейс', cons: 'Ограниченный функционал, нет продвинутых моделей', price: 'Бесплатно' },
      ],
    },
    {
      type: 'recommendations',
      title: 'Что выбрать',
      scenarios: [
        { scenario: 'Нужен доступ ко всем мировым моделям без VPN', choice: 'AI-Sphere', reason: '20+ моделей, включая ChatGPT, Claude, DeepSeek, Gemini. Работает напрямую из России.' },
        { scenario: 'Нужна простая нейросеть для бытовых вопросов', choice: 'YandexGPT', reason: 'Бесплатно, интегрирован с Алисой, хорошо понимает русский.' },
        { scenario: 'Нужна мультимодальная нейросеть от банка', choice: 'GigaChat', reason: 'Умеет работать с изображениями, встроен в экосистему Сбера.' },
      ],
    },
  ],
  faq: [
    { question: 'Какая российская нейросеть самая мощная?', answer: 'Среди российских — YandexGPT. Но мировые модели (ChatGPT, Claude, DeepSeek) значительно превосходят их по качеству.' },
    { question: 'Можно ли использовать российские нейросети бесплатно?', answer: 'Да, у всех российских нейросетей есть бесплатные версии с ограничениями.' },
    { question: 'Нужен ли VPN для российских нейросетей?', answer: 'Нет, все российские нейросети работают напрямую, без VPN.' },
  ],
  cta: 'Попробовать все модели',
  ctaLink: '/',
  ctaText: 'Зарегистрируйтесь и получите доступ к 20+ моделям, включая ChatGPT, Claude, DeepSeek. 10 бесплатных запросов.',
  relatedPages: [
    'chat-gpt-online',
    'nejroset-perevodchik',
    'nejroset-dlya-teksta',
    'gpt-besplatno',
    'generator-nejroset',
  ],
};
