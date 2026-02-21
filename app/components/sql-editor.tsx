'use client';

import React, { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql, PostgreSQL, MySQL } from '@codemirror/lang-sql';
import { keymap } from '@codemirror/view';
import { useTheme } from '../contexts/theme-context';
import { useConnection } from '../contexts/connection-context';
import {
  createBrutalistTheme,
  createBrutalistHighlight,
} from '@/lib/codemirror-brutalist-theme';

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute?: () => void;
  disabled?: boolean;
  placeholder?: string;
  schema?: Record<string, string[]>;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({
  value,
  onChange,
  onExecute,
  disabled = false,
  placeholder = 'SELECT * FROM users LIMIT 10;',
  schema: schemaSpec,
}) => {
  const { mode, colors } = useTheme();
  const { databaseType } = useConnection();
  const isDark = mode === 'dark';

  const extensions = useMemo(() => {
    const sqlDialect = databaseType === 'mysql' ? MySQL : PostgreSQL;
    const exts = [
      sql({ dialect: sqlDialect, schema: schemaSpec }),
      createBrutalistTheme(colors, isDark),
      createBrutalistHighlight(colors, isDark),
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
  }, [isDark, onExecute, colors, databaseType, schemaSpec]);

  return (
    <div className="border border-border rounded-md overflow-hidden">
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
