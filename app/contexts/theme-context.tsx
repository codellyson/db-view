"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type Mode = "light" | "dark";

export type Palette =
  | "indigo"
  | "blue"
  | "emerald"
  | "rose"
  | "amber"
  | "violet";

export interface PaletteColors {
  accent: string;
  accentHover: string;
  accentText: string;
}

const PALETTE_RGB: Record<Palette, { accent: string; accentHover: string }> = {
  indigo:  { accent: "99 102 241",  accentHover: "79 70 229"   },
  blue:    { accent: "59 130 246",  accentHover: "37 99 235"   },
  emerald: { accent: "16 185 129",  accentHover: "5 150 105"   },
  rose:    { accent: "244 63 94",   accentHover: "225 29 72"   },
  amber:   { accent: "245 158 11",  accentHover: "217 119 6"   },
  violet:  { accent: "139 92 246",  accentHover: "124 58 237"  },
};

const PALETTE_HEX: Record<Palette, PaletteColors> = {
  indigo:  { accent: "#6366f1", accentHover: "#4f46e5", accentText: "#ffffff" },
  blue:    { accent: "#3b82f6", accentHover: "#2563eb", accentText: "#ffffff" },
  emerald: { accent: "#10b981", accentHover: "#059669", accentText: "#ffffff" },
  rose:    { accent: "#f43f5e", accentHover: "#e11d48", accentText: "#ffffff" },
  amber:   { accent: "#f59e0b", accentHover: "#d97706", accentText: "#000000" },
  violet:  { accent: "#8b5cf6", accentHover: "#7c3aed", accentText: "#ffffff" },
};

export const PALETTE_LABELS: Record<Palette, string> = {
  indigo: "Indigo",
  blue: "Blue",
  emerald: "Emerald",
  rose: "Rose",
  amber: "Amber",
  violet: "Violet",
};

export const ALL_PALETTES: Palette[] = ["indigo", "blue", "emerald", "rose", "amber", "violet"];

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
  const [palette, setPaletteState] = useState<Palette>("indigo");
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

    root.style.setProperty("--accent", rgb.accent);
    root.style.setProperty("--accent-hover", rgb.accentHover);
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
