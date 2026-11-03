// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import type { RenderClient } from '@apw-pdf/react'
import { memo } from '@apw-pdf/templates'
import { PdfStage } from './PdfStage.js'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('PdfStage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    if (!URL.createObjectURL) {
      URL.createObjectURL = () => ''
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = () => {}
    }
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-stage')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('PdfStage zoom buttons change the percent mode', async () => {
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

    const { getByLabelText, queryByText } = render(
      <PdfStage
        doc={memo.document}
        data={{}}
        templateName="memo"
        client={client}
      />,
    )

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    const modeButton = getByLabelText('โหมดซูม')
    const zoomInButton = getByLabelText('ซูมเข้า')
    const zoomOutButton = getByLabelText('ซูมออก')

    expect(modeButton.textContent).toBe('100%')
    expect(queryByText('หน้า 1 / 2')).not.toBeNull()

    fireEvent.click(zoomInButton)
    expect(modeButton.textContent).toBe('125%')

    fireEvent.click(zoomOutButton)
    expect(modeButton.textContent).toBe('100%')

    fireEvent.click(zoomOutButton)
    expect(modeButton.textContent).toBe('75%')
  })

  it('PdfStage keeps the last good render when doc becomes null', async () => {
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

    const { rerender, queryByLabelText } = render(
      <PdfStage
        doc={memo.document}
        data={{}}
        templateName="memo"
        client={client}
      />,
    )

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(queryByLabelText('หน้า 1 จาก 1')).not.toBeNull()

    rerender(
      <PdfStage
        doc={null}
        data={null}
        templateName="memo"
        client={client}
      />,
    )

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(queryByLabelText('หน้า 1 จาก 1')).not.toBeNull()
  })
})
