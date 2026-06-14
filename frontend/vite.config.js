import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy /api to the local backend during development so the frontend can
    // call relative paths and we avoid CORS fiddling locally.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
