import { LatestNewsSection } from '@/components/LatestNewsSection';

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <LatestNewsSection />
    </>
  );
}
