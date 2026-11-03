import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import type {
  DocumentDef,
  ParagraphBlock,
  TableBlock,
  ColumnsBlock,
  IfBlock,
} from '@apw-pdf/core'
import type { EditorState } from '../../editor/useEditorState.js'
import type { BlockPath } from '../../editor/docModel.js'
import { ParagraphInspector } from './ParagraphInspector.js'
import { TableInspector } from './TableInspector.js'
import { ColumnsInspector } from './ColumnsInspector.js'
import { EachIfInspector } from './EachIfInspector.js'
import { GenericJsonInspector } from './GenericJsonInspector.js'
import { Inspector } from '../Inspector.js'

afterEach(() => {
  cleanup()
})

function createMockEditorState(
  docPartial: Partial<DocumentDef> = {},
  selectedPath: BlockPath | null = null,
): EditorState {
  const doc: DocumentDef = {
    version: 1,
    page: { size: 'A4', margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' } },
    font: { family: 'Sarabun', size: '16pt' },
    blocks: [],
    ...docPartial,
  }
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
    duplicateSelected: vi.fn(),
    updateBlock: vi.fn(),
    replaceBlock: vi.fn(),
    setData: vi.fn(),
    warnings: [],
  }
}

describe('Inspectors', () => {
  it('ParagraphInspector edits text and updates the block', () => {
    const block: ParagraphBlock = { type: 'paragraph', text: 'Hello' }
    const state = createMockEditorState({ blocks: [block] }, ['blocks', 0])
    const { getByLabelText } = render(
      <ParagraphInspector block={block} path={['blocks', 0]} state={state} />,
    )
    const input = getByLabelText(/Paragraph text|Text/i)
    fireEvent.change(input, { target: { value: 'Hello world' } })
    expect(state.updateBlock).toHaveBeenCalledWith(['blocks', 0], { text: 'Hello world' })
  })

  it('ParagraphInspector sets align to thaiDistributed', () => {
    const block: ParagraphBlock = { type: 'paragraph', text: 'Hello' }
    const state = createMockEditorState({ blocks: [block] }, ['blocks', 0])
    const { getByLabelText } = render(
      <ParagraphInspector block={block} path={['blocks', 0]} state={state} />,
    )
    const select = getByLabelText(/Align/i)
    fireEvent.change(select, { target: { value: 'thaiDistributed' } })
    expect(state.updateBlock).toHaveBeenCalledWith(['blocks', 0], { align: 'thaiDistributed' })
  })

  it('TableInspector adds a column', () => {
    const block: TableBlock = {
      type: 'table',
      columns: [{ width: '*' }, { width: '*' }],
      rows: [[{ text: 'A' }, { text: 'B' }]],
    }
    const state = createMockEditorState({ blocks: [block] }, ['blocks', 0])
    const { getByRole } = render(
      <TableInspector block={block} path={['blocks', 0]} state={state} />,
    )
    const addBtn = getByRole('button', { name: /Add column/i })
    fireEvent.click(addBtn)
    expect(state.updateBlock).toHaveBeenCalledTimes(1)
    const patch = (state.updateBlock as any).mock.calls[0][1]
    expect(patch.columns).toHaveLength(3)
  })

  it('TableInspector switches to each rows with an array path and a valid as', () => {
    const block: TableBlock = {
      type: 'table',
      columns: [{ width: '*' }],
      rows: [[{ text: 'A' }]],
    }
    const state = createMockEditorState({ blocks: [block] }, ['blocks', 0])
    const { getByLabelText } = render(
      <TableInspector block={block} path={['blocks', 0]} state={state} />,
    )
    const modeSelect = getByLabelText(/Body mode/i)
    fireEvent.change(modeSelect, { target: { value: 'each' } })

    const eachInput = getByLabelText(/Each array path/i)
    fireEvent.change(eachInput, { target: { value: 'items' } })

    const asInput = getByLabelText(/Loop variable \(as\)/i)
    fireEvent.change(asInput, { target: { value: 'item' } })

    expect(state.updateBlock).toHaveBeenCalledWith(
      ['blocks', 0],
      expect.objectContaining({
        rows: expect.objectContaining({
          each: 'items',
          as: 'item',
        }),
      }),
    )
  })

  it('TableInspector rejects an invalid as identifier', () => {
    const block: TableBlock = {
      type: 'table',
      columns: [{ width: '*' }],
      rows: { each: 'items', as: 'item', cells: [{ text: 'Cell' }] },
    }
    const state = createMockEditorState({ blocks: [block] }, ['blocks', 0])
    const { getByLabelText, getByText } = render(
      <TableInspector block={block} path={['blocks', 0]} state={state} />,
    )
    const asInput = getByLabelText(/Loop variable \(as\)/i)
    fireEvent.change(asInput, { target: { value: 'invalid-id' } })
    expect(getByText(/Invalid/i)).not.toBeNull()
    expect(state.updateBlock).not.toHaveBeenCalledWith(
      ['blocks', 0],
      expect.objectContaining({
        rows: expect.objectContaining({ as: 'invalid-id' }),
      }),
    )
  })

  it('TableInspector converts a text cell to blocks keeping the text', () => {
    const block: TableBlock = {
      type: 'table',
      columns: [{ width: '*' }],
      rows: [[{ text: 'Hello Cell' }]],
    }
    const state = createMockEditorState({ blocks: [block] }, ['blocks', 0])
    const { getByRole } = render(
      <TableInspector block={block} path={['blocks', 0]} state={state} />,
    )
    const convertBtn = getByRole('button', { name: /Convert cell to blocks/i })
    fireEvent.click(convertBtn)
    expect(state.updateBlock).toHaveBeenCalledTimes(1)
    const patch = (state.updateBlock as any).mock.calls[0][1]
    expect(patch.rows[0][0].blocks).toEqual([{ type: 'paragraph', text: 'Hello Cell' }])
    expect(patch.rows[0][0].text).toBeUndefined()
  })

  it('ColumnsInspector adds a column', () => {
    const block: ColumnsBlock = {
      type: 'columns',
      columns: [
        { width: '*', blocks: [] },
        { width: '*', blocks: [] },
      ],
    }
    const state = createMockEditorState({ blocks: [block] }, ['blocks', 0])
    const { getByRole } = render(
      <ColumnsInspector block={block} path={['blocks', 0]} state={state} />,
    )
    const addBtn = getByRole('button', { name: /Add column/i })
    fireEvent.click(addBtn)
    expect(state.updateBlock).toHaveBeenCalledTimes(1)
    const patch = (state.updateBlock as any).mock.calls[0][1]
    expect(patch.columns).toHaveLength(3)
  })

  it('EachIfInspector edits if.test', () => {
    const block: IfBlock = {
      type: 'if',
      test: 'active',
      then: [],
    }
    const state = createMockEditorState({ blocks: [block] }, ['blocks', 0])
    const { getByLabelText } = render(
      <EachIfInspector block={block} path={['blocks', 0]} state={state} />,
    )
    const testInput = getByLabelText(/Test expression|Test/i)
    fireEvent.change(testInput, { target: { value: 'active && count > 0' } })
    expect(state.updateBlock).toHaveBeenCalledWith(['blocks', 0], {
      test: 'active && count > 0',
    })
  })

  it('GenericJsonInspector applies valid JSON and shows issues for invalid', () => {
    const block: ParagraphBlock = { type: 'paragraph', text: 'Original' }
    const state = createMockEditorState({ blocks: [block] }, ['blocks', 0])
    const { getByLabelText, getByRole, getByText } = render(
      <GenericJsonInspector block={block} path={['blocks', 0]} state={state} />,
    )
    const textarea = getByLabelText(/Block JSON/i)
    const applyBtn = getByRole('button', { name: /Apply/i })

    // Invalid JSON / Schema
    fireEvent.change(textarea, { target: { value: '{"type": "unknown_type"}' } })
    fireEvent.click(applyBtn)
    expect(getByText(/Invalid/i)).not.toBeNull()
    expect(state.replaceBlock).not.toHaveBeenCalled()

    // Valid JSON
    fireEvent.change(textarea, { target: { value: '{"type": "paragraph", "text": "New valid"}' } })
    fireEvent.click(applyBtn)
    expect(state.replaceBlock).toHaveBeenCalledWith(['blocks', 0], {
      type: 'paragraph',
      text: 'New valid',
    })
  })

  it('Inspector shows the hint when nothing is selected', () => {
    const state = createMockEditorState({ blocks: [] }, null)
    const { getByText } = render(<Inspector state={state} />)
    expect(getByText(/Select a block/i)).not.toBeNull()
  })
})
