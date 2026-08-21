---
slug: "tabdpt-turbo-efficient-in-context-learning-tabular-predictio"
title: "TabDPT-Turbo: новая версия foundation-модели для табличных данных с ускорением в разы"
h1: "TabDPT-Turbo: новая версия foundation-модели для табличных данных с ускорением в разы"
description: "TabDPT-Turbo — новая foundation-модель для табличных данных. Сохраняет точность TabDPT v1.1, но работает на порядки быстрее за счёт row-based attention и длинного контекста."
datePublished: "2026-08-04T04:23:03+03:00"
dateModified: "2026-08-04T04:23:03+03:00"
author: "AI-Sphere"
category: "research"
tags: ["TabDPT-Turbo", "табличные данные", "in-context learning", "arXiv"]
relatedModels: [[]]
relatedCompanies: [[]]
sourceUrls: ["https://arxiv.org/abs/2608.01400"]
primarySourceUrl: "https://arxiv.org/abs/2608.01400"
isResearch: true
schema_version: "3.2"
status: "ready"
index: true
---

> **⚠️ Status: preprint
> This article is based on a preprint published on arXiv. The work may not have undergone independent peer review. Conclusions reflect the authors' position.

# TabDPT-Turbo: новая версия foundation-модели для табличных данных с ускорением в разы

**Кратко:** Исследователи представили TabDPT-Turbo — новую версию foundation-модели для табличного прогнозирования. Модель использует row-based attention и длинный контекст, что позволило отказаться от ретривера и добиться сопоставимой с TabDPT v1.1 точности при скорости, превосходящей все ведущие foundation-модели.

**Что произошло**

Опубликован препринт arXiv:2608.01400v1, в котором описана модель TabDPT-Turbo. Ключевые изменения:
- Архитектура на основе row-based attention (вместо cell-based).
- Длинный контекст, устраняющий необходимость в ретривере.
- Архитектурные улучшения и SSL-предобучение на новом, более крупном корпусе реальных данных.
- Модель обеспечивает сопоставимую производительность с TabDPT v1.1 на бенчмарках TabArena-Lite, CC18 и CTR23.
- По заявлению авторов, TabDPT-Turbo — самая быстрая модель среди ведущих foundation-моделей.
- Новая версия выпущена как TabDPT v1.2, код доступен на GitHub.

**Что изменилось по сравнению с предыдущей версией**

Предыдущая версия TabDPT v1.1 полагалась на cell-based архитектуру и ретривер, что снижало скорость. TabDPT-Turbo (v1.2) переходит на row-based attention и длинный контекст, что даёт ускорение на порядки без потери точности.

**Цены и доступность**

Модель опубликована как препринт arXiv (не прошла рецензирование). Исходный код доступен на GitHub: https://github.com/layer6ai-labs/TabDPT-inferen. Дата выхода — август 2025 года.

**Почему это важно**

Табличные foundation-модели становятся всё более популярными, но их практическое применение сдерживалось низкой скоростью. TabDPT-Turbo демонстрирует, что можно сохранить качество прогнозов, кардинально ускорив инференс. Это открывает путь к использованию таких моделей в сценариях с ограниченными вычислительными ресурсами и там, где критична скорость.

**Для пользователей AI-Sphere**

Если вы работаете с табличными данными и используете foundation-модели, TabDPT-Turbo может стать более быстрой альтернативой существующим решениям. Модель доступна в открытом коде, что позволяет протестировать её на своих задачах. Следите за обновлениями карточки модели на ai-sphere.ru.

**Источники**
- https://arxiv.org/abs/2608.01400v1
- https://github.com/layer6ai-labs/TabDPT-inferen
