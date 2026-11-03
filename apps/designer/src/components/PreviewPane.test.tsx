// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import type { RenderClient } from '@apw-pdf/react'
import { memo } from '@apw-pdf/templates'
import { PreviewPane } from './PreviewPane.js'

describe('PreviewPane', () => {
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
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('PreviewPane keeps last good doc when doc becomes null', async () => {
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
      <PreviewPane doc={memo.document} data={{}} client={client} />,
    )

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(queryByLabelText('หน้า 1 จาก 1')).not.toBeNull()

    // User types invalid JSON mid-typing -> doc becomes null
    rerender(<PreviewPane doc={null} data={null} client={client} />)

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    // The previous canvas remains visible
    expect(queryByLabelText('หน้า 1 จาก 1')).not.toBeNull()
  })
})
