"use client";

interface Props {
  name?: string;
  updatedAt?: string;
  datePublished?: string;
}

export default function SeoAuthorBar({ name, updatedAt, datePublished }: Props) {
  const authorName = name || "Редакция AI-Sphere";
  const displayDate = updatedAt || datePublished;

  return (
    <div className="seo-author-bar">
      <div className="seo-author-bar__avatar">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
          <rect width="36" height="36" rx="18" fill="#e0f0ff" />
          <text x="18" y="23" textAnchor="middle" fontSize="16" fontWeight="600" fill="#2563eb">
            {authorName.charAt(0).toUpperCase()}
          </text>
        </svg>
      </div>
      <div className="seo-author-bar__info">
        <span className="seo-author-bar__name">{authorName}</span>
        {displayDate && (
          <span className="seo-author-bar__date">
            Обновлено: {new Date(displayDate).toLocaleDateString('ru-RU')}
          </span>
        )}
      </div>
    </div>
  );
}
