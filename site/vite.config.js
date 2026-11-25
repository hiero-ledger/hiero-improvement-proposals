import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { writeStaticHipPages } from './scripts/static-pages.js';

// Keep the SPA fallback while also writing progressively rendered HIP pages.
// Direct HIP URLs therefore contain the proposal before JavaScript executes.
function staticHipPagesPlugin() {
  return {
    name: 'static-hip-pages',
    closeBundle() {
      const dist = path.resolve(import.meta.dirname, 'dist');
      fs.copyFileSync(path.join(dist, 'index.html'), path.join(dist, '404.html'));
      const count = writeStaticHipPages({
        distDir: dist,
        siteUrl: process.env.SITE_URL,
      });
      console.log(`Generated ${count} progressively rendered HIP pages`);
    },
  };
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: process.env.VITE_BASE || '/',
  plugins: [staticHipPagesPlugin()],
});
