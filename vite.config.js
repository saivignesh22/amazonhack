import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative base so the built bundle works when loaded from a sub-path,
  // e.g. file:///android_asset/... or /pkg/assets/... inside a Fire TV wrapper.
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Fire TV WebViews are Chromium based but not always on the newest engine.
    target: 'es2019',
  },
  server: {
    host: true, // allow the Fire TV device to reach the dev server over LAN
    port: 5173,
  },
})
