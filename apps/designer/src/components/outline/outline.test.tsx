import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import type { Block, DocumentDef, ColumnsBlock } from '@apw-pdf/core'
import type { EditorState } from '../../editor/useEditorState.js'
import type { Binding } from '../../editor/bindings.js'
import type { BlockPath } from '../../editor/docModel.js'
import { OutlineTree } from './OutlineTree.js'
import { QuickAdd } from './QuickAdd.js'

afterEach(() => {
  cleanup()
})

function createDoc(blocks: Block[] = []): DocumentDef {
  return {
    version: 1,
    page: {
      size: 'A4',
      margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' },
    },
    font: { family: 'Sarabun', size: '16pt' },
    blocks,
  }
}

function createMockEditorState(
  doc: DocumentDef,
  selectedPath: BlockPath | null = null,
  warnings: Binding[] = [],
): EditorState {
  return {
    doc,
    data: {},
    selectedPath,
    select: vi.fn(),
    addBlock: vi.fn(),
    removeSelected: vi.fn(),
    moveSelected: vi.fn(),
    moveSelectedInto: vi.fn(),
    moveSelectedOut: vi.fn(),
    moveBlockTo: vi.fn(),
    duplicateSelected: vi.fn(),
    updateBlock: vi.fn(),
    replaceBlock: vi.fn(),
    setData: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
    insertBlocks: vi.fn(),
    warnings,
  }
}

function createDataTransferStub() {
  const store: Record<string, string> = {}
  return {
    effectAllowed: 'all',
    dropEffect: 'move',
    setData(type: string, val: string) {
      store[type] = val
    },
    getData(type: string) {
      return store[type] ?? ''
    },
  }
}

describe('OutlineTree', () => {
  it('OutlineTree renders nested blocks with levels', () => {
    const colBlock: ColumnsBlock = {
      type: 'columns',
      columns: [
        { width: '*', blocks: [{ type: 'paragraph', text: 'Column 1 text' }] },
        { width: '*', blocks: [{ type: 'paragraph', text: 'Column 2 text' }] },
      ],
    }
    const doc = createDoc([colBlock])
    const state = createMockEditorState(doc)
    const { getAllByRole, getByText } = render(<OutlineTree state={state} />)

    const items = getAllByRole('treeitem')
    expect(items.length).toBe(3)
    expect(items[0]!.getAttribute('aria-level')).toBe('1')
    expect(items[1]!.getAttribute('aria-level')).toBe('2')
    expect(items[2]!.getAttribute('aria-level')).toBe('2')
    expect(getByText('Column 1 text')).not.toBeNull()
    expect(getByText('Column 2 text')).not.toBeNull()
  })

  it('clicking a row selects it', () => {
    const doc = createDoc([
      { type: 'paragraph', text: 'First paragraph' },
      { type: 'paragraph', text: 'Second paragraph' },
    ])
    const state = createMockEditorState(doc)
    const { getByText } = render(<OutlineTree state={state} />)

    fireEvent.click(getByText('Second paragraph'))
    expect(state.select).toHaveBeenCalledWith(['blocks', 1])
  })

  it('a row shows only one menu button and no per-row move buttons', () => {
    const doc = createDoc([
      { type: 'paragraph', text: 'First' },
      { type: 'paragraph', text: 'Second' },
    ])
    const state = createMockEditorState(doc, ['blocks', 0])
    const { getAllByRole, queryByLabelText } = render(
      <OutlineTree state={state} />,
    )

    const firstRow = getAllByRole('treeitem')[0]!
    const buttonsInRow = firstRow.querySelectorAll('button')
    expect(buttonsInRow.length).toBe(1)
    expect(queryByLabelText('Move up')).toBeNull()
    expect(queryByLabelText('Move down')).toBeNull()
  })

  it('menu Delete removes the block', () => {
    const doc = createDoc([{ type: 'paragraph', text: 'Delete me' }])
    const state = createMockEditorState(doc, ['blocks', 0])
    const { getAllByRole, getByLabelText } = render(
      <OutlineTree state={state} />,
    )

    const row = getAllByRole('treeitem')[0]!
    const menuTrigger = row.querySelector('button')!
    fireEvent.click(menuTrigger)

    const deleteItem = getByLabelText('Delete')
    fireEvent.click(deleteItem)
    expect(state.select).toHaveBeenCalledWith(['blocks', 0])
    expect(state.removeSelected).toHaveBeenCalledTimes(1)
  })

  it('keyboard Delete removes the selected block', () => {
    const doc = createDoc([{ type: 'paragraph', text: 'Selected' }])
    const state = createMockEditorState(doc, ['blocks', 0])
    const { getByRole } = render(<OutlineTree state={state} />)

    fireEvent.keyDown(getByRole('tree'), { key: 'Delete' })
    expect(state.removeSelected).toHaveBeenCalledTimes(1)
  })

  it('keyboard Alt+ArrowDown reorders', () => {
    const doc = createDoc([
      { type: 'paragraph', text: 'First' },
      { type: 'paragraph', text: 'Second' },
    ])
    const state = createMockEditorState(doc, ['blocks', 0])
    const { getByRole } = render(<OutlineTree state={state} />)

    fireEvent.keyDown(getByRole('tree'), { key: 'ArrowDown', altKey: true })
    expect(state.moveSelected).toHaveBeenCalledWith(1)
  })

  it('Ctrl+D duplicates', () => {
    const doc = createDoc([{ type: 'paragraph', text: 'Original' }])
    const state = createMockEditorState(doc, ['blocks', 0])
    const { getByRole } = render(<OutlineTree state={state} />)

    fireEvent.keyDown(getByRole('tree'), { key: 'd', ctrlKey: true })
    expect(state.duplicateSelected).toHaveBeenCalledTimes(1)
  })

  it('dropping a row between others calls moveBlockTo', () => {
    const doc = createDoc([
      { type: 'paragraph', text: 'First' },
      { type: 'paragraph', text: 'Second' },
    ])
    const state = createMockEditorState(doc)
    const { container, getAllByRole } = render(<OutlineTree state={state} />)

    const rows = getAllByRole('treeitem')
    const dataTransfer = createDataTransferStub()
    fireEvent.dragStart(rows[1]!, { dataTransfer })

    const dropSlot = container.querySelector(
      '[data-drop-list="blocks"][data-drop-index="0"]',
    )!
    expect(dropSlot).not.toBeNull()
    fireEvent.dragOver(dropSlot, { dataTransfer })
    fireEvent.drop(dropSlot, { dataTransfer })

    expect(state.moveBlockTo).toHaveBeenCalledWith(['blocks', 1], ['blocks'], 0)
  })

  it('dropping into its own descendant is ignored', () => {
    const colBlock: ColumnsBlock = {
      type: 'columns',
      columns: [
        { width: '*', blocks: [{ type: 'paragraph', text: 'Child' }] },
      ],
    }
    const doc = createDoc([colBlock])
    const state = createMockEditorState(doc)
    const { container, getAllByRole } = render(<OutlineTree state={state} />)

    const rows = getAllByRole('treeitem')
    const dataTransfer = createDataTransferStub()
    fireEvent.dragStart(rows[0]!, { dataTransfer })

    const nestedSlot = container.querySelector(
      '[data-drop-list="blocks.0.columns.0.blocks"][data-drop-index="0"]',
    )!
    expect(nestedSlot).not.toBeNull()
    fireEvent.dragOver(nestedSlot, { dataTransfer })
    fireEvent.drop(nestedSlot, { dataTransfer })

    expect(state.moveBlockTo).not.toBeNull()
    expect(state.moveBlockTo).not.toHaveBeenCalled()
  })

  it('QuickAdd filters types by text and inserts the chosen type', () => {
    const onInsert = vi.fn()
    const { getByRole, queryByText } = render(<QuickAdd onInsert={onInsert} />)

    const searchInput = getByRole('textbox')
    fireEvent.change(searchInput, { target: { value: 'ตาราง' } })

    expect(queryByText('ข้อความ')).toBeNull()
    expect(queryByText('ตาราง')).not.toBeNull()

    fireEvent.keyDown(searchInput, { key: 'Enter' })
    expect(onInsert).toHaveBeenCalledWith('table')
  })

  it('QuickAdd shows สำเร็จรูป and calls onInsertPreset("itemsTable")', () => {
    const onInsert = vi.fn()
    const onInsertPreset = vi.fn()
    const { getByText, getByRole } = render(
      <QuickAdd onInsert={onInsert} onInsertPreset={onInsertPreset} />,
    )

    expect(getByText('สำเร็จรูป')).not.toBeNull()
    const itemBtn = getByRole('menuitem', { name: 'ตารางรายการพร้อมยอดรวม' })
    fireEvent.click(itemBtn)
    expect(onInsertPreset).toHaveBeenCalledWith('itemsTable')
  })

  it('OutlineTree inserts preset after selected block or at root end when nothing is selected', () => {
    const doc = createDoc([
      { type: 'paragraph', text: 'First' },
      { type: 'paragraph', text: 'Second' },
    ])
    const state = createMockEditorState(doc, ['blocks', 0])
    const { getByRole, rerender } = render(<OutlineTree state={state} />)

    fireEvent.click(getByRole('button', { name: '+ เพิ่ม' }))
    fireEvent.click(getByRole('menuitem', { name: 'บล็อกอนุมัติ 2 ฝั่ง' }))

    expect(state.insertBlocks).toHaveBeenCalledTimes(1)
    expect(state.insertBlocks).toHaveBeenCalledWith(
      ['blocks'],
      1,
      expect.any(Array),
      expect.objectContaining({ left: expect.any(Object), right: expect.any(Object) }),
    )

    // When nothing is selected, inserts at the end of root blocks (index 2)
    const stateUnselected = createMockEditorState(doc, null)
    rerender(<OutlineTree state={stateUnselected} />)
    fireEvent.click(getByRole('button', { name: '+ เพิ่ม' }))
    fireEvent.click(getByRole('menuitem', { name: 'ตารางรายการพร้อมยอดรวม' }))

    expect(stateUnselected.insertBlocks).toHaveBeenCalledTimes(1)
    expect(stateUnselected.insertBlocks).toHaveBeenCalledWith(
      ['blocks'],
      2,
      expect.any(Array),
      expect.objectContaining({ items: expect.any(Array), total: 2150 }),
    )
  })

  it('unresolved binding shows a warning dot', () => {
    const doc = createDoc([{ type: 'paragraph', text: 'Hello {{missing}}' }])
    const state = createMockEditorState(doc, null, [
      { blockPath: ['blocks', 0], field: 'text', expr: 'missing', path: 'missing' },
    ])
    const { getByLabelText } = render(<OutlineTree state={state} />)

    expect(getByLabelText('Unresolved binding')).not.toBeNull()
  })
})
