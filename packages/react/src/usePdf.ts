import { useEffect, useRef, useState } from 'react'
import type { Warning } from '@apw-pdf/core'
import { useRenderClient } from './provider.js'

export interface UsePdfOptions {
  debounceMs?: number
  strict?: boolean
}

export interface UsePdfState {
  status: 'idle' | 'rendering' | 'ready' | 'error'
  url?: string
  bytes?: Uint8Array
  pageCount?: number
  warnings: Warning[]
  error?: {
    code: string
    message: string
    path?: string
  }
}

export function usePdf(
  doc: unknown,
  data: unknown,
  opts?: UsePdfOptions,
): UsePdfState {
  const client = useRenderClient()
  const debounceMs = opts?.debounceMs ?? 300
  const strict = opts?.strict

  const [state, setState] = useState<UsePdfState>({
    status: 'idle',
    warnings: [],
  })

  const reqSeqRef = useRef(0)
  const currentUrlRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    return () => {
      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current)
        currentUrlRef.current = undefined
      }
    }
  }, [])

  useEffect(() => {
    const seq = ++reqSeqRef.current
    const timer = setTimeout(() => {
      setState((prev) => ({
        ...prev,
        status: 'rendering',
        error: undefined,
      }))

      void client
        .render({ doc, data, strict })
        .then((res) => {
          if (seq !== reqSeqRef.current) return

          if (res.ok) {
            if (currentUrlRef.current) {
              URL.revokeObjectURL(currentUrlRef.current)
            }
            const blob = new Blob([res.bytes as BlobPart], {
              type: 'application/pdf',
            })
            const nextUrl = URL.createObjectURL(blob)
            currentUrlRef.current = nextUrl

            setState({
              status: 'ready',
              url: nextUrl,
              bytes: res.bytes,
              pageCount: res.pageCount,
              warnings: res.warnings,
            })
          } else {
            setState((prev) => ({
              ...prev,
              status: 'error',
              error: res.error,
            }))
          }
        })
        .catch((err: unknown) => {
          if (seq !== reqSeqRef.current) return
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: {
              code: 'UNKNOWN_ERROR',
              message: err instanceof Error ? err.message : String(err),
            },
          }))
        })
    }, debounceMs)

    return () => {
      clearTimeout(timer)
    }
  }, [client, doc, data, debounceMs, strict])

  return state
}
