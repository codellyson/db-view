import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

/**
 * CodeMirror theme + syntax highlight derived from the active theme's CSS
 * variables (set on :root by applyThemeVariant). Switching themes or modes
 * updates the editor automatically — no re-mount needed. Pass `isDark` so
 * CodeMirror's `dark:` flag matches the active mode (drives a few
 * dark-mode-aware editor behaviors).
 */

// CSS color helpers. Tokens are stored as `R G B` triplets so they can be
// composed with alpha via `rgb(R G B / α)`.
const rgb = (token: string) => `rgb(var(${token}))`;
const rgba = (token: string, alpha: number) => `rgb(var(${token}) / ${alpha})`;

export function createBrutalistTheme(isDark: boolean) {
  return EditorView.theme(
    {
      '&': {
        backgroundColor: rgb('--bg'),
        color: rgb('--text-primary'),
        // Match the app's mono (tailwind `font-mono` / @fontsource Geist Mono).
        // The previous `var(--font-geist-mono)` is a Next.js convention that's
        // undefined here, so the editor was silently falling back to system mono.
        fontFamily: "'Geist Mono Variable', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        fontSize: '13px',
      },
      '.cm-content': {
        caretColor: rgb('--accent'),
        color: rgb('--text-primary'),
        // 6px top/bottom so the first line lines up with the editor toolbar
        // (py-2 / 8px) instead of sitting noticeably lower.
        padding: '6px 0',
      },
      '.cm-line': {
        color: rgb('--text-primary'),
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: rgb('--accent'),
        borderLeftWidth: '2px',
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
        backgroundColor: rgba('--accent', 0.18),
      },
      // Blend the line-number gutter into the editor body — it sits flush
      // against the editor's own bg-secondary toolbar, and giving it the same
      // background + a border made it read as a doubled, too-wide gutter.
      '.cm-gutters': {
        backgroundColor: 'transparent',
        color: rgb('--text-secondary'),
        border: 'none',
      },
      '.cm-activeLineGutter': {
        backgroundColor: rgba('--accent', 0.12),
        color: rgb('--text-primary'),
      },
      '.cm-activeLine': {
        backgroundColor: rgba('--accent', 0.06),
      },
      '.cm-matchingBracket': {
        backgroundColor: rgba('--accent', 0.18),
        outline: `1px solid ${rgb('--accent')}`,
        borderRadius: '2px',
      },
      '.cm-placeholder': {
        color: rgb('--text-muted'),
      },
    },
    { dark: isDark }
  );
}

export function createBrutalistHighlight() {
  return syntaxHighlighting(
    HighlightStyle.define([
      { tag: tags.keyword, color: rgb('--accent'), fontWeight: 'bold' },
      { tag: tags.string, color: rgb('--success') },
      { tag: tags.number, color: rgb('--warning') },
      { tag: tags.comment, color: rgb('--text-muted'), fontStyle: 'italic' },
      { tag: tags.operator, color: rgb('--text-primary'), fontWeight: 'bold' },
      { tag: tags.typeName, color: rgb('--accent') },
      { tag: tags.propertyName, color: rgb('--text-primary') },
      { tag: tags.function(tags.variableName), color: rgb('--text-primary'), fontWeight: 'bold' },
      { tag: tags.null, color: rgb('--danger'), fontWeight: 'bold' },
      { tag: tags.bool, color: rgb('--warning'), fontWeight: 'bold' },
    ])
  );
}
