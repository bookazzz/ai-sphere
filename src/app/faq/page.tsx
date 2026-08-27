import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import FAQSection from '@/components/FAQSection';

export const metadata: Metadata = { title: 'Частые вопросы об AI-Sphere', description: 'Ответы на вопросы о моделях, кредитах, файлах и генерации контента в AI-Sphere.' };

metadata.alternates = { canonical: 'https://ai-sphere.ru/faq/' };

export default function FAQPage() {
  return <><Header /><main className="faq-page"><section className="faq-hero"><div className="faq-hero__container"><span className="section-label">AI SPHERE / FAQ</span><h1 className="faq-hero__title">Частые вопросы</h1><p className="faq-hero__subtitle">Короткие ответы о возможностях сервиса, оплате и приватности данных.</p></div></section><FAQSection /></main><Footer /></>;
}
