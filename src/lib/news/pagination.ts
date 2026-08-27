import { getAllNews } from './get-news';

export const NEWS_PAGE_SIZE = 36;

export function getNewsArchive() {
  return getAllNews('ready').filter((article) => article.index !== false);
}

export function getNewsPage(page: number) {
  const articles = getNewsArchive();
  const totalPages = Math.max(1, Math.ceil(articles.length / NEWS_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  return {
    articles: articles.slice((safePage - 1) * NEWS_PAGE_SIZE, safePage * NEWS_PAGE_SIZE),
    totalPages,
    page: safePage,
  };
}

