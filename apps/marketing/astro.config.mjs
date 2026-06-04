import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// Pure static SSG output — Cloudflare Pages serves the `dist/` directory
// directly. No adapter needed unless we add server-rendered routes.
export default defineConfig({
  site: 'https://justdb.kreativekorna.com',
  integrations: [tailwind({ applyBaseStyles: false })],
});
