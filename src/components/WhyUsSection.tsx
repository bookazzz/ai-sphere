export default function WhyUsSection() {
  const items = [
    { icon: '🛡️', title: 'Без VPN', desc: 'Полный доступ ко всем моделям из России без дополнительных настроек.' },
    { icon: '💳', title: 'Оплата российскими картами', desc: 'Карты РФ, СБП — никаких иностранных платежей.' },
    { icon: '🤖', title: 'Все модели в одном окне', desc: 'ChatGPT, Claude, Gemini, DeepSeek, Grok и ещё 100+ моделей.' },
    { icon: '💰', title: 'Баланс в кредитах', desc: 'Покупаете кредиты — тратите на любые модели. Кредиты не сгорают.' },
    { icon: '📁', title: 'Работа с файлами', desc: 'PDF, DOCX, XLSX, CSV, TXT, изображения — загружайте и анализируйте.' },
    { icon: '🎯', title: 'Выбор модели под задачу', desc: 'Для простых задач — дешёвые модели, для сложных — мощные.' },
    { icon: '🇷🇺', title: 'Интерфейс на русском', desc: 'Полностью на русском языке, включая подсказки и промпты.' },
    { icon: '🔒', title: 'Безопасность данных', desc: 'Файлы хранятся временно и не используются для обучения.' },
  ];
  return (
    <section className="why-us">
      <div className="why-us__inner">
        <h2 className="why-us__title">Почему именно этот ИИ чат</h2>
        <p className="why-us__subtitle">Всё, что нужно для работы с ИИ в одном месте</p>
        <div className="why-us__grid anim-stagger">
          {items.map((item, i) => (
            <div key={i} className="why-us__card">
              <div className="why-us__card-icon">{item.icon}</div>
              <div className="why-us__card-text">
                <div className="why-us__card-title">{item.title}</div>
                <div className="why-us__card-desc">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
