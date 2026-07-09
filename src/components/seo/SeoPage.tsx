import { SeoPageContent, requiredSections } from '@/types/seo-page';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SeoJsonLd from './SeoJsonLd';
import SeoBreadcrumbs from './SeoBreadcrumbs';
import SeoAuthorBar from './SeoAuthorBar';
import SeoHero from './SeoHero';
import SeoCTA from './SeoCTA';
import SeoFAQ from './SeoFAQ';
import SeoRelated from './SeoRelated';
import SectionRenderer from './SectionRenderer';

interface Props {
  content: SeoPageContent;
}

/** Валидирует, что все обязательные секции для данного типа присутствуют */
function validateSections(page: SeoPageContent): string[] {
  const required = requiredSections[page.type];
  if (!required) return [];
  const present = new Set(page.sections.map((s) => s.type));
  return required.filter((type) => !present.has(type));
}

/** Извлечь текст для Hero-блока с backward compat */
function getHero(content: SeoPageContent) {
  if (content.hero) {
    return content.hero;
  }
  return {
    title: content.title,
    text: content.subtitle || '',
    ctaText: content.ctaText || content.cta || 'Попробовать',
    modelId: undefined as string | undefined,
  };
}

/** Извлечь CTA-ссылку */
function getCtaLink(content: SeoPageContent): string {
  return content.ctaLink || (content.hero ? '/' : '/');
}

/** Извлечь список связанных страниц */
function getRelatedPages(content: SeoPageContent): Record<string, string> {
  if (content.relatedPages) {
    // Новый формат: string[] — slug → заголовок не знаем, отдаём как есть
    // SeoRelated должен уметь принимать string[]
    return {};
  }
  return content.related || {};
}

function getRelatedSlugs(content: SeoPageContent): string[] {
  if (content.relatedPages) {
    return content.relatedPages;
  }
  return Object.keys(content.related || {});
}

export default function SeoPage({ content }: Props) {
  // Валидация (только в dev)
  if (process.env.NODE_ENV === 'development') {
    const missing = validateSections(content);
    if (missing.length > 0) {
      console.warn(
        `⚠️ [SeoPage] "${content.slug}" (${content.type}) missing required sections:`,
        missing.join(', ')
      );
    }
  }

  // Hero-данные
  const hero = getHero(content);

  // Хлебные крошки — нормализуем формат
  let breadcrumbs: { label: string; href?: string }[] = [{ label: 'Главная', href: '/' }];
  if (content.breadcrumbs && content.breadcrumbs.length > 0) {
    breadcrumbs = content.breadcrumbs.map((b) => ({
      label: (b as any).title || (b as any).label || '',
      href: (b as any).url || (b as any).href,
    }));
  } else {
    breadcrumbs.push({ label: hero.title });
  }

  // H1
  const h1 = content.h1 || hero.title;

  // CTA
  const ctaHref = getCtaLink(content);
  const ctaText = hero.ctaText;

  // Related pages
  const relatedSlugs = getRelatedSlugs(content);
  const relatedMap = content.related || {};

  return (
    <>
      <SeoJsonLd content={content} />
      <Header />
      <main className="seo-page">
        <div className="seo-page__container">
          <SeoBreadcrumbs items={breadcrumbs} />

          <SeoHero title={h1} subtitle={hero.text} />

          <SeoAuthorBar
            name={content.author}
            updatedAt={content.updatedAt}
            datePublished={content.datePublished}
          />

          {content.sections.map((section, i) => (
            <SectionRenderer key={`${section.type}-${i}`} section={section} />
          ))}

          <SeoCTA
            title="Попробуйте прямо сейчас"
            text={ctaText}
            buttonLabel={ctaText}
            buttonHref={ctaHref}
          />

          {content.faq && content.faq.length > 0 && <SeoFAQ faq={content.faq} />}

          {relatedSlugs.length > 0 && (
            <SeoRelated
              related={relatedMap}
              relatedPages={relatedSlugs}
            />
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
