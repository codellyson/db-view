import type { Metadata } from 'next';

export const metadata: Metadata = {
  // The route immediately redirects to /, but it's a useful deep-link target
  // ("open a SQL editor"), so it gets its own indexable metadata.
  title: 'New SQL editor',
  description: 'Open a fresh SQL editor in Pocketdb and run queries against your database.',
  // Crawlers shouldn't index this redirect target — it doesn't render content.
  robots: { index: false, follow: false },
};

export default function QueryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
