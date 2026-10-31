import express from 'express'
import { ApwPdfError, createRenderer } from '@apw-pdf/node'
import { templates } from '@apw-pdf/templates'

export async function createApp() {
  const renderer = await createRenderer()
  const app = express()
  app.use(express.json({ limit: '5mb' }))

  app.get('/templates', (_req, res) => {
    const list = Object.values(templates).map((t) => ({
      name: t.name,
      description: t.description,
    }))
    res.json(list)
  })

  app.post('/pdf/:template', async (req, res) => {
    try {
      const templateName = req.params.template
      const pdfBytes = await renderer.render(templateName, req.body)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${templateName}.pdf"`,
      )
      res.send(Buffer.from(pdfBytes))
    } catch (err) {
      if (err instanceof ApwPdfError) {
        res.status(400).json({
          code: err.code,
          path: err.path,
          message: err.message,
        })
        return
      }
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  })

  return app
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  const port = Number(process.env.PORT ?? 3456)
  createApp()
    .then((app) => {
      app.listen(port, () => {
        console.log(`Express PDF server listening on http://127.0.0.1:${port}`)
      })
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
