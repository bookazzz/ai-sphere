import { RecommendedModelsSection } from '@/types/seo-page';
import Link from 'next/link';

interface Props { section: RecommendedModelsSection }

export default function RecommendedModelsBlock({ section }: Props) {
  return (
    <section className="seo-section seo-rec-models">
      <h2 className="seo-section__title">{section.title}</h2>
      <div className="seo-rec-models__grid">
        {section.models.map((m, i) => (
          <div key={i} className="seo-rec-model">
            <h3 className="seo-rec-model__name">{m.name}</h3>
            <p className="seo-rec-model__desc">{m.description}</p>
            {m.link && <Link href={m.link} className="seo-rec-model__link">Подробнее →</Link>}
          </div>
        ))}
      </div>
    </section>
  );
}
