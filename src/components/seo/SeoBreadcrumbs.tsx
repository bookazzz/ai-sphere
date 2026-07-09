import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface Props {
  items: BreadcrumbItem[];
}

export default function SeoBreadcrumbs({ items }: Props) {
  return (
    <nav className="seo-breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={i}>
          {item.href ? (
            <Link href={item.href}>{item.label}</Link>
          ) : (
            <span>{item.label}</span>
          )}
          {i < items.length - 1 && <span className="seo-breadcrumbs__separator"> / </span>}
        </span>
      ))}
    </nav>
  );
}
