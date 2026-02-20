import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

export const brutalistThemeLight = EditorView.theme(
  {
    '&': {
      backgroundColor: '#ffffff',
      color: '#000000',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: '14px',
    },
    '.cm-content': {
      caretColor: '#000000',
      color: '#000000',
      padding: '12px 0',
    },
    '.cm-line': {
      color: '#000000',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#000000',
      borderLeftWidth: '2px',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: '#00000020',
    },
    '.cm-gutters': {
      backgroundColor: '#000000',
      color: '#ffffff',
      border: 'none',
      fontWeight: 'bold',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#333333',
    },
    '.cm-activeLine': {
      backgroundColor: '#00000008',
    },
    '.cm-matchingBracket': {
      backgroundColor: '#00000020',
      outline: '2px solid #000000',
    },
    '.cm-placeholder': {
      color: '#00000060',
    },
  },
  { dark: false }
);

export const brutalistThemeDark = EditorView.theme(
  {
    '&': {
      backgroundColor: '#000000',
      color: '#ffffff',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: '14px',
    },
    '.cm-content': {
      caretColor: '#ffffff',
      color: '#ffffff',
      padding: '12px 0',
    },
    '.cm-line': {
      color: '#ffffff',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#ffffff',
      borderLeftWidth: '2px',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: '#ffffff20',
    },
    '.cm-gutters': {
      backgroundColor: '#ffffff',
      color: '#000000',
      border: 'none',
      fontWeight: 'bold',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#cccccc',
    },
    '.cm-activeLine': {
      backgroundColor: '#ffffff08',
    },
    '.cm-matchingBracket': {
      backgroundColor: '#ffffff20',
      outline: '2px solid #ffffff',
    },
    '.cm-placeholder': {
      color: '#ffffff60',
    },
  },
  { dark: true }
);

const highlightStyleLight = HighlightStyle.define([
  { tag: tags.keyword, color: '#000000', fontWeight: 'bold', textTransform: 'uppercase' as any },
  { tag: tags.string, color: '#16a34a' },
  { tag: tags.number, color: '#2563eb' },
  { tag: tags.comment, color: '#00000060', fontStyle: 'italic' },
  { tag: tags.operator, color: '#000000', fontWeight: 'bold' },
  { tag: tags.typeName, color: '#000000', fontWeight: 'bold' },
  { tag: tags.propertyName, color: '#000000' },
  { tag: tags.function(tags.variableName), color: '#000000', fontWeight: 'bold' },
  { tag: tags.null, color: '#dc2626', fontWeight: 'bold' },
  { tag: tags.bool, color: '#2563eb', fontWeight: 'bold' },
]);

const highlightStyleDark = HighlightStyle.define([
  { tag: tags.keyword, color: '#ffffff', fontWeight: 'bold', textTransform: 'uppercase' as any },
  { tag: tags.string, color: '#4ade80' },
  { tag: tags.number, color: '#60a5fa' },
  { tag: tags.comment, color: '#ffffff60', fontStyle: 'italic' },
  { tag: tags.operator, color: '#ffffff', fontWeight: 'bold' },
  { tag: tags.typeName, color: '#ffffff', fontWeight: 'bold' },
  { tag: tags.propertyName, color: '#ffffff' },
  { tag: tags.function(tags.variableName), color: '#ffffff', fontWeight: 'bold' },
  { tag: tags.null, color: '#f87171', fontWeight: 'bold' },
  { tag: tags.bool, color: '#60a5fa', fontWeight: 'bold' },
]);

export const brutalistHighlightLight = syntaxHighlighting(highlightStyleLight);
export const brutalistHighlightDark = syntaxHighlighting(highlightStyleDark);
