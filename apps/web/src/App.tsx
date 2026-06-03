import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './contexts/toast-context';
import { ConnectionProvider } from './contexts/connection-context';
import { ThemeProvider } from './contexts/theme-context';
import { DashboardProvider } from './contexts/dashboard-context';
import { PendingChangesProvider } from './contexts/pending-changes-context';
import { ToastContainer } from './components/ui/toast';
import { Home } from './routes/Home';
import { Connections } from './routes/Connections';
import { Query } from './routes/Query';

// Provider stack ordering:
//   ToastProvider          — sits outermost: ConnectionProvider dispatches
//                            toasts (idle disconnect), Dashboard does too.
//   ThemeProvider          — independent of connection, applies CSS vars to
//                            <html> on mount. Outside connection so the
//                            disconnected /connections page is themed too.
//   ConnectionProvider     — owns the active DB session + saved connections.
//   PendingChangesProvider — stages mutations until the user reviews them;
//                            owned per-connection but state is local to the
//                            session, so it lives inside ConnectionProvider.
//   DashboardProvider      — orchestrates the workspace (tables, schemas,
//                            tabs, etc). Reads connection state, so nests
//                            inside ConnectionProvider.
export function App() {
  return (
    <ToastProvider>
      <ThemeProvider>
        <ConnectionProvider>
          <PendingChangesProvider>
            <DashboardProvider>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/connections" element={<Connections />} />
                <Route path="/query" element={<Query />} />
                <Route path="*" element={<Navigate to="/connections" replace />} />
              </Routes>
              <ToastContainer />
            </DashboardProvider>
          </PendingChangesProvider>
        </ConnectionProvider>
      </ThemeProvider>
    </ToastProvider>
  );
}
