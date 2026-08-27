export default function HowItWorksSection() {
  const steps = [
    { num: 1, title: 'Регистрируетесь', desc: 'Создайте аккаунт за 30 секунд через email, Яндекс или VK.' },
    { num: 2, title: 'Получаете кредиты', desc: '10 бесплатных кредитов каждый день, пока вы не пополняли баланс.' },
    { num: 3, title: 'Получаете результат', desc: 'AI‑Sphere подбирает доступную модель по задаче, цене и качеству.' },
    { num: 4, title: 'Пишете запрос', desc: 'Отправляйте текст или загружайте файл — модель сделает всё остальное.' },
    { num: 5, title: 'Пополняете баланс', desc: 'Когда кредиты закончатся — пополните картой РФ или через СБП.' },
  ];
  return (
    <section className="how-it-works">
      <h2 className="how-it-works__title">Как это работает</h2>
      <p className="how-it-works__subtitle">Всё просто: регистрация, выбор модели и работа</p>
      <div className="how-it-works__steps anim-stagger">
        {steps.map((s, i) => (
          <div key={i} className="how-it-works__step">
            <div className="how-it-works__step-number">{s.num}</div>
            <div className="how-it-works__step-title">{s.title}</div>
            <div className="how-it-works__step-desc">{s.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
