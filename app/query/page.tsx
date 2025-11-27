'use client';

import { useConnection } from '../contexts/connection-context';
import { Header } from '../components/header';
import { Sidebar } from '../components/sidebar';
import { MainContent } from '../components/main-content';
import { QueryEditor } from '../components/query-editor';
import { Footer } from '../components/footer';
import { ResizableSplitter } from '../components/resizable-splitter';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function QueryPage() {
  const { isConnected, databaseName } = useConnection();
  const router = useRouter();
  const [tables, setTables] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isConnected) {
      router.push('/');
    } else {
      loadTables();
    }
  }, [isConnected, router]);

  const loadTables = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/tables');
      if (response.ok) {
        const data = await response.json();
        setTables(data.tables || []);
      }
    } catch (err) {
      console.error('Failed to load tables:', err);
    } finally {
      setIsLoading(false);
    }
  };

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
          isLoading={isLoading}
        />
      }
      right={
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header isConnected={isConnected} databaseName={databaseName} />
          <MainContent>
            <QueryEditor />
          </MainContent>
          <Footer />
        </div>
      }
    />
  );
}

