import { TroubleshootingSection } from '@/types/seo-page';

interface Props { section: TroubleshootingSection }

export default function TroubleshootingBlock({ section }: Props) {
  return (
    <section className="seo-section seo-troubleshooting">
      <h2 className="seo-section__title">{section.title}</h2>
      {section.issues.map((issue, i) => (
        <div key={i} className="seo-troubleshooting__item">
          <h3 className="seo-troubleshooting__problem">❌ {issue.problem}</h3>
          <p className="seo-troubleshooting__solution">✅ {issue.solution}</p>
        </div>
      ))}
    </section>
  );
}
