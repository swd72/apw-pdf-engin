import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { BlockPicker } from './BlockPicker.js'
import { blockMeta } from './blockMeta.js'

afterEach(() => cleanup())

describe('cards', () => {
  it('blockMeta returns Thai label and group for known blocks', () => {
    const meta = blockMeta('paragraph')
    expect(meta.label).toBe('ข้อความ')
    expect(meta.group).toBe('basic')
  })

  it('BlockPicker calls onPick with chosen block type', () => {
    const onPick = vi.fn()
    render(<BlockPicker onPick={onPick} />)

    fireEvent.click(screen.getByRole('button', { name: 'ข้อความ' }))
    expect(onPick).toHaveBeenCalledWith('paragraph')
  })
})
