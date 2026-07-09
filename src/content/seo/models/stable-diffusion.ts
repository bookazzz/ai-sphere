import type { SeoPageContent } from '@/types/seo-page';

export const stable_diffusion: SeoPageContent = {
  slug: 'stable-diffusion',
  type: 'model',
  title: 'Stable Diffusion онлайн — генерация изображений нейросетью | AI-Sphere',
  description: 'Stable Diffusion — нейросеть для генерации фотореалистичных изображений. Высокая детализация, точное следование промпту. Без VPN.',
  h1: 'Stable Diffusion онлайн',
  index: true,
  contentStatus: 'ready',
  schemaType: 'softwareApplication',
  updatedAt: '2026-07-07',
  parent: 'generaciya-izobrazhenij',
  canonical: 'https://ai-sphere.ru/stable-diffusion',

  hero: {
    title: 'Stable Diffusion',
    text: 'Stable Diffusion — мощная open-source модель для генерации изображений. Точное следование промпту, фотореализм, широкие возможности настройки.',
    ctaText: 'Генерировать с SD',
    modelId: 'stable-diffusion',
  },

  sections: [
    {
      type: 'introduction',
      title: 'Что такое Stable Diffusion',
      text: 'Stable Diffusion (SD) — это модель генерации изображений с открытой архитектурой, разработанная Stability AI. Главные преимущества: точное следование текстовому описанию, способность генерировать фотореалистичные изображения и гибкость настроек. В AI-Sphere SD доступна в общем интерфейсе — без необходимости устанавливать модель локально или разбираться в технических деталях.',
      items: [
        'Фотореалистичные изображения с высокой детализацией',
        'Точное следование промпту — одно из лучших среди всех моделей',
        'Максимальный контроль: негативные промпты, steps, guidance scale',
        'Поддержка русского и английского языков',
        'Генерация в различных соотношениях сторон',
      ],
    },
    {
      type: 'capabilities',
      title: 'Возможности Stable Diffusion',
      text: 'Stable Diffusion — технически самая гибкая модель для генерации изображений.',
      items: [
        'Генерация по текстовому описанию с высокой точностью',
        'Фотореалистичные изображения: люди, предметы, интерьеры, архитектура',
        'Негативные промпты: указать, чего НЕ должно быть на картинке',
        'Контроль стиля через параметры: шаги, масштаб, seed',
        'Работа с изображениями: img2img, inpainting (доступно в интерфейсе)',
        'Генерация текстур, паттернов, 3D-рендеров',
      ],
    },
    {
      type: 'howToRun',
      title: 'Как начать с Stable Diffusion',
      items: [
        'Зарегистрируйтесь на AI-Sphere',
        'Выберите Stable Diffusion из списка моделей',
        'Напишите промпт — чем детальнее, тем точнее результат',
        'Настройте параметры: шаги генерации, соотношение сторон',
        'Используйте негативный промпт для исключения нежелательных элементов',
      ],
      text: 'Stable Diffusion доступна на всех платных тарифах AI-Sphere.',
    },
    {
      type: 'promptExamples',
      title: 'Примеры промптов',
      examples: [
        {
          prompt: 'portrait of a young woman with freckles, natural lighting, soft focus, detailed skin texture, photorealistic, 8k, Canon EOS R5',
          result: 'Фотореалистичный портрет с проработанной текстурой кожи, естественным освещением и мягким боке. Почти неотличим от фотографии.',
          note: 'Для фотореализма используйте английские промпты с ключевыми словами: photorealistic, detailed texture, lighting.',
        },
        {
          prompt: 'product mockup of a perfume bottle on marble background, studio lighting, luxury style, soft shadows, high detail',
          result: 'Изображение товара, готовое для каталога. Мраморная текстура, студийное освещение, тени проработаны идеально.',
          note: 'Stable Diffusion — лучший выбор для предметной съёмки и мокапов. Добавьте studio lighting и high detail.',
        },
        {
          prompt: 'a cozy modern living room with a fireplace, large windows overlooking mountains, Scandinavian style, warm colors, interior design',
          result: 'Интерьер в скандинавском стиле с камином и панорамными окнами. Цветовая гамма тёплая и уютная.',
          note: 'SD отлично генерирует интерьеры — укажите стиль (Scandinavian, loft, modern) и цветовую палитру.',
        },
      ],
    },
    {
      type: 'modelComparison',
      title: 'Stable Diffusion vs Midjourney vs Кандинский',
      models: [
        {
          name: 'Stable Diffusion',
          pros: [
            'Фотореализм — лучший в классе',
            'Точное следование промпту',
            'Гибкие настройки (steps, CFG, seed)',
            'Негативные промпты',
          ],
          cons: [
            'Платный тариф',
            'Художественный стиль уступает Midjourney',
          ],
          bestFor: 'Фотореализм, предметная съёмка, интерьеры, прототипы',
        },
        {
          name: 'Midjourney',
          pros: [
            'Художественный стиль и креативность',
            '4 варианта за генерацию',
            'Апскейл и вариации',
          ],
          cons: ['Меньше контроля над деталями', 'Платный тариф'],
          bestFor: 'Художественные проекты, концепт-арт, иллюстрации',
        },
        {
          name: 'Кандинский',
          pros: ['Бесплатный тариф', 'Лучшее понимание русского', 'Быстрая генерация'],
          cons: ['Меньше детализации', 'Слабее в фотореализме'],
          bestFor: 'Быстрые задачи на русском, бюджетные проекты',
        },
      ],
    },
    {
      type: 'limitations',
      title: 'Ограничения',
      text: 'Stable Diffusion — технически продвинутая модель, но важно понимать её границы.',
      items: [
        'Требуется платный тариф в AI-Sphere',
        'Английские промпты дают лучший результат, чем русские',
        'Анатомия рук и пальцев может быть искажена на сложных ракурсах',
        'Генерация текста на изображениях — слабое место (буквы искажаются)',
        'Модель может воспроизводить предвзятости из обучающих данных',
        'Доступные возможности зависят от выбранной модели и тарифа',
      ],
    },
  ],

  faq: [
    {
      question: 'Stable Diffusion — это бесплатно?',
      answer: 'В AI-Sphere SD доступна на платных тарифах. Стоимость зависит от количества генераций.',
    },
    {
      question: 'Нужен ли мощный компьютер для Stable Diffusion?',
      answer: 'Нет. Вся генерация происходит на серверах AI-Sphere. Вам нужен только браузер.',
    },
    {
      question: 'Что такое негативный промпт?',
      answer: 'Это описание того, чего НЕ должно быть на изображении. Например: «no blur, no watermark, low quality» — помогает улучшить результат.',
    },
    {
      question: 'Stable Diffusion работает с русским языком?',
      answer: 'Да, но для фотореализма рекомендуются английские промпты — модель обучалась преимущественно на английских текстах.',
    },
    {
      question: 'Можно ли использовать SD для коммерческих проектов?',
      answer: 'Да, лицензия Stable Diffusion допускает коммерческое использование сгенерированных изображений, но проверяйте условия AI-Sphere в /offer.',
    },
  ],

  breadcrumbs: [
    { title: 'AI-Sphere', url: '/' },
    { title: 'Генерация изображений', url: '/generaciya-izobrazhenij' },
    { title: 'Stable Diffusion', url: '/stable-diffusion' },
  ],

  relatedPages: ['generaciya-izobrazhenij', 'midjourney-nejroset', 'dalle-nejroset'],
};
