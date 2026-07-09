import { SeoPageContent } from '@/types/seo-page';
import SeoPage from './SeoPage';

interface Props {
  content: SeoPageContent;
}

/**
 * Упрощённый роутер: не использует switch/case с отдельными шаблонами.
 * Все страницы рендерятся через единый SeoPage-оркестратор с динамическими секциями.
 * Тип страницы влияет на состав секций (SectionRenderer) и JSON-LD, но не на каркас.
 */
export default function SeoTemplateRouter({ content }: Props) {
  return <SeoPage content={content} />;
}
