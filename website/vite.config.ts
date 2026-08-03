import { defineConfig } from 'vite'

export default defineConfig({
  server: { port: 4174, strictPort: true },
  preview: { port: 4174, strictPort: true },
  build: { target: 'es2022', sourcemap: false },
})
