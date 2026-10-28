import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/main.ts')
        }
      }
    },
    resolve: {
      alias: {
        '@sdk/core': resolve(__dirname, 'sdk/core'),
        '@sdk/plugins': resolve(__dirname, 'sdk/plugins')
      }
    },
    plugins: [externalizeDepsPlugin({ exclude: ['@sdk/core', '@sdk/plugins'] })]
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/preload.ts')
        }
      }
    },
    resolve: {
      alias: {
        '@sdk/core': resolve(__dirname, 'sdk/core'),
        '@sdk/plugins': resolve(__dirname, 'sdk/plugins')
      }
    },
    plugins: [externalizeDepsPlugin({ exclude: ['@sdk/core', '@sdk/plugins'] })]
  },
  renderer: {
    root: 'frontend',
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true
        }
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'frontend/index.html')
        }
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve('frontend')
      }
    },
    plugins: [react()]
  }
})
