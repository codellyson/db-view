"use client";

import React from "react";
import { ConnectionProvider } from "./contexts/connection-context";
import { ToastProvider } from "./contexts/toast-context";
import { ThemeProvider } from "./contexts/theme-context";
import { DashboardProvider } from "./contexts/dashboard-context";
import { ToastContainer } from "./components/ui/toast";
import { ThemeToggle } from "./components/theme-toggle";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ConnectionProvider>
          <DashboardProvider>{children}</DashboardProvider>
        </ConnectionProvider>
        <ToastContainer />
        <ThemeToggle />
      </ToastProvider>
    </ThemeProvider>
  );
}
