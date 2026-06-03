"use client";

import React from "react";
import { Analytics } from "@vercel/analytics/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectionProvider } from "./contexts/connection-context";
import { ToastProvider } from "./contexts/toast-context";
import { ThemeProvider } from "./contexts/theme-context";
import { DashboardProvider } from "./contexts/dashboard-context";
import { PendingChangesProvider } from "./contexts/pending-changes-context";
import { ToastContainer } from "./components/ui/toast";
import { ThemeToggle } from "./components/theme-toggle";
import { TauriTitleBar } from "./components/tauri-title-bar";
import { UpdatePrompt } from "./components/update-prompt";
import { PostHogProvider } from "./posthog-provider";

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

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TauriTitleBar />
          <ToastProvider>
            <ConnectionProvider>
              <PendingChangesProvider>
                <DashboardProvider>{children}</DashboardProvider>
              </PendingChangesProvider>
            </ConnectionProvider>
            <ToastContainer />
            <ThemeToggle />
            <UpdatePrompt />
            <Analytics />
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </PostHogProvider>
  );
}
