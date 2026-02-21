"use client";

import React, { useEffect, useState } from "react";
import { useToast, type ToastType } from "../../contexts/toast-context";

const typeStyles: Record<ToastType, { bg: string; icon: string }> = {
  success: { bg: "border-l-success", icon: "\u2713" },
  error: { bg: "border-l-danger", icon: "!" },
  warning: { bg: "border-l-warning", icon: "\u26A0" },
  info: { bg: "border-l-accent", icon: "i" },
};

function ToastItem({
  id,
  message,
  type,
  onRemove,
}: {
  id: string;
  message: string;
  type: ToastType;
  onRemove: (id: string) => void;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleRemove = () => {
    setIsVisible(false);
    setTimeout(() => onRemove(id), 200);
  };

  const style = typeStyles[type];

  return (
    <div
      role="alert"
      className={`
        flex items-center gap-3
        bg-bg border border-border border-l-4 ${style.bg}
        rounded-lg px-4 py-3 text-sm text-primary shadow-md
        transition-all duration-200
        ${isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}
      `}
    >
      <span className="flex-shrink-0 text-sm font-medium">{style.icon}</span>
      <span className="flex-1 truncate">{message}</span>
      <button
        onClick={handleRemove}
        className="flex-shrink-0 text-muted hover:text-primary transition-colors focus:outline-none"
        aria-label="Dismiss notification"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          onRemove={removeToast}
        />
      ))}
    </div>
  );
}
