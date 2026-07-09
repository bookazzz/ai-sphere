import { SeoPageContent } from '@/types/seo-page';

export const nejroset_telegram_bot: SeoPageContent = {
  slug: "nejroset-telegram-bot",
  type: "guide",
  title: "Нейросеть Telegram бот",
  description: "Нейросеть в Telegram — ИИ чат-боты для телеграма. Бесплатно, без регистрации.",
  index: false,
  canonical: 'https://ai-sphere.ru/nejroset-telegram-bot',
  subtitle: "Нейросеть Telegram бот — общайтесь с ИИ прямо в Telegram. Бот отвечает на вопросы, генерирует тексты.",
  sections: [
      { type: 'textBlock', title: "Как работают AI-боты в Telegram", text: "Боты подключаются к API нейросетей. Общаетесь как с обычным собеседником." },
      { type: 'textBlock', title: "Что умеет AI-бот", text: "Отвечать на вопросы, писать тексты, переводить, помогать с кодом." }
  ],
  faq: [
      { question: "Нужна ли регистрация?", answer: "Да, нужна минимальная регистрация по email. Это бесплатно и занимает 30 секунд." },
      { question: "Есть ли бесплатная версия?", answer: "Да, после регистрации вы получаете 10 бесплатных запросов на пробу. Для регулярного использования доступны тарифы от 99 ₽." },
      { question: "Работает ли без VPN?", answer: "Да, все модели доступны напрямую без VPN. Оплата в рублях, картами РФ." },
      { question: "Поддерживается ли русский язык?", answer: "Да, все популярные модели отлично понимают и отвечают на русском языке." },
      { question: "Какие модели доступны?", answer: "ChatGPT, DeepSeek, Claude, Gemini, Midjourney, Stable Diffusion и более 20 других моделей." }
  ],
  cta: "Попробовать сейчас",
  ctaLink: "/",
  ctaText: "Зарегистрируйтесь и получите 10 бесплатных запросов. Без VPN, без привязки карты, с оплатой в рублях.",
  related: {
      "chat-gpt-online": "ChatGPT онлайн",
      "gpt-4-chat": "GPT-4 чат",
      "chat-gpt-rossiya": "ChatGPT в России",
      "gpt-besplatno": "GPT бесплатно",
      "chatgpt-rasshirenie": "Расширения ChatGPT"
  },
};
