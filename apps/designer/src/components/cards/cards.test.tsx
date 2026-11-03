import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import type { Block, DocumentDef, ColumnsBlock } from '@apw-pdf/core'
import type { EditorState } from '../../editor/useEditorState.js'
import type { Binding } from '../../editor/bindings.js'
import type { BlockPath } from '../../editor/docModel.js'
import { BlockCard } from './BlockCard.js'
import { InsertLine } from './InsertLine.js'
import { DocumentView } from './DocumentView.js'

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

describe('card framework', () => {
  it('DocumentView shows the empty state and the picker adds a text block', () => {
    const doc = createDoc([])
    const state = createMockEditorState(doc)
    const { getByText } = render(
      <DocumentView
        state={state}
        renderCard={(path, block) => (
          <BlockCard key={path.join('.')} path={path} state={state}>
            <span>{block.type}</span>
          </BlockCard>
        )}
      />,
    )

    expect(getByText('เริ่มต้นด้วยการเพิ่มบล็อกแรก')).not.toBeNull()
    fireEvent.click(getByText('ข้อความ'))
    expect(state.addBlock).toHaveBeenCalledWith(['blocks'], 0, 'paragraph')
  })

  it('InsertLine inserts a block of the picked type at its index', () => {
    const onPick = vi.fn()
    const { getByRole, getByText } = render(<InsertLine onPick={onPick} />)

    fireEvent.click(getByRole('button', { name: /เพิ่มบล็อก/i }))
    fireEvent.click(getByText('ตาราง'))
    expect(onPick).toHaveBeenCalledWith('table')
  })

  it('BlockCard up/down buttons move the block and keep their aria-labels', () => {
    const doc = createDoc([
      { type: 'paragraph', text: 'A' },
      { type: 'paragraph', text: 'B' },
    ])
    const state = createMockEditorState(doc, ['blocks', 0])
    const { getByLabelText } = render(
      <BlockCard path={['blocks', 0]} state={state}>
        <div>Content A</div>
      </BlockCard>,
    )

    const upBtn = getByLabelText('Move up') as HTMLButtonElement
    const downBtn = getByLabelText('Move down') as HTMLButtonElement
    expect(upBtn.disabled).toBe(true)
    expect(downBtn.disabled).toBe(false)

    fireEvent.click(downBtn)
    expect(state.select).toHaveBeenCalledWith(['blocks', 0])
    expect(state.moveSelected).toHaveBeenCalledWith(1)
  })

  it('BlockCard menu Delete removes the block', () => {
    const doc = createDoc([{ type: 'paragraph', text: 'Delete me' }])
    const state = createMockEditorState(doc, ['blocks', 0])
    const { getByRole, getByLabelText } = render(
      <BlockCard path={['blocks', 0]} state={state}>
        <div>Delete me</div>
      </BlockCard>,
    )

    const menuTrigger = getByRole('button', { name: /ตัวเลือกบล็อก|More/i })
    fireEvent.click(menuTrigger)

    const deleteItem = getByLabelText('Delete')
    fireEvent.click(deleteItem)
    expect(state.select).toHaveBeenCalledWith(['blocks', 0])
    expect(state.removeSelected).toHaveBeenCalledTimes(1)
  })

  it('BlockCard shows a warning chip for an unresolved variable', () => {
    const doc = createDoc([{ type: 'paragraph', text: 'Hello {{missing}}' }])
    const state = createMockEditorState(doc, null, [
      { blockPath: ['blocks', 0], field: 'text', expr: 'missing', path: 'missing' },
    ])
    const { getByText } = render(
      <BlockCard path={['blocks', 0]} state={state}>
        <div>Body</div>
      </BlockCard>,
    )

    expect(getByText(/missing/)).not.toBeNull()
  })

  it('dropping a card on another list position calls moveBlockTo', () => {
    const doc = createDoc([
      { type: 'paragraph', text: 'First' },
      { type: 'paragraph', text: 'Second' },
    ])
    const state = createMockEditorState(doc)
    const { container, getAllByLabelText } = render(
      <DocumentView
        state={state}
        renderCard={(path, block) => (
          <BlockCard key={path.join('.')} path={path} state={state}>
            <span>{(block as { text?: string }).text}</span>
          </BlockCard>
        )}
      />,
    )

    const handles = getAllByLabelText('ลากเพื่อย้าย')
    const dataTransfer = createDataTransferStub()
    fireEvent.dragStart(handles[1]!, { dataTransfer })

    const dropSlots = container.querySelectorAll('[data-drop-index]')
    expect(dropSlots.length).toBeGreaterThan(0)
    fireEvent.dragOver(dropSlots[0]!, { dataTransfer })
    fireEvent.drop(dropSlots[0]!, { dataTransfer })

    expect(state.moveBlockTo).toHaveBeenCalledWith(['blocks', 1], ['blocks'], 0)
  })

  it('dropping a card into its own descendant is ignored', () => {
    const colBlock: ColumnsBlock = {
      type: 'columns',
      columns: [
        { width: '*', blocks: [{ type: 'paragraph', text: 'Child' }] },
      ],
    }
    const doc = createDoc([colBlock])
    const state = createMockEditorState(doc)
    const nestedListPath: BlockPath = ['blocks', 0, 'columns', 0, 'blocks']

    const renderBlockCard = (path: BlockPath, block: Block): React.ReactNode => (
      <BlockCard
        key={path.join('.')}
        path={path}
        state={state}
        renderNested={
          block.type === 'columns' ? (
            <DocumentView
              state={state}
              listPath={nestedListPath}
              renderCard={renderBlockCard}
            />
          ) : undefined
        }
      >
        <div>{block.type}</div>
      </BlockCard>
    )

    const { container, getAllByLabelText } = render(
      <DocumentView state={state} renderCard={renderBlockCard} />,
    )

    const handles = getAllByLabelText('ลากเพื่อย้าย')
    const dataTransfer = createDataTransferStub()
    fireEvent.dragStart(handles[0]!, { dataTransfer })

    const nestedDropSlot = container.querySelector(
      '.doc-view--nested [data-drop-index="0"]',
    )
    expect(nestedDropSlot).not.toBeNull()
    fireEvent.dragOver(nestedDropSlot!, { dataTransfer })
    fireEvent.drop(nestedDropSlot!, { dataTransfer })

    expect(state.moveBlockTo).not.toHaveBeenCalled()
  })
})
