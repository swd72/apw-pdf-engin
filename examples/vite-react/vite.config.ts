import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['harfbuzzjs'],
  },
  build: {
    target: 'es2022',
  },
  worker: {
    format: 'es',
  },
})
