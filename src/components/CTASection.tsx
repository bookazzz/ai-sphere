interface Props { onOpenAuth: () => void; }
export default function CTASection({ onOpenAuth }: Props) {
  return (
    <section className="cta">
      <div className="cta__inner">
        <h2 className="cta__title">Начни прямо сейчас</h2>
        <p className="cta__subtitle">Доступ к самым мощным моделям ИИ в вашем браузере</p>
        <button className="cta__btn" onClick={onOpenAuth}>
          Открыть чат →
        </button>
      </div>
    </section>
  );
}
