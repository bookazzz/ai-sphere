import { ResultExamplesSection } from '@/types/seo-page';

interface Props { section: ResultExamplesSection }

export default function ResultExamplesBlock({ section }: Props) {
  return (
    <section className="seo-section seo-results">
      <h2 className="seo-section__title">{section.title}</h2>
      <div className="seo-results__grid">
        {section.results.map((r, i) => (
          <div key={i} className="seo-result-card">
            <h3 className="seo-result-card__label">{r.label}</h3>
            <p className="seo-result-card__desc">{r.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
