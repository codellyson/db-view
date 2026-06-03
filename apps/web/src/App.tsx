import { Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './routes/Home';
import { Connections } from './routes/Connections';
import { Query } from './routes/Query';

// Mirror of the Next.js router topology in apps/next/app/ — same URLs, so
// links from the marketing site and any external bookmarks keep working
// when we cut over from Next.js to Vite.
export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/connections" element={<Connections />} />
      <Route path="/query" element={<Query />} />
      <Route path="*" element={<Navigate to="/connections" replace />} />
    </Routes>
  );
}
