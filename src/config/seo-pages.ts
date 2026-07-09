import type { SeoPageContent } from '@/types/seo-page';

// Реестр SEO-страниц для организации и сортировки
export const seoPageSlugs: string[] = [
  // === Models (модели) ===
  'deepseek-chat',
  'gpt-4-chat',
  'chat-gpt-online',
  'midjourney-nejroset',
  'kandinsky-nejroset',
  'stable-diffusion',
  'dalle-nejroset',

  // === Tools (инструменты) ===
  'prezentaciya-nejroset',
  'nejroset-perevodchik',
  'logo-nejroset',
  'nejroset-foto-obrabotka',
  'generaciya-izobrazhenij',
  'nejroset-risovanie',
  'nejroset-oboji',
  'nejroset-muzyka',
  'nejroset-video',
  'ozvuchka-teksta-nejroset',

  // === Use-cases (кейсы) ===
  'rerajt-nejrosetej',
  'nejroset-dlya-koda',
  'gpt-besplatno',
  'sochinenie-nejroset',
  'nejroset-ucheba',
  'nejroset-sozdat',
  'nejroset-online',
  'nejroset-dlya-teksta',
  'voprosy-nejroseti',
  'nejroset-kalkulyator',
  'nejroset-yandex-alisa',

  // === Guides (гайды) ===
  'chat-gpt-rossiya',
  'chatgpt-skachat',
  'nejroset-telegram-bot',
  'vpn-dlya-nejrosetej',
  'chatgpt-rasshirenie',
  'nejroset-novosti',

  // === Comparisons (сравнения) ===
  'generator-nejroset',
  'rossijskie-nejroseti',
];

// Human-readable link titles for cross-linking
export const linkTitles: Record<string, string> = {
  'deepseek-chat': 'DeepSeek — нейросеть нового поколения',
  'gpt-4-chat': 'GPT-4 — самая мощная нейросеть OpenAI',
  'chat-gpt-online': 'ChatGPT онлайн — доступ к GPT-4o и DeepSeek',
  'midjourney-nejroset': 'Midjourney — генерация изображений',
  'kandinsky-nejroset': 'Кандинский — российская нейросеть',
  'stable-diffusion': 'Stable Diffusion — открытая нейросеть',
  'dalle-nejroset': 'DALL-E — генерация по тексту',
  'prezentaciya-nejroset': 'Нейросеть для презентаций',
  'rerajt-nejrosetej': 'Рерайт текста нейросетью',
  'nejroset-dlya-koda': 'Нейросеть для программирования',
  'nejroset-perevodchik': 'Переводчик нейросетью',
  'logo-nejroset': 'Логотип нейросетью',
  'nejroset-foto-obrabotka': 'Обработка фото нейросетью',
  'generaciya-izobrazhenij': 'Генерация изображений нейросетью',
  'gpt-besplatno': 'GPT бесплатно — без подписки',
  'sochinenie-nejroset': 'Сочинение нейросетью',
  'nejroset-ucheba': 'Нейросеть для учёбы',
  'nejroset-video': 'Видео нейросетью',
  'nejroset-muzyka': 'Музыка нейросетью',
  'ozvuchka-teksta-nejroset': 'Озвучка текста нейросетью',
  'nejroset-risovanie': 'Рисование нейросетью',
  'nejroset-oboji': 'Обои нейросетью',
  'nejroset-sozdat': 'Создать нейросеть — руководство',
  'nejroset-online': 'Нейросеть онлайн',
  'nejroset-dlya-teksta': 'Нейросеть для текста',
  'voprosy-nejroseti': 'Вопросы нейросети',
  'nejroset-kalkulyator': 'Калькулятор нейросети',
  'nejroset-yandex-alisa': 'Нейросеть в Яндекс Алисе',
  'chat-gpt-rossiya': 'ChatGPT в России',
  'chatgpt-skachat': 'ChatGPT скачать',
  'nejroset-telegram-bot': 'Нейросеть Telegram бот',
  'vpn-dlya-nejrosetej': 'VPN для нейросетей',
  'chatgpt-rasshirenie': 'ChatGPT расширение',
  'nejroset-novosti': 'Новости нейросетей',
  'generator-nejroset': 'Генератор нейросетей — сравнение',
  'rossijskie-nejroseti': 'Российские нейросети — обзор',
};

export function getSeoPage(slug: string): string | undefined {
  return seoPageSlugs.find(s => s === slug);
}

export function getLinkTitle(slug: string): string {
  return linkTitles[slug] ?? slug;
}
