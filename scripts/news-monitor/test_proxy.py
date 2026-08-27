#!/usr/bin/env python3
"""Ensure every news network layer receives the configured proxy."""

import os
import sys
import unittest
from unittest.mock import Mock, patch


sys.path.insert(0, os.path.dirname(__file__))

import generator_v31  # noqa: E402
import monitor_v31  # noqa: E402
from proxy_utils import normalize_proxy_url, redact_secrets  # noqa: E402


PROXY = 'http://proxy-user:proxy-password@127.0.0.1:8456'


class NewsProxyTests(unittest.TestCase):
    def test_source_fetch_passes_proxy_to_requests(self):
        response = Mock(status_code=200, text='<rss><channel /></rss>', headers={})
        response.raise_for_status.return_value = None
        with patch.object(monitor_v31.requests, 'get', return_value=response) as request_get:
            monitor_v31.fetch_url('https://example.com/feed.xml', proxy=PROXY)
        self.assertEqual(
            request_get.call_args.kwargs['proxies'],
            {'http': PROXY, 'https': PROXY},
        )

    def test_rss_uses_shared_proxy_aware_fetcher(self):
        with patch.object(monitor_v31, 'fetch_url', return_value='<rss />') as fetch:
            result = monitor_v31.fetch_rss('https://example.com/rss', proxy=PROXY)
        self.assertEqual(result, '<rss />')
        self.assertEqual(fetch.call_args.kwargs['proxy'], PROXY)

    def test_full_article_and_fallback_keep_the_proxy(self):
        article = {'link': 'https://example.com/news/item', 'description': 'summary'}
        with patch.object(monitor_v31, 'fetch_article_text', return_value=None) as primary, \
                patch.object(monitor_v31, 'fetch_article_text_fallback', return_value='x' * 500) as fallback:
            result = monitor_v31.extract_article(article, PROXY)
        self.assertEqual(len(result), 500)
        primary.assert_called_once_with(article['link'], PROXY)
        fallback.assert_called_once_with(article['link'], PROXY)

    def test_openrouter_passes_proxy_to_requests(self):
        response = Mock(status_code=200)
        response.raise_for_status.return_value = None
        response.json.return_value = {'choices': [{'message': {'content': '{}'}}]}
        environment = {
            'AISPHERE_OPENROUTER_API_KEY': 'test-key',
            'AISPHERE_NEWS_PROXY': PROXY,
            'NEWS_PROXY_REQUIRED': '1',
        }
        with patch.dict(os.environ, environment, clear=False), \
                patch.object(generator_v31.requests, 'post', return_value=response) as request_post:
            generator_v31.call_llm([{'role': 'user', 'content': 'test'}])
        self.assertEqual(
            request_post.call_args.kwargs['proxies'],
            {'http': PROXY, 'https': PROXY},
        )

    def test_proxy_credentials_are_redacted(self):
        self.assertNotIn('proxy-password', redact_secrets('failed via ' + PROXY))
        self.assertEqual(
            normalize_proxy_url('http proxy-user:proxy-password\\@127.0.0.1:8456'),
            PROXY,
        )


if __name__ == '__main__':
    unittest.main()
