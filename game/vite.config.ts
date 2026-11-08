import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 47321, strictPort: true },
  preview: { host: '127.0.0.1', port: 47321, strictPort: true },
  build: { outDir: 'dist', target: 'es2020', emptyOutDir: true, assetsInlineLimit: 1024 * 1024 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})
