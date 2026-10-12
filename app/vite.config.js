import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../', import.meta.url))

// Preview unpublished recipes locally, and ship a fallback snapshot with each build.
function recipeAssets() {
  return {
    name: 'recipe-assets',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || '').split('?')[0]
        if (path !== '/data/recipes.json' && !/^\/images\/[a-z0-9-]+\.(jpg|png|webp)$/.test(path)) return next()
        try {
          const source = await readFile(`${repoRoot}${path.slice(1)}`)
          const type = path.endsWith('.json') ? 'application/json' : path.endsWith('.webp') ? 'image/webp' : path.endsWith('.png') ? 'image/png' : 'image/jpeg'
          res.setHeader('Content-Type', type)
          res.end(source)
        } catch {
          res.statusCode = 404
          res.end('Not found')
        }
      })
    },
    async generateBundle() {
      const files = ['data/recipes.json', ...(await readdir(`${repoRoot}images`))
        .filter((name) => /\.(jpg|png|webp)$/.test(name)).map((name) => `images/${name}`)]
      for (const fileName of files) {
        this.emitFile({ type: 'asset', fileName, source: await readFile(`${repoRoot}${fileName}`) })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), recipeAssets()],
})
