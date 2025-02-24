import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: false,
    commonjsOptions: {
      include: [/node_modules/]  // node_modules'dan gelen modülleri dahil et
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
