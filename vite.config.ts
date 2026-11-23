import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    allowedHosts: true,
    cors: true,
  },
  plugins: [react()],
});
