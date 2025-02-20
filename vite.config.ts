import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
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
    },
    define: {
      'process.env': env
    }
  }
})
