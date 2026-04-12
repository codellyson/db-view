"use client";

import React, { useEffect, useRef, useState } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  preventClose?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className = "",
  preventClose = false,
}) => {
  const safeClose = () => {
    if (!preventClose) onClose();
  };
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement;
      setIsAnimating(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true));
      });
      modalRef.current?.focus();
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setIsAnimating(false);
        // Return focus to the element that triggered the modal
        if (triggerRef.current && triggerRef.current instanceof HTMLElement) {
          triggerRef.current.focus();
          triggerRef.current = null;
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        safeClose();
        return;
      }

      // Focus trapping
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || document.activeElement === modalRef.current) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose, preventClose, safeClose]);

  if (!isAnimating && !isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-150 ease-out ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={safeClose}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`relative z-10 bg-bg border border-border rounded-lg shadow-lg w-full max-w-md transition-all duration-150 ease-out ${
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.97]'
        } ${className}`}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3
              id="modal-title"
              className="text-base font-semibold text-primary"
            >
              {title}
            </h3>
            <button
              onClick={safeClose}
              disabled={preventClose}
              className="text-muted hover:text-primary rounded-md p-1 transition-colors focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Close modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};
