import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' → works on GitHub Pages sub-paths, any static host, and from a zip.
export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC') },
  plugins: [react()],
})
