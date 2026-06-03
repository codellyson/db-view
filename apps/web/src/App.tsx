import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './contexts/toast-context';
import { ConnectionProvider } from './contexts/connection-context';
import { ToastContainer } from './components/ui/toast';
import { Home } from './routes/Home';
import { Connections } from './routes/Connections';
import { Query } from './routes/Query';

// Provider stack:
//   ToastProvider     — needs to be outside ConnectionProvider since the
//                       connection context dispatches toasts (idle disconnect).
//   ConnectionProvider — manages session + saved-connections, hits /api/*.
//   ToastContainer    — rendered alongside <Routes> so toasts overlay any route.
export function App() {
  return (
    <ToastProvider>
      <ConnectionProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/connections" element={<Connections />} />
          <Route path="/query" element={<Query />} />
          <Route path="*" element={<Navigate to="/connections" replace />} />
        </Routes>
        <ToastContainer />
      </ConnectionProvider>
    </ToastProvider>
  );
}
