import { SeoPageContent } from '@/types/seo-page';
import { site } from '@/config/site';
import { absoluteUrl, schemaAuthor } from '@/lib/seo';

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
    const aliases: Record<string, string> = {
      webPage: 'WebPage',
      article: 'Article',
      softwareApplication: 'SoftwareApplication',
      product: 'Product',
      report: 'Report',
      howTo: 'HowTo',
    };
    return aliases[content.schemaType] || content.schemaType;
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
  const url = absoluteUrl(content.canonical || `/${content.slug}`);
  const graph: Record<string, any>[] = [];

  // Основной тип страницы
  const pageType = getPageType(content);
  const headline = content.h1 || content.hero?.title || content.title;
  const mainEntity: Record<string, any> = {
    '@type': pageType,
    '@id': `${url}#main`,
    name: headline,
    description: content.metaDescription || content.description,
    url,
    inLanguage: 'ru-RU',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };

  if (['Article', 'Report'].includes(pageType)) {
    mainEntity.headline = headline;
    mainEntity.author = schemaAuthor(content.author);
    mainEntity.publisher = { '@id': `${site.url}/#organization` };
    mainEntity.image = content.image || site.ogImage;
  }

  // Даты
  if (content.datePublished) {
    mainEntity.datePublished = content.datePublished;
    mainEntity.dateModified = content.dateModified || content.datePublished;
  }
  if (content.updatedAt) mainEntity.dateModified = content.updatedAt;

  if (pageType === 'SoftwareApplication') {
    mainEntity.applicationCategory = 'BusinessApplication';
    mainEntity.operatingSystem = 'Any';
    mainEntity.publisher = { '@id': `${site.url}/#organization` };
  }

  graph.push(mainEntity);

  // BreadcrumbList
  const breadcrumbItems = content.breadcrumbs?.length
    ? content.breadcrumbs.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.title,
        item: absoluteUrl(item.url),
      }))
    : [
        { '@type': 'ListItem', position: 1, name: 'Главная', item: `${site.url}/` },
        { '@type': 'ListItem', position: 2, name: headline, item: url },
      ];

  graph.push({
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems,
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
