import { RecommendationsSection } from '@/types/seo-page';

interface Props { section: RecommendationsSection }

export default function RecommendationsBlock({ section }: Props) {
  return (
    <section className="seo-section seo-recommendations">
      <h2 className="seo-section__title">{section.title}</h2>
      {section.scenarios.map((s, i) => (
        <div key={i} className="seo-recommendation">
          <h3 className="seo-recommendation__scenario">🎯 {s.scenario}</h3>
          <p className="seo-recommendation__choice"><strong>Выбор:</strong> {s.choice}</p>
          <p className="seo-recommendation__reason">{s.reason}</p>
        </div>
      ))}
    </section>
  );
}
