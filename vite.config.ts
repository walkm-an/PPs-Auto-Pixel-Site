import { createReadStream, existsSync, statSync } from 'node:fs'
import { join, normalize, sep } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

function previewMissingPage(): Plugin {
  return {
    name: 'preview-missing-page',
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0])
        if (urlPath === '/') return next()
        const dist = normalize(join(server.config.root, server.config.build.outDir))
        const file = normalize(join(dist, urlPath.replace(/^\/+/, '')))
        if (file.startsWith(dist + sep) && existsSync(file) && statSync(file).isFile()) return next()
        res.statusCode = 404
        res.setHeader('content-type', 'text/html; charset=utf-8')
        createReadStream(join(dist, '404.html')).pipe(res)
      })
    },
  }
}

export default defineConfig({
  base: './',
  appType: 'mpa',
  plugins: [previewMissingPage()],
  build: {
    cssTarget: ['chrome123', 'edge123', 'firefox120', 'safari17.5'],
  },
})
