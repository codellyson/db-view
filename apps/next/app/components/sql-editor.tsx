'use client';

import React, { useMemo, useCallback, useRef, useEffect } from 'react';
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

type SQLSchemaSpec = { [name: string]: SQLSchemaSpec | readonly string[] };

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  schema?: SQLSchemaSpec;
  defaultSchema?: string;
  editorRef?: React.MutableRefObject<EditorView | null>;
  onSelectionChange?: (hasSelection: boolean) => void;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder = 'SELECT * FROM users LIMIT 10;',
  schema: schemaSpec,
  defaultSchema,
  editorRef,
  onSelectionChange,
}) => {
  const { mode, colors } = useTheme();
  const { databaseType } = useConnection();
  const isDark = mode === 'dark';

  // Hold the selection callback in a ref so extensions stay stable across renders.
  const onSelectionChangeRef = useRef(onSelectionChange);
  useEffect(() => { onSelectionChangeRef.current = onSelectionChange; }, [onSelectionChange]);

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
        schema: schemaSpec as any,
        defaultSchema,
        upperCaseKeywords: true,
      }),
      createBrutalistTheme(colors, isDark),
      createBrutalistHighlight(colors, isDark),
      // Accept completion with Tab
      keymap.of([
        { key: 'Tab', run: acceptCompletion },
      ]),
    ];

    exts.push(
      EditorView.updateListener.of((update) => {
        if (update.selectionSet && onSelectionChangeRef.current) {
          const { from, to } = update.state.selection.main;
          onSelectionChangeRef.current(from !== to);
        }
      })
    );

    return exts;
  }, [isDark, colors, databaseType, schemaSpec, defaultSchema]);

  return (
    <div className="overflow-hidden">
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
