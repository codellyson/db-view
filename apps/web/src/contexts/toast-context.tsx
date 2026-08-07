
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastControls {
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

// Split from the list: this provider is outermost, so a value carrying
// `toasts` re-rendered the whole app on every toast.
const ToastControlsContext = createContext<ToastControls | undefined>(undefined);
const ToastListContext = createContext<Toast[]>([]);

const MAX_TOASTS = 3;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = "info", duration: number = 4000) => {
      const id = `toast-${Date.now()}-${counterRef.current++}`;
      const toast: Toast = { id, message, type, duration };

      setToasts((prev) => {
        const next = [...prev, toast];
        if (next.length > MAX_TOASTS) {
          return next.slice(next.length - MAX_TOASTS);
        }
        return next;
      });

      if (duration > 0) {
        const timer = setTimeout(() => {
          timersRef.current.delete(timer);
          removeToast(id);
        }, duration);
        timersRef.current.add(timer);
      }
    },
    [removeToast]
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  const controls = useMemo(() => ({ addToast, removeToast }), [addToast, removeToast]);

  return (
    <ToastControlsContext.Provider value={controls}>
      <ToastListContext.Provider value={toasts}>{children}</ToastListContext.Provider>
    </ToastControlsContext.Provider>
  );
}

/** Raise and dismiss toasts. Never re-renders the caller. */
export function useToast(): ToastControls {
  const context = useContext(ToastControlsContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export function useToasts(): Toast[] {
  return useContext(ToastListContext);
}
