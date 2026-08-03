import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'

function demoVideoPlugin(mode: string): Plugin {
  const env = loadEnv(mode, process.cwd(), '')
  const external = env.VITE_DEMO_VIDEO_URL?.trim() ?? ''
  const local = path.resolve('public/media/project-lens-demo.mp4')
  const poster = path.resolve('public/media/project-lens-demo-poster.webp')
  const source = external || (fs.existsSync(local) ? '/media/project-lens-demo.mp4' : '')
  const posterUrl = fs.existsSync(poster) ? '/media/project-lens-demo-poster.webp' : ''
  const config = JSON.stringify({ source, poster: posterUrl })

  return {
    name: 'project-lens-demo-video',
    transformIndexHtml(html) {
      return html.replace('<head>', `<head><script>window.__PROJECT_LENS_DEMO__=${config}</script>`)
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [demoVideoPlugin(mode)],
  server: { port: 4174, strictPort: true },
  preview: { port: 4174, strictPort: true },
  build: { target: 'es2022', sourcemap: false },
}))
