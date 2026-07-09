interface Props {
  title: string;
  subtitle: string;
}

export default function SeoHero({ title, subtitle }: Props) {
  return (
    <section className="seo-hero">
      <h1 className="seo-hero__title">{title}</h1>
      <p className="seo-hero__subtitle">{subtitle}</p>
    </section>
  );
}
