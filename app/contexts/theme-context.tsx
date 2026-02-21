"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type Mode = "light" | "dark";

export type Palette =
  | "gray"
  | "sepia"
  | "ocean"
  | "forest"
  | "rose"
  | "midnight";

export interface PaletteColors {
  surface: string;
  ink: string;
  accent: string;
  accentText: string;
}

// RGB triplets for CSS variables (supports Tailwind opacity modifiers)
const PALETTE_RGB: Record<Palette, { surface: string; ink: string; accent: string }> = {
  gray:     { surface: "244 244 245", ink: "24 24 27",   accent: "96 165 250"  },
  sepia:    { surface: "250 246 241", ink: "44 29 14",   accent: "217 119 6"   },
  ocean:    { surface: "236 246 254", ink: "12 25 41",   accent: "56 189 248"  },
  forest:   { surface: "240 249 240", ink: "20 46 20",   accent: "74 222 128"  },
  rose:     { surface: "253 242 244", ink: "45 16 22",   accent: "251 113 133" },
  midnight: { surface: "232 232 237", ink: "18 18 26",   accent: "167 139 250" },
};

// Hex values for CodeMirror and other JS-based color needs
const PALETTE_HEX: Record<Palette, PaletteColors> = {
  gray:     { surface: "#f4f4f5", ink: "#18181b", accent: "#60a5fa", accentText: "#18181b" },
  sepia:    { surface: "#faf6f1", ink: "#2c1d0e", accent: "#d97706", accentText: "#2c1d0e" },
  ocean:    { surface: "#ecf6fe", ink: "#0c1929", accent: "#38bdf8", accentText: "#0c1929" },
  forest:   { surface: "#f0f9f0", ink: "#142e14", accent: "#4ade80", accentText: "#142e14" },
  rose:     { surface: "#fdf2f4", ink: "#2d1016", accent: "#fb7185", accentText: "#2d1016" },
  midnight: { surface: "#e8e8ed", ink: "#12121a", accent: "#a78bfa", accentText: "#12121a" },
};

export const PALETTE_LABELS: Record<Palette, string> = {
  gray: "GRAY",
  sepia: "SEPIA",
  ocean: "OCEAN",
  forest: "FOREST",
  rose: "ROSE",
  midnight: "MIDNIGHT",
};

export const ALL_PALETTES: Palette[] = ["gray", "sepia", "ocean", "forest", "rose", "midnight"];

interface ThemeContextType {
  mode: Mode;
  palette: Palette;
  colors: PaletteColors;
  toggleMode: () => void;
  setPalette: (p: Palette) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const MODE_KEY = "dbview-mode";
const PALETTE_KEY = "dbview-palette";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("light");
  const [palette, setPaletteState] = useState<Palette>("gray");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const storedMode = localStorage.getItem(MODE_KEY) as Mode | null;
    if (storedMode === "light" || storedMode === "dark") {
      setMode(storedMode);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setMode("dark");
    }

    const storedPalette = localStorage.getItem(PALETTE_KEY) as Palette | null;
    if (storedPalette && storedPalette in PALETTE_RGB) {
      setPaletteState(storedPalette);
    }

    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;

    if (mode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem(MODE_KEY, mode);
  }, [mode, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    const rgb = PALETTE_RGB[palette];

    root.style.setProperty("--surface", rgb.surface);
    root.style.setProperty("--ink", rgb.ink);
    root.style.setProperty("--accent", rgb.accent);
    root.dataset.palette = palette;

    localStorage.setItem(PALETTE_KEY, palette);
  }, [palette, mounted]);

  const toggleMode = () => {
    setMode((prev) => (prev === "light" ? "dark" : "light"));
  };

  const setPalette = (p: Palette) => {
    setPaletteState(p);
  };

  const colors = PALETTE_HEX[palette];

  return (
    <ThemeContext.Provider value={{ mode, palette, colors, toggleMode, setPalette }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
