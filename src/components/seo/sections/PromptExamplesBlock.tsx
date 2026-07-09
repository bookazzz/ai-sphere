import { PromptExamplesSection } from '@/types/seo-page';

interface Props {
  section: PromptExamplesSection;
}

export default function PromptExamplesBlock({ section }: Props) {
  return (
    <section className="seo-section seo-prompts">
      <h2 className="seo-section__title">{section.title}</h2>
      {section.examples.map((ex, i) => (
        <div key={i} className="seo-prompt">
          <h3 className="seo-prompt__label">Пример {i + 1}</h3>
          <div className="seo-prompt__request">
            <strong>Запрос:</strong>
            <pre>{ex.prompt}</pre>
          </div>
          <div className="seo-prompt__result">
            <strong>Результат:</strong>
            <p>{ex.result}</p>
          </div>
          {ex.note && <p className="seo-prompt__note">📝 {ex.note}</p>}
        </div>
      ))}
    </section>
  );
}
