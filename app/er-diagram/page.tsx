'use client';

import { useConnection } from '../contexts/connection-context';
import { useDashboard } from '../contexts/dashboard-context';
import { Header } from '../components/header';
import { Sidebar } from '../components/sidebar';
import { MainContent } from '../components/main-content';
import { Breadcrumb } from '../components/breadcrumb';
import { Footer } from '../components/footer';
import { ResizableSplitter } from '../components/resizable-splitter';
import { ERDiagram } from '../components/er-diagram';
import { Spinner } from '../components/ui/spinner';
import { ErrorState } from '../components/error-state';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import type { ERTable, ERRelationship } from '@/lib/er-layout';

export default function ERDiagramPage() {
  const { isConnected, databaseName } = useConnection();
  const { tables: sidebarTables, schemas, selectedSchema, handleSchemaChange, isLoadingTables, views, materializedViews, dbFunctions } = useDashboard();
  const router = useRouter();
  const [tables, setTables] = useState<ERTable[]>([]);
  const [relationships, setRelationships] = useState<ERRelationship[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDiagramData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/schema-overview?schema=${encodeURIComponent(selectedSchema)}`
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load schema overview');
      }
      const data = await response.json();
      setTables(data.tables || []);
      setRelationships(data.relationships || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load diagram data');
    } finally {
      setIsLoading(false);
    }
  }, [selectedSchema]);

  useEffect(() => {
    if (!isConnected) {
      router.push('/');
      return;
    }
    loadDiagramData();
  }, [isConnected, selectedSchema, router, loadDiagramData]);

  if (!isConnected) {
    return null;
  }

  return (
    <ResizableSplitter
      left={
        <Sidebar
          tables={sidebarTables}
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
                { label: 'ER Diagram' },
              ]}
            />
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-semibold tracking-tight text-primary">
                ER Diagram
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
            {error && (
              <ErrorState message={error} onRetry={loadDiagramData} className="mb-6" />
            )}
            {isLoading ? (
              <div className="flex items-center justify-center h-96">
                <Spinner />
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden bg-bg" style={{ height: 'calc(100vh - 220px)' }}>
                <ERDiagram tables={tables} relationships={relationships} />
              </div>
            )}
          </MainContent>
          <Footer />
        </div>
      }
    />
  );
}
