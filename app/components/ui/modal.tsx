"use client";

import React, { useEffect, useRef } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className = "",
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    // Focus the modal on open
    modalRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      <div
        className="fixed inset-0 bg-black/80"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`relative z-10 bg-white dark:bg-black border-2 border-black dark:border-white w-full max-w-md shadow-[4px_4px_0_0_black] dark:shadow-[4px_4px_0_0_white] ${className}`}
      >
        {title && (
          <div className="flex items-center justify-between border-b-2 border-black dark:border-white p-4 bg-black dark:bg-white">
            <h3
              id="modal-title"
              className="text-base font-bold uppercase text-white dark:text-black"
            >
              {title}
            </h3>
            <button
              onClick={onClose}
              className="text-white dark:text-black hover:text-red-500 font-bold text-lg focus:outline-none"
              aria-label="Close modal"
            >
              X
            </button>
          </div>
        )}
        <div className="p-8">{children}</div>
      </div>
    </div>
  );
};
