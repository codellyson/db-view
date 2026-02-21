'use client';

import React from 'react';
import { Modal } from './ui/modal';
import { type Shortcut, formatShortcutKey } from '../hooks/use-keyboard-shortcuts';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: Shortcut[];
}

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  isOpen,
  onClose,
  shortcuts,
}) => {
  const categories = Array.from(new Set(shortcuts.map((s) => s.category)));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard shortcuts">
      <div className="space-y-6 max-h-[60vh] overflow-y-auto">
        {categories.map((category) => (
          <div key={category}>
            <h4 className="text-xs font-medium text-muted mb-2 border-b border-border pb-1">
              {category}
            </h4>
            <div className="space-y-1">
              {shortcuts
                .filter((s) => s.category === category)
                .map((shortcut) => (
                  <div
                    key={`${shortcut.key}-${shortcut.meta}-${shortcut.shift}`}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-sm text-primary">
                      {shortcut.description}
                    </span>
                    <kbd className="px-2 py-1 text-xs font-mono rounded-md bg-bg-secondary border border-border text-secondary">
                      {formatShortcutKey(shortcut)}
                    </kbd>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
};
