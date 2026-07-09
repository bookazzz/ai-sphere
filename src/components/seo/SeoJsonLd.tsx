import { SeoPageContent } from '@/types/seo-page';
import { site } from '@/config/site';

interface Props {
  content: SeoPageContent;
}

/**
 * Schema.org-тип для JSON-LD.
 * 1. Если указан schemaType в контенте — используем его.
 * 2. Иначе — fallback по type страницы.
 */
function getPageType(content: SeoPageContent): string {
  // Явное переопределение на уровне страницы
  if (content.schemaType) {
    return content.schemaType;
  }

  // Fallback по типу страницы
  switch (content.type) {
    case 'guide':
    case 'use-case':
      return 'Article';
    case 'model':
      return 'WebPage';
    case 'tool':
      return 'WebPage';
    case 'comparison':
      return 'Report';
    default:
      return 'WebPage';
  }
}

export default function SeoJsonLd({ content }: Props) {
  const url = `${site.url}/${content.slug}`;
  const graph: Record<string, any>[] = [];

  // Основной тип страницы
  const pageType = getPageType(content);
  const mainEntity: Record<string, any> = {
    '@type': pageType,
    headline: content.h1 || content.hero?.title || content.title,
    description: content.description,
    url,
    publisher: { '@type': 'Organization', name: 'AI-Sphere' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };

  // if pageType is Article — добавляем author
  if (pageType === 'Article') {
    mainEntity.author = { '@type': 'Organization', name: 'AI-Sphere' };
  }

  // Даты
  if (content.updatedAt) {
    mainEntity.datePublished = content.updatedAt;
    mainEntity.dateModified = content.updatedAt;
  } else if (content.datePublished) {
    mainEntity.datePublished = content.datePublished;
    mainEntity.dateModified = content.dateModified || content.datePublished;
  }

  // For softwareApplication — добавляем offers, applicationCategory, operatingSystem
  if (pageType === 'SoftwareApplication') {
    mainEntity.applicationCategory = 'AIApplication';
    mainEntity.operatingSystem = 'All';
    mainEntity.offers = {
      '@type': 'Offer',
      price: '99',
      priceCurrency: 'RUB',
      availability: 'https://schema.org/InStock',
    };
  }

  graph.push(mainEntity);

  // BreadcrumbList
  graph.push({
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Главная', item: site.url },
      { '@type': 'ListItem', position: 2, name: content.hero?.title || content.title, item: url },
    ],
  });

  // FAQPage — только если есть вопросы
  if (content.faq && content.faq.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: content.faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    });
  }

  const schema = {
    '@context': 'https://schema.org',
    '@graph': graph,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
