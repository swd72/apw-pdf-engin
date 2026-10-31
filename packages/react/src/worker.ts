import { ApwPdfError } from '@apw-pdf/core'
import { createPdfEngine, type PdfEngine } from '@apw-pdf/pdf'
import { fetchFontProvider, fetchImageProvider } from './fetch-providers.js'
import type {
  RenderRequest,
  RenderResponse,
  WorkerInitConfig,
} from './protocol.js'

let cachedEngineKey = ''
let cachedEnginePromise: Promise<PdfEngine> | null = null

function getOrCreateEngine(cfg: WorkerInitConfig): Promise<PdfEngine> {
  const key = JSON.stringify(cfg)
  if (cachedEnginePromise && cachedEngineKey === key) {
    return cachedEnginePromise
  }
  cachedEngineKey = key
  cachedEnginePromise = createPdfEngine({
    fonts: fetchFontProvider(cfg.fontBaseUrl),
    images: fetchImageProvider(cfg.assets),
    subsetWasm: async () => {
      const res = await fetch(cfg.wasmUrl)
      if (!res.ok) {
        throw new Error(`Failed to fetch subset wasm from ${cfg.wasmUrl}`)
      }
      return res.arrayBuffer()
    },
  })
  return cachedEnginePromise
}

export async function handleMessage(
  req: RenderRequest,
  fallbackConfig?: WorkerInitConfig,
): Promise<RenderResponse> {
  const cfg = req.config ?? fallbackConfig ?? {
    fontBaseUrl: '/fonts',
    wasmUrl: '/harfbuzz-subset.wasm',
  }
  try {
    const engine = await getOrCreateEngine(cfg)
    const result = await engine.renderPdf(req.doc, req.data, {
      strict: req.strict,
    })
    return {
      id: req.id,
      ok: true,
      bytes: result.bytes,
      pageCount: result.pageCount,
      warnings: result.warnings,
    }
  } catch (err) {
    if (err instanceof ApwPdfError) {
      return {
        id: req.id,
        ok: false,
        error: {
          code: err.code,
          message: err.message,
          path: err.path,
        },
      }
    }
    return {
      id: req.id,
      ok: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: err instanceof Error ? err.message : String(err),
      },
    }
  }
}

if (
  typeof self !== 'undefined' &&
  typeof (self as unknown as { postMessage?: unknown }).postMessage === 'function' &&
  typeof window === 'undefined'
) {
  self.onmessage = async (ev: MessageEvent<RenderRequest>) => {
    const res = await handleMessage(ev.data)
    if (res.ok) {
      const transfer = res.bytes.buffer
      ;(self as unknown as Worker).postMessage(res, [transfer])
    } else {
      ;(self as unknown as Worker).postMessage(res)
    }
  }
}
