import type { Company } from '@/types/company';

export const mistral: Company = {
  slug: 'mistral-ai',
  name: 'Mistral AI',
  shortName: 'Mistral',
  description: 'Mistral AI — французская компания, разработчик эффективных языковых моделей с открытым весом. Создатель Mistral Large, Mistral Small и Codestral.',
  h1: 'Mistral AI — модели, продукты и последние новости',
  founded: '2023',
  headquarters: 'Париж, Франция',
  website: 'https://mistral.ai',
  products: [
    { name: 'Mistral Large', description: 'Флагманская модель с сильным reasoning и поддержкой длинного контекста.' },
    { name: 'Mistral Small', description: 'Лёгкая модель для повседневных задач с low latency.' },
    { name: 'Codestral', description: 'Специализированная модель для генерации и понимания кода.' },
    { name: 'Le Chat', description: 'Бесплатный AI-чат для экспериментов с моделями Mistral.' },
  ],
  models: ['mistral-large', 'codestral', 'mistral-saba'],
  categories: ['mistral'],
  sections: [
    {
      title: 'О компании',
      content: `Mistral AI основана в 2023 году бывшими исследователями Google DeepMind и Meta. Французский стартап быстро привлёк рекордные инвестиции и выпустил одни из самых эффективных моделей на рынке.

Компания известна подходом «open-weight»: модели публикуются с открытыми весами, но под лицензией, ограничивающей коммерческое использование для крупных компаний.

Mistral Large — флагманская модель, конкурирующая с GPT-4 и Claude Opus 5, при меньших требованиях к вычислительным ресурсам.`
    },
    {
      title: 'Основные продукты',
      content: `**Mistral Large** — флагманская модель с контекстом до 128K токенов. Поддерживает natively английский, французский, немецкий, испанский, итальянский и русский языки.

**Codestral** — модель для разработчиков, специализирующаяся на генерации кода. Поддерживает все основные языки программирования.

**Mistral Small** — лёгкая модель для задач, где важна скорость. Оптимальный выбор для RAG и простых запросов.

**Le Chat** — бесплатный веб-чат для знакомства с возможностями моделей Mistral.`
    },
    {
      title: 'Доступность и цены',
      content: `Модели Mistral AI доступны через AI-Sphere с оплатой в рублях.

**Популярные модели и цены:**
- Mistral Large — от 15 кредитов за 1K токенов
- Codestral — от 10 кредитов за 1K токенов
- Mistral Saba — от 3 кредитов за 1K токенов

Mistral — отличный выбор для европейских языков и задач с кодом.`
    },
  ],
};
