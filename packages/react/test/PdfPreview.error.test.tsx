import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import {
  ApwPdfProvider,
  PdfPreview,
  type RenderClient,
} from '../src/index.js'

const mockGetDocument = vi.fn(() => ({
  promise: Promise.reject(new Error('Simulated pdfjs render error')),
}))

vi.mock('pdfjs-dist', () => ({
  getDocument: mockGetDocument,
  default: { getDocument: mockGetDocument },
}))

describe('PdfPreview error logging', () => {
  beforeEach(() => {
    vi.useFakeTimers()
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
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('logs pdfjs render errors instead of swallowing them', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const client: RenderClient = {
      render: vi.fn(async () => ({
        id: 1,
        ok: true as const,
        bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        pageCount: 1,
        warnings: [],
      })),
      dispose: vi.fn(),
    }

    render(
      <ApwPdfProvider fontBaseUrl="/fonts" wasmUrl="/hb.wasm" client={client}>
        <PdfPreview
          doc={{ version: 1, blocks: [] }}
          data={{}}
          scale={1}
          debounceMs={0}
        />
      </ApwPdfProvider>,
    )

    await act(async () => {
      vi.advanceTimersByTime(300)
      for (let i = 0; i < 20; i++) {
        await Promise.resolve()
      }
    })

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[apw-pdf] preview render failed'),
      expect.anything(),
    )
  })
})
