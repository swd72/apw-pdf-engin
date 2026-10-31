import React, { createContext, useContext, useEffect, useMemo } from 'react'
import type {
  RenderRequest,
  RenderResponse,
  WorkerInitConfig,
} from './protocol.js'
import { handleMessage } from './worker.js'

export interface RenderClientOptions extends WorkerInitConfig {
  useWorker?: boolean
}

export interface RenderClient {
  render(req: Omit<RenderRequest, 'id'>): Promise<RenderResponse>
  dispose(): void
}

export function createRenderClient(opts: RenderClientOptions): RenderClient {
  let nextId = 1
  let worker: Worker | null = null
  const pending = new Map<number, (res: RenderResponse) => void>()

  const config: WorkerInitConfig = {
    fontBaseUrl: opts.fontBaseUrl,
    wasmUrl: opts.wasmUrl,
    assets: opts.assets,
  }

  if (opts.useWorker !== false && typeof Worker !== 'undefined') {
    try {
      worker = new Worker(new URL('./worker.js', import.meta.url), {
        type: 'module',
      })
      worker.onmessage = (ev: MessageEvent<RenderResponse>) => {
        const res = ev.data
        const resolve = pending.get(res.id)
        if (resolve) {
          pending.delete(res.id)
          resolve(res)
        }
      }
    } catch {
      worker = null
    }
  }

  return {
    async render(req: Omit<RenderRequest, 'id'>): Promise<RenderResponse> {
      const id = nextId++
      const fullReq: RenderRequest = {
        ...req,
        id,
        config,
      }
      if (worker) {
        return new Promise<RenderResponse>((resolve) => {
          pending.set(id, resolve)
          worker!.postMessage(fullReq)
        })
      }
      return handleMessage(fullReq, config)
    },
    dispose() {
      if (worker) {
        worker.terminate()
        worker = null
      }
      pending.clear()
    },
  }
}

const ApwPdfContext = createContext<RenderClient | null>(null)

export interface ApwPdfProviderProps {
  fontBaseUrl: string
  wasmUrl?: string
  assets?: Record<string, string>
  worker?: boolean
  client?: RenderClient
  children: React.ReactNode
}

export function ApwPdfProvider({
  fontBaseUrl,
  wasmUrl = '/harfbuzz-subset.wasm',
  assets,
  worker = true,
  client: injectedClient,
  children,
}: ApwPdfProviderProps) {
  const client = useMemo(() => {
    if (injectedClient) return injectedClient
    return createRenderClient({
      fontBaseUrl,
      wasmUrl,
      assets,
      useWorker: worker,
    })
  }, [injectedClient, fontBaseUrl, wasmUrl, assets, worker])

  useEffect(() => {
    return () => {
      if (!injectedClient) {
        client.dispose()
      }
    }
  }, [client, injectedClient])

  return (
    <ApwPdfContext.Provider value={client}>{children}</ApwPdfContext.Provider>
  )
}

export function useRenderClient(): RenderClient {
  const ctx = useContext(ApwPdfContext)
  if (ctx) return ctx
  return createRenderClient({
    fontBaseUrl: '/fonts',
    wasmUrl: '/harfbuzz-subset.wasm',
    useWorker: false,
  })
}
