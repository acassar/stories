import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  /** See the reader config: the deployer decides where the app is served from. */
  base: process.env.EMBRANCHE_BASE ?? '/',
  plugins: [react()],
  server: { port: 5174 },
});
