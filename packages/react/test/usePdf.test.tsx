import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { ApwPdfProvider, usePdf, type RenderClient } from '../src/index.js'
import type { RenderResponse } from '../src/protocol.js'

describe('usePdf hook', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    let blobId = 0
    if (!URL.createObjectURL) {
      URL.createObjectURL = () => ''
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = () => {}
    }
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:test-${++blobId}`)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('debounces 3 data changes within 100ms into 1 render call after 300ms', async () => {
    let reqCounter = 0
    const renderMock = vi.fn(async (): Promise<RenderResponse> => {
      reqCounter++
      return {
        id: reqCounter,
        ok: true,
        bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        pageCount: 1,
        warnings: [],
      }
    })
    const client: RenderClient = {
      render: renderMock,
      dispose: vi.fn(),
    }

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ApwPdfProvider fontBaseUrl="/fonts" wasmUrl="/hb.wasm" client={client}>
        {children}
      </ApwPdfProvider>
    )

    const doc = { version: 1, blocks: [] }
    const { result, rerender } = renderHook(
      ({ data }) => usePdf(doc, data, { debounceMs: 300 }),
      {
        wrapper,
        initialProps: { data: { n: 1 } },
      },
    )

    act(() => {
      vi.advanceTimersByTime(40)
      rerender({ data: { n: 2 } })
    })
    act(() => {
      vi.advanceTimersByTime(40)
      rerender({ data: { n: 3 } })
    })

    expect(renderMock).toHaveBeenCalledTimes(0)

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(renderMock).toHaveBeenCalledTimes(1)
    expect(renderMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: { n: 3 } }),
    )
    expect(result.current.status).toBe('ready')
    expect(result.current.pageCount).toBe(1)
  })

  it('ignores stale out-of-order responses and revokes old object URLs on new result and unmount', async () => {
    const resolvers: ((res: RenderResponse) => void)[] = []
    const renderMock = vi.fn(
      () =>
        new Promise<RenderResponse>((resolve) => {
          resolvers.push(resolve)
        }),
    )
    const client: RenderClient = {
      render: renderMock,
      dispose: vi.fn(),
    }

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ApwPdfProvider fontBaseUrl="/fonts" wasmUrl="/hb.wasm" client={client}>
        {children}
      </ApwPdfProvider>
    )

    const doc = { version: 1, blocks: [] }
    const { result, rerender, unmount } = renderHook(
      ({ data }) => usePdf(doc, data, { debounceMs: 10 }),
      {
        wrapper,
        initialProps: { data: { v: 1 } },
      },
    )

    await act(async () => {
      vi.advanceTimersByTime(10)
    })
    expect(renderMock).toHaveBeenCalledTimes(1)

    rerender({ data: { v: 2 } })
    await act(async () => {
      vi.advanceTimersByTime(10)
    })
    expect(renderMock).toHaveBeenCalledTimes(2)

    // Resolve request 2 first
    await act(async () => {
      resolvers[1]!({
        id: 2,
        ok: true,
        bytes: new Uint8Array([2]),
        pageCount: 2,
        warnings: [],
      })
    })
    expect(result.current.status).toBe('ready')
    expect(result.current.pageCount).toBe(2)
    expect(result.current.url).toBe('blob:test-1')

    // Resolve stale request 1 after -> should be ignored
    await act(async () => {
      resolvers[0]!({
        id: 1,
        ok: true,
        bytes: new Uint8Array([1]),
        pageCount: 1,
        warnings: [],
      })
    })
    expect(result.current.pageCount).toBe(2)
    expect(result.current.url).toBe('blob:test-1')

    // Trigger a 3rd request and resolve it -> revokes blob:test-1
    rerender({ data: { v: 3 } })
    await act(async () => {
      vi.advanceTimersByTime(10)
    })
    await act(async () => {
      resolvers[2]!({
        id: 3,
        ok: true,
        bytes: new Uint8Array([3]),
        pageCount: 3,
        warnings: [],
      })
    })
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1')
    expect(result.current.url).toBe('blob:test-2')

    unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-2')
  })

  it('populates error state with code and path on failure', async () => {
    const client: RenderClient = {
      render: vi.fn(async () => ({
        id: 1,
        ok: false as const,
        error: {
          code: 'MISSING_VARIABLE',
          message: 'Missing variable "subject"',
          path: 'blocks[0].text',
        },
      })),
      dispose: vi.fn(),
    }

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ApwPdfProvider fontBaseUrl="/fonts" wasmUrl="/hb.wasm" client={client}>
        {children}
      </ApwPdfProvider>
    )

    const { result } = renderHook(
      () => usePdf({ version: 1, blocks: [] }, {}, { debounceMs: 10 }),
      { wrapper },
    )

    await act(async () => {
      vi.advanceTimersByTime(10)
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toEqual({
      code: 'MISSING_VARIABLE',
      message: 'Missing variable "subject"',
      path: 'blocks[0].text',
    })
  })
})
