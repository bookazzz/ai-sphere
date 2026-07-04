'use client';

import Link from 'next/link';
import React from 'react';
import { useState } from 'react';
import Footer from '@/components/Footer';

const categories = [
  {
    name: 'Amazon',
    models: [
      { name: 'Nova 2 Lite', price: 3 },
      { name: 'Nova Premier 1.0', price: 13 },
    ],
  },
  {
    name: 'Anthropic',
    models: [
      { name: 'Claude Haiku Latest', price: 5 },
      { name: 'Claude Sonnet Latest', price: 16 },
      { name: 'Claude Opus Latest', price: 25 },
      { name: 'Claude Opus 4.8 (Fast)', price: 50 },
      { name: 'Claude Opus 4.8', price: 25 },
      { name: 'Claude Opus 4.7 (Fast)', price: 150 },
      { name: 'Claude Opus 4.7', price: 25 },
      { name: 'Claude Opus 4.6 (Fast)', price: 150 },
      { name: 'Claude Sonnet 4.6', price: 16 },
      { name: 'Claude Opus 4.6', price: 25 },
      { name: 'Claude Opus 4.5', price: 25 },
      { name: 'Claude Haiku 4.5', price: 5 },
      { name: 'Claude Sonnet 4.5', price: 16 },
    ],
  },
  {
    name: 'DeepSeek',
    models: [
      { name: 'DeepSeek V4 Pro', price: 1 },
      { name: 'DeepSeek V4 Flash', price: 1 },
      { name: 'DeepSeek V3.2', price: 1 },
      { name: 'DeepSeek V3.2 Exp', price: 1 },
      { name: 'DeepSeek V3.1 Terminus', price: 1 },
    ],
  },
  {
    name: 'Google',
    models: [
      { name: 'Gemini Pro Latest', price: 12 },
      { name: 'Gemini Flash Latest', price: 10 },
      { name: 'Gemini 3.5 Flash', price: 10 },
      { name: 'Gemini 3.1 Flash Lite', price: 2 },
      { name: 'Gemma 4 26B A4B', price: 1 },
      { name: 'Gemma 4 31B', price: 1 },
      { name: 'Gemini 3.1 Flash Lite Preview', price: 2 },
      { name: 'Gemini 3.1 Pro Preview Custom Tools', price: 12 },
      { name: 'Gemini 3.1 Pro Preview', price: 12 },
      { name: 'Gemini 3 Flash Preview', price: 3 },
      { name: 'Gemini 2.5 Flash Lite Preview 09-2025', price: 1 },
    ],
  },
  {
    name: 'Microsoft',
    models: [
      { name: 'Phi 4 Mini Instruct', price: 1 },
    ],
  },
  {
    name: 'Mistral',
    models: [
      { name: 'Mistral Medium 3.5', price: 8 },
      { name: 'Mistral Small 4', price: 1 },
      { name: 'Devstral 2 2512', price: 2 },
      { name: 'Ministral 3 14B 2512', price: 1 },
      { name: 'Ministral 3 8B 2512', price: 1 },
      { name: 'Ministral 3 3B 2512', price: 1 },
      { name: 'Mistral Large 3 2512', price: 2 },
      { name: 'Voxtral Small 24B 2507', price: 1 },
    ],
  },
  {
    name: 'NVIDIA',
    models: [
      { name: 'Nemotron 3 Ultra', price: 3 },
      { name: 'Nemotron 3 Super', price: 1 },
      { name: 'Nemotron 3 Nano 30B A3B', price: 1 },
      { name: 'Llama 3.3 Nemotron Super 49B V1.5', price: 1 },
    ],
  },
  {
    name: 'OpenAI',
    models: [
      { name: 'GPT Chat Latest', price: 31 },
      { name: 'GPT Mini Latest', price: 5 },
      { name: 'GPT Latest', price: 31 },
      { name: 'GPT-5.5 Pro', price: 181 },
      { name: 'GPT-5.5', price: 31 },
      { name: 'GPT-5.4 Nano', price: 2 },
      { name: 'GPT-5.4 Mini', price: 5 },
      { name: 'GPT-5.4 Pro', price: 181 },
      { name: 'GPT-5.4', price: 16 },
      { name: 'GPT-5.3 Chat', price: 14 },
      { name: 'GPT-5.3 Codex', price: 14 },
      { name: 'GPT-5.2 Codex', price: 14 },
      { name: 'GPT-5.2 Chat', price: 14 },
      { name: 'GPT-5.2 Pro', price: 168 },
      { name: 'GPT-5.2', price: 14 },
      { name: 'GPT-5.1 Codex Max', price: 10 },
      { name: 'GPT-5.1', price: 10 },
      { name: 'GPT-5.1 Chat', price: 10 },
      { name: 'GPT-5.1 Codex', price: 10 },
      { name: 'GPT-5.1 Codex Mini', price: 2 },
      { name: 'gpt-oss-safeguard-20b', price: 1 },
      { name: 'o3 Deep Research', price: 40 },
      { name: 'o4 Mini Deep Research', price: 8 },
      { name: 'GPT-5 Pro', price: 121 },
      { name: 'GPT-5 Codex', price: 10 },
      { name: 'GPT-4o-mini', price: 1 },
    ],
  },
  {
    name: 'Perplexity',
    models: [
      { name: 'Sonar Pro Search', price: 16 },
      { name: 'Sonar Reasoning Pro', price: 8 },
      { name: 'Sonar Deep Research', price: 8 },
    ],
  },
  {
    name: 'Qwen',
    models: [
      { name: 'Qwen3.7 Plus', price: 2 },
      { name: 'Qwen3.7 Max', price: 4 },
      { name: 'Qwen3.5 Plus 2026-04-20', price: 2 },
      { name: 'Qwen3.6 Flash', price: 2 },
      { name: 'Qwen3.6 35B A3B', price: 1 },
      { name: 'Qwen3.6 Max Preview', price: 7 },
      { name: 'Qwen3.6 27B', price: 4 },
      { name: 'Qwen3.6 Plus', price: 2 },
      { name: 'Qwen3.5-9B', price: 1 },
      { name: 'Qwen3.5-35B-A3B', price: 1 },
      { name: 'Qwen3.5-27B', price: 2 },
      { name: 'Qwen3.5-122B-A10B', price: 3 },
      { name: 'Qwen3.5-Flash', price: 1 },
      { name: 'Qwen3.5 Plus 2026-02-15', price: 2 },
      { name: 'Qwen3.5 397B A17B', price: 3 },
      { name: 'Qwen3 Max Thinking', price: 4 },
      { name: 'Qwen3 Coder Next', price: 1 },
      { name: 'Qwen3 VL 32B Instruct', price: 1 },
      { name: 'Qwen3 VL 8B Thinking', price: 2 },
      { name: 'Qwen3 VL 8B Instruct', price: 1 },
      { name: 'Qwen3 VL 30B A3B Thinking', price: 2 },
      { name: 'Qwen3 VL 30B A3B Instruct', price: 1 },
      { name: 'Qwen3 VL 235B A22B Thinking', price: 3 },
      { name: 'Qwen3 VL 235B A22B Instruct', price: 1 },
      { name: 'Qwen3 Max', price: 4 },
      { name: 'Qwen3 Coder Plus', price: 4 },
      { name: 'Qwen3 Coder Flash', price: 1 },
      { name: 'Qwen3 Next 80B A3B Thinking', price: 1 },
      { name: 'Qwen3 Next 80B A3B Instruct', price: 2 },
      { name: 'Qwen Plus 0728 (thinking)', price: 1 },
      { name: 'Qwen Plus 0728', price: 1 },
    ],
  },
  {
    name: 'Xiaomi',
    models: [
      { name: 'MiMo-V2.5-Pro', price: 1 },
      { name: 'MiMo-V2.5', price: 1 },
    ],
  },
  {
    name: 'Z.ai',
    models: [
      { name: 'GLM 5.2', price: 5 },
      { name: 'GLM 5.1', price: 4 },
      { name: 'GLM 5 Turbo', price: 4 },
      { name: 'GLM 5', price: 2 },
      { name: 'GLM 4.7 Flash', price: 1 },
      { name: 'GLM 4.7', price: 2 },
      { name: 'GLM 4.6V', price: 1 },
      { name: 'GLM 4.6', price: 2 },
    ],
  },
  {
    name: 'xAI',
    models: [
      { name: 'Grok Build 0.1', price: 2 },
      { name: 'Grok 4.3', price: 3 },
      { name: 'Grok 4.20 Multi-Agent', price: 3 },
      { name: 'Grok 4.20', price: 3 },
    ],
  },
];

const faqItems = [
  {
    q: 'Как списываются кредиты?',
    a: 'Кредиты списываются за каждый запрос к модели. Стоимость зависит от выбранной модели. Например, DeepSeek V4 Flash — 1 кредит за 1K токенов, GPT-5.5 Pro — 181 кредит за 1K токенов. Полный ответ тарифицируется по сумме входных и выходных токенов.',
  },
  {
    q: 'Можно ли пополнить баланс без комиссии?',
    a: 'Да, пополнение через ЮKassa без скрытых комиссий. Доступны суммы: 50, 250, 1000 и 2500 рублей. Средства зачисляются мгновенно.',
  },
  {
    q: 'Есть ли бесплатный лимит?',
    a: 'Да, после регистрации вы получаете 50 кредитов на тестирование. Этого достаточно, чтобы опробовать разные модели и выбрать подходящую.',
  },
  {
    q: 'Какие модели самые доступные?',
    a: 'Базовые модели DeepSeek, Qwen Flash, Ministral и Phi стоят всего 1 кредит за 1K токенов. Для сложных задач подойдут Claude Opus (25 кредитов) или GPT-5 Pro (121 кредит).',
  },
  {
    q: 'Поддерживается ли работа с изображениями?',
    a: 'Да, мультимодальные модели (Claude, GPT, Gemini, Qwen VL) принимают изображения на вход. Стоимость обработки изображений зависит от размера и считается в токенах.',
  },
];

export default function PricesPage() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="header__container">
          <Link href="/" className="header__logo">AI Sphere</Link>
          <nav className="header__menu">
            <Link href="/" className="header__link">Главная</Link>
            <Link href="/prices" className="header__link header__link--active">Цены</Link>
            <Link href="/security" className="header__link">Безопасность</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="pricing-hero">
        <div className="pricing-hero__container">
          <h1 className="pricing-hero__title">Цены на AI-модели</h1>
          <p className="pricing-hero__subtitle">
            Оплачивайте только то, что используете. Все цены указаны за 1 000 токенов (входных + выходных).
          </p>
        </div>
      </section>

      {/* Model Pricing Table */}
      <section className="pricing-table">
        <div className="pricing-table__container">
          <div className="pricing-table__wrapper">
            <table className="pricing-table__table">
              <thead>
                <tr>
                  <th className="pricing-table__th pricing-table__th--model">Модель</th>
                  <th className="pricing-table__th pricing-table__th--price">Цена за 1K токенов</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <React.Fragment key={category.name}>
                    <tr>
                      <td className="pricing-table__category" colSpan={2}>
                        {category.name}
                      </td>
                    </tr>
                    {category.models.map((model) => (
                      <tr key={model.name}>
                        <td className="pricing-table__model">{model.name}</td>
                        <td className="pricing-table__price">
                          {model.price}
                          <span className="pricing-table__unit"> credit</span>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="plans">
        <div className="plans__container">
          <h2 className="plans__title">Выберите тариф</h2>
          <div className="plans__grid">
            {[
              { amount: 50, bonus: null },
              { amount: 250, bonus: '+10%' },
              { amount: 1000, bonus: '+15%' },
              { amount: 2500, bonus: '+20%' },
            ].map((plan) => (
              <div className="plans__card" key={plan.amount}>
                <div className="plans__card-header">
                  <span className="plans__price">{plan.amount} ₽</span>
                  {plan.bonus && (
                    <span className="plans__bonus">{plan.bonus}</span>
                  )}
                </div>
                <div className="plans__card-body">
                  <p className="plans__credits">
                    ~{plan.amount * 10} кредитов
                  </p>
                  {plan.bonus && (
                    <p className="plans__bonus-text">
                      +{plan.bonus === '+10%' ? '25' : plan.bonus === '+15%' ? '150' : '500'} бонусных кредитов
                    </p>
                  )}
                </div>
                <button className="plans__btn">Пополнить</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="pricing-faq">
        <div className="pricing-faq__container">
          <h2 className="pricing-faq__title">Частые вопросы</h2>
          <div className="pricing-faq__list">
            {faqItems.map((item, idx) => (
              <div
                className={`pricing-faq__item ${expandedFaq === idx ? 'pricing-faq__item--open' : ''}`}
                key={idx}
              >
                <button
                  className="pricing-faq__question"
                  onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                >
                  <span>{item.q}</span>
                  <span className="pricing-faq__icon">
                    {expandedFaq === idx ? '−' : '+'}
                  </span>
                </button>
                {expandedFaq === idx && (
                  <div className="pricing-faq__answer">
                    <p>{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pricing-cta">
        <div className="pricing-cta__container">
          <h2 className="pricing-cta__title">Начните бесплатно</h2>
          <p className="pricing-cta__text">
            50 кредитов на старте. Доступ ко всем моделям без ограничений.
          </p>
          <Link href="/" className="pricing-cta__btn">
            Зарегистрироваться
          </Link>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </>
  );
}
