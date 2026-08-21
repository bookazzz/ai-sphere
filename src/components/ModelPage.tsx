'use client';

import Link from 'next/link';
import type { ModelHubData } from '@/content/models';

interface Props {
  model: ModelHubData;
}

export default function ModelPageClient({ model }: Props) {
  return (
    <>
      {/* Hero */}
      <section className="model-hero">
        <div className="container">
          <div className="model-hero__breadcrumbs">
            <Link href="/models">Все модели</Link>
            <span> / </span>
            <span>{model.name}</span>
          </div>
          <h1 className="model-hero__title">{model.h1}</h1>
          <p className="model-hero__desc">{model.description}</p>
          <div className="model-hero__meta">
            <span className="model-hero__provider">
              Разработчик: <Link href={`/company/${model.provider}/`}>{model.providerName}</Link>
            </span>
            {model.context && <span>Контекст: {model.context}</span>}
            {model.releaseDate && <span>Релиз: {model.releaseDate}</span>}
          </div>
        </div>
      </section>

      <div className="model-content container">
        {/* Характеристики */}
        <section className="model-section">
          <h2 className="model-section__title">Ключевые возможности</h2>
          <ul className="model-features">
            {model.features.map((f, i) => (
              <li key={i} className="model-feature">{f}</li>
            ))}
          </ul>
        </section>

        {/* Сильные стороны */}
        <section className="model-section">
          <h2 className="model-section__title">Сильные стороны</h2>
          <div className="model-tags">
            {model.strengths.map((s, i) => (
              <span key={i} className="model-tag">{s}</span>
            ))}
          </div>
        </section>

        {/* Сценарии */}
        <section className="model-section">
          <h2 className="model-section__title">Для каких задач подходит</h2>
          <ul className="model-uses">
            {model.useCases.map((u, i) => (
              <li key={i} className="model-use">{u}</li>
            ))}
          </ul>
        </section>

        {/* Цена */}
        <section className="model-section">
          <h2 className="model-section__title">Стоимость и доступность</h2>
          <p className="model-section__text">
            Цена {model.name} — от {model.id === 'deepseek/deepseek-v4-flash' ? '1' : '2'} кредита за 1K токенов.
            Точную стоимость смотрите на странице{' '}
            <Link href={`/prices/#${model.provider}`}>тарифов</Link>.
          </p>
          <p className="model-section__text">
            Модель доступна в России через AI-Sphere. Оплата в рублях, без комиссий.
            {model.id === 'deepseek/deepseek-v4-flash' && ' Это модель по умолчанию в AI-Sphere.'}
          </p>
        </section>

        {/* FAQ */}
        {model.faq.length > 0 && (
          <section className="model-section">
            <h2 className="model-section__title">FAQ</h2>
            <div className="model-faq">
              {model.faq.map((item, i) => (
                <div key={i} className="model-faq__item">
                  <h3 className="model-faq__q">{item.q}</h3>
                  <p className="model-faq__a">{item.a}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Новости модели */}
        <section className="model-section">
          <h2 className="model-section__title">Новости {model.name}</h2>
          <p className="model-section__text">
            Читайте последние новости и обновления в нашем{' '}
            <Link href="/news">новостном разделе</Link>.
          </p>
        </section>

        {/* CTA */}
        <section className="model-cta">
          <div className="model-cta__content">
            <h2 className="model-cta__title">Попробуйте {model.name}</h2>
            <p className="model-cta__text">10 000 кредитов бесплатно при регистрации</p>
            <a href="https://ai-sphere.ru?topup=true" className="model-cta__btn">
              Начать чат с {model.name}
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
