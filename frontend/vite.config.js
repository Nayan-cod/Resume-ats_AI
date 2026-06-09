import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = env.VITE_API_URL || 'http://localhost:8001';

  return {
    plugins: [react()],

    server: {
      port: 5173,
      proxy: {
        // Proxy API & WebSocket calls to the backend during development
        '/api': { target: apiUrl, changeOrigin: true },
        '/ws':  { target: apiUrl.replace('http', 'ws'), ws: true, changeOrigin: true },
        '/uploads': { target: apiUrl, changeOrigin: true },
        '/analyze': { target: apiUrl, changeOrigin: true },
      },
    },

    build: {
      outDir: 'dist',
      sourcemap: false,
      // Chunk splitting: vendor libraries in their own chunk for better caching
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            motion: ['framer-motion'],
            charts: ['recharts'],
          },
        },
      },
    },
  };
});
