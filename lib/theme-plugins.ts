/**
 * Theme plugin system.
 *
 * A theme is a complete palette (bg, fg, borders, semantic colors, accent)
 * for both light and dark modes. The user picks a theme; the mode toggle
 * switches between the theme's two variants. Everything is applied as CSS
 * custom properties on `<html>`, so any element using Tailwind utilities
 * like `bg-bg`, `text-primary`, `bg-warning/10`, etc. picks them up.
 *
 * To add a theme, drop a new entry in `BUILT_IN_THEMES`. No other wiring
 * required — the picker UI and the apply logic are data-driven.
 */

export interface ThemeVariant {
  /** Page background. */
  bg: string;
  /** Slightly elevated surface (cards, hover states). */
  bgSecondary: string;
  /** Border / divider color. */
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  /** Focal accent for active state, links, highlights. */
  accent: string;
  accentHover: string;
  /** Color for the accent-on-fill case (e.g., text on a solid accent button). */
  accentText: string;
  danger: string;
  success: string;
  warning: string;
}

export interface ThemePlugin {
  id: string;
  label: string;
  description?: string;
  /** Two-color preview swatch shown in the theme picker. */
  swatch: { light: string; dark: string };
  light: ThemeVariant;
  dark: ThemeVariant;
}

// ─── Built-in themes ───────────────────────────────────────────────

const ESPRESSO: ThemePlugin = {
  id: 'espresso',
  label: 'Espresso',
  description: 'Warm dark with cream text. Default.',
  swatch: { light: '#f9fafb', dark: '#161412' },
  light: {
    bg: '249 250 251',
    bgSecondary: '243 244 246',
    border: '229 231 235',
    textPrimary: '17 24 39',
    textSecondary: '107 114 128',
    textMuted: '156 163 175',
    accent: '99 102 241',
    accentHover: '79 70 229',
    accentText: '255 255 255',
    danger: '239 68 68',
    success: '34 197 94',
    warning: '234 179 8',
  },
  dark: {
    bg: '22 20 18',
    bgSecondary: '37 33 30',
    border: '56 50 45',
    textPrimary: '232 222 210',
    textSecondary: '178 167 152',
    textMuted: '124 114 102',
    accent: '168 180 220',
    accentHover: '195 205 235',
    accentText: '22 20 18',
    danger: '220 105 95',
    success: '165 195 130',
    warning: '230 195 115',
  },
};

const MOCHA: ThemePlugin = {
  id: 'mocha',
  label: 'Catppuccin Mocha',
  description: 'Cool dark with lavender highlights.',
  swatch: { light: '#eff1f5', dark: '#1e1e2e' },
  light: {
    // Catppuccin Latte
    bg: '239 241 245',
    bgSecondary: '230 233 239',
    border: '220 224 232',
    textPrimary: '76 79 105',
    textSecondary: '92 95 119',
    textMuted: '156 160 176',
    accent: '30 102 245',
    accentHover: '4 165 229',
    accentText: '255 255 255',
    danger: '210 15 57',
    success: '64 160 43',
    warning: '223 142 29',
  },
  dark: {
    // Catppuccin Mocha
    bg: '17 17 27',
    bgSecondary: '30 30 46',
    border: '49 50 68',
    textPrimary: '205 214 244',
    textSecondary: '166 173 200',
    textMuted: '127 132 156',
    accent: '137 180 250',
    accentHover: '180 190 254',
    accentText: '17 17 27',
    danger: '243 139 168',
    success: '166 227 161',
    warning: '249 226 175',
  },
};

const GRUVBOX: ThemePlugin = {
  id: 'gruvbox',
  label: 'Gruvbox',
  description: 'Yellow-orange retro warmth.',
  swatch: { light: '#fbf1c7', dark: '#282828' },
  light: {
    bg: '251 241 199',
    bgSecondary: '235 219 178',
    border: '213 196 161',
    textPrimary: '60 56 54',
    textSecondary: '80 73 69',
    textMuted: '124 111 100',
    accent: '175 58 3',
    accentHover: '214 93 14',
    accentText: '251 241 199',
    danger: '157 0 6',
    success: '121 116 14',
    warning: '181 118 20',
  },
  dark: {
    bg: '40 40 40',
    bgSecondary: '60 56 54',
    border: '80 73 69',
    textPrimary: '235 219 178',
    textSecondary: '189 174 147',
    textMuted: '146 131 116',
    accent: '250 189 47',
    accentHover: '254 208 110',
    accentText: '40 40 40',
    danger: '251 73 52',
    success: '184 187 38',
    warning: '250 189 47',
  },
};

const NORD: ThemePlugin = {
  id: 'nord',
  label: 'Nord',
  description: 'Cool arctic slate.',
  swatch: { light: '#eceff4', dark: '#2e3440' },
  light: {
    bg: '236 239 244',
    bgSecondary: '229 233 240',
    border: '216 222 233',
    textPrimary: '46 52 64',
    textSecondary: '76 86 106',
    textMuted: '129 161 193',
    accent: '94 129 172',
    accentHover: '129 161 193',
    accentText: '255 255 255',
    danger: '191 97 106',
    success: '163 190 140',
    warning: '235 203 139',
  },
  dark: {
    bg: '46 52 64',
    bgSecondary: '59 66 82',
    border: '76 86 106',
    textPrimary: '236 239 244',
    textSecondary: '216 222 233',
    textMuted: '129 161 193',
    accent: '136 192 208',
    accentHover: '143 188 187',
    accentText: '46 52 64',
    danger: '191 97 106',
    success: '163 190 140',
    warning: '235 203 139',
  },
};

const GITHUB: ThemePlugin = {
  id: 'github',
  label: 'GitHub',
  description: 'GitHub Primer — clean and familiar.',
  swatch: { light: '#ffffff', dark: '#0d1117' },
  light: {
    // GitHub Primer Light
    bg: '255 255 255',
    bgSecondary: '246 248 250',
    border: '208 215 222',
    textPrimary: '31 35 40',
    textSecondary: '89 99 110',
    textMuted: '110 119 129',
    accent: '9 105 218',
    accentHover: '5 80 174',
    accentText: '255 255 255',
    danger: '207 34 46',
    success: '26 127 55',
    warning: '154 103 0',
  },
  dark: {
    // GitHub Primer Dark (canvas.default)
    bg: '13 17 23',
    bgSecondary: '22 27 34',
    border: '48 54 61',
    textPrimary: '230 237 243',
    textSecondary: '141 150 160',
    textMuted: '110 118 129',
    accent: '47 129 247',
    accentHover: '88 166 255',
    accentText: '13 17 23',
    danger: '248 81 73',
    success: '63 185 80',
    warning: '210 153 34',
  },
};

const SOLARIZED: ThemePlugin = {
  id: 'solarized',
  label: 'Solarized',
  description: 'Ethan Schoonover’s classic.',
  swatch: { light: '#fdf6e3', dark: '#002b36' },
  light: {
    bg: '253 246 227',
    bgSecondary: '238 232 213',
    border: '230 219 184',
    textPrimary: '101 123 131',
    textSecondary: '88 110 117',
    textMuted: '147 161 161',
    accent: '38 139 210',
    accentHover: '108 113 196',
    accentText: '253 246 227',
    danger: '220 50 47',
    success: '133 153 0',
    warning: '181 137 0',
  },
  dark: {
    bg: '0 43 54',
    bgSecondary: '7 54 66',
    border: '34 64 80',
    textPrimary: '147 161 161',
    textSecondary: '131 148 150',
    textMuted: '101 123 131',
    accent: '38 139 210',
    accentHover: '108 113 196',
    accentText: '0 43 54',
    danger: '220 50 47',
    success: '133 153 0',
    warning: '181 137 0',
  },
};

export const BUILT_IN_THEMES: ThemePlugin[] = [GITHUB, ESPRESSO, MOCHA, GRUVBOX, NORD, SOLARIZED];

export const DEFAULT_THEME_ID = 'github';

// ─── Apply ─────────────────────────────────────────────────────────

const VAR_MAP: Record<keyof ThemeVariant, string> = {
  bg: '--bg',
  bgSecondary: '--bg-secondary',
  border: '--border',
  textPrimary: '--text-primary',
  textSecondary: '--text-secondary',
  textMuted: '--text-muted',
  accent: '--accent',
  accentHover: '--accent-hover',
  // accentText is JS-only (used by codemirror theme); not a Tailwind token.
  accentText: '--accent-text',
  danger: '--danger',
  success: '--success',
  warning: '--warning',
};

export function applyThemeVariant(variant: ThemeVariant): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const key of Object.keys(VAR_MAP) as (keyof ThemeVariant)[]) {
    root.style.setProperty(VAR_MAP[key], variant[key]);
  }
}

export function findTheme(id: string | undefined): ThemePlugin {
  return BUILT_IN_THEMES.find((t) => t.id === id) ?? GITHUB;
}

/**
 * Convert "R G B" → "#rrggbb". Useful for components (CodeMirror, etc.)
 * that need a hex value rather than the RGB triplet expected by Tailwind.
 */
export function rgbTripletToHex(rgb: string): string {
  const [r, g, b] = rgb.split(/\s+/).map((n) => parseInt(n, 10));
  if ([r, g, b].some((n) => isNaN(n))) return '#000000';
  return (
    '#' +
    [r, g, b]
      .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0'))
      .join('')
  );
}
