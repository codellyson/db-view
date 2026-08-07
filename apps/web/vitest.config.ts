import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

// Inherits the `@/*` alias from vite.config.ts so tests resolve imports the
// same way the app does.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  })
);
