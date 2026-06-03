import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // 3030 was the Tauri-specific Next dev port too — keeping the convention
    // so muscle memory still works. strictPort makes Vite refuse to silently
    // fall back to another port if 3030 is busy, which would desync from
    // tauri.conf.json's devUrl and produce a white-screen webview.
    port: 3030,
    strictPort: true,
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
