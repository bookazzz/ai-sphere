# Логика производства SEO-контента для AI-Sphere v3

> **Архитектура:** 5 отдельных инструкций для Hermes, каждая со строгим входом и выходом.
> Этот документ — общий регламент. Hermes на каждом этапе получает короткую специализированную инструкцию и схему ответа.

---

## Этап 1: semantic-clustering.md

**Вход (обязательные поля):**
```
keyword
frequency
exact_frequency
competitor
competitor_url
competitor_position
top_10_urls (список URL в топ-10)
entity
task
modifiers
existing_url (если есть)
```

Если частотность, топ-10 или существующие страницы не переданы — Hermes не угадывает, а устанавливает:
```
decision: serp_check
reason: недостаточно данных
```

**Правила SERP-кластеризации (числовые пороги):**

| Общих URL в топ-10 | Решение |
|-------------------|---------|
| 4+ | Вероятно один page-level кластер |
| 2–3 | serp_check + ручная оценка интента |
| 0–1 | Разные страницы |

Дополнительно учитывать:
- типы ранжирующихся страниц
- доминирующий интент
- наличие официального сайта
- наличие инструментов, гайдов, рейтингов
- разные гео и поисковые системы

**Поисковая система:**
```
target_search_engine: Google | Yandex | both
target_geo: RU
target_language: ru
```

Если выдача Google и Яндекса существенно различается — не объединять данные автоматически. Указывать основной поисковик для конкретной страницы.

**Сопоставление с существующими страницами (обязательно):**

Перед любым решением Hermes получает карту существующих страниц:
```
slug
content_type
H1
title
canonical
primary_entity
primary_task
target_keywords
status
```

`merge_into_existing` разрешён только при заполненном `existing_url`. Если URL неизвестен — `merge_into_parent` или `serp_check`.

**Пороги для create_page (все обязательны):**
1. Интент подтверждён SERP
2. Нет существующей страницы с тем же интентом
3. Есть достаточный объём полезного содержания
4. Страница соответствует продукту AI-Sphere
5. Есть реальный CTA
6. Есть подтверждённые источники
7. Страница не строится вокруг одной словоформы

Частотность — не порог, а фактор приоритизации.

**Решение по странице (одно из):**
```
create_page
update_existing
merge_into_existing (только с existing_url)
merge_into_parent
split_cluster
use_as_secondary
serp_check
discard
```

**Выход (строгий JSON):**
```json
{
  "cluster_name": "ChatGPT онлайн",
  "primary_keyword": "chatgpt онлайн",
  "secondary_keywords": ["чат gpt на русском", "chatgpt бесплатно"],
  "intent": "transactional",
  "content_type": "model_landing",
  "page_action": "update_existing",
  "target_url": "/chat-gpt-online",
  "existing_url": "/chat-gpt-online",
  "target_search_engine": "Yandex",
  "target_geo": "RU",
  "target_language": "ru",
  "h1": "ChatGPT онлайн на русском языке",
  "title": "ChatGPT онлайн на русском — открыть AI-чат | AI-Sphere",
  "cta": {
    "type": "open_model",
    "target": "/chat?model=chatgpt"
  },
  "serp_status": "confirmed",
  "sources_required": ["official_product", "official_pricing", "official_docs"],
  "decision_reason": "Интент подтверждён, 6/10 общих URL, страницы нет"
}
```

---

## Этап 2: seo-brief.md

**Вход:** JSON из semantic-clustering (подтверждённый кластер).

**Формирует:**
- H1 (по интенту, не по частотности; бренд сайта — только в title, не в H1)
- Title (одна главная ценность, не перечисление ключей)
- Description (краткий ответ, не «бесплатно/быстро/удобно»)
- Тип страницы (см. ниже)
- Структуру контента (по шаблону)
- Источники для сбора фактов
- CTA
- Внутренние ссылки (граф сущности)

**Политика для запросов «официальный сайт»:**
- AI-Sphere не является официальным сайтом разработчика
- На странице явно указывается официальный ресурс и отличие AI-Sphere
- Не использовать Title вида «Официальный сайт ChatGPT» для страницы AI-Sphere
- Допустимо: «Официальный сайт ChatGPT: как открыть и пользоваться в России»

**Типы страниц:**

| Тип | Описание | Пример |
|-----|----------|-------|
| model_landing | Продуктовая страница модели (рабочий чат / запуск) | ChatGPT онлайн |
| model_review | Обзор модели (характеристики, возможности) | DeepSeek — обзор |
| tool | Инструмент / use-case | Нейросеть для презентаций |
| comparison | Сравнение моделей | DeepSeek или ChatGPT |
| guide | Инструкция / гайд | Как пользоваться DeepSeek в России |
| news | Новость | DeepSeek R2 вышел |
| rating | Рейтинг / подборка | Топ AI-инструментов |

**Шаблон model_landing (новый):**
```
1. Рабочий чат или кнопка запуска
2. Кратко: какая модель доступна
3. Что умеет
4. Доступные версии
5. Русский язык
6. Файлы и изображения
7. Ограничения
8. Стоимость запроса
9. Как начать
10. Чем AI-Sphere отличается от официального сервиса
11. FAQ
12. CTA: открыть модель
```

**Выход (JSON):**
```json
{
  "target_url": "/chat-gpt-online",
  "h1": "ChatGPT онлайн на русском языке",
  "title": "ChatGPT онлайн на русском — открыть AI-чат | AI-Sphere",
  "meta_description": "ChatGPT онлайн на русском — общайтесь с GPT-4o, загружайте файлы и изображения. Доступно в России без VPN.",
  "content_type": "model_landing",
  "structure": [
    "chat_interface",
    "brief_description",
    "capabilities",
    "versions",
    "russian_language",
    "files_and_images",
    "limitations",
    "pricing",
    "how_to_start",
    "vs_official",
    "faq",
    "cta"
  ],
  "cta": {
    "type": "open_model",
    "target": "/chat?model=chatgpt",
    "text": "Открыть ChatGPT"
  },
  "internal_links": [
    {"text": "ChatGPT цена", "url": "/chatgpt-tsena"},
    {"text": "ChatGPT приложение", "url": "/chatgpt-skachat"}
  ],
  "sources_required": ["official_product", "official_pricing", "official_docs"],
  "official_site_disclaimer": true,
  "editorial_status": "draft"
}
```

---

## Этап 3: research-fact-check.md

**Вход:** JSON из seo-brief (список источников, тип страницы).

**Собирает:**
- версии модели
- цены
- характеристики
- контекстное окно
- ограничения
- доступные страны
- официальные ссылки

**Иерархия источников (строгая):**
1. Официальный сайт разработчика
2. Документация
3. Официальная страница цен
4. Model card
5. GitHub
6. Независимые тесты
7. СМИ — только для контекста

**Запрещено придумывать:**
- цены
- benchmark
- версии
- доступность в России
- функции
- наличие модели в AI-Sphere

**Политика противоречащих источников:**
Если источники расходятся:
1. Приоритет — официальный источник
2. Указать дату проверки
3. Кратко описать расхождение
4. Не объединять несовместимые значения
5. Не выбирать удобное значение без объяснения

**Проверка дат:**
Любая цифра в контенте должна быть подтверждена источником и датой проверки.

**Пример первого абзаца (через переменные, не конкретные цифры):**
```
{Модель} — это {тип модели}, разработанная {компания}.
Актуальная версия поддерживает {проверенные возможности}.
```

**Выход (только структурированные факты, не статья):**
```json
{
  "model_name": "GPT-4o",
  "developer": "OpenAI",
  "current_version": "gpt-4o-2026-07-01",
  "checked_at": "2026-07-27",
  "context_window": 128000,
  "russian_support": true,
  "multimodal": ["text", "image_input", "audio_input"],
  "pricing": {
    "input_per_1k": 0.01,
    "output_per_1k": 0.03,
    "currency": "USD",
    "source": "https://openai.com/pricing",
    "checked_at": "2026-07-27"
  },
  "limitations": ["требуется VPN для прямого доступа", "недоступен в России официально"],
  "official_url": "https://chatgpt.com",
  "available_in_ai_sphere": true,
  "ai_sphere_pricing": {
    "credits_per_request": 1,
    "model_id": "openai/gpt-4o"
  },
  "contradictions": [
    {
      "field": "context_window",
      "official": 128000,
      "openrouter": 128000,
      "sources_match": true
    }
  ],
  "sources": [
    {"label": "OpenAI Docs", "url": "https://platform.openai.com/docs/models"},
    {"label": "OpenRouter", "url": "https://openrouter.ai/models/openai/gpt-4o"}
  ]
}
```

---

## Этап 4: content-writing.md

**Вход:** JSON из seo-brief + JSON из research-fact-check.

**Правила:**
- Не имеет права добавлять новые факты
- Использует только структуру из seo-brief
- Использует только факты из research-fact-check
- Первый абзац — сразу суть, без вступлений
- Нет воды «в современном мире»
- Нет эмодзи
- Объём — по типу страницы (не фиксированный):

| Тип | Объём |
|-----|-------|
| Новость | 400–800 слов |
| Инструмент | 500–1200 |
| model_review | 900–1800 |
| model_landing | 600–1200 |
| Сравнение | 1200–2500 |
| Инструкция | 1200–3000 |
| Рейтинг | 1500–3000 |

**Главное правило контента:**
Закончить, когда интент полностью закрыт. Не добавлять текст ради объёма.

**Критерии качества (вместо «уникальность 90%+»):**
1. Текст написан с нуля
2. Не повторяет композицию конкурента
3. Факты подтверждены первичными источниками
4. Есть собственная таблица или сравнение
5. Есть практические примеры
6. Указаны ограничения
7. Понятный CTA
8. Основной вопрос закрыт до первого скролла

**Выход:** Markdown-текст статьи (черновик, статус `draft`).

---

## Этап 5: quality-build-deploy.md

**Вход:** черновик + seo-brief + research-fact-check.

**Проверяет:**
- [ ] Каннибализация (пересечение с существующими страницами)
- [ ] Все внутренние ссылки рабочие
- [ ] canonical указан
- [ ] JSON-LD корректна (см. ниже)
- [ ] Изображения: обложка, alt, WebP/AVIF, 1200px для Discover, права
- [ ] sitemap обновлён
- [ ] TypeScript собирается
- [ ] Статус: `approved`

**Structured data по типу страницы:**

| Тип | Разметка |
|-----|----------|
| model_landing / model_review | Product или SoftwareApplication |
| tool | WebApplication / SoftwareApplication |
| guide | Article / HowTo |
| news | NewsArticle |
| comparison | Article или Report |
| rating | ItemList + Article |
| Все | BreadcrumbList |

**Важно:** не генерировать Review и AggregateRating без реальных данных.

**Изображения (требования):**
- Оригинальная обложка (не сток)
- alt по содержанию изображения
- 1200px для Google Discover
- WebP/AVIF
- Указаны размеры (CLS)
- Права на использование подтверждены
- Новости: пропорции 1:1, 4:3, 16:9

**Редакционный workflow (статусы):**
```
draft → fact_checked → seo_reviewed → approved → published → update_required → archived
```

Hermes создаёт черновик (draft). Публикация — после проверки для:
- цен
- юридических утверждений
- доступности в России
- сравнений моделей
- benchmark
- новостей и слухов

**E-E-A-T и метаданные страницы:**
```
author: string
reviewedBy: string
datePublished: ISO date
dateModified: ISO date
lastFactCheck: ISO date
changeLog: [{date: ISO, change: string}]
sourceUrls: string[]
```

Для рейтингов дополнительно:
```
methodologyUrl: string
testedModels: string[]
testDate: ISO date
```

---

## Приоритизация страниц

Два балла, общий вес:

```
SEO Potential = frequency × reachability × serp_quality × competition_factor
Business Potential = product_relevance × launch_probability × registration_probability × payment_probability

Priority Score = SEO Potential × 0.4 + Business Potential × 0.6
```

Для молодого продукта бизнес-потенциал важнее чистого трафика.

**Не путать:** Низкочастотный запрос «нейросеть для анализа PDF» может быть ценнее высокочастотного «GPT» по Business Potential.

---

## Перелинковка (граф сущности)

```
DeepSeek
├── model_landing (/deepseek-online/)
├── model_review (/deepseek-chat/)
├── guide (/kak-polzovatsya-deepseek/)
├── comparison (/deepseek-vs-chatgpt/)
└── news (/news/deepseek-r2-release/)
```

Правила:
- Новость → ссылается на постоянную страницу модели
- Модель → ссылается на инструкцию и сравнения
- Сравнение → ссылается на запуск обеих моделей

---

## Защита от ошибок нормализации

Версии моделей НЕ трогать:
`Claude 4.6`, `Gemini 2.5 Pro`, `GPT-4o`, `GPT-5.3 Codex`, `o3-mini`, `DeepSeek R1`, `Claude 3.5`

Точки, дефисы и буквенные обозначения в версиях — не очищать.

---

## Обновление контента

Триггеры:
- изменение официальной документации
- выход новой версии модели
- изменение тарифов
- изменение контекстного окна
- изменение API
- изменение возможностей продукта
- изменение наличия в AI-Sphere
- изменение условий использования

OpenRouter — источник для цен API, но не единственный. Не считать его истиной в последней инстанции.

`dateModified` обновлять только при содержательных изменениях.

---

## CTA (для AI-Sphere)

- Попробовать {модель}
- Сравнить с {модель}
- Загрузить документ
- Создать презентацию
- Открыть AI-чат
- Зарегистрироваться

**Не использовать:** ссылки на Ozon / маркетплейсы / сторонние сервисы (кроме официального сайта разработчика).

---

## Финальный конвейер (сводка)

```
1. semantic-clustering.md
   Вход: семантика, топ-10, карта существующих страниц
   Выход: JSON-решение по URL

2. seo-brief.md
   Вход: решение из semantic-clustering
   Выход: JSON-бриф (H1, Title, Description, структура, CTA, источники)

3. research-fact-check.md
   Вход: seo-brief, список источников
   Выход: JSON-факты (только структурированные, не статья)

4. content-writing.md
   Вход: seo-brief + факты
   Выход: Markdown-черновик (draft)

5. quality-build-deploy.md
   Вход: черновик + бриф + факты
   Выход: проверенный контент (approved) → публикация
```

Каждый этап — отдельная инструкция Hermes со строгой схемой входа/выхода. Никакой этап не принимает решения за соседний.
