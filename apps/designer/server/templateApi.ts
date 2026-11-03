import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { PathNotAllowedError } from '@apw-pdf/mcp'
import { createTemplateStore, StoreError } from './templateStore.js'

function sendJson(res: ServerResponse, status: number, data: unknown) {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

export function createTemplateApiHandler(
  store: ReturnType<typeof createTemplateStore>,
) {
  return async (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const pathname = url.pathname

    if (
      pathname !== '/api/templates' &&
      !pathname.startsWith('/api/templates/')
    ) {
      next()
      return
    }

    try {
      if (pathname === '/api/templates') {
        if (req.method === 'GET') {
          const list = await store.list()
          sendJson(res, 200, list)
          return
        }
        sendJson(res, 405, { error: 'Method Not Allowed' })
        return
      }

      const rawName = pathname.slice('/api/templates/'.length)
      const name = decodeURIComponent(rawName)

      if (req.method === 'GET') {
        const item = await store.get(name)
        sendJson(res, 200, item)
        return
      }

      if (req.method === 'DELETE') {
        await store.remove(name)
        sendJson(res, 200, { ok: true })
        return
      }

      if (req.method === 'PUT') {
        const overwrite = url.searchParams.get('overwrite') === 'true'

        let total = 0
        const chunks: Buffer[] = []
        let exceeded = false

        for await (const chunk of req) {
          total += chunk.length
          if (total > 1024 * 1024) {
            exceeded = true
            break
          }
          chunks.push(chunk)
        }

        if (exceeded) {
          sendJson(res, 413, { error: 'Payload exceeds 1 MB limit' })
          return
        }

        const bodyStr = Buffer.concat(chunks).toString('utf8')
        let record: any
        try {
          record = JSON.parse(bodyStr)
        } catch {
          sendJson(res, 400, { error: 'Invalid JSON body' })
          return
        }

        if (record.name !== name) {
          sendJson(res, 422, { error: 'URL name does not match record name' })
          return
        }

        await store.put(record, { overwrite })
        sendJson(res, 200, { ok: true, name })
        return
      }

      sendJson(res, 405, { error: 'Method Not Allowed' })
    } catch (err: any) {
      if (err instanceof StoreError) {
        sendJson(res, err.status, {
          error: err.message,
          issues: err.issues,
        })
        return
      }
      if (err instanceof PathNotAllowedError) {
        sendJson(res, 400, { error: err.message })
        return
      }
      sendJson(res, 500, { error: err?.message ?? 'Internal Server Error' })
    }
  }
}

export function templateApiPlugin(dir: string): Plugin {
  return {
    name: 'template-api-plugin',
    apply: 'serve',
    configureServer(server) {
      const store = createTemplateStore(dir)
      const handler = createTemplateApiHandler(store)
      server.middlewares.use(handler)
    },
  }
}
