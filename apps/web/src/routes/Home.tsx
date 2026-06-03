import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnection } from '../contexts/connection-context';
import { Dashboard } from '../components/dashboard';

// `/` is the workspace entry. Connected → render Dashboard. Disconnected →
// redirect to /connections. Mirrors apps/next/app/page.tsx, with useRouter
// swapped for useNavigate.
export function Home() {
  const { isConnected } = useConnection();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isConnected) navigate('/connections', { replace: true });
  }, [isConnected, navigate]);

  if (isConnected) return <Dashboard />;
  return null;
}
