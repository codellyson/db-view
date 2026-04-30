'use client';

import React, { useState } from 'react';
import { useTheme } from '../contexts/theme-context';

export const ThemeToggle: React.FC = () => {
  const { mode, toggleMode, themeId, setThemeId, themes } = useTheme();
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
          <div className="relative z-50 border border-border bg-bg rounded-lg p-4 space-y-3 shadow-lg w-72">
            <div className="text-xs font-medium text-muted border-b border-border pb-2">
              Appearance
            </div>

            <button
              onClick={toggleMode}
              className="w-full text-left px-3 py-2 text-sm font-medium rounded-md border border-border text-primary hover:bg-bg-secondary transition-colors"
            >
              {mode === 'light' ? 'Switch to dark' : 'Switch to light'}
            </button>

            <div className="text-xs font-medium text-muted border-b border-border pb-2 pt-1">
              Theme
            </div>

            <div className="space-y-1.5">
              {themes.map((t) => {
                const active = t.id === themeId;
                const swatchBg = mode === 'dark' ? t.swatch.dark : t.swatch.light;
                const swatchFg = mode === 'dark' ? t.swatch.light : t.swatch.dark;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setThemeId(t.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left flex items-center gap-2.5 px-2 py-1.5 rounded-md border text-sm transition-colors ${
                      active
                        ? 'border-accent bg-accent/10 text-primary'
                        : 'border-border text-secondary hover:bg-bg-secondary'
                    }`}
                  >
                    <span
                      className="flex-shrink-0 w-7 h-5 rounded border border-border overflow-hidden flex"
                      aria-hidden="true"
                    >
                      <span style={{ backgroundColor: swatchBg, flex: 1 }} />
                      <span style={{ backgroundColor: swatchFg, flex: 1 }} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium truncate">{t.label}</span>
                      {t.description && (
                        <span className="block text-[11px] text-muted truncate">{t.description}</span>
                      )}
                    </span>
                    {active && (
                      <span className="text-accent text-xs flex-shrink-0" aria-label="Active">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
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
        {isOpen ? '×' : '◑'}
      </button>
    </div>
  );
};
