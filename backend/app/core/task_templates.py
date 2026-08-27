"""Default task catalogue used by both fresh databases and migrations."""

import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task_template import TaskTemplate


DEFAULT_TASK_TEMPLATES = [
    dict(slug="explain-topic", title="Объяснить тему", description="Понятное объяснение с примерами", category="text", task_type="explain", prompt_template="Объясни простыми словами и приведи пример:\n\n{input}", example_input="Что такое блокчейн?", example_output="Краткое объяснение без сложных терминов", required_input="Вопрос или тема", estimated_credits_label="обычно 1–4 кредита", is_featured=True, sort_order=10),
    dict(slug="write-text", title="Написать текст", description="Черновик статьи, письма или описания", category="text", task_type="write", prompt_template="Напиши качественный текст по задаче:\n\n{input}", example_input="Письмо клиенту о переносе встречи", example_output="Готовый структурированный текст", required_input="Тема, формат и пожелания", estimated_credits_label="обычно 2–8 кредитов", is_featured=True, sort_order=20),
    dict(slug="improve-text", title="Улучшить текст", description="Сделать яснее, грамотнее и убедительнее", category="text", task_type="rewrite", prompt_template="Улучши текст, сохранив смысл. Верни готовую версию и кратко перечисли изменения:\n\n{input}", example_input="Вставьте свой текст", example_output="Отредактированный текст", required_input="Исходный текст", estimated_credits_label="обычно 1–5 кредитов", sort_order=30),
    dict(slug="translate", title="Перевести", description="Точный перевод с сохранением стиля", category="text", task_type="translate", prompt_template="Переведи текст на указанный пользователем язык, сохрани стиль и форматирование:\n\n{input}", example_input="Переведи на английский: …", example_output="Перевод в исходной структуре", required_input="Текст и язык перевода", estimated_credits_label="обычно 1–5 кредитов", sort_order=40),
    dict(slug="compare", title="Сравнить варианты", description="Плюсы, минусы и рекомендация", category="text", task_type="compare", prompt_template="Сравни варианты по важным критериям, оформи таблицей и дай рекомендацию:\n\n{input}", example_input="Сравни два телефона для путешествий", example_output="Таблица и итоговый выбор", required_input="Варианты и критерии", estimated_credits_label="обычно 2–6 кредитов", sort_order=50),
    dict(slug="create-post", title="Создать пост", description="Пост для Telegram или соцсетей", category="text", task_type="social_post", prompt_template="Создай готовый пост для указанной площадки. Добавь сильный заголовок и призыв к действию:\n\n{input}", example_input="Пост для Telegram о запуске курса", example_output="Готовый пост", required_input="Тема, площадка и аудитория", estimated_credits_label="обычно 2–6 кредитов", is_featured=True, sort_order=60),
    dict(slug="make-plan", title="Составить план", description="Пошаговый план действий", category="text", task_type="plan", prompt_template="Составь практичный пошаговый план. Укажи приоритеты, риски и первый шаг:\n\n{input}", example_input="План запуска интернет-магазина", example_output="Пошаговый план с приоритетами", required_input="Цель и ограничения", estimated_credits_label="обычно 2–7 кредитов", sort_order=70),
    dict(slug="summarize-document", title="Кратко пересказать документ", description="Выжимка, выводы и важные факты", category="document", task_type="summarize_document", prompt_template="Сделай краткое содержание приложенного документа. Выдели ключевые факты, выводы и следующие действия.\n\n{input}", example_input="Загрузите PDF, DOCX или TXT", example_output="Выжимка по разделам", required_input="Документ", estimated_credits_label="зависит от объёма", is_featured=True, sort_order=80),
    dict(slug="analyze-document", title="Проанализировать документ", description="Риски, противоречия и вопросы", category="document", task_type="analyze_document", prompt_template="Проанализируй приложенный документ. Найди риски, противоречия, обязательства и вопросы, которые нужно уточнить.\n\n{input}", example_input="Загрузите договор или таблицу", example_output="Структурированный анализ", required_input="Документ и цель анализа", estimated_credits_label="зависит от объёма", sort_order=90),
    dict(slug="web-research", title="Найти актуальную информацию", description="Поиск с кратким выводом", category="document", task_type="web_research", prompt_template="Найди актуальную информацию по запросу, сравни источники и дай краткий вывод:\n\n{input}", example_input="Последние изменения по моей теме", example_output="Сводка с источниками", required_input="Поисковый запрос", estimated_credits_label="обычно 3–8 кредитов", sort_order=100),
    dict(slug="analyze-image", title="Проанализировать изображение", description="Распознать и объяснить содержимое", category="image", task_type="analyze_image", prompt_template="Подробно проанализируй приложенное изображение и ответь на запрос пользователя:\n\n{input}", example_input="Загрузите изображение и задайте вопрос", example_output="Описание и выводы", required_input="Изображение", estimated_credits_label="обычно 2–8 кредитов", sort_order=110),
    dict(slug="create-image", title="Создать изображение", description="Картинка по описанию", category="image", task_type="create_image", prompt_template="/image {input}", example_input="Минималистичный постер кофейни", example_output="Готовое изображение для скачивания", required_input="Описание желаемого изображения", estimated_credits_label="точная цена перед запуском", default_parameters=json.dumps({"aspect_ratio": "1:1", "resolution": "1K"}), is_featured=True, sort_order=120),
    dict(slug="create-video", title="Создать видео", description="Короткое видео по сценарию", category="video", task_type="create_video", prompt_template="/video {input}", example_input="Плавный пролёт камеры над вечерним городом", example_output="Короткое видео для скачивания", required_input="Сценарий или описание кадра", estimated_credits_label="точная цена перед запуском", default_parameters=json.dumps({"aspect_ratio": "16:9", "resolution": "720p", "duration": 5}), is_featured=True, sort_order=130),
]


async def seed_task_templates(db: AsyncSession) -> None:
    existing = set((await db.execute(select(TaskTemplate.slug))).scalars().all())
    for item in DEFAULT_TASK_TEMPLATES:
        if item["slug"] not in existing:
            db.add(TaskTemplate(**item))
    await db.commit()

