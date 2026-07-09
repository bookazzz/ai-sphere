import Link from 'next/link';
import { categories } from '@/lib/models-data';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

// Icon mapping for categories
const categoryIcons: Record<string, string> = {
  'Amazon': '☁️',
  'Anthropic': '🤖',
  'Cohere': '🔤',
  'DeepSeek': '🔍',
  'Google': '🌐',
  'Grok': '⚡',
  'Meta': '📘',
  'Microsoft': '🪟',
  'Mistral': '🌬️',
  'Nvidia': '🟢',
  'OpenAI': '🧠',
  'Qwen': '🐉',
  'xAI': '✖️',
};

export default function ModelsPage() {
  return (
    <>
      {/* Header */}
      <Header />

      {/* Hero */}
      <section className="models-hero">
        <div className="models-hero__container">
          <h1 className="models-hero__title">Все AI-модели</h1>
          <p className="models-hero__subtitle">
            {categories.reduce((sum, cat) => sum + cat.models.length, 0)} нейросетей от ведущих мировых разработчиков в одном интерфейсе
          </p>
        </div>
      </section>

      {/* Models by category */}
      <section className="models-section">
        <div className="models-section__container">
          {categories.map((category) => (
            <div className="models-category" key={category.name}>
              <div className="models-category__header">
                <span className="models-category__icon">{categoryIcons[category.name] || '🤖'}</span>
                <h2 className="models-category__name">{category.name}</h2>
                <span className="models-category__count">{category.models.length} модели</span>
              </div>
              <div className="models-grid">
                {category.models.map((model: { id: string; name: string }) => (
                  <div className="models-card" key={model.id}>
                    <span className="models-card__name">{model.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="models-cta">
        <div className="models-cta__container">
          <h2 className="models-cta__title">Попробуйте любую модель</h2>
          <p className="models-cta__text">
            10 бесплатных кредитов каждый день. Никаких подписок — платите только за запросы.
          </p>
          <Link href="/" className="models-cta__btn">
            Начать бесплатно
          </Link>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </>
  );
}
