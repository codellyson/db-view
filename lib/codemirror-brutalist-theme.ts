import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import type { PaletteColors } from '@/app/contexts/theme-context';

export function createBrutalistTheme(colors: PaletteColors, isDark: boolean) {
  const bg = isDark ? '#0f1117' : '#f9fafb';
  const fg = isDark ? '#f9fafb' : '#111827';
  const fgMuted = isDark ? '#6b7280' : '#9ca3af';
  const selectionBg = isDark ? 'rgba(249,250,251,0.08)' : 'rgba(17,24,39,0.08)';
  const activeLineBg = isDark ? 'rgba(249,250,251,0.04)' : 'rgba(17,24,39,0.04)';
  const gutterBg = isDark ? '#1f2937' : '#f3f4f6';
  const gutterFg = isDark ? '#9ca3af' : '#6b7280';
  const borderColor = isDark ? '#374151' : '#e5e7eb';

  return EditorView.theme(
    {
      '&': {
        backgroundColor: bg,
        color: fg,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '14px',
      },
      '.cm-content': {
        caretColor: colors.accent,
        color: fg,
        padding: '12px 0',
      },
      '.cm-line': {
        color: fg,
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: colors.accent,
        borderLeftWidth: '2px',
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
        backgroundColor: selectionBg,
      },
      '.cm-gutters': {
        backgroundColor: gutterBg,
        color: gutterFg,
        border: 'none',
        borderRight: `1px solid ${borderColor}`,
      },
      '.cm-activeLineGutter': {
        backgroundColor: isDark ? '#374151' : '#e5e7eb',
      },
      '.cm-activeLine': {
        backgroundColor: activeLineBg,
      },
      '.cm-matchingBracket': {
        backgroundColor: selectionBg,
        outline: `1px solid ${fgMuted}`,
        borderRadius: '2px',
      },
      '.cm-placeholder': {
        color: fgMuted,
      },
    },
    { dark: isDark }
  );
}

export function createBrutalistHighlight(colors: PaletteColors, isDark: boolean) {
  const fg = isDark ? '#f9fafb' : '#111827';
  const fgMuted = isDark ? '#6b7280' : '#9ca3af';
  const greenStr = isDark ? '#4ade80' : '#16a34a';
  const blueNum = isDark ? '#60a5fa' : '#2563eb';
  const redNull = isDark ? '#f87171' : '#dc2626';

  return syntaxHighlighting(
    HighlightStyle.define([
      { tag: tags.keyword, color: colors.accent, fontWeight: 'bold' },
      { tag: tags.string, color: greenStr },
      { tag: tags.number, color: blueNum },
      { tag: tags.comment, color: fgMuted, fontStyle: 'italic' },
      { tag: tags.operator, color: fg, fontWeight: 'bold' },
      { tag: tags.typeName, color: colors.accent },
      { tag: tags.propertyName, color: fg },
      { tag: tags.function(tags.variableName), color: fg, fontWeight: 'bold' },
      { tag: tags.null, color: redNull, fontWeight: 'bold' },
      { tag: tags.bool, color: blueNum, fontWeight: 'bold' },
    ])
  );
}
