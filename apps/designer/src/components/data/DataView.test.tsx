import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { DataView } from './DataView.js'

afterEach(() => {
  cleanup()
})

describe('DataView', () => {
  it('DataView adds a key', () => {
    const onChange = vi.fn()
    const data = { title: 'Report' }
    const { getByRole } = render(<DataView data={data} onChange={onChange} />)

    const addBtn = getByRole('button', { name: /Add field|Add key/i })
    fireEvent.click(addBtn)

    expect(onChange).toHaveBeenCalledTimes(1)
    const calledWith = onChange.mock.calls[0]![0] as Record<string, unknown>
    expect(Object.keys(calledWith).length).toBe(2)
  })

  it('DataView renames a key and rejects a duplicate with an inline message', () => {
    const onChange = vi.fn()
    const data = { first: 'A', second: 'B' }
    const { getAllByLabelText, getByText } = render(
      <DataView data={data} onChange={onChange} />,
    )

    const keyInputs = getAllByLabelText('Key')
    fireEvent.change(keyInputs[1]!, { target: { value: 'first' } })
    expect(getByText(/duplicate/i)).not.toBeNull()
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.change(keyInputs[1]!, { target: { value: 'third' } })
    expect(onChange).toHaveBeenCalledWith({ first: 'A', third: 'B' })
  })

  it('DataView changes type string to number only when lossless', () => {
    const onChange = vi.fn()
    const data = { age: '25', text: 'hello' }
    const { getAllByLabelText, getByRole, getByText } = render(
      <DataView data={data} onChange={onChange} />,
    )

    const typeButtons = getAllByLabelText('Type')
    fireEvent.click(typeButtons[0]!)
    fireEvent.click(getByRole('menuitem', { name: 'number' }))
    expect(onChange).toHaveBeenCalledWith({ age: 25, text: 'hello' })

    onChange.mockClear()
    fireEvent.click(typeButtons[1]!)
    fireEvent.click(getByRole('menuitem', { name: 'number' }))
    expect(getByText(/cannot convert/i)).not.toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('DataView adds an array item copying the first row shape', () => {
    const onChange = vi.fn()
    const data = {
      items: [{ name: 'Pen', count: 10 }],
    }
    const { getByRole } = render(<DataView data={data} onChange={onChange} />)

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

  it('DataView removes an item', () => {
    const onChange = vi.fn()
    const data = { a: 'first', b: 'second' }
    const { getAllByLabelText, getByLabelText } = render(
      <DataView data={data} onChange={onChange} />,
    )

    const menuButtons = getAllByLabelText('ตัวเลือกข้อมูล')
    fireEvent.click(menuButtons[0]!)
    fireEvent.click(getByLabelText('Remove'))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ b: 'second' })
  })

  it('DataView collapses a nested object', () => {
    const onChange = vi.fn()
    const data = { author: { name: 'Somchai' } }
    const { getByLabelText, queryByDisplayValue } = render(
      <DataView data={data} onChange={onChange} />,
    )

    expect(queryByDisplayValue('Somchai')).not.toBeNull()

    const toggleBtn = getByLabelText('Toggle author')
    fireEvent.click(toggleBtn)
    expect(queryByDisplayValue('Somchai')).toBeNull()

    fireEvent.click(toggleBtn)
    expect(queryByDisplayValue('Somchai')).not.toBeNull()
  })
})
