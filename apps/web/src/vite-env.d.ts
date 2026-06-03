/// <reference types="vite/client" />

// Fontsource packages ship CSS without a JS entry; TS treats them as
// untyped side-effect imports. Declaring them ambiently keeps tsc happy
// without forcing a more brittle path-based import.
declare module '@fontsource-variable/geist';
declare module '@fontsource-variable/geist-mono';
