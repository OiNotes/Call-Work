import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const dropConsole = process.env.DROP_CONSOLE === 'true'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: dropConsole,
        drop_debugger: dropConsole,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          'react-vendor': ['react', 'react-dom'],
          'animation': ['framer-motion'],
          'state': ['zustand'],
          'telegram': ['@telegram-apps/sdk'],
          'qr': ['qrcode.react'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'framer-motion', 'zustand'],
  },
})
