import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Mirrors apps/next/app/page.tsx — `/` is just an entry into /connections
// when not connected. The actual workspace (Dashboard) will mount here once
// we port it from apps/next; for now it's a thin redirect.
export function Home() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/connections', { replace: true });
  }, [navigate]);
  return null;
}
