import { TableOfContentsSection } from '@/types/seo-page';

interface Props { section: TableOfContentsSection }

export default function TableOfContentsBlock({ section }: Props) {
  return (
    <nav className="seo-section seo-toc" aria-label="Содержание">
      <h2 className="seo-section__title">Содержание</h2>
      <ul className="seo-toc__list">
        {section.items.map((item, i) => (
          <li key={i} className="seo-toc__item">
            <a href={`#${item.anchor}`} className="seo-toc__link">{item.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
