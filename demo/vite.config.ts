import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// GitHub Pages serves the demo from https://<user>.github.io/spote-editor/,
// so the production build (and `vite preview`, which replays it) needs that
// base. Plain `vite dev` stays at '/' for convenience.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/spote-editor/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      'spote-editor/styles': resolve(__dirname, '../src/styles/index.css'),
      'spote-editor': resolve(__dirname, '../src/index.ts'),
    },
    dedupe: ['react', 'react-dom'],
  },
}))
