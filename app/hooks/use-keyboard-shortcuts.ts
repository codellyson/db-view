'use client';

import { useEffect, useCallback, useRef } from 'react';

export interface Shortcut {
  key: string;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  category: string;
  action: () => void;
}

function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (target.isContentEditable) return true;
  if (target.closest('.cm-editor')) return true;
  return false;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    for (const shortcut of shortcutsRef.current) {
      const metaMatch = shortcut.meta ? (e.metaKey || e.ctrlKey) : (!e.metaKey && !e.ctrlKey);
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
      const altMatch = shortcut.alt ? e.altKey : !e.altKey;
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

      if (metaMatch && shiftMatch && altMatch && keyMatch) {
        if (shortcut.key === 'Escape' || !isInputElement(e.target)) {
          e.preventDefault();
          e.stopPropagation();
          shortcut.action();
          return;
        }
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);
}

export function formatShortcutKey(shortcut: Shortcut): string {
  const parts: string[] = [];
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

  if (shortcut.meta) parts.push(isMac ? '\u2318' : 'Ctrl');
  if (shortcut.shift) parts.push(isMac ? '\u21E7' : 'Shift');
  if (shortcut.alt) parts.push(isMac ? '\u2325' : 'Alt');

  const key = shortcut.key === '/' ? '/' : shortcut.key.toUpperCase();
  parts.push(key);

  return parts.join(isMac ? '' : '+');
}
