import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxy: the client talks to the Fastify server on 3001.
// In production the server serves client/dist itself (same origin, no proxy).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3001' },
  },
  build: { outDir: 'dist', sourcemap: false },
});
