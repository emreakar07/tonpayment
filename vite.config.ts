import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: false,
    rollupOptions: {
      external: ['zod']
    }
  },
  base: './',
  server: {
    port: 3000,
    host: true,
    fs: {
      allow: ['../sdk', './'],
    },
  },
  preview: {
    port: 3000,
  }
})
