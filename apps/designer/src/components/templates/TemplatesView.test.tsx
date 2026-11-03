import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { TemplatesView } from './TemplatesView.js'

afterEach(() => {
  cleanup()
})

const SAMPLE_TEMPLATES = [
  {
    name: 'official-memo',
    description: 'บันทึกข้อความราชการ',
    source: 'builtin' as const,
  },
  {
    name: 'invoice-th',
    description: 'ใบแจ้งหนี้มาตรฐาน',
    source: 'saved' as const,
  },
]

describe('TemplatesView', () => {
  it('TemplatesView filters by text', () => {
    const onSelect = vi.fn()
    const onNew = vi.fn()
    const { getByRole, queryByText } = render(
      <TemplatesView
        items={SAMPLE_TEMPLATES}
        selected="official-memo"
        onSelect={onSelect}
        onNew={onNew}
      />,
    )

    expect(queryByText('official-memo')).not.toBeNull()
    expect(queryByText('invoice-th')).not.toBeNull()

    const search = getByRole('searchbox')
    fireEvent.change(search, { target: { value: 'invoice' } })

    expect(queryByText('official-memo')).toBeNull()
    expect(queryByText('invoice-th')).not.toBeNull()
  })

  it('TemplatesView selects a template', () => {
    const onSelect = vi.fn()
    const onNew = vi.fn()
    const { getByText } = render(
      <TemplatesView
        items={SAMPLE_TEMPLATES}
        selected="official-memo"
        onSelect={onSelect}
        onNew={onNew}
      />,
    )

    fireEvent.click(getByText('invoice-th'))
    expect(onSelect).toHaveBeenCalledWith('invoice-th')
  })
})
