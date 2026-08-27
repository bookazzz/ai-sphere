import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ContactsFaq from '@/components/ContactsFaq';

export const metadata: Metadata = { title: 'Контакты AI-Sphere', description: 'Свяжитесь с командой AI-Sphere и службой поддержки.' };

metadata.alternates = { canonical: 'https://ai-sphere.ru/contacts/' };

export default function ContactsPage() {
  return <><Header /><main className="contacts-page"><section className="contacts-hero"><div className="contacts-hero__container"><span className="section-label">AI SPHERE / КОНТАКТЫ</span><h1 className="contacts-hero__title">Мы на связи</h1><p className="contacts-hero__subtitle">Задайте вопрос о сервисе, оплате или работе моделей — команда поддержки ответит в течение рабочего дня.</p></div></section><section className="contacts-section"><div className="contacts-section__container"><h2 className="contacts-section__title">Служба поддержки</h2><div className="contacts-card"><h3 className="contacts-card__title">Напишите нам</h3><p className="contacts-card__text">Основной канал поддержки — электронная почта.</p><a href="mailto:goorujke@yandex.ru">goorujke@yandex.ru</a></div></div></section><ContactsFaq /></main><Footer /></>;
}
