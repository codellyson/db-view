import { Navigate } from 'react-router-dom';
import { useConnection } from '../contexts/connection-context';
import { Dashboard } from '../components/dashboard';

// `/` is the workspace entry. Connected → render Dashboard. Disconnected →
// redirect to /connections **synchronously** via <Navigate /> so there's
// no frame where we render `null` (the previous useEffect-based redirect
// flashed a blank screen during the unmount → effect → navigate roundtrip).
export function Home() {
  const { isConnected } = useConnection();
  if (!isConnected) return <Navigate to="/connections" replace />;
  return <Dashboard />;
}
