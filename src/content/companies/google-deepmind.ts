import type { Company } from '@/types/company';

export const google: Company = {
  slug: 'google-deepmind',
  name: 'Google DeepMind',
  shortName: 'Google',
  description: 'Google DeepMind — объединённый AI-отдел Google, создатель Gemini, Gemma и других фундаментальных моделей.',
  h1: 'Google DeepMind — модели, продукты и последние новости',
  founded: '2010 (DeepMind) / 2023 (объединение с Google Brain)',
  headquarters: 'Лондон, Великобритания / Маунтин-Вью, США',
  website: 'https://deepmind.google',
  products: [
    { name: 'Gemini', description: 'Семейство мультимодальных моделей Google: от лёгкой Nano до ультимативной Ultra.' },
    { name: 'Gemma', description: 'Открытые лёгкие модели для исследователей и разработчиков.' },
    { name: 'Google AI Studio', description: 'Бесплатная платформа для экспериментов с моделями Gemini.' },
    { name: 'Vertex AI', description: 'Корпоративная платформа для развёртывания AI-моделей на Google Cloud.' },
  ],
  models: ['gemini-2.5-flash-image', 'gemini-3.1-flash-lite-image', 'gemini-3.1-flash-image'],
  categories: ['google'],
  sections: [
    {
      title: 'О компании',
      content: `Google DeepMind — это объединение двух ведущих AI-лабораторий: DeepMind (основана в 2010, приобретена Google в 2014) и Google Brain (внутренняя лаборатория Google). Слияние произошло в 2023 году.

DeepMind известен прорывами в области reinforcement learning — AlphaGo, AlphaFold, AlphaZero. Google Brain разработал Transformer — архитектуру, лежащую в основе всех современных LLM.

Gemini — мультимодальная модель, способная работать с текстом, изображениями, аудио и видео. Состоит из трёх уровней: Ultra (максимальная мощность), Pro (баланс) и Nano (на устройстве).`
    },
    {
      title: 'Основные продукты',
      content: `**Gemini** — флагманская мультимодальная модель. Доступна в Bard (теперь просто Gemini), Google AI Studio и через API. Поддерживает изображения, аудио, видео и код.

**Gemma** — семейство открытых моделей для разработчиков. Доступны для коммерческого использования, работают на обычном оборудовании.

**Google AI Studio** — бесплатная веб-среда для прототипирования с Gemini.

**Vertex AI** — корпоративная ML-платформа Google Cloud с полным циклом разработки моделей.`
    },
    {
      title: 'Доступность и цены',
      content: `Модели Google доступны в России через AI-Sphere с оплатой в рублях.

**Популярные модели и цены:**
- Gemini 3.1 Flash — от 2 кредитов за 1K токенов
- Gemini 2.5 Flash — от 1 кредита за 1K токенов

Модели Google — одни из самых доступных по цене. Отлично подходят для задач, где важна скорость и экономия.`
    },
    {
      title: 'FAQ',
      content: `**Чем Gemini отличается от GPT?**
Gemini лучше интегрирован с экосистемой Google, имеет мультимодальность «из коробки» и более низкую стоимость API. GPT сильнее в креативных задачах.

**Gemini доступен в России?**
Да, через AI-Sphere.`
    },
  ],
};
