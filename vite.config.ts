import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
 base: process.env.VERCEL ? '/' : (process.env.NODE_ENV === 'production' ? '/wayside-app/' : '/'),
  optimizeDeps: {
    include: ['three', 'three/examples/jsm/loaders/GLTFLoader.js']
  },
  // might also need this for proper path resolution
  resolve: {
    alias: {
      'three': 'three'
    }
  },
  server: {
    hmr: {
      overlay: true,
      timeout: 5000,
    },
    // Add CORS headers
    cors: {
      origin: '*',
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Custom-Header',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Service-Worker-Allowed': '/'
    }
    
  }
})