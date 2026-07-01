
export default function FeaturesSection() {
  return (
    <section className="features">
      <div className="features__inner">
        <div className="features__label">ИИ чат</div>
        <h2 className="features__title">Что это и зачем это нужно</h2>
        <p className="features__desc">
          AI-Sphere — это не просто чат. Это единое окно для работы с разными ИИ-моделями.
          Пишите тексты, анализируйте документы, ищите идеи, разбирайте таблицы,
          создавайте изображения, пишите код — всё в одном интерфейсе, без VPN и без иностранных карт.
        </p>
        <div className="features__grid anim-stagger">
          {[
            { icon: '✍️', title: 'Пишет тексты', desc: 'Статьи, посты, письма, описания — любой формат на русском или других языках.' },
            { icon: '⚖️', title: 'Анализирует договоры', desc: 'Находит риски, спорные пункты, скрытые обязательства.' },
            { icon: '🌐', title: 'Переводит документы', desc: 'Сохраняет структуру, терминологию и смысл оригинала.' },
            { icon: '📊', title: 'Разбирает таблицы', desc: 'Находит аномалии, отклонения, ключевые показатели.' },
            { icon: '💻', title: 'Пишет код', desc: 'Помогает с кодом на Python, JavaScript, SQL и других языках.' },
            { icon: '🎨', title: 'Создаёт изображения', desc: 'Генерирует картинки по описанию через доступные модели.' },
            { icon: '📋', title: 'Делает презентации', desc: 'Структурирует данные в готовую презентацию.' },
            { icon: '📝', title: 'Улучшает резюме', desc: 'Адаптирует под вакансию, усиливает релевантный опыт.' },
          ].map((item, i) => (
            <div key={i} className="features__card">
              <span className="features__card-icon">{item.icon}</span>
              <div className="features__card-title">{item.title}</div>
              <div className="features__card-desc">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
