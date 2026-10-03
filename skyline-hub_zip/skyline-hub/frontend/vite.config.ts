import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: true,
    // Sandbox previews reach the dev server through a *.e2b.app proxy host.
    allowedHosts: ['.e2b.app', 'localhost'],
  },
  preview: { port: 4173, host: '0.0.0.0' },
  build: {
    // Pages are bundled eagerly (navigation is instant in the demo) so the app
    // chunk lands around 540 kB raw / 150 kB gzipped.
    chunkSizeWarningLimit: 600,
    // Split the heavy vendors out of the app chunk so first paint stays quick.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          radix: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
          ],
          forms: ['react-hook-form', 'zod', '@hookform/resolvers'],
          scan: ['html5-qrcode', 'qrcode'],
        },
      },
    },
  },
});
