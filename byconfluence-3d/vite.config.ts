import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        // Three is ~600kB on its own and never changes between deploys — keeping
        // it in its own chunk means a copy edit doesn't re-download the renderer.
        // (Vite 8 / rolldown wants the function form here, not the object map.)
        manualChunks(id: string) {
          if (id.includes('node_modules/three')) return 'three'
          if (id.includes('node_modules/postprocessing')) return 'postfx'
          if (id.includes('node_modules/@react-three')) return 'r3f'
          return undefined
        },
      },
    },
  },
})
