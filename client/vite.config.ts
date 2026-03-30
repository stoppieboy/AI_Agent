import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, Vite proxies API requests to the Express server.
// In production, Express serves the built client/dist/ folder directly.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/chat':   'http://localhost:3000',
      '/agent':  'http://localhost:3000',
      '/ingest': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
