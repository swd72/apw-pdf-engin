import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const defaultDir = path.resolve(__dirname, 'saved-templates')
const templateDir = process.env.APW_PDF_TEMPLATE_DIR ?? defaultDir

export default defineConfig(({ command }) => {
  const plugins: Plugin[] = [react()]

  if (command === 'serve' && !process.env.VITEST) {
    plugins.push({
      name: 'template-api-plugin',
      apply: 'serve',
      async configureServer(server) {
        const { createTemplateStore } = await import('./server/templateStore.js')
        const { createTemplateApiHandler } = await import('./server/templateApi.js')
        const store = createTemplateStore(templateDir)
        const handler = createTemplateApiHandler(store)
        server.middlewares.use(handler)
      },
    })
  }

  return {
    plugins,
    optimizeDeps: {
      exclude: ['harfbuzzjs'],
    },
    build: {
      target: 'es2022',
    },
    worker: {
      format: 'es',
    },
    test: {
      environmentMatchGlobs: [
        ['src/**', 'jsdom'],
        ['server/**', 'node'],
      ],
    },
  }
})
