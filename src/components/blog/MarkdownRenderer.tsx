import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

interface Props {
  content: string;
}

export default function MarkdownRenderer({ content }: Props) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        rehypePlugins={[rehypeRaw]}
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children, ...props }) => (
            <h2
              style={{
                fontSize: 24,
                fontWeight: 700,
                marginTop: 40,
                marginBottom: 16,
                lineHeight: 1.3,
              }}
              {...props}
            >
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3
              style={{
                fontSize: 20,
                fontWeight: 600,
                marginTop: 32,
                marginBottom: 12,
                lineHeight: 1.3,
              }}
              {...props}
            >
              {children}
            </h3>
          ),
          p: ({ children, ...props }) => (
            <p
              style={{
                fontSize: 16,
                lineHeight: 1.7,
                marginBottom: 16,
                color: '#555',
              }}
              {...props}
            >
              {children}
            </p>
          ),
          ul: ({ children, ...props }) => (
            <ul
              style={{
                paddingLeft: 24,
                marginBottom: 20,
                lineHeight: 1.8,
                color: '#555',
              }}
              {...props}
            >
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol
              style={{
                paddingLeft: 24,
                marginBottom: 20,
                lineHeight: 1.8,
                color: '#555',
              }}
              {...props}
            >
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li style={{ marginBottom: 6, fontSize: 16 }} {...props}>
              {children}
            </li>
          ),
          a: ({ children, href, ...props }) => (
            <a
              href={href}
              style={{ color: '#0066ff', textDecoration: 'underline' }}
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
              {...props}
            >
              {children}
            </a>
          ),
          blockquote: ({ children, ...props }) => (
            <blockquote
              style={{
                borderLeft: '4px solid #0066ff',
                padding: '16px 20px',
                margin: '24px 0',
                background: '#f0f6ff',
                borderRadius: 4,
                fontSize: 16,
                lineHeight: 1.6,
                color: '#333',
              }}
              {...props}
            >
              {children}
            </blockquote>
          ),
          table: ({ children, ...props }) => (
            <div style={{ overflowX: 'auto', marginBottom: 24 }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 15,
                }}
                {...props}
              >
                {children}
              </table>
            </div>
          ),
          th: ({ children, ...props }) => (
            <th
              style={{
                border: '1px solid #ddd',
                padding: '10px 14px',
                background: '#f5f5f5',
                fontWeight: 600,
                textAlign: 'left' as const,
              }}
              {...props}
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td
              style={{
                border: '1px solid #ddd',
                padding: '10px 14px',
              }}
              {...props}
            >
              {children}
            </td>
          ),
          strong: ({ children, ...props }) => (
            <strong style={{ fontWeight: 700 }} {...props}>
              {children}
            </strong>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
