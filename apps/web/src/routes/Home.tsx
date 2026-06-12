import { useConnection } from '../contexts/connection-context';
import { Dashboard } from '../components/dashboard';
import { Connections } from './Connections';

// `/` is the single entry point. Connected → render Dashboard.
// Disconnected → render the Connections landing inline. There's no
// dedicated /connections route any more — we just swap the view based
// on session state.
export function Home() {
  const { isConnected } = useConnection();
  return isConnected ? <Dashboard /> : <Connections />;
}
