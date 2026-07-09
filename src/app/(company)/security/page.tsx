import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const sections = [
  {
    icon: '🔒',
    title: 'Шифрование данных',
    items: [
      'Все данные передаются по протоколу TLS 1.3 — современному стандарту безопасной передачи информации.',
      'Диалоги и файлы хранятся в зашифрованном виде с использованием алгоритма AES-256.',
      'Ключи шифрования регулярно ротируются, доступ к ним строго ограничен.',
    ],
  },
  {
    icon: '🛡️',
    title: 'Приватность диалогов',
    items: [
      'Ваши диалоги не используются для обучения моделей. Никто не читает вашу переписку.',
      'История чатов хранится локально в вашем браузере и не передаётся третьим лицам.',
      'Вы можете в любой момент очистить историю диалогов или удалить аккаунт без объяснения причин.',
    ],
  },
  {
    icon: '📁',
    title: 'Безопасность файлов',
    items: [
      'Загруженные файлы обрабатываются в изолированной среде и автоматически удаляются после обработки.',
      'Максимальный размер файла ограничен 50 МБ — это снижает риски перегрузки.',
      'Поддерживаются только безопасные форматы: изображения, документы PDF и TXT.',
    ],
  },
  {
    icon: '👤',
    title: 'Защита аккаунта',
    items: [
      'Вход через Яндекс ID и VK ID — проверенные провайдеры с двухфакторной аутентификацией.',
      'При входе по email мы храним только хеш пароля — ваш пароль никогда не передаётся в открытом виде.',
      'Сессии автоматически завершаются после 24 часов бездействия.',
    ],
  },
  {
    icon: '📋',
    title: 'Прозрачность',
    items: [
      'Все запросы к API моделей логируются анонимно — мы не храним содержимое, только метаданные.',
      'Код проекта открыт на GitHub — вы можете проверить, как работают механизмы безопасности.',
      'Мы регулярно проводим аудит безопасности и обновляем зависимости.',
    ],
  },
  {
    icon: '⚖️',
    title: 'Соответствие требованиям',
    items: [
      'Серверы расположены на территории РФ в дата-центрах с физической защитой.',
      'Мы соблюдаем требования 152-ФЗ «О персональных данных».',
      'Обработка платежей проходит через ЮKassa — данные карт не хранятся на наших серверах.',
    ],
  },
];

export default function SecurityPage() {
  return (
    <>
      {/* Header */}
      <Header />

      {/* Hero */}
      <section className="security-hero">
        <h1 className="security-hero__title">Безопасность</h1>
        <p className="security-hero__subtitle">Как мы защищаем ваши данные</p>
      </section>

      {/* Sections */}
      <section className="security-content">
        <div className="security-content__inner">
          {sections.map((section, i) => (
            <div key={i} className="security-section">
              <div className="security-section__icon">{section.icon}</div>
              <h2 className="security-section__title">{section.title}</h2>
              <ul className="security-section__list">
                {section.items.map((item, j) => (
                  <li key={j} className="security-section__item">{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="pricing-cta">
        <div className="pricing-cta__inner">
          <h2 className="pricing-cta__title">Ваши данные под защитой</h2>
          <p className="pricing-cta__subtitle">Попробуйте AI-Sphere — 10 бесплатных кредитов каждый день</p>
          <Link href="/" className="pricing-cta__btn">Перейти в чат</Link>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </>
  );
}
