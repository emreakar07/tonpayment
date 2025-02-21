import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      sourcemap: true,
      minify: 'terser',
      rollupOptions: {
        external: [
          // Server kodlarını dışarıda bırak
          /^src\/server\/.*/
        ],
        output: {
          manualChunks(id) {
            // server kodlarını ayrı bir chunk'a al
            if (id.includes('src/server/')) {
              return 'server';
            }
          }
        }
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
    },
    define: {
      'process.env': env
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    }
  }
})
