import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Cargar variables de entorno que empiezan con VITE_ y las del sistema
  // Fix: Cast process to any to resolve 'cwd' property access error on Process type
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // "Polyfill" para que process.env.API_KEY funcione en el navegador
      // tomando el valor de Vercel (VITE_API_KEY)
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY),
    },
  };
});