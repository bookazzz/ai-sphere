import { RatingTableSection } from '@/types/seo-page';

interface Props { section: RatingTableSection }

export default function RatingTableBlock({ section }: Props) {
  return (
    <section className="seo-section seo-rating">
      <h2 className="seo-section__title">{section.title}</h2>
      <div className="seo-rating__table">
        {section.entries.map((e, i) => (
          <div key={i} className="seo-rating__row">
            <div className="seo-rating__info">
              <span className="seo-rating__place">#{i + 1}</span>
              <strong className="seo-rating__name">{e.name}</strong>
              <span className="seo-rating__stars">{'⭐'.repeat(Math.round(e.rating))}</span>
              <span className="seo-rating__score">{e.rating}/10</span>
            </div>
            <div className="seo-rating__details">
              <p><strong>+</strong> {e.pros}</p>
              <p><strong>−</strong> {e.cons}</p>
              <p><strong>💰</strong> {e.price}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
