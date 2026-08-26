import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  /*
   * Served from the root by default — a dev server, a Tauri shell later. The
   * publication workflow sets this to the sub-path GitHub Pages serves the app
   * from, because that is a deployment concern and belongs to whoever deploys.
   */
  base: process.env.EMBRANCHE_BASE ?? '/',
  plugins: [react()],
  server: { port: 5173, host: true },
});
