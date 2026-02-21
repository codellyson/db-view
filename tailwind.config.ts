import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: "rgb(var(--surface) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        white: "rgb(var(--surface) / <alpha-value>)",
        black: "rgb(var(--ink) / <alpha-value>)",
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'brutal': '4px 4px 0 0 rgb(var(--ink))',
        'brutal-sm': '2px 2px 0 0 rgb(var(--ink))',
        'brutal-dark': '4px 4px 0 0 rgb(var(--surface))',
        'brutal-sm-dark': '2px 2px 0 0 rgb(var(--surface))',
      },
    },
  },
  plugins: [],
};
export default config;
