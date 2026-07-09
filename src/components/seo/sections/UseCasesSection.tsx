import type { UseCasesSection as UseCasesSectionType } from '@/types/seo-page';

interface Props {
  section: UseCasesSectionType;
}

export default function UseCasesSectionBlock({ section }: Props) {
  return (
    <section className="seo-section">
      <h2 className="seo-section__title">{section.title}</h2>
      <div className="seo-cases">
        {section.cases.map((c, i) => (
          <div key={i} className="seo-case">
            <h3 className="seo-case__title">{c.name}</h3>
            <p className="seo-case__desc">{c.description}</p>
            {c.models && c.models.length > 0 && (
              <p className="seo-case__models">
                <strong>Модели:</strong> {c.models.join(', ')}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
