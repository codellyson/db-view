'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useConnection } from '../contexts/connection-context';
import { useDashboard } from '../contexts/dashboard-context';
import { Dashboard } from '../components/dashboard';

export default function QueryPage() {
  const { isConnected } = useConnection();
  const { openEditorTab } = useDashboard();
  const router = useRouter();
  const didOpenRef = useRef(false);

  useEffect(() => {
    if (!isConnected) {
      router.push('/');
      return;
    }
    if (!didOpenRef.current) {
      didOpenRef.current = true;
      openEditorTab();
      router.replace('/');
    }
  }, [isConnected, openEditorTab, router]);

  if (!isConnected) return null;
  return <Dashboard />;
}
