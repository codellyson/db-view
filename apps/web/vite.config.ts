import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy /api/* to the still-running Next.js dev server during the
    // migration. When the Workers API lands (phase 3), point this at the
    // Workers dev URL instead, and the web build switches over cleanly.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: true,
  },
});
