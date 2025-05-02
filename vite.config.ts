import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/wayside-app/',
  optimizeDeps: {
    include: ['three', 'three/examples/jsm/loaders/GLTFLoader.js']
  },
  // You might also need this for proper path resolution
  resolve: {
    alias: {
      'three': 'three'
    }
  }
})