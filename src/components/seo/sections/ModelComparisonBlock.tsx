import { ModelComparisonSection } from '@/types/seo-page';

interface Props {
  section: ModelComparisonSection;
}

export default function ModelComparisonBlock({ section }: Props) {
  return (
    <section className="seo-section seo-comparison">
      <h2 className="seo-section__title">{section.title}</h2>
      <div className="seo-comparison__grid">
        {section.models.map((m, i) => (
          <div key={i} className="seo-comparison__card">
            <h3 className="seo-comparison__name">{m.name}</h3>
            <p className="seo-comparison__best"><strong>Лучше всего для:</strong> {m.bestFor}</p>
            <div className="seo-comparison__pros">
              <strong>Плюсы:</strong>
              <ul>{m.pros.map((p, j) => <li key={j}>{p}</li>)}</ul>
            </div>
            <div className="seo-comparison__cons">
              <strong>Минусы:</strong>
              <ul>{m.cons.map((c, j) => <li key={j}>{c}</li>)}</ul>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
