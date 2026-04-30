"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import {
  BUILT_IN_THEMES,
  DEFAULT_THEME_ID,
  applyThemeVariant,
  findTheme,
  rgbTripletToHex,
  type ThemePlugin,
} from "@/lib/theme-plugins";

type Mode = "light" | "dark";

/**
 * Hex view of the active theme's accent — codemirror and other libs that
 * can't read CSS vars consume this instead. Kept minimal (accent only) to
 * preserve the existing useTheme().colors API surface.
 */
export interface PaletteColors {
  accent: string;
  accentHover: string;
  accentText: string;
}

interface ThemeContextType {
  mode: Mode;
  toggleMode: () => void;
  /** Active theme plugin id. */
  themeId: string;
  setThemeId: (id: string) => void;
  /** All registered theme plugins (built-ins for now; pluggable in future). */
  themes: ThemePlugin[];
  /** Active theme plugin object — sugar for `findTheme(themeId)`. */
  theme: ThemePlugin;
  /** Hex accent colors for libs that need them as values, not CSS vars. */
  colors: PaletteColors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const MODE_KEY = "dbview-mode";
const THEME_KEY = "dbview-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("light");
  const [themeId, setThemeIdState] = useState<string>(DEFAULT_THEME_ID);
  const [mounted, setMounted] = useState(false);

  // Hydrate from localStorage / system preference.
  useEffect(() => {
    const storedMode = localStorage.getItem(MODE_KEY) as Mode | null;
    if (storedMode === "light" || storedMode === "dark") {
      setMode(storedMode);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setMode("dark");
    }

    const storedTheme = localStorage.getItem(THEME_KEY);
    if (storedTheme && BUILT_IN_THEMES.some((t) => t.id === storedTheme)) {
      setThemeIdState(storedTheme);
    }

    setMounted(true);
  }, []);

  // Toggle the `.dark` class so Tailwind's `dark:` utilities still work,
  // and persist the mode.
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (mode === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem(MODE_KEY, mode);
  }, [mode, mounted]);

  // Apply the active theme variant whenever theme or mode changes.
  useEffect(() => {
    if (!mounted) return;
    const t = findTheme(themeId);
    applyThemeVariant(mode === "dark" ? t.dark : t.light);
    document.documentElement.dataset.theme = t.id;
    localStorage.setItem(THEME_KEY, t.id);
  }, [themeId, mode, mounted]);

  const theme = useMemo(() => findTheme(themeId), [themeId]);
  const variant = mode === "dark" ? theme.dark : theme.light;
  const colors: PaletteColors = useMemo(
    () => ({
      accent: rgbTripletToHex(variant.accent),
      accentHover: rgbTripletToHex(variant.accentHover),
      accentText: rgbTripletToHex(variant.accentText),
    }),
    [variant.accent, variant.accentHover, variant.accentText]
  );

  const toggleMode = () => setMode((prev) => (prev === "light" ? "dark" : "light"));
  const setThemeId = (id: string) => setThemeIdState(id);

  return (
    <ThemeContext.Provider
      value={{
        mode,
        toggleMode,
        themeId,
        setThemeId,
        themes: BUILT_IN_THEMES,
        theme,
        colors,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
