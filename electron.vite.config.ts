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
        '@sdk/backend': resolve(__dirname, 'sdk/backend')
      }
    },
    plugins: [externalizeDepsPlugin({ exclude: ['@sdk/core', '@sdk/backend'] })]
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/preload.ts')
        }
      }
    },
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    root: 'frontend',
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
