import type { Company } from '@/types/company';

export const deepseek: Company = {
  slug: 'deepseek',
  name: 'DeepSeek',
  shortName: 'DeepSeek',
  description: 'DeepSeek — разработчик языковых моделей для рассуждений, программирования и повседневных текстовых задач.',
  h1: 'DeepSeek — модели, возможности и новости',
  founded: '2023',
  headquarters: 'Ханчжоу, Китай',
  website: 'https://www.deepseek.com/',
  products: [
    { name: 'DeepSeek Chat', description: 'Семейство языковых моделей для диалога, анализа и работы с текстом.' },
    { name: 'DeepSeek Reasoner', description: 'Модели с усиленным рассуждением для сложных задач, математики и кода.' },
  ],
  models: ['deepseek'],
  categories: ['deepseek'],
  sections: [
    {
      title: 'Для каких задач подходит DeepSeek',
      content: 'Модели DeepSeek используют для анализа текста, программирования, подготовки черновиков и решения задач, где важно пошаговое рассуждение. Фактическая доступность конкретных моделей отображается в каталоге AI-Sphere.',
    },
    {
      title: 'Доступность в AI-Sphere',
      content: 'Каталог и стоимость синхронизируются с провайдером. Перед запуском пользователь видит выбранную модель и предварительную оценку расхода кредитов.',
    },
  ],
};
