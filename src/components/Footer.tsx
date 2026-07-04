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
            ИНН: 402572055731<br />
            Email: errorkO@mail.ru
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
          </div>
        </div>
        <div>
          <div className="footer__column-title">Модели</div>
          <div className="footer__links">
            <a className="footer__link" href="/chat?model=chatgpt">ChatGPT для программистов</a>
            <a className="footer__link" href="/chat?model=xiaomi">Xiaomi MiMo-V2-Flash</a>
            <a className="footer__link" href="/chat?model=deepseek">DeepSeek бесплатно</a>
            <a className="footer__link" href="/chat?model=gemini">Gemini-3-Flash-preview</a>
            <a className="footer__link" href="/chat?model=perplexity">AI для поиска в интернете</a>
            <a className="footer__link" href="/models">Бесплатные нейросети</a>
            <a className="footer__link" href="/chat?model=claude">Claude Sonnet 4.5</a>
          </div>
        </div>
      </div>
      <div className="footer__bottom">
        © {new Date().getFullYear()} AI-Sphere. Все права защищены.
      </div>
    </footer>
  );
}
