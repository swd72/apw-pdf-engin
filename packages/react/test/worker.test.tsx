import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fontsDir } from '@apw-pdf/fonts/node'
import { memo } from '@apw-pdf/templates'
import { fetchFontProvider, fetchImageProvider } from '../src/fetch-providers.js'
import { createRenderClient } from '../src/provider.js'
import { handleMessage } from '../src/worker.js'

const require = createRequire(import.meta.url)

describe('fetchFontProvider and worker handleMessage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetchFontProvider requests /fonts/THSarabunIT9-Bold.ttf for bold and caches the promise', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new Uint8Array([0, 1, 0, 0]).buffer,
      } as Response)

    const provider = fetchFontProvider('/fonts')
    const b1 = await provider.load('THSarabunIT9', { bold: true, italic: false })
    const b2 = await provider.load('THSarabunIT9', { bold: true, italic: false })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledWith('/fonts/THSarabunIT9-Bold.ttf')
    expect(b1.byteLength).toBe(4)
    expect(b2.byteLength).toBe(4)
  })

  it('fetchImageProvider supports data: URLs, relative URLs, and rejects cross-origin URLs', async () => {
    const png1x1 =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const provider = fetchImageProvider({ garuda: png1x1 })
    const bytes = await provider.load('asset:garuda')
    expect(bytes[0]).toBe(0x89)
    expect(bytes[1]).toBe(0x50)

    const plainData = await provider.load('data:text/plain,hello')
    expect(plainData.byteLength).toBe(5)

    await expect(provider.load('asset:missing')).rejects.toMatchObject({
      code: 'IMAGE_LOAD_FAILED',
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    } as Response)
    const fetched = await provider.load('/images/logo.png')
    expect(fetched.byteLength).toBe(3)
    const cached = await provider.load('/images/logo.png')
    expect(cached.byteLength).toBe(3)

    await expect(
      provider.load('https://evil.example.com/x.png'),
    ).rejects.toMatchObject({ code: 'IMAGE_NOT_ALLOWED' })
  })

  it('worker handleMessage(req) renders memo example, handles errors, and createRenderClient works', async () => {
    const wasmPath = require.resolve('harfbuzzjs/dist/harfbuzz-subset.wasm')
    const placeholderPath = require.resolve(
      '@apw-pdf/templates/assets/garuda-placeholder.png',
    )

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith('.wasm')) {
        const buf = await fs.readFile(wasmPath)
        return {
          ok: true,
          arrayBuffer: async () =>
            buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
        } as Response
      }
      if (url.includes('garuda')) {
        const buf = await fs.readFile(placeholderPath)
        return {
          ok: true,
          arrayBuffer: async () =>
            buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
        } as Response
      }
      const fileName = url.split('/').pop()!
      const buf = await fs.readFile(path.join(fontsDir, fileName))
      return {
        ok: true,
        arrayBuffer: async () =>
          buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      } as Response
    })

    const res = await handleMessage(
      {
        id: 42,
        doc: memo.document,
        data: memo.example,
      },
      {
        fontBaseUrl: '/fonts',
        wasmUrl: '/harfbuzz-subset.wasm',
        assets: { garuda: '/garuda.png' },
      },
    )

    expect(res.id).toBe(42)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.pageCount).toBe(1)
      const header = new TextDecoder('latin1').decode(res.bytes.subarray(0, 4))
      expect(header).toBe('%PDF')
    }

    const errRes = await handleMessage(
      {
        id: 43,
        doc: memo.document,
        data: {},
      },
      {
        fontBaseUrl: '/fonts',
        wasmUrl: '/harfbuzz-subset.wasm',
        assets: { garuda: '/garuda.png' },
      },
    )
    expect(errRes.ok).toBe(false)
    if (!errRes.ok) {
      expect(errRes.error.code).toBe('MISSING_VARIABLE')
    }

    const mainThreadClient = createRenderClient({
      fontBaseUrl: '/fonts',
      wasmUrl: '/harfbuzz-subset.wasm',
      assets: { garuda: '/garuda.png' },
      useWorker: false,
    })
    const clientRes = await mainThreadClient.render({
      doc: memo.document,
      data: memo.example,
    })
    expect(clientRes.ok).toBe(true)
    mainThreadClient.dispose()

    // Test Worker branch in createRenderClient
    class MockWorker {
      onmessage: ((ev: MessageEvent) => void) | null = null
      postMessage(data: { id: number }) {
        setTimeout(() => {
          this.onmessage?.({
            data: {
              id: data.id,
              ok: true,
              bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
              pageCount: 1,
              warnings: [],
            },
          } as MessageEvent)
        }, 5)
      }
      terminate() {}
    }
    vi.stubGlobal('Worker', MockWorker)
    const workerClient = createRenderClient({
      fontBaseUrl: '/fonts',
      wasmUrl: '/harfbuzz-subset.wasm',
      useWorker: true,
    })
    const wRes = await workerClient.render({
      doc: memo.document,
      data: memo.example,
    })
    expect(wRes.ok).toBe(true)
    workerClient.dispose()
  })
})
