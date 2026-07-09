import { TextSection } from '@/types/seo-page';

interface Props {
  section: TextSection;
}

export default function TextBlockSection({ section }: Props) {
  return (
    <section className="seo-section" itemScope itemProp="articleBody">
      <h2 className="seo-section__title">{section.title}</h2>
      <p className="seo-section__text">{section.text}</p>
      {section.items && section.items.length > 0 && (
        <ul className="seo-section__list">
          {section.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
