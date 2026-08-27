import type { BlogPost } from '@/types/blog-post';
import BlogCard from './BlogCard';

interface Props {
  posts: BlogPost[];
}

export default function BlogList({ posts }: Props) {
  if (posts.length === 0) {
    return (
      <div className="blog-empty"
        style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: '#999',
          fontSize: 16,
        }}
      >
        В этой категории пока нет статей
      </div>
    );
  }

  return (
    <div className="blog-grid"
      style={{
        display: 'grid',
        gap: 24,
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        maxWidth: 1100,
        margin: '0 auto',
      }}
    >
      {posts.map((post) => (
        <BlogCard key={post.url} post={post} />
      ))}
    </div>
  );
}
