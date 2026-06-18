import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './contexts/toast-context';
import { ConnectionProvider } from './contexts/connection-context';
import { ThemeProvider } from './contexts/theme-context';
import { DashboardProvider } from './contexts/dashboard-context';
import { PendingChangesProvider } from './contexts/pending-changes-context';
import { ToastContainer } from './components/ui/toast';
import { TauriTitleBar } from './components/tauri-title-bar';
import { UpdatePrompt } from './components/update-prompt';
import { Home } from './routes/Home';
import { Query } from './routes/Query';

// Defaults match apps/next/app/providers.tsx — DashboardProvider's queries
// are user-driven (table data, schema), so we don't want focus/mount
// refetches stealing CPU mid-edit; staleTime keeps cached metadata around
// for the typical "tab away, come back" flow.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

// Provider stack ordering:
//   ToastProvider          — sits outermost: ConnectionProvider dispatches
//                            toasts (idle disconnect), Dashboard does too.
//   ThemeProvider          — independent of connection, applies CSS vars to
//                            <html> on mount. Outside connection so the
//                            disconnected landing is themed too.
//   ConnectionProvider     — owns the active DB session + saved connections.
//   PendingChangesProvider — stages mutations until the user reviews them;
//                            owned per-connection but state is local to the
//                            session, so it lives inside ConnectionProvider.
//   DashboardProvider      — orchestrates the workspace (tables, schemas,
//                            tabs, etc). Reads connection state, so nests
//                            inside ConnectionProvider.
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ThemeProvider>
          {/* Custom title bar replaces the OS chrome (tauri.conf.json sets
              decorations:false). Renders only inside Tauri; no-op on web. */}
          <TauriTitleBar />
          <ConnectionProvider>
            <PendingChangesProvider>
              <DashboardProvider>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/query" element={<Query />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                <ToastContainer />
                <UpdatePrompt />
              </DashboardProvider>
            </PendingChangesProvider>
          </ConnectionProvider>
        </ThemeProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
