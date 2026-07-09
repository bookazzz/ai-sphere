'use client';

import { useState } from 'react';

interface FaqItem {
  q: string;
  a: string;
}

interface FaqCategory {
  category: string;
  items: FaqItem[];
}

interface FaqAccordionProps {
  faqData: FaqCategory[];
}

export default function FaqAccordion({ faqData }: FaqAccordionProps) {
  const [openItem, setOpenItem] = useState<{ cat: number; idx: number } | null>(null);

  const toggleItem = (catIdx: number, itemIdx: number) => {
    if (openItem?.cat === catIdx && openItem?.idx === itemIdx) {
      setOpenItem(null);
    } else {
      setOpenItem({ cat: catIdx, idx: itemIdx });
    }
  };

  return (
    <section className="faq-section">
      <div className="faq-section__container">
        {faqData.map((category, catIdx) => (
          <div key={catIdx} className="faq-section__category">
            <h2 className="faq-section__category-title">{category.category}</h2>
            <div className="faq-section__items">
              {category.items.map((item, itemIdx) => (
                <div
                  key={itemIdx}
                  className={`faq-section__item ${
                    openItem?.cat === catIdx && openItem?.idx === itemIdx
                      ? 'faq-section__item--open'
                      : ''
                  }`}
                >
                  <button
                    className="faq-section__question"
                    onClick={() => toggleItem(catIdx, itemIdx)}
                  >
                    <span>{item.q}</span>
                    <span className="faq-section__icon">
                      {openItem?.cat === catIdx && openItem?.idx === itemIdx ? '−' : '+'}
                    </span>
                  </button>
                  {openItem?.cat === catIdx && openItem?.idx === itemIdx && (
                    <div className="faq-section__answer">
                      <p>{item.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
