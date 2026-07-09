import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="not-found">
      <div className="not-found__container">
        <h1 className="not-found__code">404</h1>
        <h2 className="not-found__title">Страница не найдена</h2>
        <p className="not-found__text">
          Такой страницы больше нет или она никогда не существовала.
          Попробуйте начать с главной или найти нужное через поиск.
        </p>
        <div className="not-found__actions">
          <Link href="/" className="not-found__btn not-found__btn--primary">
            На главную
          </Link>
          <Link href="/chat" className="not-found__btn not-found__btn--secondary">
            Перейти в чат
          </Link>
        </div>
      </div>
    </div>
  );
}
