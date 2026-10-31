import type { Warning } from '@apw-pdf/core'

export interface WorkerInitConfig {
  fontBaseUrl: string
  wasmUrl: string
  assets?: Record<string, string>
}

export type RenderRequest = {
  id: number
  doc: unknown
  data: unknown
  strict?: boolean
  config?: WorkerInitConfig
}

export type RenderResponse =
  | {
      id: number
      ok: true
      bytes: Uint8Array
      pageCount: number
      warnings: Warning[]
    }
  | {
      id: number
      ok: false
      error: {
        code: string
        message: string
        path?: string
      }
    }
