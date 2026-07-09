import { SeoPageContent } from '@/types/seo-page';

// МОДЕЛИ
import { chat_gpt_online } from './models/chat-gpt-online';
import { deepseek_chat } from './models/deepseek-chat';
import { gpt_4_chat } from './models/gpt-4-chat';
import { midjourney_nejroset } from './models/midjourney-nejroset';
import { kandinsky_nejroset } from './models/kandinsky-nejroset';
import { stable_diffusion } from './models/stable-diffusion';
import { dalle_nejroset } from './models/dalle-nejroset';

// ИНСТРУМЕНТЫ
import { generaciya_izobrazhenij } from './tools/generaciya-izobrazhenij';
import { nejroset_perevodchik } from './tools/nejroset-perevodchik';
import { prezentaciya_nejroset } from './tools/prezentaciya-nejroset';
import { ozvuchka_teksta_nejroset } from './tools/ozvuchka-teksta-nejroset';
import { nejroset_video } from './tools/nejroset-video';
import { nejroset_muzyka } from './tools/nejroset-muzyka';
import { nejroset_risovanie } from './tools/nejroset-risovanie';
import { nejroset_foto_obrabotka } from './tools/nejroset-foto-obrabotka';
import { nejroset_oboji } from './tools/nejroset-oboji';
import { logo_nejroset } from './tools/logo-nejroset';

// СЦЕНАРИИ
import { nejroset_dlya_teksta } from './use-cases/nejroset-dlya-teksta';
import { sochinenie_nejroset } from './use-cases/sochinenie-nejroset';
import { nejroset_ucheba } from './use-cases/nejroset-ucheba';
import { nejroset_dlya_koda } from './use-cases/nejroset-dlya-koda';
import { voprosy_nejroseti } from './use-cases/voprosy-nejroseti';
import { nejroset_online } from './use-cases/nejroset-online';
import { nejroset_kalkulyator } from './use-cases/nejroset-kalkulyator';
import { nejroset_sozdat } from './use-cases/nejroset-sozdat';
import { nejroset_yandex_alisa } from './use-cases/nejroset-yandex-alisa';
import { gpt_besplatno } from './use-cases/gpt-besplatno';
import { rerajt_nejrosetej } from './use-cases/rerajt-nejrosetej';

// ГАЙДЫ
import { chat_gpt_rossiya } from './guides/chat-gpt-rossiya';
import { vpn_dlya_nejrosetej } from './guides/vpn-dlya-nejrosetej';
import { chatgpt_skachat } from './guides/chatgpt-skachat';
import { chatgpt_rasshirenie } from './guides/chatgpt-rasshirenie';
import { nejroset_telegram_bot } from './guides/nejroset-telegram-bot';
import { nejroset_novosti } from './guides/nejroset-novosti';

// СРАВНЕНИЯ
import { rossijskie_nejroseti } from './comparisons/rossijskie-nejroseti';
import { generator_nejroset } from './comparisons/generator-nejroset';

/** Реестр всех SEO-страниц: slug → SeoPageContent */
export const seoContentMap: Record<string, SeoPageContent> = {
  'chat-gpt-online': chat_gpt_online,
  'deepseek-chat': deepseek_chat,
  'gpt-4-chat': gpt_4_chat,
  'midjourney-nejroset': midjourney_nejroset,
  'kandinsky-nejroset': kandinsky_nejroset,
  'stable-diffusion': stable_diffusion,
  'dalle-nejroset': dalle_nejroset,
  'generaciya-izobrazhenij': generaciya_izobrazhenij,
  'nejroset-perevodchik': nejroset_perevodchik,
  'prezentaciya-nejroset': prezentaciya_nejroset,
  'ozvuchka-teksta-nejroset': ozvuchka_teksta_nejroset,
  'nejroset-video': nejroset_video,
  'nejroset-muzyka': nejroset_muzyka,
  'nejroset-risovanie': nejroset_risovanie,
  'nejroset-foto-obrabotka': nejroset_foto_obrabotka,
  'nejroset-oboji': nejroset_oboji,
  'logo-nejroset': logo_nejroset,
  'nejroset-dlya-teksta': nejroset_dlya_teksta,
  'sochinenie-nejroset': sochinenie_nejroset,
  'nejroset-ucheba': nejroset_ucheba,
  'nejroset-dlya-koda': nejroset_dlya_koda,
  'voprosy-nejroseti': voprosy_nejroseti,
  'nejroset-online': nejroset_online,
  'nejroset-kalkulyator': nejroset_kalkulyator,
  'nejroset-sozdat': nejroset_sozdat,
  'nejroset-yandex-alisa': nejroset_yandex_alisa,
  'gpt-besplatno': gpt_besplatno,
  'chat-gpt-rossiya': chat_gpt_rossiya,
  'vpn-dlya-nejrosetej': vpn_dlya_nejrosetej,
  'chatgpt-skachat': chatgpt_skachat,
  'chatgpt-rasshirenie': chatgpt_rasshirenie,
  'nejroset-telegram-bot': nejroset_telegram_bot,
  'nejroset-novosti': nejroset_novosti,
  'rossijskie-nejroseti': rossijskie_nejroseti,
  'rerajt-nejrosetej': rerajt_nejrosetej,
  'generator-nejroset': generator_nejroset,
};

/** Получить контент по slug (с проверкой) */
export function getSeoContent(slug: string): SeoPageContent | null {
  return seoContentMap[slug] ?? null;
}

/** Все slug для generateStaticParams */
export function getAllSeoSlugs(): string[] {
  return Object.keys(seoContentMap);
}

/** Slug по типу */
export function getSeoSlugsByType(type: string): string[] {
  return Object.values(seoContentMap)
    .filter(p => p.type === type)
    .map(p => p.slug);
}
