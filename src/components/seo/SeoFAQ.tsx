import { SeoPageFAQ } from '@/types/seo-page';

interface Props {
  faq: SeoPageFAQ[];
}

export default function SeoFAQ({ faq }: Props) {
  return (
    <section className="seo-faq" itemScope itemType="https://schema.org/FAQPage">
      <h2 className="seo-faq__title">Часто задаваемые вопросы</h2>
      <div className="seo-faq__list">
        {faq.map((item, i) => (
          <div key={i} className="seo-faq__item" itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
            <h3 className="seo-faq__question" itemProp="name">{item.question}</h3>
            <div className="seo-faq__answer" itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
              <p itemProp="text">{item.answer}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
