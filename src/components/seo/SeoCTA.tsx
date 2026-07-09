import Link from 'next/link';

interface Props {
  title: string;
  text: string;
  buttonLabel: string;
  buttonHref: string;
}

export default function SeoCTA({ title, text, buttonLabel, buttonHref }: Props) {
  return (
    <section className="seo-cta">
      <div className="seo-cta__container">
        <h2 className="seo-cta__title">{title}</h2>
        <p className="seo-cta__text">{text}</p>
        <Link href={buttonHref} className="btn btn-primary">
          {buttonLabel} →
        </Link>
      </div>
    </section>
  );
}
