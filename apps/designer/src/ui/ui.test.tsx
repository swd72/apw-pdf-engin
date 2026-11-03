import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { IconButton } from './IconButton.js'
import { Menu } from './Menu.js'
import { Popover } from './Popover.js'
import { SegmentedControl } from './SegmentedControl.js'
import { Chip } from './Chip.js'
import { PlusIcon } from './icons.js'

afterEach(() => {
  cleanup()
})

describe('ui kit', () => {
  it('IconButton exposes its label as aria-label and calls onClick', () => {
    const onClick = vi.fn()
    const { getByLabelText } = render(
      <IconButton label="Add item" icon={<PlusIcon />} onClick={onClick} />,
    )
    const btn = getByLabelText('Add item')
    expect(btn).not.toBeNull()
    expect(btn.getAttribute('title')).toBe('Add item')
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('Menu opens on click, selects an item and closes', () => {
    const onDuplicate = vi.fn()
    const onDelete = vi.fn()
    const items = [
      { label: 'Duplicate', onSelect: onDuplicate },
      { label: 'Delete', onSelect: onDelete, danger: true },
    ]
    const { getByLabelText, queryByRole, getByText } = render(
      <Menu label="More actions" items={items} />,
    )

    expect(queryByRole('menu')).toBeNull()
    fireEvent.click(getByLabelText('More actions'))
    expect(queryByRole('menu')).not.toBeNull()

    fireEvent.click(getByText('Duplicate'))
    expect(onDuplicate).toHaveBeenCalledTimes(1)
    expect(queryByRole('menu')).toBeNull()
  })

  it('Menu closes on Escape', () => {
    const onSelect = vi.fn()
    const items = [{ label: 'Action', onSelect }]
    const { getByLabelText, queryByRole } = render(
      <Menu label="More actions" items={items} />,
    )

    fireEvent.click(getByLabelText('More actions'))
    expect(queryByRole('menu')).not.toBeNull()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(queryByRole('menu')).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('Menu disabled item does not call onSelect', () => {
    const onSelect = vi.fn()
    const items = [{ label: 'Move out', onSelect, disabled: true }]
    const { getByLabelText, getByText, queryByRole } = render(
      <Menu label="More actions" items={items} />,
    )

    fireEvent.click(getByLabelText('More actions'))
    const itemBtn = getByText('Move out') as HTMLButtonElement
    expect(itemBtn.disabled).toBe(true)

    fireEvent.click(itemBtn)
    expect(onSelect).not.toHaveBeenCalled()
    expect(queryByRole('menu')).not.toBeNull()
  })

  it('SegmentedControl calls onChange with the clicked value', () => {
    const onChange = vi.fn()
    const options = [
      { value: 'document' as const, label: 'เอกสาร' },
      { value: 'data' as const, label: 'ข้อมูล' },
      { value: 'json' as const, label: 'JSON' },
    ]
    const { getByRole, getByText } = render(
      <SegmentedControl value="document" options={options} onChange={onChange} />,
    )

    expect(getByRole('tablist')).not.toBeNull()
    fireEvent.click(getByText('ข้อมูล'))
    expect(onChange).toHaveBeenCalledWith('data')
  })

  it('Popover toggles its content', () => {
    const { getByRole, queryByText } = render(
      <Popover label="ตั้งค่าหน้า">
        <div>เนื้อหาตั้งค่าหน้า</div>
      </Popover>,
    )

    expect(queryByText('เนื้อหาตั้งค่าหน้า')).toBeNull()
    const trigger = getByRole('button', { name: 'ตั้งค่าหน้า' })
    fireEvent.click(trigger)
    expect(queryByText('เนื้อหาตั้งค่าหน้า')).not.toBeNull()

    fireEvent.click(trigger)
    expect(queryByText('เนื้อหาตั้งค่าหน้า')).toBeNull()
  })

  it('Chip renders with tone class', () => {
    const { getByText } = render(<Chip tone="warn">คำเตือน</Chip>)
    const el = getByText('คำเตือน')
    expect(el.className).toContain('ui-chip--warn')
  })
})
