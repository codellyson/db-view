"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const navItems = [
  { label: 'Connections', path: '/connections' },
];

export const MobileMenu: React.FC<MobileMenuProps> = ({
  isOpen,
  onClose,
  children,
}) => {
  const pathname = usePathname();
  const router = useRouter();
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
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-y-0 left-0 w-[280px] z-50 bg-bg border-r border-border overflow-y-auto shadow-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold text-primary">DBView</span>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted hover:text-primary hover:bg-bg-secondary transition-colors"
            aria-label="Close menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <nav className="flex gap-1 px-3 py-2 border-b border-border">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => { router.push(item.path); onClose(); }}
              aria-current={pathname === item.path ? 'page' : undefined}
              className={`flex-1 text-xs font-medium px-2 py-1.5 rounded-md text-center transition-colors ${
                pathname === item.path
                  ? 'bg-accent/10 text-accent'
                  : 'text-secondary hover:text-primary hover:bg-bg-secondary'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};
