'use client';

import React, { useState, useRef, useEffect } from 'react';

interface ExportDropdownProps {
  onExportCSV: () => void;
  onExportJSON: () => void;
  onExportSQL: () => void;
  disabled?: boolean;
}

export const ExportDropdown: React.FC<ExportDropdownProps> = ({
  onExportCSV,
  onExportJSON,
  onExportSQL,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true));
      });
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleExport = (exportFn: () => void) => {
    exportFn();
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="px-3 py-1.5 text-sm border border-border rounded-md bg-bg text-primary hover:bg-bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        Export
      </button>
      {isOpen && (
        <div className={`absolute top-full right-0 mt-1 z-20 bg-bg border border-border rounded-lg shadow-lg min-w-[140px] transition-all duration-150 ease-out ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
        }`}>
          <button
            onClick={() => handleExport(onExportCSV)}
            className="w-full px-3 py-2 text-sm text-left text-primary hover:bg-bg-secondary transition-colors rounded-t-lg border-b border-border/50"
          >
            CSV
          </button>
          <button
            onClick={() => handleExport(onExportJSON)}
            className="w-full px-3 py-2 text-sm text-left text-primary hover:bg-bg-secondary transition-colors border-b border-border/50"
          >
            JSON
          </button>
          <button
            onClick={() => handleExport(onExportSQL)}
            className="w-full px-3 py-2 text-sm text-left text-primary hover:bg-bg-secondary transition-colors rounded-b-lg"
          >
            SQL Insert
          </button>
        </div>
      )}
    </div>
  );
};
