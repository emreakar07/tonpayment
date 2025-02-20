import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
      },
    },
  },
  // @ts-ignore
  base: process.env.GH_PAGES ? '/demo-dapp-with-react-ui/' : './',
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
