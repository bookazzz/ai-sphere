import { StepByStepSection } from '@/types/seo-page';

interface Props {
  section: StepByStepSection;
}

export default function StepByStepBlock({ section }: Props) {
  return (
    <section className="seo-section seo-steps">
      <h2 className="seo-section__title">{section.title}</h2>
      <ol className="seo-steps__list">
        {section.steps.map((step, i) => (
          <li key={i} className="seo-steps__item">
            <h3 className="seo-steps__step-title">{step.title}</h3>
            <p className="seo-steps__desc">{step.description}</p>
            {step.tip && (
              <p className="seo-steps__tip">💡 {step.tip}</p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
