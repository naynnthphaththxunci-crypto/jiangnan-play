import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  root: fileURLToPath(new URL('./web/', import.meta.url)),
  server: { host: '127.0.0.1', port: 47321, strictPort: true },
})
