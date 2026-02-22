'use client';

import { useConnection } from '../contexts/connection-context';
import { useDashboard } from '../contexts/dashboard-context';
import { Header } from '../components/header';
import { Sidebar } from '../components/sidebar';
import { MainContent } from '../components/main-content';
import { Breadcrumb } from '../components/breadcrumb';
import { Footer } from '../components/footer';
import { ResizableSplitter } from '../components/resizable-splitter';
import { PerformanceDashboard } from '../components/performance-dashboard';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function PerformancePage() {
  const { isConnected, databaseName } = useConnection();
  const {
    tables,
    schemas,
    selectedSchema,
    handleSchemaChange,
    isLoadingTables,
    views,
    materializedViews,
    dbFunctions,
  } = useDashboard();
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
          onTableSelect={(table) => router.push(`/?table=${table}`)}
          isLoading={isLoadingTables}
          schemas={schemas}
          selectedSchema={selectedSchema}
          onSchemaChange={handleSchemaChange}
          views={views}
          materializedViews={materializedViews}
          functions={dbFunctions}
        />
      }
      right={
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header isConnected={isConnected} databaseName={databaseName} />
          <MainContent>
            <Breadcrumb
              items={[
                { label: databaseName || 'Database', onClick: () => router.push('/') },
                { label: 'Performance' },
              ]}
            />
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-semibold tracking-tight text-primary">
                Performance
              </h1>
              {schemas.length > 1 && (
                <select
                  value={selectedSchema}
                  onChange={(e) => handleSchemaChange(e.target.value)}
                  className="px-3 py-1.5 text-sm rounded-md border border-border bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {schemas.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}
            </div>
            <PerformanceDashboard schema={selectedSchema} />
          </MainContent>
          <Footer />
        </div>
      }
    />
  );
}
