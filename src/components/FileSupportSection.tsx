export default function FileSupportSection() {
  return (
    <section className="file-support">
      <div className="file-support__inner">
        <div className="file-support__content">
          <div>
            <h2 className="file-support__title">Можно загружать файлы</h2>
            <p className="file-support__desc">
              Загружайте документы, таблицы, изображения — AI-Sphere прочитает их и выполнит задачу.
              Поддерживаются все популярные форматы.
            </p>
            <div className="file-support__formats">
              <span className="file-support__format">PDF</span>
              <span className="file-support__format">DOCX</span>
              <span className="file-support__format">XLSX</span>
              <span className="file-support__format">CSV</span>
              <span className="file-support__format">TXT</span>
              <span className="file-support__format">PNG</span>
              <span className="file-support__format">JPG</span>
              <span className="file-support__format">WEBP</span>
            </div>
            <p className="file-support__notice">
              Файлы хранятся ограниченное время и используются только для обработки вашего запроса.
              Мы не используем ваши файлы для обучения моделей. {' '}
              <a href="/privacy">Подробнее в политике конфиденциальности</a>
            </p>
          </div>
          <div className="file-support__visual">
            <div className="file-support__icon-box">📁</div>
          </div>
        </div>
      </div>
    </section>
  );
}
