import React, { useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import type {
  Block,
  DocumentDef,
  ParagraphBlock,
  SignatureBlock,
  ColumnsBlock,
  EachBlock,
  IfBlock,
} from '@apw-pdf/core'
import { useEditorState, type EditorState } from '../../editor/useEditorState.js'
import { getBlock, type BlockPath } from '../../editor/docModel.js'
import { PropertiesPanel } from './PropertiesPanel.js'
import { DocumentSettings } from './DocumentSettings.js'
import { ParagraphProps } from './types/ParagraphProps.js'
import { SignatureProps } from './types/SignatureProps.js'
import { ColumnsProps } from './types/ColumnsProps.js'
import { RepeatProps } from './types/RepeatProps.js'
import { ConditionProps } from './types/ConditionProps.js'
import { JsonProps } from './types/JsonProps.js'

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
      if (path.length === 0) {
        state.doc = block as unknown as DocumentDef
        return
      }
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
const FIRST_BLOCK_PATH: BlockPath = ['blocks', 0]

function StatefulParagraphHarness({
  initialBlock,
  data = EMPTY_DATA,
  onChange,
}: {
  initialBlock: ParagraphBlock
  data?: unknown
  onChange: (next: { doc: DocumentDef; data: unknown }) => void
}) {
  const [initial] = useState(() => ({ doc: createDoc([initialBlock]), data }))
  const state = useEditorState(initial, onChange)
  const current =
    (getBlock(state.doc, FIRST_BLOCK_PATH) as ParagraphBlock) ?? initialBlock
  return <ParagraphProps block={current} path={FIRST_BLOCK_PATH} state={state} />
}

describe('PropertiesPanel and block property editors', () => {
  it('PropertiesPanel shows document settings when nothing is selected', () => {
    const state = createMockEditorState({ blocks: [] }, null)
    const { getByLabelText, getByText } = render(
      <PropertiesPanel state={state} onOpenTableEditor={vi.fn()} />,
    )

    expect(getByText('ตั้งค่าเอกสาร')).not.toBeNull()
    expect(getByLabelText('Page size')).not.toBeNull()
    expect(getByLabelText('Font size')).not.toBeNull()
  })

  it('DocumentSettings changes font size via applyPageSettings', () => {
    const state = createMockEditorState({ blocks: [] }, null)
    const onChange = vi.fn()
    const { getByLabelText } = render(
      <DocumentSettings state={state} onChange={onChange} />,
    )

    const fontSizeInput = getByLabelText('Font size') as HTMLInputElement
    expect(fontSizeInput.value).toBe('16pt')

    fireEvent.change(fontSizeInput, { target: { value: '18pt' } })

    expect(state.doc.font.size).toBe('18pt')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0]![0].font.size).toBe('18pt')
  })

  it('ParagraphProps edits text and variable picker inserts {{path}}', () => {
    const onChange = vi.fn()
    const initialBlock: ParagraphBlock = { type: 'paragraph', text: 'เรียน ' }
    const data = { recipient: 'ผู้อำนวยการ', date: '2026-11-03' }

    const { getByLabelText, getByRole, getByText } = render(
      <StatefulParagraphHarness
        initialBlock={initialBlock}
        data={data}
        onChange={onChange}
      />,
    )

    const textInput = getByLabelText('Paragraph text') as HTMLTextAreaElement
    fireEvent.change(textInput, { target: { value: 'เรียน ท่าน' } })
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        doc: expect.objectContaining({
          blocks: [{ type: 'paragraph', text: 'เรียน ท่าน' }],
        }),
      }),
    )

    const pickerBtn = getByRole('button', { name: '{ } ตัวแปร' })
    fireEvent.click(pickerBtn)

    const pathOption = getByText('recipient')
    fireEvent.click(pathOption)

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        doc: expect.objectContaining({
          blocks: [{ type: 'paragraph', text: 'เรียน ท่าน{{recipient}}' }],
        }),
      }),
    )
  })

  it('ParagraphProps hides unset optional properties and AddProperty reveals indentLeft', () => {
    const block: ParagraphBlock = { type: 'paragraph', text: 'Hello' }
    const state = createMockEditorState({ blocks: [block] }, ['blocks', 0])

    const { queryByLabelText, getByRole, getByText } = render(
      <ParagraphProps block={block} path={['blocks', 0]} state={state} />,
    )

    expect(queryByLabelText('Left indent')).toBeNull()
    expect(queryByLabelText('Space before')).toBeNull()

    const addPropBtn = getByRole('button', { name: '+ เพิ่มคุณสมบัติ' })
    fireEvent.click(addPropBtn)

    const indentLeftOption = getByText('indentLeft')
    fireEvent.click(indentLeftOption)

    const indentInput = queryByLabelText('Left indent') as HTMLInputElement | null
    expect(indentInput).not.toBeNull()
    expect(indentInput!.getAttribute('inputmode')).toBe('decimal')
    expect('indentLeft' in (state.doc.blocks[0] as Record<string, unknown>)).toBe(false)

    fireEvent.change(indentInput!, { target: { value: '2' } })
    expect(state.updateBlock).toHaveBeenCalledWith(['blocks', 0], {
      indentLeft: '2cm',
    })
  })

  it('ParagraphProps spaceBefore shows number 6 + unit pt for spaceBefore: 6pt and picking cm writes 0.21cm to the block', () => {
    const onChange = vi.fn()
    const initialBlock: ParagraphBlock = {
      type: 'paragraph',
      text: 'Spaced text',
      spaceBefore: '6pt',
    }

    const { getByLabelText } = render(
      <StatefulParagraphHarness initialBlock={initialBlock} onChange={onChange} />,
    )

    const numInput = getByLabelText('Space before') as HTMLInputElement
    const unitSelect = getByLabelText('Space before unit') as HTMLSelectElement

    expect(numInput.value).toBe('6')
    expect(unitSelect.value).toBe('pt')

    fireEvent.change(unitSelect, { target: { value: 'cm' } })

    expect(numInput.value).toBe('0.21')
    expect(unitSelect.value).toBe('cm')
    expect(onChange).toHaveBeenCalledTimes(1)
    const savedBlock = onChange.mock.calls[0]![0].doc.blocks[0] as ParagraphBlock
    expect(savedBlock.spaceBefore).toBe('0.21cm')
  })

  it('ParagraphProps reset removes the key from the block', () => {
    const onChange = vi.fn()
    const initialBlock: ParagraphBlock = {
      type: 'paragraph',
      text: 'Indented text',
      indentLeft: '1.5cm',
    }

    const { queryByLabelText, getByLabelText } = render(
      <StatefulParagraphHarness initialBlock={initialBlock} onChange={onChange} />,
    )

    expect(queryByLabelText('Left indent')).not.toBeNull()

    const resetBtn = getByLabelText(/Reset.*indentLeft/i)
    fireEvent.click(resetBtn)

    expect(queryByLabelText('Left indent')).toBeNull()
    expect(onChange).toHaveBeenCalledTimes(1)
    const savedBlock = onChange.mock.calls[0]![0].doc.blocks[0] as Record<
      string,
      unknown
    >
    expect('indentLeft' in savedBlock).toBe(false)
  })

  it('ParagraphProps sets align thaiDistributed', () => {
    const block: ParagraphBlock = { type: 'paragraph', text: 'สวัสดี' }
    const state = createMockEditorState({ blocks: [block] }, ['blocks', 0])

    const { getByLabelText } = render(
      <ParagraphProps block={block} path={['blocks', 0]} state={state} />,
    )

    const alignSelect = getByLabelText('Align')
    fireEvent.change(alignSelect, { target: { value: 'thaiDistributed' } })

    expect(state.updateBlock).toHaveBeenCalledWith(['blocks', 0], {
      align: 'thaiDistributed',
    })
  })

  it('SignatureProps edits name and positions', () => {
    const block: SignatureBlock = { type: 'signature', name: 'สมชาย ใจดี' }
    const state = createMockEditorState({ blocks: [block] }, ['blocks', 0])

    const { getByLabelText } = render(
      <SignatureProps block={block} path={['blocks', 0]} state={state} />,
    )

    const nameInput = getByLabelText('Signature name')
    fireEvent.change(nameInput, { target: { value: 'สมหญิง ใจดี' } })
    expect(state.updateBlock).toHaveBeenCalledWith(['blocks', 0], {
      name: 'สมหญิง ใจดี',
    })

    const posInput = getByLabelText('Signature positions')
    fireEvent.change(posInput, {
      target: { value: 'ผู้อำนวยการ\nสำนักยุทธศาสตร์' },
    })
    expect(state.updateBlock).toHaveBeenCalledWith(['blocks', 0], {
      positions: ['ผู้อำนวยการ', 'สำนักยุทธศาสตร์'],
    })
  })

  it('ColumnsProps adds and removes a column', () => {
    const block: ColumnsBlock = {
      type: 'columns',
      columns: [
        { width: '*', blocks: [] },
        { width: '*', blocks: [] },
      ],
    }
    const state = createMockEditorState({ blocks: [block] }, ['blocks', 0])

    const { getByRole, getByLabelText, rerender } = render(
      <ColumnsProps block={block} path={['blocks', 0]} state={state} />,
    )

    const addBtn = getByRole('button', { name: 'Add column' })
    fireEvent.click(addBtn)
    expect(state.updateBlock).toHaveBeenCalledWith(['blocks', 0], {
      columns: [
        { width: '*', blocks: [] },
        { width: '*', blocks: [] },
        { width: '*', blocks: [] },
      ],
    })

    const updatedBlock = state.doc.blocks[0] as ColumnsBlock
    rerender(
      <ColumnsProps block={updatedBlock} path={['blocks', 0]} state={state} />,
    )

    const removeBtn = getByLabelText('Remove column 3')
    fireEvent.click(removeBtn)
    expect((state.doc.blocks[0] as ColumnsBlock).columns.length).toBe(2)
  })

  it('RepeatProps edits of and as with identifier validation', () => {
    const block: EachBlock = {
      type: 'each',
      of: 'items',
      as: 'item',
      blocks: [],
    }
    const state = createMockEditorState({ blocks: [block] }, ['blocks', 0])

    const { getByLabelText, queryByRole } = render(
      <RepeatProps block={block} path={['blocks', 0]} state={state} />,
    )

    const ofInput = getByLabelText('Array path')
    fireEvent.change(ofInput, { target: { value: 'invoice.lines' } })
    expect(state.updateBlock).toHaveBeenCalledWith(['blocks', 0], {
      of: 'invoice.lines',
    })

    ;(state.updateBlock as any).mockClear()
    const asInput = getByLabelText('Variable name')
    fireEvent.change(asInput, { target: { value: 'invalid-name' } })
    expect(queryByRole('alert')).not.toBeNull()
    expect(state.updateBlock).not.toHaveBeenCalled()

    fireEvent.change(asInput, { target: { value: 'lineItem' } })
    expect(queryByRole('alert')).toBeNull()
    expect(state.updateBlock).toHaveBeenCalledWith(['blocks', 0], {
      as: 'lineItem',
    })
  })

  it('ConditionProps edits test', () => {
    const block: IfBlock = {
      type: 'if',
      test: 'active',
      then: [],
    }
    const state = createMockEditorState({ blocks: [block] }, ['blocks', 0])

    const { getByLabelText } = render(
      <ConditionProps block={block} path={['blocks', 0]} state={state} />,
    )

    const testInput = getByLabelText('Test expression')
    fireEvent.change(testInput, { target: { value: 'active && total > 0' } })
    expect(state.updateBlock).toHaveBeenCalledWith(['blocks', 0], {
      test: 'active && total > 0',
    })
  })

  it('JsonProps applies valid JSON and shows issues for invalid', () => {
    const block: ParagraphBlock = { type: 'paragraph', text: 'Original' }
    const state = createMockEditorState({ blocks: [block] }, ['blocks', 0])

    const { getByLabelText, getByRole, queryByRole } = render(
      <JsonProps block={block} path={['blocks', 0]} state={state} />,
    )

    const textarea = getByLabelText('Block JSON')
    const applyBtn = getByRole('button', { name: 'Apply' })

    fireEvent.change(textarea, { target: { value: '{"type": "not_a_block"}' } })
    fireEvent.click(applyBtn)
    expect(queryByRole('alert')).not.toBeNull()
    expect(state.replaceBlock).not.toHaveBeenCalled()

    fireEvent.change(textarea, {
      target: { value: '{"type": "paragraph", "text": "Updated JSON"}' },
    })
    fireEvent.click(applyBtn)
    expect(queryByRole('alert')).toBeNull()
    expect(state.replaceBlock).toHaveBeenCalledWith(['blocks', 0], {
      type: 'paragraph',
      text: 'Updated JSON',
    })
  })

  it('unknown block type renders JsonProps', () => {
    const unknownBlock = {
      type: 'customWidget',
      foo: 'bar',
    } as unknown as Block
    const state = createMockEditorState(
      { blocks: [unknownBlock] },
      ['blocks', 0],
    )

    const { getByLabelText, getByRole } = render(
      <PropertiesPanel state={state} onOpenTableEditor={vi.fn()} />,
    )

    const textarea = getByLabelText('Block JSON') as HTMLTextAreaElement
    expect(textarea.value).toContain('customWidget')
    expect(getByRole('button', { name: 'Apply' })).not.toBeNull()
  })
})
