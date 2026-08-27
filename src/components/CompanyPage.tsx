'use client';

import { useMemo } from 'react';
import { useModels } from '@/hooks/useModels';
import Link from 'next/link';
import type { Company } from '@/types/company';

interface Props {
  company: Company;
}

export default function CompanyPageClient({ company }: Props) {
  const { allModels } = useModels();

  // Filter models that belong to this company
  const companyModels = useMemo(() => {
    if (!allModels) return [];
    const slugs = company.models.map((m) => m.toLowerCase());
    return allModels.filter((m) => {
      const id = m.id?.toLowerCase() || '';
      const name = m.name?.toLowerCase() || '';
      return slugs.some((s) => id.includes(s) || name.includes(s));
    });
  }, [allModels, company]);

  // Map company name to price anchor
  const priceAnchor = company.categories[0]?.toLowerCase() || company.slug;
  const newsCategoryByCompany: Record<string, string> = {
    openai: 'openai',
    anthropic: 'anthropic',
    'google-deepmind': 'google-gemini',
    'meta-ai': 'llm',
    'mistral-ai': 'llm',
    xai: 'llm',
    deepseek: 'llm',
  };
  const newsCategory = newsCategoryByCompany[company.slug] || 'general';

  return (
    <>
      <section className="company-hero">
        <div className="container">
          <h1 className="company-hero__title">{company.h1}</h1>
          <p className="company-hero__desc">{company.description}</p>
          <div className="company-hero__meta">
            {company.founded && <span>Основана: {company.founded}</span>}
            {company.headquarters && <span>Штаб-квартира: {company.headquarters}</span>}
            <a href={company.website} target="_blank" rel="noopener noreferrer" className="company-hero__link">
              Официальный сайт ↗
            </a>
          </div>
        </div>
      </section>

      <div className="company-content container">
        {/* Продукты */}
        <section className="company-section">
          <h2 className="company-section__title">Основные продукты</h2>
          <div className="company-products">
            {company.products.map((product, i) => (
              <div key={i} className="company-product">
                <h3 className="company-product__name">{product.name}</h3>
                <p className="company-product__desc">{product.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Доступные модели */}
        {companyModels.length > 0 && (
          <section className="company-section">
            <h2 className="company-section__title">Доступные модели</h2>
            <div className="company-models">
              {companyModels.map((model: { id: string; name: string; context?: string; description?: string }) => (
                <Link
                  key={model.id}
                  href={`/prices/#${priceAnchor}`}
                  className="company-model"
                >
                  <span className="company-model__name">{model.name}</span>
                  {model.context && <span className="company-model__ctx">Контекст: {model.context}</span>}
                  {model.description && <span className="company-model__desc">{model.description}</span>}
                  <span className="company-model__price-link">Цены →</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Цены */}
        <section className="company-section">
          <h2 className="company-section__title">Стоимость API</h2>
          <p className="company-section__text">
            Актуальные цены на модели {company.shortName} — на странице{' '}
            <Link href={`/prices/#${priceAnchor}`}>тарифов</Link>.
            Перед запуском показывается оценка расхода кредитов; итог зависит от модели и объёма задачи.
          </p>
        </section>

        {/* Статические секции */}
        {company.sections.map((section, i) => (
          <section key={i} className="company-section">
            <h2 className="company-section__title">{section.title}</h2>
            <div className="company-section__text">{renderMarkdown(section.content)}</div>
          </section>
        ))}

        {/* Новости компании */}
        <section className="company-section">
          <h2 className="company-section__title">Последние новости {company.shortName}</h2>
          <p className="company-section__text">
            Читайте последние новости и обновления {company.shortName} в нашем{' '}
            <Link href={`/news/category/${newsCategory}/`}>новостном разделе</Link>.
          </p>
        </section>

        {/* CTA */}
        <section className="company-cta">
          <div className="company-cta__content">
            <h2 className="company-cta__title">Попробуйте {company.shortName}</h2>
            <p className="company-cta__text">
              Доступный стартовый баланс отображается после регистрации
            </p>
            <a href="https://ai-sphere.ru?topup=true" className="company-cta__btn">
              Начать пользоваться
            </a>
          </div>
        </section>
      </div>
    </>
  );
}

function renderMarkdown(text: string): React.ReactNode {
  // Simple markdown renderer for bold and paragraphs
  const lines = text.split('\n\n').filter(Boolean);
  return lines.map((block, i) => {
    if (block.startsWith('**') && block.endsWith('**')) {
      return <p key={i} className="company-section__strong">{block.replace(/\*\*/g, '')}</p>;
    }
    // Handle inline bold
    const withBold = block.split(/(\*\*[^*]+\*\*)/).map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      // Handle lists starting with -
      if (part.trimStart().startsWith('- ')) {
        const items = part.split('\n').filter(l => l.trim());
        return (
          <ul key={`${i}-${j}`} className="company-section__list">
            {items.map((item, k) => (
              <li key={k}>{item.replace(/^- /, '')}</li>
            ))}
          </ul>
        );
      }
      return part;
    });
    return <p key={i}>{withBold}</p>;
  });
}
