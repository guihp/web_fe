import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        id: '/',
        name: 'App FÃ©',
        short_name: 'App FÃ©',
        description: 'Portal gerencial FÃ© Merchandising',
        lang: 'pt-BR',
        theme_color: '#ea6624',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  envDir: path.resolve(__dirname),
  envPrefix: ['VITE_', 'EXPO_PUBLIC_'],
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api/catalog': {
        target: 'https://sjapbromslgohlxcndrj.supabase.co',
        changeOrigin: true,
        rewrite: () => '/functions/v1/catalogo-catalog',
      },
      '/api/product-image': {
        target: 'https://sjapbromslgohlxcndrj.supabase.co',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(/^\/api\/product-image/, '/functions/v1/catalogo-product-image'),
      },
    },
  },
});
