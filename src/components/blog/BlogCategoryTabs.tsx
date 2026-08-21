'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { BlogCategory } from '@/types/blog-post';
import { CATEGORY_LABELS } from '@/types/blog-post';

interface Props {
  categories: BlogCategory[];
  activeCategory?: string;
}

export default function BlogCategoryTabs({ categories, activeCategory }: Props) {
  const pathname = usePathname();

  return (
    <nav
      style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginBottom: 40,
      }}
    >
      <Link
        href="/blog"
        style={{
          padding: '10px 20px',
          borderRadius: 24,
          fontSize: 14,
          fontWeight: 600,
          textDecoration: 'none',
          background: !activeCategory ? '#0066ff' : '#f0f0f0',
          color: !activeCategory ? '#fff' : '#333',
          transition: 'all 0.2s',
        }}
      >
        Все
      </Link>
      {categories.map((cat) => {
        const isActive = activeCategory === cat;
        return (
          <Link
            key={cat}
            href={`/blog/${cat}`}
            style={{
              padding: '10px 20px',
              borderRadius: 24,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
              background: isActive ? '#0066ff' : '#f0f0f0',
              color: isActive ? '#fff' : '#333',
              transition: 'all 0.2s',
            }}
          >
            {CATEGORY_LABELS[cat]}
          </Link>
        );
      })}
    </nav>
  );
}
