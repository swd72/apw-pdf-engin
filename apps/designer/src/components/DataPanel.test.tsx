import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { DataPanel } from './DataPanel.js'

afterEach(() => {
  cleanup()
})

describe('DataPanel', () => {
  it('DataPanel adds a key', () => {
    const onChange = vi.fn()
    const data = { title: 'Report' }
    const { getByRole } = render(<DataPanel data={data} onChange={onChange} />)
    const addKeyBtn = getByRole('button', { name: /Add key/i })
    fireEvent.click(addKeyBtn)
    expect(onChange).toHaveBeenCalledTimes(1)
    const calledWith = onChange.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(calledWith).length).toBe(2)
  })

  it('DataPanel renames a key and rejects a duplicate with an inline message', () => {
    const onChange = vi.fn()
    const data = { first: 'A', second: 'B' }
    const { getAllByLabelText, getByText } = render(
      <DataPanel data={data} onChange={onChange} />,
    )
    const keyInputs = getAllByLabelText('Key')
    // Attempt duplicate rename
    fireEvent.change(keyInputs[1]!, { target: { value: 'first' } })
    expect(getByText(/duplicate/i)).not.toBeNull()
    expect(onChange).not.toHaveBeenCalled()

    // Valid rename
    fireEvent.change(keyInputs[1]!, { target: { value: 'third' } })
    expect(onChange).toHaveBeenCalledWith({ first: 'A', third: 'B' })
  })

  it('DataPanel changes type string to number only when lossless', () => {
    const onChange = vi.fn()
    const data = { age: '25', text: 'hello' }
    const { getAllByLabelText, getByText } = render(
      <DataPanel data={data} onChange={onChange} />,
    )
    const typeSelects = getAllByLabelText('Type')
    // Convert '25' to number -> success
    fireEvent.change(typeSelects[0]!, { target: { value: 'number' } })
    expect(onChange).toHaveBeenCalledWith({ age: 25, text: 'hello' })

    onChange.mockClear()
    // Convert 'hello' to number -> rejected
    fireEvent.change(typeSelects[1]!, { target: { value: 'number' } })
    expect(getByText(/cannot convert/i)).not.toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('DataPanel adds an array item copying the first row shape', () => {
    const onChange = vi.fn()
    const data = {
      items: [{ name: 'Pen', count: 10 }],
    }
    const { getByRole } = render(<DataPanel data={data} onChange={onChange} />)
    const addItemBtn = getByRole('button', { name: /Add item/i })
    fireEvent.click(addItemBtn)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({
      items: [
        { name: 'Pen', count: 10 },
        { name: '', count: 0 },
      ],
    })
  })

  it('DataPanel removes an item', () => {
    const onChange = vi.fn()
    const data = { a: 'first', b: 'second' }
    const { getAllByRole } = render(<DataPanel data={data} onChange={onChange} />)
    const removeButtons = getAllByRole('button', { name: /Remove/i })
    fireEvent.click(removeButtons[0]!)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ b: 'second' })
  })
})
