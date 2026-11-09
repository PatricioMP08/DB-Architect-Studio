import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Configuración de Vite para soporte dual Web y Escritorio (Electron / PWA)
export default defineConfig({
  base: './', // Permite que los recursos carguen correctamente en Electron (file://) y en la Web
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: 'localhost',
    watch: {
      ignored: ['**/release/**', '**/dist/**'], // Ignorar binarios de escritorio para evitar recargas innecesarias
    },
  },
});
