import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import {
  LengthInput,
  parseLength,
  formatLength,
  convertLength,
} from './LengthInput.js'

afterEach(() => {
  cleanup()
})

describe('LengthInput utilities and component', () => {
  it('parseLength parses valid lengths and returns null for invalid or bindings', () => {
    expect(parseLength('6pt')).toEqual({ num: 6, unit: 'pt' })
    expect(parseLength('1.5cm')).toEqual({ num: 1.5, unit: 'cm' })
    expect(parseLength(12)).toEqual({ num: 12, unit: 'pt' })
    expect(parseLength('{{x}}')).toBeNull()
    expect(parseLength('5px')).toBeNull()
    expect(parseLength(undefined)).toBeNull()
  })

  it('convertLength and formatLength convert between units accurately', () => {
    const ptToCm = convertLength(6, 'pt', 'cm')
    expect(ptToCm).toBeCloseTo(0.21, 2)
    expect(formatLength(ptToCm, 'cm')).toBe('0.21cm')
    expect(convertLength(1, 'in', 'pt')).toBe(72)
    expect(convertLength(10, 'mm', 'cm')).toBe(1)
  })

  it('renders with "6pt": number box shows 6 and select shows pt', () => {
    const onChange = vi.fn()
    const { getByLabelText } = render(
      <LengthInput
        aria-label="Test length"
        value="6pt"
        defaultUnit="pt"
        onChange={onChange}
      />,
    )

    const numInput = getByLabelText('Test length') as HTMLInputElement
    const unitSelect = getByLabelText('Test length unit') as HTMLSelectElement

    expect(numInput.type).toBe('text')
    expect(numInput.getAttribute('inputmode')).toBe('decimal')
    expect(numInput.value).toBe('6')
    expect(unitSelect.value).toBe('pt')
  })

  it('typing 12 calls onChange("12pt"), clearing calls onChange(undefined), typing "-" alone makes no call', () => {
    const onChange = vi.fn()
    const { getByLabelText } = render(
      <LengthInput
        aria-label="Test length"
        value="6pt"
        defaultUnit="pt"
        allowNegative
        onChange={onChange}
      />,
    )

    const numInput = getByLabelText('Test length') as HTMLInputElement

    fireEvent.change(numInput, { target: { value: '12' } })
    expect(onChange).toHaveBeenLastCalledWith('12pt')

    fireEvent.change(numInput, { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith(undefined)

    onChange.mockClear()
    fireEvent.change(numInput, { target: { value: '-' } })
    expect(numInput.value).toBe('-')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('typing "12a" filters out letters, shows "12", and calls onChange("12pt")', () => {
    const onChange = vi.fn()
    const { getByLabelText } = render(
      <LengthInput
        aria-label="Test length"
        value="6pt"
        defaultUnit="pt"
        onChange={onChange}
      />,
    )

    const numInput = getByLabelText('Test length') as HTMLInputElement

    fireEvent.change(numInput, { target: { value: '12a' } })
    expect(numInput.value).toBe('12')
    expect(onChange).toHaveBeenLastCalledWith('12pt')
  })

  it('ArrowUp and Shift+ArrowUp step by unit step and step*10', () => {
    const onChange = vi.fn()
    const { getByLabelText, rerender } = render(
      <LengthInput
        aria-label="Test length"
        value="6pt"
        defaultUnit="pt"
        onChange={onChange}
      />,
    )

    const numInput = getByLabelText('Test length') as HTMLInputElement

    fireEvent.keyDown(numInput, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith('7pt')

    fireEvent.keyDown(numInput, { key: 'ArrowUp', shiftKey: true })
    expect(onChange).toHaveBeenLastCalledWith('16pt')

    rerender(
      <LengthInput
        aria-label="Test length"
        value="1.5cm"
        defaultUnit="cm"
        onChange={onChange}
      />,
    )

    fireEvent.keyDown(numInput, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith('1.6cm')
  })

  it('changing unit to cm on "6pt" calls onChange("0.21cm")', () => {
    const onChange = vi.fn()
    const { getByLabelText } = render(
      <LengthInput
        aria-label="Test length"
        value="6pt"
        defaultUnit="pt"
        onChange={onChange}
      />,
    )

    const unitSelect = getByLabelText('Test length unit') as HTMLSelectElement
    fireEvent.change(unitSelect, { target: { value: 'cm' } })
    expect(onChange).toHaveBeenLastCalledWith('0.21cm')
  })

  it('rejects negative input without allowNegative and accepts "-1cm" with allowNegative', () => {
    const onChange = vi.fn()
    const { getByLabelText, rerender } = render(
      <LengthInput
        aria-label="Test length"
        value="1cm"
        defaultUnit="cm"
        onChange={onChange}
      />,
    )

    const numInput = getByLabelText('Test length') as HTMLInputElement

    fireEvent.change(numInput, { target: { value: '-1' } })
    expect(onChange).not.toHaveBeenCalled()

    rerender(
      <LengthInput
        aria-label="Test length"
        value="1cm"
        defaultUnit="cm"
        allowNegative
        onChange={onChange}
      />,
    )

    fireEvent.change(numInput, { target: { value: '-1' } })
    expect(onChange).toHaveBeenLastCalledWith('-1cm')
  })

  it('renders a plain text input when value is an unparseable expression like "{{gap}}"', () => {
    const onChange = vi.fn()
    const { getByLabelText, queryByLabelText } = render(
      <LengthInput
        aria-label="Test length"
        value="{{gap}}"
        defaultUnit="cm"
        onChange={onChange}
      />,
    )

    const input = getByLabelText('Test length') as HTMLInputElement
    expect(input.type).toBe('text')
    expect(input.value).toBe('{{gap}}')
    expect(queryByLabelText('Test length unit')).toBeNull()
  })
})
