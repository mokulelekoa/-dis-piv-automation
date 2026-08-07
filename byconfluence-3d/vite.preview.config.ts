import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Single-chunk build used only to generate the self-contained preview HTML —
// with no manualChunks and no dynamic imports, everything lands in one JS file
// that can be inlined into a <script type="module"> with no blob/import tricks.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist-preview',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
  },
})
