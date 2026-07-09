'use client';

import { useState } from 'react';

const faqData = [
  {
    q: 'Как связаться со службой поддержки?',
    a: 'Напишите нам на email goorujke@yandex.ru. Мы отвечаем в течение 24 часов в рабочие дни. Для оперативных вопросов указывайте в теме письма «Срочно».',
  },
  {
    q: 'Как мне пополнить баланс?',
    a: 'Перейдите в раздел «Тарифы» на главной странице, выберите подходящий пакет кредитов и оплатите через ЮKassa — можно картой, СБП или через электронный кошелёк. Кредиты зачисляются мгновенно.',
  },
  {
    q: 'Как получить бесплатные кредиты?',
    a: 'После регистрации вы получаете 10 бесплатных кредитов. Каждый день мы начисляем ещё 10 кредитов — они обновляются автоматически. Никаких подписок и скрытых платежей.',
  },
  {
    q: 'Как удалить аккаунт?',
    a: 'Напишите нам на почту с запросом на удаление аккаунта с того же email, на который он зарегистрирован. Мы удалим все данные в течение 3 рабочих дней.',
  },
  {
    q: 'Работаете ли вы с юридическими лицами?',
    a: 'Да. Мы предоставляем закрывающие документы (акты, счета) по запросу. Для оформления корпоративного доступа напишите на goorujke@yandex.ru с реквизитами вашей организации.',
  },
];

export default function ContactsFaq() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (i: number) => {
    setOpenFaq(openFaq === i ? null : i);
  };

  return (
    <section className="contacts-faq">
      <div className="contacts-faq__container">
        <h2 className="contacts-faq__title">Часто задаваемые вопросы</h2>
        {faqData.map((item, i) => (
          <div
            key={i}
            className={`contacts-faq__item ${openFaq === i ? 'contacts-faq__item--open' : ''}`}
          >
            <button
              className="contacts-faq__question"
              onClick={() => toggleFaq(i)}
            >
              <span>{item.q}</span>
              <span className="contacts-faq__icon">+</span>
            </button>
            {openFaq === i && (
              <div className="contacts-faq__answer">{item.a}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
