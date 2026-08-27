#!/usr/bin/env python3
"""Regression tests for balanced news publication rules."""

import os
import sys
import unittest
from unittest.mock import patch


sys.path.insert(0, os.path.dirname(__file__))

from generator_v31 import stage6_quality_gate  # noqa: E402


class NewsQualityGateTests(unittest.TestCase):
    def setUp(self):
        paragraph = (
            "Событие связано с развитием инструментов искусственного интеллекта. "
            "Материал объясняет изменение простыми словами, показывает практические "
            "сценарии и отдельно обозначает редакционные выводы без новых утверждений. "
        )
        self.article = {
            "slug": "novoe-sobytie-v-sfere-ii",
            "title_final": "Новое событие в сфере ИИ: что изменилось",
            "description": (
                "Разбираем новое событие в сфере искусственного интеллекта, его "
                "практическое значение, подтверждённые детали и вопросы без ответа."
            ),
            "content": (
                "Краткий лид о событии.\n\n## Что произошло\n" + paragraph * 3
                + "\n\n## Почему это важно\n" + paragraph * 2
                + "\n\n## Что это даёт пользователю\n" + paragraph * 2
            ),
        }
        self.ledger = {
            "source_type": "news_article",
            "facts": [{
                "fact_id": "fact-a",
                "field": "announcement",
                "value": "Компания объявила об изменении продукта",
                "evidence": "Announcement in the source article",
            }],
        }
        self.source = {
            "link": "https://example.com/news/item",
            "description": "A sufficiently detailed feed summary. " * 12,
            "source_fetch_ok": True,
            "tier": "media",
            "additional_source_urls": [],
            "secondary_sources": [],
        }

    def test_single_reputable_source_is_publishable_in_balanced_mode(self):
        with patch.dict(os.environ, {"NEWS_STRICT_QA": "0"}, clear=False):
            result = stage6_quality_gate(self.article, self.ledger, self.source)
        self.assertEqual(result["qa_status"], "passed")
        self.assertIn("single_media_source", result["warnings"])
        self.assertEqual(result["gate_mode"], "balanced")

    def test_unverified_number_still_blocks_publication(self):
        article = dict(self.article)
        article["content"] += "\nНеподтверждённый показатель составил 98765 единиц."
        result = stage6_quality_gate(article, self.ledger, self.source)
        self.assertEqual(result["qa_status"], "failed")
        self.assertTrue(any("unverified_numeric_claims" in item for item in result["blocking_errors"]))

    def test_strict_mode_can_be_enabled_for_an_audit(self):
        with patch.dict(os.environ, {"NEWS_STRICT_QA": "1"}, clear=False):
            result = stage6_quality_gate(self.article, self.ledger, self.source)
        self.assertEqual(result["qa_status"], "failed")
        self.assertEqual(result["gate_mode"], "strict")


if __name__ == "__main__":
    unittest.main()
