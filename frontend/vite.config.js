import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The frontend forwards anything under /api to the Go backend and strips the
// /api prefix (the backend serves /projects, /tasks, /search at its root).
//
// Right now the backend address is hard-coded to localhost:8080, which only
// works when both run directly on your machine.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
});
