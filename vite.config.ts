import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(__dirname),
  envPrefix: ['VITE_', 'EXPO_PUBLIC_'],
  server: {
    port: 5173,
    open: true,
  },
});
