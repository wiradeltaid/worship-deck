import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.resolve(dir, '../package.json'), 'utf8'));

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version || '0.1.0'),
  },
  root: dir,
  publicDir: path.resolve(dir, '../public'),
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'projected-html',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const url = req.url?.split('?')[0] ?? '';
          if (url.endsWith('/slideshow') || url.endsWith('/projector')) {
            req.url = '/projected.html';
          }
          next();
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(dir, '../src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
  build: {
    outDir: path.resolve(dir, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(dir, 'index.html'),
        projected: path.resolve(dir, 'projected.html'),
      },
    },
  },
});
