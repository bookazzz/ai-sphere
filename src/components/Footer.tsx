export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__brand">
          <div className="footer__logo">
            <span className="footer__logo-icon">AI</span>
            ai-sphere
          </div>
          <div className="footer__slogan">Один чат для всех задач</div>
          <div className="footer__details">
            Поддержка: <a href="mailto:goorujke@yandex.ru">goorujke@yandex.ru</a>
          </div>
        </div>
        <div>
          <div className="footer__column-title">Компания</div>
          <div className="footer__links">
            <a className="footer__link" href="/about">О компании</a>
            <a className="footer__link" href="/prices">Тарифы</a>
            <a className="footer__link" href="/contacts">Контакты</a>
            <a className="footer__link" href="/security">Безопасность</a>
            <a className="footer__link" href="/faq">FAQ</a>
            <a className="footer__link" href="/privacy">Политика конфиденциальности</a>
            <a className="footer__link" href="/offer">Пользовательское соглашение</a>
          </div>
        </div>
        <div>
          <div className="footer__column-title">Модели</div>
          <div className="footer__links">
            <a className="footer__link" href="/chat-gpt-online">ChatGPT онлайн</a>
            <a className="footer__link" href="/gpt-4-chat">GPT-4</a>
            <a className="footer__link" href="/deepseek-chat">DeepSeek</a>
            <a className="footer__link" href="/dalle-nejroset">DALL-E</a>
            <a className="footer__link" href="/stable-diffusion">Stable Diffusion</a>
            <a className="footer__link" href="/midjourney-nejroset">Midjourney</a>
          </div>
        </div>
      </div>
      <div className="footer__bottom">
        © {new Date().getFullYear()} AI-Sphere. Все права защищены.
      </div>
    </footer>
  );
}
