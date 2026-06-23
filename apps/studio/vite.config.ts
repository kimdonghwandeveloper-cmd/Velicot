import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@velicot/editor': resolve(__dirname, '../../packages/editor/src/index.ts'),
      '@velicot/morph': resolve(__dirname, '../../packages/morph/src/index.ts'),
    },
  },
  optimizeDeps: {
    include: ['flubber'],
  },
  server: {
    // COOP/COEP headers for SharedArrayBuffer are added in Phase 5 (ffmpeg.wasm).
    // Omitting here so the preview iframe can load without COEP restrictions.
  },
})
