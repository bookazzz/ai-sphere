import { TextSection } from '@/types/seo-page';

interface Props {
  sections: TextSection[];
}

export default function SeoSections({ sections }: Props) {
  return (
    <article className="seo-content">
      {sections.map((section, i) => (
        <section key={i} className="seo-section" itemScope itemProp="articleBody">
          <h2 className="seo-section__title">{section.title}</h2>
          <p className="seo-section__text">{section.text}</p>
        </section>
      ))}
    </article>
  );
}
