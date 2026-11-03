import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { DocumentDef } from '@apw-pdf/core'
import { TopBar } from './TopBar.js'
import { UsePopover } from './UsePopover.js'
import { PagePopover } from './PagePopover.js'

afterEach(() => cleanup())

const sampleDoc: DocumentDef = {
  version: 1,
  page: {
    size: 'A4',
    margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' },
  },
  font: { family: 'Sarabun', size: '16pt' },
  blocks: [],
}

describe('shell', () => {
  it('TopBar mode control calls onMode', () => {
    const onMode = vi.fn()
    render(
      <TopBar
        name="receipt-v1"
        dirty={false}
        mode="visual"
        onMode={onMode}
        onSave={() => {}}
        saveLabel="Save"
        menu={[]}
      />,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'JSON' }))
    expect(onMode).toHaveBeenCalledWith('json')
  })

  it('TopBar menu items call onSelect', () => {
    const onDup = vi.fn()
    render(
      <TopBar
        name="receipt-v1"
        dirty={true}
        mode="visual"
        onMode={() => {}}
        onSave={() => {}}
        saveLabel="Save"
        menu={[{ label: 'ทำซ้ำ', onSelect: onDup }]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'เมนูเพิ่มเติม' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'ทำซ้ำ' }))
    expect(onDup).toHaveBeenCalled()
  })

  it('UsePopover shows CLI and React snippets for the template', () => {
    render(<UsePopover templateName="receipt-v1" />)
    expect(screen.getByText(/apw-pdf render receipt-v1/)).not.toBeNull()
    expect(screen.getByText(/PdfDownloadButton/)).not.toBeNull()
  })

  it('PagePopover changes page size', () => {
    const onChange = vi.fn()
    render(<PagePopover doc={sampleDoc} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Page size'), {
      target: { value: 'A5' },
    })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0]![0].page.size).toBe('A5')
  })
})
