'use client';

import React, { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql, PostgreSQL } from '@codemirror/lang-sql';
import { keymap } from '@codemirror/view';
import { useTheme } from '../contexts/theme-context';
import {
  brutalistThemeLight,
  brutalistThemeDark,
  brutalistHighlightLight,
  brutalistHighlightDark,
} from '@/lib/codemirror-brutalist-theme';

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({
  value,
  onChange,
  onExecute,
  disabled = false,
  placeholder = 'SELECT * FROM users LIMIT 10;',
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const extensions = useMemo(() => {
    const exts = [
      sql({ dialect: PostgreSQL }),
      isDark ? brutalistThemeDark : brutalistThemeLight,
      isDark ? brutalistHighlightDark : brutalistHighlightLight,
    ];

    if (onExecute) {
      exts.push(
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              onExecute();
              return true;
            },
          },
        ])
      );
    }

    return exts;
  }, [isDark, onExecute]);

  return (
    <div
      className="border-2 border-black dark:border-white overflow-hidden [&_.cm-editor]:!color-[initial]"
      style={{ color: isDark ? '#ffffff' : '#000000' }}
    >
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={extensions}
        placeholder={placeholder}
        editable={!disabled}
        height="192px"
        theme="none"
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightActiveLine: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          foldGutter: false,
          indentOnInput: true,
        }}
      />
    </div>
  );
};
