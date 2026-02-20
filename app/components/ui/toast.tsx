"use client";

import React, { useEffect, useState } from "react";
import { useToast, type ToastType } from "../../contexts/toast-context";

const borderColors: Record<ToastType, string> = {
  success: "border-l-green-400",
  error: "border-l-red-500",
  warning: "border-l-yellow-300",
  info: "border-l-blue-400",
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
    setTimeout(() => onRemove(id), 150);
  };

  return (
    <div
      role="alert"
      className={`
        flex items-center justify-between gap-4
        bg-white dark:bg-black border-2 border-black dark:border-white border-l-4 ${borderColors[type]}
        px-4 py-3 font-mono text-sm uppercase font-bold text-black dark:text-white
        shadow-[4px_4px_0_0_black] dark:shadow-[4px_4px_0_0_white]
        transition-all duration-150
        ${isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}
      `}
    >
      <span className="truncate">{message}</span>
      <button
        onClick={handleRemove}
        className="flex-shrink-0 text-black dark:text-white hover:text-red-500 font-bold text-xs focus:outline-none"
        aria-label="Dismiss notification"
      >
        X
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
