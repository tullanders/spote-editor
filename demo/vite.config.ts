import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'spote-editor': resolve(__dirname, '../src/index.ts'),
    },
    dedupe: ['react', 'react-dom'],
  },
})
