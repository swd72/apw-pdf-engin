import { pathToFileURL } from 'node:url'
import express from 'express'
import { ApwPdfError, createRenderer } from '@apw-pdf/node'
import { templates } from '@apw-pdf/templates'

export interface ServerOptions {
  maxRequestsPerWindow?: number
  windowMs?: number
  maxConcurrent?: number
  renderer?: {
    render(doc: string, data: unknown): Promise<Uint8Array>
  }
}

export function pruneRateWindows(
  windows: Map<string, { count: number; resetAt: number }>,
  now: number,
  maxEntries = 10_000,
): void {
  for (const [ip, entry] of windows) {
    if (entry.resetAt <= now) {
      windows.delete(ip)
    }
  }
  if (windows.size > maxEntries) {
    const toDrop = windows.size - maxEntries
    let dropped = 0
    for (const key of windows.keys()) {
      windows.delete(key)
      dropped++
      if (dropped >= toDrop) break
    }
  }
}

export async function createApp(opts?: ServerOptions) {
  const renderer = opts?.renderer ?? (await createRenderer())
  const maxRequestsPerWindow = opts?.maxRequestsPerWindow ?? 60
  const windowMs = opts?.windowMs ?? 60_000
  const maxConcurrent = opts?.maxConcurrent ?? 4

  const rateWindows = new Map<string, { count: number; resetAt: number }>()
  let activeRenders = 0

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
    const now = Date.now()
    pruneRateWindows(rateWindows, now)
    const clientIp = req.ip ?? '127.0.0.1'
    let bucket = rateWindows.get(clientIp)
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs }
      rateWindows.set(clientIp, bucket)
    }
    if (bucket.count >= maxRequestsPerWindow || activeRenders >= maxConcurrent) {
      res.status(429).json({
        code: 'RATE_LIMITED',
        message: 'Too many requests',
      })
      return
    }
    bucket.count += 1
    activeRenders += 1

    try {
      const templateName = req.params.template
      if (!Object.hasOwn(templates, templateName)) {
        throw new ApwPdfError(
          'TEMPLATE_INVALID',
          `Unknown built-in template "${templateName}"`,
        )
      }
      const pdfBytes = await renderer.render(templateName, req.body)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(templateName)}.pdf"`,
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
        message: 'Internal server error',
      })
    } finally {
      activeRenders -= 1
    }
  })

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (
        err instanceof SyntaxError &&
        'status' in err &&
        (err as { status?: number }).status === 400
      ) {
        res.status(400).json({
          code: 'INVALID_JSON',
          message: 'Invalid JSON request body',
        })
        return
      }
      if ((err as { type?: string })?.type === 'entity.too.large') {
        res.status(413).json({
          code: 'LIMIT_EXCEEDED',
          message: 'Request body exceeds 5 MB limit',
        })
        return
      }
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      })
    },
  )

  return app
}

export function isMainModule(metaUrl: string, argv1?: string): boolean {
  if (!argv1) return false
  try {
    return metaUrl === pathToFileURL(argv1).href
  } catch {
    return false
  }
}

if (isMainModule(import.meta.url, process.argv[1])) {
  const port = Number(process.env.PORT ?? 3456)
  const host = process.env.HOST ?? '127.0.0.1'
  createApp()
    .then((app) => {
      app.listen(port, host, () => {
        console.log(`Express PDF server listening on http://${host}:${port}`)
      })
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
