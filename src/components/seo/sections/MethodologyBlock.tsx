import { MethodologySection } from '@/types/seo-page';

interface Props { section: MethodologySection }

export default function MethodologyBlock({ section }: Props) {
  return (
    <section className="seo-section seo-methodology">
      <h2 className="seo-section__title">{section.title}</h2>
      <ol className="seo-methodology__list">
        {section.criteria.map((c, i) => (
          <li key={i} className="seo-methodology__item">
            <strong>{c.name}</strong>
            {c.weight && <span className="seo-methodology__weight"> (вес: {c.weight})</span>}
            <p>{c.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
