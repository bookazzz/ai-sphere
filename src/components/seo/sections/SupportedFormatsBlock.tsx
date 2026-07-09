import { SupportedFormatsSection } from '@/types/seo-page';

interface Props {
  section: SupportedFormatsSection;
}

export default function SupportedFormatsBlock({ section }: Props) {
  return (
    <section className="seo-section seo-formats">
      <h2 className="seo-section__title">{section.title}</h2>
      <ul className="seo-formats__list">
        {section.formats.map((fmt, i) => (
          <li key={i} className="seo-formats__item">{fmt}</li>
        ))}
      </ul>
      {section.note && <p className="seo-formats__note">ℹ️ {section.note}</p>}
    </section>
  );
}
