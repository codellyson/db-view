import type { Config } from 'tailwindcss';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

// pnpm links packages into the store, and Tailwind's globber won't traverse
// that symlink — resolve the real directory so JustUI's compiled classes are
// actually scanned. Without it, its components render unstyled.
const justuiDist = join(
  dirname(createRequire(import.meta.url).resolve('@codellyson/justui/package.json')),
  'dist'
);

// Mirrors apps/next/tailwind.config.ts so the design tokens stay aligned
// across the migration. Once apps/next is deleted, this becomes the only one.
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}', `${justuiDist}/**/*.js`],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        'bg-secondary': 'rgb(var(--bg-secondary) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        primary: 'rgb(var(--text-primary) / <alpha-value>)',
        secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
        muted: 'rgb(var(--text-muted) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-hover': 'rgb(var(--accent-hover) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
      },
      fontFamily: {
        sans: ["'Geist Variable'", '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ["'Geist Mono Variable'", 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      // Pinned in px. `html` is 15px, so the rem-based defaults rendered ~7%
      // small everywhere — text-sm was 13.1px, text-xs 11.3px. Spacing still
      // scales off the 15px root, so only type changes.
      fontSize: {
        xs: ['12px', '16px'],
        sm: ['14px', '20px'],
        base: ['16px', '24px'],
        lg: ['18px', '28px'],
        xl: ['20px', '28px'],
        '2xl': ['24px', '32px'],
        '3xl': ['30px', '36px'],
      },
      borderRadius: { sm: '4px', md: '6px', lg: '8px', xl: '12px' },
      keyframes: {
        indeterminate: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(400%)' },
        },
        'menu-in': {
          from: { opacity: '0', transform: 'translateY(-4px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        indeterminate: 'indeterminate 1.1s ease-in-out infinite',
        'menu-in': 'menu-in 120ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
export default config;
