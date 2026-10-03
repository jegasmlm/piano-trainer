import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const BUILD_TIME = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
const BUILD_ID = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

/** Emits version.json so running clients can detect a newer deploy and reload. */
function versionFile(): Plugin {
  return {
    name: 'keysreader-version',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID, time: BUILD_TIME }) })
    },
  }
}

// base './' → works on GitHub Pages sub-paths, any static host, and from a zip.
export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(BUILD_TIME), __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [react(), versionFile()],
})
