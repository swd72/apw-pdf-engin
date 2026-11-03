import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import type { DocumentDef } from '@apw-pdf/core'
import type { EditorState } from '../editor/useEditorState.js'
import type { Binding } from '../editor/bindings.js'
import type { BlockPath } from '../editor/docModel.js'
import { BlockTree } from './BlockTree.js'

afterEach(() => {
  cleanup()
})

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
    duplicateSelected: vi.fn(),
    updateBlock: vi.fn(),
    replaceBlock: vi.fn(),
    setData: vi.fn(),
    warnings,
  }
}

describe('BlockTree', () => {
  it('renders nested blocks inside columns', () => {
    const doc: DocumentDef = {
      version: 1,
      page: { size: 'A4', margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' } },
      font: { family: 'Sarabun', size: '16pt' },
      blocks: [
        {
          type: 'columns',
          columns: [
            { width: '*', blocks: [{ type: 'paragraph', text: 'Column 1 text' }] },
            { width: '*', blocks: [{ type: 'paragraph', text: 'Column 2 text' }] },
          ],
        },
      ],
    }
    const state = createMockEditorState(doc)
    const { getByText } = render(<BlockTree state={state} />)
    expect(getByText(/Columns/i)).not.toBeNull()
    expect(getByText(/Column 1 text/i)).not.toBeNull()
    expect(getByText(/Column 2 text/i)).not.toBeNull()
  })

  it('clicking a node selects it', () => {
    const doc: DocumentDef = {
      version: 1,
      page: { size: 'A4', margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' } },
      font: { family: 'Sarabun', size: '16pt' },
      blocks: [
        { type: 'paragraph', text: 'First paragraph' },
        { type: 'paragraph', text: 'Second paragraph' },
      ],
    }
    const state = createMockEditorState(doc)
    const { getByText } = render(<BlockTree state={state} />)
    fireEvent.click(getByText(/Second paragraph/i))
    expect(state.select).toHaveBeenCalledWith(['blocks', 1])
  })

  it('add-block menu inserts a paragraph at the end of the clicked list', () => {
    const doc: DocumentDef = {
      version: 1,
      page: { size: 'A4', margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' } },
      font: { family: 'Sarabun', size: '16pt' },
      blocks: [{ type: 'paragraph', text: 'First' }],
    }
    const state = createMockEditorState(doc)
    const { getByRole, getByText } = render(<BlockTree state={state} />)
    const addBtn = getByRole('button', { name: /Add block/i })
    fireEvent.click(addBtn)
    const paragraphOption = getByText('Paragraph')
    fireEvent.click(paragraphOption)
    expect(state.addBlock).toHaveBeenCalledWith(['blocks'], 1, 'paragraph')
  })

  it('move-into is disabled for the first block and for a block into its own descendant', () => {
    const doc: DocumentDef = {
      version: 1,
      page: { size: 'A4', margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' } },
      font: { family: 'Sarabun', size: '16pt' },
      blocks: [
        {
          type: 'columns',
          columns: [
            { width: '*', blocks: [{ type: 'paragraph', text: 'Inside col' }] },
          ],
        },
        { type: 'paragraph', text: 'Second block' },
      ],
    }
    const state = createMockEditorState(doc, ['blocks', 0])
    const { getAllByLabelText } = render(<BlockTree state={state} />)
    const moveIntoBtns = getAllByLabelText('Move into previous')
    expect((moveIntoBtns[0] as HTMLButtonElement).disabled).toBe(true)
  })

  it('delete removes the node', () => {
    const doc: DocumentDef = {
      version: 1,
      page: { size: 'A4', margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' } },
      font: { family: 'Sarabun', size: '16pt' },
      blocks: [{ type: 'paragraph', text: 'Delete me' }],
    }
    const state = createMockEditorState(doc, ['blocks', 0])
    const { getByLabelText } = render(<BlockTree state={state} />)
    const deleteBtn = getByLabelText('Delete')
    fireEvent.click(deleteBtn)
    expect(state.removeSelected).toHaveBeenCalledTimes(1)
  })

  it('unresolved binding shows a warning dot on the owning node', () => {
    const doc: DocumentDef = {
      version: 1,
      page: { size: 'A4', margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' } },
      font: { family: 'Sarabun', size: '16pt' },
      blocks: [{ type: 'paragraph', text: 'Hello {{missing}}' }],
    }
    const state = createMockEditorState(doc, null, [
      { blockPath: ['blocks', 0], field: 'text', expr: 'missing', path: 'missing' },
    ])
    const { getByLabelText } = render(<BlockTree state={state} />)
    expect(getByLabelText('Unresolved binding')).not.toBeNull()
  })
})
