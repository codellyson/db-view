import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import type { PaletteColors } from '@/app/contexts/theme-context';

export function createBrutalistTheme(colors: PaletteColors, isDark: boolean) {
  const bg = isDark ? colors.ink : colors.surface;
  const fg = isDark ? colors.surface : colors.ink;
  const fgAlpha20 = `${fg}20`;
  const fgAlpha08 = `${fg}08`;
  const fgAlpha60 = `${fg}60`;
  const gutterBg = isDark ? colors.surface : colors.ink;
  const gutterFg = isDark ? colors.ink : colors.surface;
  const activeGutter = isDark ? '#d4d4d8' : '#3f3f46';

  return EditorView.theme(
    {
      '&': {
        backgroundColor: bg,
        color: fg,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '14px',
      },
      '.cm-content': {
        caretColor: fg,
        color: fg,
        padding: '12px 0',
      },
      '.cm-line': {
        color: fg,
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: fg,
        borderLeftWidth: '2px',
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
        backgroundColor: fgAlpha20,
      },
      '.cm-gutters': {
        backgroundColor: gutterBg,
        color: gutterFg,
        border: 'none',
        fontWeight: 'bold',
      },
      '.cm-activeLineGutter': {
        backgroundColor: activeGutter,
      },
      '.cm-activeLine': {
        backgroundColor: fgAlpha08,
      },
      '.cm-matchingBracket': {
        backgroundColor: fgAlpha20,
        outline: `2px solid ${fg}`,
      },
      '.cm-placeholder': {
        color: fgAlpha60,
      },
    },
    { dark: isDark }
  );
}

export function createBrutalistHighlight(colors: PaletteColors, isDark: boolean) {
  const fg = isDark ? colors.surface : colors.ink;
  const fgAlpha60 = `${fg}60`;
  const greenStr = isDark ? '#4ade80' : '#16a34a';
  const blueNum = isDark ? '#60a5fa' : '#2563eb';
  const redNull = isDark ? '#f87171' : '#dc2626';

  return syntaxHighlighting(
    HighlightStyle.define([
      { tag: tags.keyword, color: fg, fontWeight: 'bold', textTransform: 'uppercase' as any },
      { tag: tags.string, color: greenStr },
      { tag: tags.number, color: blueNum },
      { tag: tags.comment, color: fgAlpha60, fontStyle: 'italic' },
      { tag: tags.operator, color: fg, fontWeight: 'bold' },
      { tag: tags.typeName, color: fg, fontWeight: 'bold' },
      { tag: tags.propertyName, color: fg },
      { tag: tags.function(tags.variableName), color: fg, fontWeight: 'bold' },
      { tag: tags.null, color: redNull, fontWeight: 'bold' },
      { tag: tags.bool, color: blueNum, fontWeight: 'bold' },
    ])
  );
}
