import Link from 'next/link';
import { seoContentMap } from '@/content/seo';

interface Props {
  related?: Record<string, string>;
  relatedPages?: string[];
}

/** Получить человеческое название по slug */
function getTitle(slug: string): string {
  // Прямой slug в seoContentMap
  const page = seoContentMap[slug];
  if (page) {
    return page.hero?.title || page.h1 || page.title;
  }
  // Fallback: красивое русское название из slug
  const names: Record<string, string> = {
    'chat-gpt-online': 'ChatGPT онлайн',
    'deepseek-chat': 'DeepSeek',
    'gpt-4-chat': 'GPT-4',
    'midjourney-nejroset': 'Midjourney',
    'kandinsky-nejroset': 'Кандинский',
    'stable-diffusion': 'Stable Diffusion',
    'dalle-nejroset': 'DALL-E',
    'generaciya-izobrazhenij': 'Генерация изображений',
    'nejroset-perevodchik': 'Нейросеть-переводчик',
    'prezentaciya-nejroset': 'Создание презентаций',
    'ozvuchka-teksta-nejroset': 'Озвучка текста',
    'nejroset-video': 'Генерация видео',
    'nejroset-muzyka': 'Создание музыки',
    'nejroset-risovanie': 'Рисование нейросетью',
    'nejroset-foto-obrabotka': 'Обработка фото',
    'nejroset-oboji': 'Создание обоев',
    'logo-nejroset': 'Создание логотипов',
    'nejroset-dlya-teksta': 'Нейросеть для текста',
    'sochinenie-nejroset': 'Написание сочинений',
    'nejroset-dlya-koda': 'Нейросеть для кода',
    'voprosy-nejroseti': 'Вопросы нейросети',
    'nejroset-online': 'Нейросеть онлайн',
    'nejroset-kalkulyator': 'Нейросеть-калькулятор',
    'nejroset-sozdat': 'Создание нейросети',
    'nejroset-yandex-alisa': 'Нейросеть Яндекс Алиса',
    'gpt-besplatno': 'GPT бесплатно',
    'chat-gpt-rossiya': 'ChatGPT в России',
    'vpn-dlya-nejrosetej': 'VPN для нейросетей',
    'chatgpt-skachat': 'ChatGPT скачать',
    'chatgpt-rasshirenie': 'Расширение ChatGPT',
    'nejroset-telegram-bot': 'Нейросеть Telegram бот',
    'nejroset-novosti': 'Новости нейросетей',
    'rossijskie-nejroseti': 'Российские нейросети',
    'rerajt-nejrosetej': 'Рерайт текста',
    'generator-nejroset': 'Генератор нейросетей',
  };
  return names[slug] || slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function SeoRelated({ related, relatedPages }: Props) {
  const items: { slug: string; label: string }[] = [];

  if (related && Object.keys(related).length > 0) {
    Object.entries(related).forEach(([slug, label]) => {
      // Используем override из related, если есть, иначе getTitle
      items.push({ slug, label: getTitle(slug) });
    });
  }
  if (relatedPages && relatedPages.length > 0) {
    relatedPages.forEach((slug) => {
      if (!items.some((i) => i.slug === slug)) {
        items.push({ slug, label: getTitle(slug) });
      }
    });
  }

  if (items.length === 0) return null;

  return (
    <section className="seo-related">
      <h2 className="seo-related__title">Другие нейросети и сервисы</h2>
      <ul className="seo-related__list">
        {items.map(({ slug, label }) => (
          <li key={slug}>
            <Link href={`/${slug}`}>{label}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
