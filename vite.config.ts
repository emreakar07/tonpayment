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
      external: ['zod'],  // zod'u external olarak işaretle
      output: {
        globals: {
          zod: 'zod'  // global değişken olarak tanımla
        }
      }
    }
  },
  optimizeDeps: {
    include: ['zod']  // zod'u optimize edilecek bağımlılıklara ekle
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
