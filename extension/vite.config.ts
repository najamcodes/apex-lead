// extension/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup:          resolve(__dirname, 'popup/index.html'),
        'service-worker': resolve(__dirname, 'background/service-worker.ts'),
        extractor:      resolve(__dirname, 'content/extractor.ts'),
      },
      output: {
        // Each entry gets its own file — required for MV3
        entryFileNames: (chunk) => {
          if (chunk.name === 'service-worker') return 'background/service-worker.js'
          if (chunk.name === 'extractor')      return 'content/extractor.js'
          return '[name]/[name].js'
        },
        chunkFileNames:  'shared/[name].js',
        assetFileNames:  '[name].[ext]',
      },
    },
  },
})
