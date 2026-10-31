import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import {
  ApwPdfProvider,
  PdfDownloadButton,
  PdfPreview,
  type RenderClient,
} from '../src/index.js'
import type { RenderResponse } from '../src/protocol.js'

describe('PdfDownloadButton and PdfPreview components', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    if (!URL.createObjectURL) {
      URL.createObjectURL = () => ''
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = () => {}
    }
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf-download')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('disables download button while rendering and triggers anchor click with download="memo.pdf" when ready', async () => {
    let resolveRender!: (res: RenderResponse) => void
    const client: RenderClient = {
      render: vi.fn(
        () =>
          new Promise<RenderResponse>((resolve) => {
            resolveRender = resolve
          }),
      ),
      dispose: vi.fn(),
    }

    const doc = { version: 1, blocks: [] }
    const { getByRole } = render(
      <ApwPdfProvider fontBaseUrl="/fonts" wasmUrl="/hb.wasm" client={client}>
        <PdfDownloadButton doc={doc} data={{}} fileName="memo.pdf">
          ดาวน์โหลด
        </PdfDownloadButton>
      </ApwPdfProvider>,
    )

    const btn = getByRole('button') as HTMLButtonElement
    // Advance debounce timer to enter rendering state
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(btn.disabled).toBe(true)

    await act(async () => {
      resolveRender({
        id: 1,
        ok: true,
        bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        pageCount: 1,
        warnings: [],
      })
    })
    expect(btn.disabled).toBe(false)

    let clickedDownloadAttr = ''
    let clickedHref = ''
    const origCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = origCreateElement(tagName)
      if (tagName.toLowerCase() === 'a') {
        vi.spyOn(el as HTMLAnchorElement, 'click').mockImplementation(() => {
          clickedDownloadAttr = (el as HTMLAnchorElement).download
          clickedHref = (el as HTMLAnchorElement).href
        })
      }
      return el
    })

    fireEvent.click(btn)
    expect(clickedDownloadAttr).toBe('memo.pdf')
    expect(clickedHref).toContain('blob:pdf-download')
  })

  it('renders PdfPreview with accessible page canvases ("หน้า 1 จาก 2", "หน้า 2 จาก 2")', async () => {
    const client: RenderClient = {
      render: vi.fn(async () => ({
        id: 1,
        ok: true as const,
        bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        pageCount: 2,
        warnings: [],
      })),
      dispose: vi.fn(),
    }

    const { getByLabelText } = render(
      <ApwPdfProvider fontBaseUrl="/fonts" wasmUrl="/hb.wasm" client={client}>
        <PdfPreview doc={{ version: 1, blocks: [] }} data={{}} scale={1} />
      </ApwPdfProvider>,
    )

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(getByLabelText('หน้า 1 จาก 2')).toBeDefined()
    expect(getByLabelText('หน้า 2 จาก 2')).toBeDefined()
  })

  it('renders error alert in PdfPreview when render fails', async () => {
    const client: RenderClient = {
      render: vi.fn(async () => ({
        id: 1,
        ok: false as const,
        error: {
          code: 'SCHEMA_INVALID',
          message: 'Invalid doc',
        },
      })),
      dispose: vi.fn(),
    }

    const { getByRole } = render(
      <ApwPdfProvider fontBaseUrl="/fonts" wasmUrl="/hb.wasm" client={client}>
        <PdfPreview doc={{}} data={{}} />
      </ApwPdfProvider>,
    )

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(getByRole('alert').textContent).toContain('SCHEMA_INVALID')
  })
})
