import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AboutFaq from '@/components/AboutFaq';

export const metadata: Metadata = {
  alternates: { canonical: 'https://ai-sphere.ru/about/' },
  title: 'О AI-Sphere — единое пространство для работы с ИИ',
  description: 'Узнайте, как AI-Sphere объединяет современные AI-модели в одном сервисе.',
};

export default function AboutPage() {
  return <><Header /><main className="about-page"><section className="about-hero"><div className="about-hero__container"><span className="section-label">AI SPHERE / О ПРОЕКТЕ</span><h1 className="about-hero__title">Один интерфейс для реальных задач с ИИ</h1><p className="about-hero__subtitle">AI-Sphere помогает работать с текстом, документами, изображениями и видео без переключения между десятками сервисов.</p></div></section><section className="about-section"><div className="about-section__container"><h2 className="about-section__title">Что мы делаем</h2><p className="about-section__text">Мы собираем сильные модели в одном рабочем пространстве, показываем стоимость до отправки запроса и помогаем выбрать подходящий инструмент для конкретной задачи.</p></div></section><AboutFaq /></main><Footer /></>;
}
