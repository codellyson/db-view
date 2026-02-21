'use client';

import React, { useState } from 'react';
import { useTheme, ALL_PALETTES, PALETTE_LABELS, type Palette } from '../contexts/theme-context';

const PALETTE_PREVIEW: Record<Palette, string> = {
  gray: '#9ca3af',
  sepia: '#d97706',
  ocean: '#38bdf8',
  forest: '#4ade80',
  rose: '#fb7185',
  midnight: '#a78bfa',
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
          <div className="relative z-50 border-2 border-black dark:border-white bg-white dark:bg-black p-3 space-y-3 shadow-brutal dark:shadow-brutal-dark">
            <div className="text-xs font-bold uppercase font-mono text-black dark:text-white border-b-2 border-black dark:border-white pb-2">
              THEME
            </div>

            <button
              onClick={toggleMode}
              className="w-full text-left px-3 py-2 text-xs font-bold uppercase font-mono border-2 border-black dark:border-white text-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
            >
              {mode === 'light' ? 'SWITCH TO DARK' : 'SWITCH TO LIGHT'}
            </button>

            <div className="text-xs font-bold uppercase font-mono text-black dark:text-white border-b-2 border-black dark:border-white pb-2 pt-1">
              PALETTE
            </div>

            <div className="grid grid-cols-3 gap-2">
              {ALL_PALETTES.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPalette(p);
                    setIsOpen(false);
                  }}
                  className={`flex flex-col items-center gap-1.5 p-2 border-2 text-xs font-bold uppercase font-mono ${
                    palette === p
                      ? 'border-accent bg-accent/10 text-black dark:text-white'
                      : 'border-black dark:border-white text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                  title={PALETTE_LABELS[p]}
                >
                  <span
                    className="w-6 h-6 border-2 border-black dark:border-white"
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
        className="relative z-50 w-10 h-10 border-2 border-black dark:border-white bg-black dark:bg-white text-white dark:text-black font-bold text-lg font-mono flex items-center justify-center hover:bg-white dark:hover:bg-black hover:text-black dark:hover:text-white transition-colors"
        aria-label="Open theme settings"
        title="THEME SETTINGS"
      >
        {isOpen ? '\u00d7' : '\u25d1'}
      </button>
    </div>
  );
};
