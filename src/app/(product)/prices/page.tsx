import Link from 'next/link';
import { categories } from '@/lib/models-data';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PricesClient from '@/components/PricesClient';
import React from 'react';

export default function PricesPage() {
  return (
    <>
      {/* Header */}
      <Header />

      {/* Hero */}
      <section className="pricing-hero">
        <div className="pricing-hero__container">
          <h1 className="pricing-hero__title">Цены AI-модели</h1>
          <p className="pricing-hero__subtitle">
            1 000 кредитов = 100 ₽
          </p>
        </div>
      </section>

      {/* Pricing table */}
      <section className="pricing-table">
        <div className="pricing-table__container">
          <div className="pricing-table__wrapper">
            <table className="pricing-table__table">
              <thead>
                <tr>
                  <th className="pricing-table__th pricing-table__th--model">Модель</th>
                  <th className="pricing-table__th pricing-table__th--price">Цена за 1K токенов</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <React.Fragment key={category.name}>
                    <tr>
                      <td className="pricing-table__category" colSpan={2}>
                        {category.name}
                      </td>
                    </tr>
                    {category.models.map((model) => (
                      <tr key={model.name}>
                        <td className="pricing-table__model">{model.name}</td>
                        <td className="pricing-table__price">
                          {model.price}
                          <span className="pricing-table__unit"> credit</span>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Interactive section: plans + FAQ + AuthModal */}
      <PricesClient />

      {/* CTA */}
      <section className="pricing-cta">
        <div className="pricing-cta__container">
          <h2 className="pricing-cta__title">Начните бесплатно</h2>
          <p className="pricing-cta__text">
            50 бесплатных кредитов на старте
          </p>
          <Link href="/" className="pricing-cta__btn">
            Перейти в чат
          </Link>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </>
  );
}
