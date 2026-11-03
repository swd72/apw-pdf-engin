import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import type { PageInfo } from '@apw-pdf/core'
import {
  ApwPdfProvider,
  PdfPreview,
  type RenderClient,
  type RenderResponse,
} from '../src/index.js'
import { handleMessage } from '../src/worker.js'

const renderPdfMock = vi.fn()

vi.mock('@apw-pdf/pdf', () => ({
  createPdfEngine: vi.fn(async () => ({
    fonts: {},
    validate: vi.fn(),
    layout: vi.fn(),
    renderPdf: renderPdfMock,
  })),
}))

const mockPdfDoc = {
  numPages: 1,
  getPage: vi.fn(async () => ({
    getViewport: vi.fn(() => ({ width: 100, height: 100 })),
    render: vi.fn(() => ({
      promise: Promise.resolve(),
      cancel: vi.fn(),
    })),
  })),
  destroy: vi.fn(async () => {}),
}

vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn(() => ({
    promise: Promise.resolve(mockPdfDoc),
    destroy: vi.fn(async () => {}),
  })),
}))

const DOC = { version: 1, blocks: [] }
const DATA_1 = { step: 1 }
const DATA_2 = { step: 2 }

const SAMPLE_PAGES: PageInfo[] = [
  {
    width: 595,
    height: 842,
    content: { x: 85, y: 42, w: 453, h: 742 },
    boxes: [{ path: 'blocks[0]', x: 85, y: 42, w: 453, h: 18 }],
  },
  {
    width: 595,
    height: 842,
    content: { x: 85, y: 42, w: 453, h: 742 },
    boxes: [{ path: 'blocks[1]', x: 85, y: 42, w: 453, h: 18 }],
  },
]

describe('PdfPreview overlay and boxes transport', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    renderPdfMock.mockReset()
    if (!HTMLCanvasElement.prototype.getContext) {
      HTMLCanvasElement.prototype.getContext = vi.fn(() => ({} as any))
    } else {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
        {} as any,
      )
    }
    if (!URL.createObjectURL) {
      URL.createObjectURL = () => ''
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = () => {}
    }
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-overlay')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('requests boxes only when renderOverlay is given', async () => {
    const renderSpy = vi.fn(
      async (): Promise<RenderResponse> => ({
        id: 1,
        ok: true,
        bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        pageCount: 1,
        warnings: [],
        pages: [SAMPLE_PAGES[0]!],
      }),
    )
    const client: RenderClient = {
      render: renderSpy,
      dispose: vi.fn(),
    }

    const overlayFn = vi.fn(() => <span>overlay</span>)

    const { rerender } = render(
      <ApwPdfProvider fontBaseUrl="/fonts" wasmUrl="/hb.wasm" client={client}>
        <PdfPreview doc={DOC} data={DATA_1} debounceMs={10} />
      </ApwPdfProvider>,
    )

    await act(async () => {
      vi.advanceTimersByTime(10)
    })

    expect(renderSpy).toHaveBeenCalledTimes(1)
    expect(renderSpy.mock.calls[0]![0].boxes).toBeUndefined()

    rerender(
      <ApwPdfProvider fontBaseUrl="/fonts" wasmUrl="/hb.wasm" client={client}>
        <PdfPreview
          doc={DOC}
          data={DATA_2}
          debounceMs={10}
          renderOverlay={overlayFn}
        />
      </ApwPdfProvider>,
    )

    await act(async () => {
      vi.advanceTimersByTime(10)
    })

    expect(renderSpy).toHaveBeenCalledTimes(2)
    expect(renderSpy.mock.calls[1]![0].boxes).toBe(true)
  })

  it('renders overlay once per page with the scale', async () => {
    const client: RenderClient = {
      render: vi.fn(
        async (): Promise<RenderResponse> => ({
          id: 1,
          ok: true,
          bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
          pageCount: 2,
          warnings: [],
          pages: SAMPLE_PAGES,
        }),
      ),
      dispose: vi.fn(),
    }

    const overlayFn = vi.fn((idx: number) => (
      <div data-testid={`ov-${idx}`}>ov</div>
    ))
    const onPagesChange = vi.fn()

    const { container } = render(
      <ApwPdfProvider fontBaseUrl="/fonts" wasmUrl="/hb.wasm" client={client}>
        <PdfPreview
          doc={DOC}
          data={DATA_1}
          scale={1.5}
          debounceMs={10}
          renderOverlay={overlayFn}
          onPagesChange={onPagesChange}
        />
      </ApwPdfProvider>,
    )

    await act(async () => {
      vi.advanceTimersByTime(10)
    })

    const overlays = container.querySelectorAll('.apw-pdf-page__overlay')
    expect(overlays.length).toBe(2)
    expect(overlayFn).toHaveBeenCalledWith(0, 1.5, SAMPLE_PAGES[0])
    expect(overlayFn).toHaveBeenCalledWith(1, 1.5, SAMPLE_PAGES[1])
    expect(onPagesChange).toHaveBeenCalledWith(SAMPLE_PAGES)
  })

  it('no wrapper without renderOverlay', async () => {
    const client: RenderClient = {
      render: vi.fn(
        async (): Promise<RenderResponse> => ({
          id: 1,
          ok: true,
          bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
          pageCount: 1,
          warnings: [],
        }),
      ),
      dispose: vi.fn(),
    }

    const { container } = render(
      <ApwPdfProvider fontBaseUrl="/fonts" wasmUrl="/hb.wasm" client={client}>
        <PdfPreview doc={DOC} data={DATA_1} debounceMs={10} />
      </ApwPdfProvider>,
    )

    await act(async () => {
      vi.advanceTimersByTime(10)
    })

    expect(container.querySelector('canvas')).not.toBeNull()
    expect(container.querySelector('.apw-pdf-page')).toBeNull()
  })

  it('keeps last pages on error', async () => {
    let callCount = 0
    const client: RenderClient = {
      render: vi.fn(async (): Promise<RenderResponse> => {
        callCount++
        if (callCount === 1) {
          return {
            id: 1,
            ok: true,
            bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
            pageCount: 1,
            warnings: [],
            pages: [SAMPLE_PAGES[0]!],
          }
        }
        return {
          id: 2,
          ok: false,
          error: {
            code: 'MISSING_VARIABLE',
            message: 'Missing var',
          },
        }
      }),
      dispose: vi.fn(),
    }

    const overlayFn = vi.fn(() => <span data-testid="kept-overlay">ok</span>)

    const { container, rerender } = render(
      <ApwPdfProvider fontBaseUrl="/fonts" wasmUrl="/hb.wasm" client={client}>
        <PdfPreview
          doc={DOC}
          data={DATA_1}
          debounceMs={10}
          renderOverlay={overlayFn}
        />
      </ApwPdfProvider>,
    )

    await act(async () => {
      vi.advanceTimersByTime(10)
    })

    expect(overlayFn).toHaveBeenLastCalledWith(0, 1, SAMPLE_PAGES[0])

    overlayFn.mockClear()
    rerender(
      <ApwPdfProvider fontBaseUrl="/fonts" wasmUrl="/hb.wasm" client={client}>
        <PdfPreview
          doc={DOC}
          data={DATA_2}
          debounceMs={10}
          renderOverlay={overlayFn}
        />
      </ApwPdfProvider>,
    )

    await act(async () => {
      vi.advanceTimersByTime(10)
    })

    expect(
      container.querySelector('[data-testid="kept-overlay"]'),
    ).not.toBeNull()
    expect(overlayFn).toHaveBeenCalledWith(0, 1, SAMPLE_PAGES[0])
  })

  it('worker passes boxes to renderPdf', async () => {
    renderPdfMock.mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]),
      pageCount: 1,
      warnings: [],
      pages: [SAMPLE_PAGES[0]!],
    })

    const res = await handleMessage({
      id: 7,
      doc: DOC,
      data: DATA_1,
      boxes: true,
      config: { fontBaseUrl: '/fonts', wasmUrl: '/hb.wasm' },
    })

    expect(renderPdfMock).toHaveBeenCalledWith(
      DOC,
      DATA_1,
      expect.objectContaining({ boxes: true }),
    )
    expect(res).toEqual({
      id: 7,
      ok: true,
      bytes: new Uint8Array([1, 2, 3]),
      pageCount: 1,
      warnings: [],
      pages: [SAMPLE_PAGES[0]!],
    })
  })
})
