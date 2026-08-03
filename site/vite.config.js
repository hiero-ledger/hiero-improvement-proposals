import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

// Copy index.html → 404.html so GitHub Pages serves the SPA for all paths
// (e.g. /hip/hip-1341). The app reads the pathname and routes internally.
function copy404Plugin() {
  return {
    name: 'copy-404',
    closeBundle() {
      const dist = path.resolve(import.meta.dirname, 'dist');
      fs.copyFileSync(path.join(dist, 'index.html'), path.join(dist, '404.html'));
    },
  };
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: process.env.VITE_BASE || '/',
  plugins: [copy404Plugin()],
});
