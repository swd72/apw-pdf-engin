import React, { useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import type { Block, DocumentDef, TableBlock } from '@apw-pdf/core'
import { useEditorState, type EditorState } from '../../editor/useEditorState.js'
import { getBlock, type BlockPath } from '../../editor/docModel.js'
import { TableProps } from '../properties/types/TableProps.js'
import { TableGridDialog } from './TableGridDialog.js'
import { Dialog } from './Dialog.js'

afterEach(() => {
  cleanup()
})

function createDoc(blocks: Block[] = []): DocumentDef {
  return {
    version: 1,
    page: {
      size: 'A4',
      margin: { top: '1.5cm', bottom: '2cm', left: '3cm', right: '2cm' },
    },
    font: { family: 'Sarabun', size: '16pt' },
    blocks,
  }
}

function createMockEditorState(
  docPartial: Partial<DocumentDef> = {},
  selectedPath: BlockPath | null = null,
  data: unknown = {},
): EditorState {
  const doc: DocumentDef = {
    ...createDoc(),
    ...docPartial,
  }
  const state: EditorState = {
    doc,
    data,
    selectedPath,
    select: vi.fn((p) => {
      state.selectedPath = p
    }),
    addBlock: vi.fn(),
    removeSelected: vi.fn(),
    moveSelected: vi.fn(),
    moveSelectedInto: vi.fn(),
    moveSelectedOut: vi.fn(),
    moveBlockTo: vi.fn(),
    duplicateSelected: vi.fn(),
    updateBlock: vi.fn((path, patch) => {
      const current = getBlock(state.doc, path)
      if (!current) return
      const nextBlock = { ...current, ...patch } as Block
      state.replaceBlock(path, nextBlock)
    }),
    replaceBlock: vi.fn((path, block) => {
      if (path.length === 2 && path[0] === 'blocks' && typeof path[1] === 'number') {
        const blocksCopy = [...state.doc.blocks]
        blocksCopy[path[1]] = block
        state.doc = { ...state.doc, blocks: blocksCopy }
      }
    }),
    setData: vi.fn((next) => {
      state.data = next
    }),
    warnings: [],
  }
  return state
}

const EMPTY_DATA: Record<string, unknown> = {}
const NOOP = () => {}
const FIRST_BLOCK_PATH: BlockPath = ['blocks', 0]

function StatefulGridHarness({
  initialTable,
  data = EMPTY_DATA,
  onChange,
  onClose = NOOP,
}: {
  initialTable: TableBlock
  data?: unknown
  onChange: (next: { doc: DocumentDef; data: unknown }) => void
  onClose?: () => void
}) {
  const [initial] = useState(() => ({ doc: createDoc([initialTable]), data }))
  const state = useEditorState(initial, onChange)
  return (
    <TableGridDialog path={FIRST_BLOCK_PATH} state={state} onClose={onClose} />
  )
}

describe('TableProps, TableGridDialog and Dialog', () => {
  it('TableProps adds a column', () => {
    const block: TableBlock = {
      type: 'table',
      columns: [{ width: '*' }, { width: '*' }],
      rows: [[{ text: 'A' }, { text: 'B' }]],
    }
    const state = createMockEditorState({ blocks: [block] }, ['blocks', 0])

    const { getByRole } = render(
      <TableProps block={block} path={['blocks', 0]} state={state} />,
    )

    const addBtn = getByRole('button', { name: 'Add column' })
    fireEvent.click(addBtn)

    expect(state.updateBlock).toHaveBeenCalledTimes(1)
    const updated = state.doc.blocks[0] as TableBlock
    expect(updated.columns).toHaveLength(3)
    expect(Array.isArray(updated.rows) && updated.rows[0]).toHaveLength(3)
  })

  it('TableProps switches to each rows with an array and a valid as', () => {
    const block: TableBlock = {
      type: 'table',
      columns: [{ width: '*' }, { width: '*' }],
      rows: [[{ text: 'A' }, { text: 'B' }]],
    }
    const state = createMockEditorState(
      { blocks: [block] },
      ['blocks', 0],
      { items: [{ name: 'Pen', qty: 2 }] },
    )

    const { getByLabelText, rerender } = render(
      <TableProps block={block} path={['blocks', 0]} state={state} />,
    )

    const modeSelect = getByLabelText('Body mode')
    fireEvent.change(modeSelect, { target: { value: 'each' } })

    rerender(
      <TableProps
        block={state.doc.blocks[0] as TableBlock}
        path={['blocks', 0]}
        state={state}
      />,
    )

    const eachInput = getByLabelText('Each array path')
    fireEvent.change(eachInput, { target: { value: 'items' } })

    rerender(
      <TableProps
        block={state.doc.blocks[0] as TableBlock}
        path={['blocks', 0]}
        state={state}
      />,
    )

    const asInput = getByLabelText('Loop variable (as)')
    fireEvent.change(asInput, { target: { value: 'rowItem' } })

    const updated = state.doc.blocks[0] as TableBlock
    expect(updated.rows).toEqual({
      each: 'items',
      as: 'rowItem',
      cells: [{ text: '' }, { text: '' }],
    })
  })

  it('TableProps rejects an invalid loop variable', () => {
    const block: TableBlock = {
      type: 'table',
      columns: [{ width: '*' }],
      rows: { each: 'items', as: 'item', cells: [{ text: '{{item.name}}' }] },
    }
    const state = createMockEditorState({ blocks: [block] }, ['blocks', 0])

    const { getByLabelText, queryByRole } = render(
      <TableProps block={block} path={['blocks', 0]} state={state} />,
    )

    const asInput = getByLabelText('Loop variable (as)')
    fireEvent.change(asInput, { target: { value: '123-invalid' } })

    expect(queryByRole('alert')).not.toBeNull()
    expect(state.updateBlock).not.toHaveBeenCalled()
  })

  it('TableProps with an empty array still opens the grid', () => {
    const block: TableBlock = {
      type: 'table',
      columns: [{ width: '*' }, { width: '*' }],
      rows: {
        each: 'items',
        as: 'item',
        cells: [{ text: '{{item.title}}' }, { text: '{{item.amount}}' }],
      },
    }
    const state = createMockEditorState(
      { blocks: [block] },
      ['blocks', 0],
      { items: [] },
    )
    const onOpenTableEditor = vi.fn()

    const { getByRole, queryByRole, getByLabelText } = render(
      <TableProps
        block={block}
        path={['blocks', 0]}
        state={state}
        onOpenTableEditor={onOpenTableEditor}
      />,
    )

    const openBtn = getByRole('button', { name: 'แก้ไขตาราง' })
    fireEvent.click(openBtn)

    expect(onOpenTableEditor).toHaveBeenCalledWith(['blocks', 0])
    expect(queryByRole('dialog')).not.toBeNull()
    const cellInput = getByLabelText('Body cell 1,1') as HTMLInputElement
    expect(cellInput.value).toBe('{{item.title}}')
  })

  it('TableGridDialog edits a body cell', () => {
    const onChange = vi.fn()
    const initialTable: TableBlock = {
      type: 'table',
      columns: [{ width: '*' }, { width: '*' }],
      header: [[{ text: 'หัวข้อ 1' }, { text: 'หัวข้อ 2' }]],
      rows: [[{ text: 'ข้อมูลเดิม' }, { text: '100' }]],
    }

    const { getByLabelText } = render(
      <StatefulGridHarness initialTable={initialTable} onChange={onChange} />,
    )

    const cellInput = getByLabelText('Body cell 1,1')
    fireEvent.change(cellInput, { target: { value: 'ข้อมูลใหม่' } })

    expect(onChange).toHaveBeenCalledTimes(1)
    const updatedTable = onChange.mock.calls[0]![0].doc.blocks[0] as TableBlock
    expect(Array.isArray(updatedTable.rows)).toBe(true)
    if (Array.isArray(updatedTable.rows)) {
      expect(updatedTable.rows[0]![0]!.text).toBe('ข้อมูลใหม่')
    }
  })

  it('TableGridDialog adds and removes a row and a column', () => {
    const onChange = vi.fn()
    const initialTable: TableBlock = {
      type: 'table',
      columns: [{ width: '*' }, { width: '*' }],
      rows: [[{ text: 'R1C1' }, { text: 'R1C2' }]],
    }

    const { getByRole } = render(
      <StatefulGridHarness initialTable={initialTable} onChange={onChange} />,
    )

    // Add row
    fireEvent.click(getByRole('button', { name: 'Add row' }))
    let latestTable = onChange.mock.calls[onChange.mock.calls.length - 1]![0]
      .doc.blocks[0] as TableBlock
    expect(Array.isArray(latestTable.rows) && latestTable.rows).toHaveLength(2)

    // Remove row
    fireEvent.click(getByRole('button', { name: 'Remove row' }))
    latestTable = onChange.mock.calls[onChange.mock.calls.length - 1]![0].doc
      .blocks[0] as TableBlock
    expect(Array.isArray(latestTable.rows) && latestTable.rows).toHaveLength(1)

    // Add column
    fireEvent.click(getByRole('button', { name: 'Add column' }))
    latestTable = onChange.mock.calls[onChange.mock.calls.length - 1]![0].doc
      .blocks[0] as TableBlock
    expect(latestTable.columns).toHaveLength(3)
    expect(Array.isArray(latestTable.rows) && latestTable.rows[0]).toHaveLength(3)

    // Remove column
    fireEvent.click(getByRole('button', { name: 'Remove column' }))
    latestTable = onChange.mock.calls[onChange.mock.calls.length - 1]![0].doc
      .blocks[0] as TableBlock
    expect(latestTable.columns).toHaveLength(2)
    expect(Array.isArray(latestTable.rows) && latestTable.rows[0]).toHaveLength(2)
  })

  it('TableGridDialog converts a text cell to blocks keeping the text', () => {
    const onChange = vi.fn()
    const initialTable: TableBlock = {
      type: 'table',
      columns: [{ width: '*' }],
      rows: [[{ text: 'ข้อความในเซลล์' }]],
    }

    const { getByRole } = render(
      <StatefulGridHarness initialTable={initialTable} onChange={onChange} />,
    )

    const convertBtn = getByRole('button', { name: 'แปลงเซลล์เป็นบล็อก' })
    fireEvent.click(convertBtn)

    expect(onChange).toHaveBeenCalledTimes(1)
    const updatedTable = onChange.mock.calls[0]![0].doc.blocks[0] as TableBlock
    expect(Array.isArray(updatedTable.rows)).toBe(true)
    if (Array.isArray(updatedTable.rows)) {
      const cell = updatedTable.rows[0]![0]!
      expect(cell.blocks).toEqual([
        { type: 'paragraph', text: 'ข้อความในเซลล์' },
      ])
      expect('text' in cell).toBe(false)
    }
  })

  it('Dialog closes on Escape and traps focus', () => {
    const onClose = vi.fn()
    const { getByRole, getByText } = render(
      <Dialog open={true} title="แก้ไขตาราง" onClose={onClose}>
        <button type="button">ปุ่มแรก</button>
        <button type="button">ปุ่มสอง</button>
      </Dialog>,
    )

    const dialog = getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')

    const closeBtn = getByRole('button', { name: 'Close' })
    const firstBtn = getByText('ปุ่มแรก') as HTMLButtonElement
    const secondBtn = getByText('ปุ่มสอง') as HTMLButtonElement

    // Focus the last focusable element and press Tab -> wraps to first focusable (closeBtn)
    secondBtn.focus()
    expect(document.activeElement).toBe(secondBtn)
    fireEvent.keyDown(secondBtn, { key: 'Tab' })
    expect(document.activeElement).toBe(closeBtn)

    // Press Shift+Tab on the first focusable element -> wraps to last focusable (secondBtn)
    fireEvent.keyDown(closeBtn, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(secondBtn)

    // Escape closes
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
