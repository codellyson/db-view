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
  const dropdownRef = useRef<HTMLDivElement>(null);

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
        className="px-8 py-4 text-base font-bold uppercase font-mono border-2 border-black dark:border-white bg-white dark:bg-black text-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black disabled:opacity-25 disabled:cursor-not-allowed"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        EXPORT
      </button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 z-20 bg-white dark:bg-black border-2 border-black dark:border-white shadow-[4px_4px_0_0_black] dark:shadow-[4px_4px_0_0_white] min-w-[160px]">
          <button
            onClick={() => handleExport(onExportCSV)}
            className="w-full px-4 py-3 text-sm font-bold uppercase font-mono text-left text-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black border-b border-black dark:border-white"
          >
            CSV
          </button>
          <button
            onClick={() => handleExport(onExportJSON)}
            className="w-full px-4 py-3 text-sm font-bold uppercase font-mono text-left text-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black border-b border-black dark:border-white"
          >
            JSON
          </button>
          <button
            onClick={() => handleExport(onExportSQL)}
            className="w-full px-4 py-3 text-sm font-bold uppercase font-mono text-left text-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
          >
            SQL INSERT
          </button>
        </div>
      )}
    </div>
  );
};
