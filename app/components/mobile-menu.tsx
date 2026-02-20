"use client";

import React, { useEffect } from "react";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({
  isOpen,
  onClose,
  children,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <div
        className="fixed inset-0 bg-black/80"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-y-0 left-0 w-[280px] z-50 bg-white dark:bg-black border-r-2 border-black dark:border-white overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b-2 border-black dark:border-white bg-black dark:bg-white">
          <span className="text-sm font-bold uppercase text-white dark:text-black">TABLES</span>
          <button
            onClick={onClose}
            className="text-white dark:text-black hover:text-red-500 font-bold text-lg focus:outline-none"
            aria-label="Close menu"
          >
            X
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};
