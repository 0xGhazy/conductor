/// <reference types="vitest" />
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const envDir = path.resolve(__dirname, '..')
const apiTarget =
  process.env.WEAVER_API_PROXY_TARGET ||
  loadEnv('development', envDir, '').WEAVER_API_PROXY_TARGET ||
  'http://localhost:8080'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
  },
  envDir,
  // Keep Vite's optimized deps cache out of `node_modules` to reduce Windows file-lock issues
  // (e.g. EBUSY rename errors and "Outdated Optimize Dep" 504s).
  cacheDir: '.vite',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    // The Conductor server serves every API (workflows, databases, queries, secrets, ...).
    // Point WEAVER_API_PROXY_TARGET elsewhere to use another backend.
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true, secure: false },
      '/health': { target: apiTarget, changeOrigin: true, secure: false },
      // Kept for older dashboard code paths.
      '/conductor-health': {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/conductor-health/, '/health'),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Keep Vite's dynamic-import helper in its own tiny chunk. Otherwise Rollup can place it
          // inside a lazily used vendor chunk (e.g. Monaco, which uses dynamic imports itself),
          // and the entry would then preload that whole chunk on first page load.
          if (id.includes('vite/preload-helper')) {
            return 'vendor-runtime';
          }
          if (id.includes('node_modules')) {
            const normalizedId = id.replace(/\\/g, '/');
            // Monaco is intentionally not forced into a manual chunk: it is only reached through
            // lazily loaded editor modules, so Rollup keeps it out of the initial load.
            if (normalizedId.includes('/node_modules/@xyflow/')) {
              return 'vendor-xyflow';
            }
            // Only core MUI goes in the shared vendor chunk. Icons, lab and the x-* packages
            // (date pickers, data grid) are left to Rollup so they load with the pages using them.
            if (
              /\/node_modules\/@mui\/(material|system|utils|styled-engine|private-theming|types|core-downloads-tracker)\//.test(normalizedId) ||
              normalizedId.includes('/node_modules/@emotion/')
            ) {
              return 'vendor-mui';
            }
            if (
              normalizedId.includes('/node_modules/react/') ||
              normalizedId.includes('/node_modules/react-dom/') ||
              normalizedId.includes('/node_modules/react-router/') ||
              normalizedId.includes('/node_modules/react-router-dom/') ||
              normalizedId.includes('/node_modules/scheduler/')
            ) {
              return 'vendor-react';
            }
          }
        },
      },
    },
  },
})
