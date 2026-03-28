'use client';

import { useConnection } from '../contexts/connection-context';
import { useDashboard } from '../contexts/dashboard-context';
import { Header } from '../components/header';
import { Sidebar } from '../components/sidebar';
import { MainContent } from '../components/main-content';
import { QueryEditor } from '../components/query-editor';
import { Breadcrumb } from '../components/breadcrumb';
import { Footer } from '../components/footer';
import { ResizableSplitter } from '../components/resizable-splitter';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function QueryPage() {
  const { isConnected, databaseName } = useConnection();
  const { tables, isLoadingTables } = useDashboard();
  const router = useRouter();

  useEffect(() => {
    if (!isConnected) {
      router.push('/');
    }
  }, [isConnected, router]);

  if (!isConnected) {
    return null;
  }

  return (
    <ResizableSplitter
      left={
        <Sidebar
          tables={tables}
          selectedTable={undefined}
          onTableSelect={(table) => {
            router.push(`/?table=${table}`);
          }}
          isLoading={isLoadingTables}
        />
      }
      right={
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header isConnected={isConnected} databaseName={databaseName} />
          <MainContent>
            <Breadcrumb
              items={[
                { label: databaseName || 'DATABASE', onClick: () => router.push('/') },
                { label: 'QUERY' },
              ]}
            />
            <QueryEditor />
          </MainContent>
          <Footer />
        </div>
      }
    />
  );
}
