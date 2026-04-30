import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Connect to your database',
  description:
    'Add a PostgreSQL, MySQL, or SQLite connection to start exploring with DBView. Saved connections are stored locally; nothing leaves your browser.',
  openGraph: {
    title: 'Connect to your database — DBView',
    description: 'Add a PostgreSQL, MySQL, or SQLite connection to start exploring.',
  },
};

export default function ConnectionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
