'use client';

import type { CSSProperties } from 'react';
import { useModels } from '@/hooks/useModels';

const providerColors: Record<string, string> = {
  OpenAI: '#10a37f', Anthropic: '#d97706', Google: '#4285f4', DeepSeek: '#4f46e5',
  Mistral: '#f97316', Qwen: '#06b6d4', xAI: '#1d1d1f', Grok: '#1d1d1f',
  Perplexity: '#22c55e', Amazon: '#ff9900', Microsoft: '#00a4ef', Nvidia: '#76b900',
};

function modelCountLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} модель`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} модели`;
  return `${count} моделей`;
}

export default function ModelsGridSection() {
  const { categories } = useModels();
  const count = categories.reduce((sum, category) => sum + category.models.length, 0);

  return (
    <section className="models-showcase">
      <div className="models-showcase__header">
        <span className="models-showcase__eyebrow"><span className="models-showcase__eyebrow-dot" aria-hidden="true" />Единая AI‑платформа</span>
        <h2 className="models-showcase__title">Какие модели доступны</h2>
        <p className="models-showcase__subtitle">Сейчас доступно {modelCountLabel(count)} от ведущих мировых провайдеров — каталог обновляется автоматически.</p>
      </div>
      <div className="models-showcase__list anim-stagger">
        {categories.map(category => (
          <article key={category.name} className="models-showcase__card" style={{ '--provider-color': providerColors[category.name] || '#8b5cf6' } as CSSProperties}>
            <div className="models-showcase__card-header">
              <span className="models-showcase__mark" aria-hidden="true"><span>{category.name.charAt(0)}</span></span>
              <div><h3 className="models-showcase__provider">{category.name}</h3><p className="models-showcase__count">{modelCountLabel(category.models.length)}</p></div>
            </div>
            <ul className="models-showcase__models" aria-label={`Модели ${category.name}`}>
              {category.models.slice(0, 4).map(model => <li key={model.id}>{model.name}</li>)}
            </ul>
          </article>
        ))}
      </div>
      <p className="models-showcase__note"><span aria-hidden="true" />Показываем только активные модели из подтверждённого каталога</p>
    </section>
  );
}
