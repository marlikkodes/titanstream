import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          if (id.includes('node_modules/framer-motion') || id.includes('node_modules/motion-dom')) {
            return 'vendor-motion';
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'vendor-react';
          }
        },
      },
    },
  },
  server: {
    port: 3002,
    strictPort: false,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, req, res) => {
            if (res && !('headersSent' in res && res.headersSent)) {
              const url = req.url || '';
              // @ts-ignore
              res.writeHead(502, { 'Content-Type': 'application/json' });
              // @ts-ignore
              res.end(JSON.stringify({ success: false, error: 'API_GATEWAY_UNAVAILABLE', message: 'Backend service offline' }));
            }
          });
        },
      },
    },
  },
});
