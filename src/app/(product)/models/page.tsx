'use client';

import { useModels } from '@/hooks/useModels';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { getAllModelHubs } from '@/content/models';

// Ссылка на раздел цен по названию провайдера
function getPriceAnchor(providerName: string): string {
  const map: Record<string, string> = {
    'Amazon': 'amazon',
    'Anthropic': 'anthropic',
    'Cohere': 'cohere',
    'DeepSeek': 'deepseek',
    'Google': 'google',
    'Grok': 'xai',
    'Meta': 'meta',
    'Microsoft': 'microsoft',
    'Mistral': 'mistral',
    'Nvidia': 'nvidia',
    'OpenAI': 'openai',
    'Qwen': 'qwen',
    'xAI': 'xai',
  };
  const anchor = map[providerName] || providerName.toLowerCase();
  return `/prices/#${anchor}`;
}

// Icon mapping for categories
const categoryIcons: Record<string, string> = {
  'Amazon': '☁️',
  'Anthropic': '🤖',
  'Cohere': '🔤',
  'DeepSeek': '🔍',
  'Google': '🌐',
  'Grok': '⚡',
  'Meta': '📘',
  'Microsoft': '🪟',
  'Mistral': '🌬️',
  'Nvidia': '🟢',
  'OpenAI': '🧠',
  'Qwen': '🐉',
  'xAI': '✖️',
};

export default function ModelsPage() {
  const { categories } = useModels();
  const modelHubs = getAllModelHubs();

  return (
    <>
      <Header />
      <section className="models-hero">
        <div className="models-hero__container">
          <h1 className="models-hero__title">Все AI-модели</h1>
          <p className="models-hero__subtitle">
            {categories.reduce((sum, cat) => sum + cat.models.length, 0)} нейросетей от ведущих мировых разработчиков в одном интерфейсе
          </p>
        </div>
      </section>
      <section className="models-section" aria-labelledby="model-guides-title">
        <div className="models-section__container">
          <div className="models-category__header">
            <h2 id="model-guides-title" className="models-category__name">Популярные модели</h2>
          </div>
          <div className="models-grid">
            {modelHubs.map((model) => (
              <Link
                href={`/models/${model.slug}/`}
                className="models-card"
                key={model.slug}
                style={{ textDecoration: 'none', display: 'block' }}
              >
                <span className="models-card__name" style={{ color: 'var(--color-accent, #667eea)' }}>
                  {model.name}
                </span>
                <span className="models-card__description">{model.providerName} · {model.useCases[0]}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="models-section">
        <div className="models-section__container">
          {categories.map((category) => (
            <div className="models-category" key={category.name}>
              <div className="models-category__header">
                <span className="models-category__icon">{categoryIcons[category.name] || '🤖'}</span>
                <h2 className="models-category__name">{category.name}</h2>
                <span className="models-category__count">{category.models.length} модели</span>
              </div>
              <div className="models-grid">
                {category.models.map((model) => (
                  <Link
                    href={getPriceAnchor(category.name)}
                    className="models-card"
                    key={model.id}
                    style={{ textDecoration: 'none', display: 'block' }}
                  >
                    <span className="models-card__name" style={{ color: 'var(--color-accent, #667eea)' }}>{model.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="models-cta">
        <div className="models-cta__container">
          <h2 className="models-cta__title">Попробуйте модель</h2>
          <p className="models-cta__text">10 бесплатных кредитов на старте</p>
          <a href="/" className="models-cta__btn">Перейти в чат</a>
        </div>
      </section>
      <Footer />
    </>
  );
}
