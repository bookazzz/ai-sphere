import Link from 'next/link';
import { CTABlockSection } from '@/types/seo-page';

interface Props { section: CTABlockSection }

export default function CTABlock({ section }: Props) {
  return (
    <section className="seo-cta seo-cta--inline">
      <div className="seo-cta__container">
        <p className="seo-cta__text">{section.text}</p>
        <Link href={section.buttonHref} className="btn btn-primary">
          {section.buttonLabel} →
        </Link>
      </div>
    </section>
  );
}
