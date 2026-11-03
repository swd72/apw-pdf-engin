import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { BindingInput } from './BindingInput.js'

afterEach(() => {
  cleanup()
})

describe('BindingInput', () => {
  it('BindingInput shows data paths after typing {{', () => {
    const onChange = vi.fn()
    const data = { user: { name: 'Alice', age: 30 }, title: 'Invoice' }
    const { getByRole, getAllByRole } = render(
      <BindingInput value="Hello " onChange={onChange} data={data} />,
    )
    const input = getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Hello {{' } })

    const options = getAllByRole('option')
    const labels = options.map((o) => o.textContent)
    expect(labels).toContain('user.name')
    expect(labels).toContain('title')

    const userOption = options.find((o) => o.textContent === 'user.name')!
    fireEvent.click(userOption)
    expect(onChange).toHaveBeenCalledWith('Hello {{user.name}}')
  })

  it('BindingInput lists filters after typing a pipe', () => {
    const onChange = vi.fn()
    const data = { date: '2026-11-03' }
    const { getByRole, getAllByRole } = render(
      <BindingInput value="Hello {{date |" onChange={onChange} data={data} />,
    )
    const options = getAllByRole('option')
    const labels = options.map((o) => o.textContent)
    expect(labels).toContain('thaiDate')
    expect(labels).toContain('thaiNum')

    const filterOption = options.find((o) => o.textContent === 'thaiDate')!
    fireEvent.click(filterOption)
    expect(onChange).toHaveBeenCalledWith('Hello {{date | thaiDate}}')
  })

  it('BindingInput suggests loop variable fields from scope', () => {
    const onChange = vi.fn()
    const data = { items: [{ name: 'Pen', price: 10 }] }
    const scope = [{ name: 'item', arrayPath: 'items' }]
    const { getAllByRole } = render(
      <BindingInput value="{{" onChange={onChange} data={data} scope={scope} />,
    )
    const options = getAllByRole('option')
    const labels = options.map((o) => o.textContent)
    expect(labels).toContain('item.name')
    expect(labels).toContain('item.price')
  })

  it('BindingInput lists unresolved names', () => {
    const onChange = vi.fn()
    const { getByText } = render(
      <BindingInput
        value="{{missingField}} and {{anotherMissing}}"
        onChange={onChange}
        data={{}}
        unresolved={['missingField', 'anotherMissing']}
      />,
    )
    expect(getByText(/missingField/)).not.toBeNull()
    expect(getByText(/anotherMissing/)).not.toBeNull()
  })
})
