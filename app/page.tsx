"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConnection } from "./contexts/connection-context";
import { Dashboard } from "./components/dashboard";

// Marketing/landing lives in the Astro site at /marketing (deployed
// separately to Cloudflare Pages at justdb.kreativekorna.com). The Next.js
// app no longer renders a landing — `/` is purely the workspace entry:
//   - connected:    render Dashboard
//   - disconnected: redirect to /connections (or, in Tauri, same thing)
export default function Home() {
  const { isConnected } = useConnection();
  const router = useRouter();

  useEffect(() => {
    if (!isConnected) router.replace("/connections");
  }, [isConnected, router]);

  if (isConnected) return <Dashboard />;
  return null;
}
