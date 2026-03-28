'use client';

import React, { useMemo, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql, PostgreSQL, MySQL, SQLite } from '@codemirror/lang-sql';
import { keymap, EditorView } from '@codemirror/view';
import { acceptCompletion } from '@codemirror/autocomplete';
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
  editorRef?: React.MutableRefObject<EditorView | null>;
  onSelectionChange?: (hasSelection: boolean) => void;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({
  value,
  onChange,
  onExecute,
  disabled = false,
  placeholder = 'SELECT * FROM users LIMIT 10;',
  schema: schemaSpec,
  editorRef,
  onSelectionChange,
}) => {
  const { mode, colors } = useTheme();
  const { databaseType } = useConnection();
  const isDark = mode === 'dark';

  const handleCreateEditor = useCallback((view: EditorView) => {
    if (editorRef) {
      editorRef.current = view;
    }
  }, [editorRef]);

  const extensions = useMemo(() => {
    const sqlDialect = databaseType === 'mysql' ? MySQL : databaseType === 'sqlite' ? SQLite : PostgreSQL;
    const exts = [
      sql({
        dialect: sqlDialect,
        schema: schemaSpec,
        upperCaseKeywords: true,
      }),
      createBrutalistTheme(colors, isDark),
      createBrutalistHighlight(colors, isDark),
      // Accept completion with Tab
      keymap.of([
        { key: 'Tab', run: acceptCompletion },
      ]),
    ];

    if (onSelectionChange) {
      exts.push(
        EditorView.updateListener.of((update) => {
          if (update.selectionSet) {
            const { from, to } = update.state.selection.main;
            onSelectionChange(from !== to);
          }
        })
      );
    }

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
  }, [isDark, onExecute, onSelectionChange, colors, databaseType, schemaSpec]);

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
        onCreateEditor={handleCreateEditor}
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
