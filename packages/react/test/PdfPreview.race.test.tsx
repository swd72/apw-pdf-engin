import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import {
  ApwPdfProvider,
  PdfPreview,
  type RenderClient,
} from '../src/index.js'

interface MockRenderTask {
  promise: Promise<unknown>
  cancel: ReturnType<typeof vi.fn>
}

const renderTasks: MockRenderTask[] = []

function createMockRenderTask(): MockRenderTask {
  let rejectFn!: (err: any) => void
  const promise = new Promise((_, reject) => {
    rejectFn = reject
  })
  const cancel = vi.fn(() => {
    rejectFn({ name: 'RenderingCancelledException' })
  })
  const task = { promise, cancel }
  renderTasks.push(task)
  return task
}

const renderMock = vi.fn(() => createMockRenderTask())

const mockGetPage = vi.fn(async () => ({
  getViewport: vi.fn(() => ({ width: 100, height: 100 })),
  render: renderMock,
}))

const mockPdfDoc = {
  numPages: 1,
  getPage: mockGetPage,
  destroy: vi.fn(async () => {}),
}

const mockGetDocument = vi.fn(() => ({
  promise: Promise.resolve(mockPdfDoc),
  destroy: vi.fn(async () => {}),
}))

vi.mock('pdfjs-dist', () => ({
  getDocument: mockGetDocument,
  default: { getDocument: mockGetDocument },
}))

const docConstant = { version: 1, blocks: [] }
const dataConstant1 = { v: 1 }
const dataConstant2 = { v: 2 }

describe('PdfPreview canvas race', () => {
  beforeEach(() => {
    renderTasks.length = 0
    renderMock.mockClear()
    mockGetPage.mockClear()
    mockGetDocument.mockClear()

    if (!HTMLCanvasElement.prototype.getContext) {
      HTMLCanvasElement.prototype.getContext = vi.fn(() => ({} as any))
    } else {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as any)
    }

    if (!URL.createObjectURL) {
      URL.createObjectURL = () => ''
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = () => {}
    }
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-preview')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('cancels previous render task and ignores RenderingCancelledException without console.error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    let seq = 0
    const client: RenderClient = {
      render: vi.fn(async () => {
        seq++
        return {
          id: seq,
          ok: true as const,
          bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, seq]),
          pageCount: 1,
          warnings: [],
        }
      }),
      dispose: vi.fn(),
    }

    const { rerender } = render(
      <ApwPdfProvider fontBaseUrl="/fonts" wasmUrl="/hb.wasm" client={client}>
        <PdfPreview
          doc={docConstant}
          data={dataConstant1}
          scale={1}
          debounceMs={0}
        />
      </ApwPdfProvider>,
    )

    // Wait for the first render task to be in-flight before rerendering
    await vi.waitFor(() => {
      expect(renderMock).toHaveBeenCalledTimes(1)
    })

    const firstTask = renderTasks[0]!
    const firstCancel = firstTask.cancel
    expect(firstCancel).not.toHaveBeenCalled()

    // Rerender with different data (different bytes)
    rerender(
      <ApwPdfProvider fontBaseUrl="/fonts" wasmUrl="/hb.wasm" client={client}>
        <PdfPreview
          doc={docConstant}
          data={dataConstant2}
          scale={1}
          debounceMs={0}
        />
      </ApwPdfProvider>,
    )

    // Wait until the first task's cancel was called
    await vi.waitFor(() => {
      expect(firstCancel).toHaveBeenCalled()
    })

    // Assert console.error was not called with the preview render failed message
    expect(errorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('[apw-pdf] preview render failed'),
      expect.anything(),
    )
  })
})
