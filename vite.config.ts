import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    // Allow the sandbox live-preview host (*.e2b.app) to reach the dev server.
    allowedHosts: true,
    // The API writes data/*.json on every login/change; don't reload the page on those writes.
    watch: {
      ignored: ['**/data/**', '**/dist/**'],
    },
  },
});
