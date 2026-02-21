'use client';

import React, { useState } from 'react';
import { useTheme, ALL_PALETTES, PALETTE_LABELS, type Palette } from '../contexts/theme-context';

const PALETTE_PREVIEW: Record<Palette, string> = {
  indigo: '#6366f1',
  blue: '#3b82f6',
  emerald: '#10b981',
  rose: '#f43f5e',
  amber: '#f59e0b',
  violet: '#8b5cf6',
};

export const ThemeToggle: React.FC = () => {
  const { mode, palette, toggleMode, setPalette } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-50 border border-border bg-bg rounded-lg p-4 space-y-3 shadow-lg w-64">
            <div className="text-xs font-medium text-muted border-b border-border pb-2">
              Theme
            </div>

            <button
              onClick={toggleMode}
              className="w-full text-left px-3 py-2 text-sm font-medium rounded-md border border-border text-primary hover:bg-bg-secondary transition-colors"
            >
              {mode === 'light' ? 'Switch to dark' : 'Switch to light'}
            </button>

            <div className="text-xs font-medium text-muted border-b border-border pb-2 pt-1">
              Palette
            </div>

            <div className="grid grid-cols-3 gap-2">
              {ALL_PALETTES.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPalette(p);
                    setIsOpen(false);
                  }}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-md border text-xs font-medium transition-colors ${
                    palette === p
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-secondary hover:bg-bg-secondary'
                  }`}
                  title={PALETTE_LABELS[p]}
                >
                  <span
                    className="w-6 h-6 rounded-full"
                    style={{ backgroundColor: PALETTE_PREVIEW[p] }}
                  />
                  <span className="text-[10px] leading-none">{PALETTE_LABELS[p]}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative z-50 w-10 h-10 rounded-lg border border-border bg-bg text-primary shadow-md flex items-center justify-center hover:bg-bg-secondary transition-colors"
        aria-label="Open theme settings"
        title="Theme settings"
      >
        {isOpen ? '\u00d7' : '\u25d1'}
      </button>
    </div>
  );
};
