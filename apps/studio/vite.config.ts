import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@velicot/editor': resolve(__dirname, '../../packages/editor/src/index.ts'),
      '@velicot/morph': resolve(__dirname, '../../packages/morph/src/index.ts'),
      '@velicot/export': resolve(__dirname, '../../packages/export/src/index.ts'),
    },
  },
  optimizeDeps: {
    include: ['flubber'],
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
