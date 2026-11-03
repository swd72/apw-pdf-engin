// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import type { Block, DocumentDef, PageInfo, TableBlock } from '@apw-pdf/core'
import { useEditorState, type EditorState } from '../../editor/useEditorState.js'
import type { BlockPath } from '../../editor/docModel.js'
import { resolveSelection } from './sourcePath.js'
import { editTarget } from './InlineTextEditor.js'
import { StageOverlay } from './StageOverlay.js'

afterEach(() => {
  cleanup()
})

function createDoc(
  blocks: Block[],
  fontSize: string = '16pt',
): DocumentDef {
  return {
    version: 1,
    page: {
      size: 'A4',
      margin: { top: '2cm', bottom: '2cm', left: '3cm', right: '2cm' },
    },
    font: { family: 'Sarabun', size: fontSize },
    blocks,
  }
}

const SAMPLE_DATA: Record<string, unknown> = {
  subject: 'เรื่องทดสอบ',
  author: { name: 'สมชาย' },
}
const NOOP = () => {}

function InlineHarness({
  initialDoc,
  data = SAMPLE_DATA,
  page,
  scale = 1,
  initialSelected = null,
  onFocusProperties,
  onState,
}: {
  initialDoc: DocumentDef
  data?: unknown
  page: PageInfo
  scale?: number
  initialSelected?: BlockPath | null
  onFocusProperties?: () => void
  onState?: (s: EditorState) => void
}) {
  const initial = React.useMemo(
    () => ({ doc: initialDoc, data }),
    [initialDoc, data],
  )
  const editor = useEditorState(initial, NOOP)
  const initializedRef = React.useRef(false)
  React.useEffect(() => {
    if (!initializedRef.current && initialSelected) {
      initializedRef.current = true
      editor.select(initialSelected)
    }
  }, [editor, initialSelected])
  onState?.(editor)

  return (
    <StageOverlay
      pageIndex={0}
      scale={scale}
      page={page}
      editor={editor}
      onFocusProperties={onFocusProperties}
    />
  )
}

describe('editTarget and InlineTextEditor on StageOverlay', () => {
  it('editTarget resolves plain-text paragraphs and plain-text table cells, and returns null for runs/other blocks', () => {
    const doc = createDoc([
      { type: 'paragraph', text: 'ข้อความ {{subject}}' },
      { type: 'paragraph', runs: [{ text: 'ตัวหนา', bold: true }] },
      { type: 'image', src: 'asset:garuda' },
      {
        type: 'table',
        columns: [{ width: '50%' }, { width: '50%' }],
        rows: [
          [
            { text: 'เซลล์ข้อความ' },
            { blocks: [{ type: 'paragraph', text: 'บล็อกในเซลล์' }] },
          ],
        ],
      },
    ])

    expect(editTarget(doc, resolveSelection(doc, 'blocks[0]'))).toEqual({
      kind: 'paragraph',
      path: ['blocks', 0],
      text: 'ข้อความ {{subject}}',
    })

    expect(editTarget(doc, resolveSelection(doc, 'blocks[1]'))).toBeNull()
    expect(editTarget(doc, resolveSelection(doc, 'blocks[2]'))).toBeNull()

    expect(
      editTarget(doc, resolveSelection(doc, 'blocks[3].rows[0][0]')),
    ).toEqual({
      kind: 'cell',
      tablePath: ['blocks', 3],
      cellPath: ['blocks', 3, 'rows', 0, 0],
      text: 'เซลล์ข้อความ',
    })

    expect(
      editTarget(doc, resolveSelection(doc, 'blocks[3].rows[0][1]')),
    ).toBeNull()
  })

  it('double-click paragraph box opens textarea with raw {{ }} text, positioned at scaled box and scaled font size', () => {
    const doc = createDoc(
      [
        { type: 'paragraph', text: 'เรื่อง {{subject}}' },
        {
          type: 'paragraph',
          text: 'หัวข้อใหญ่',
          font: { size: '20pt' },
        },
      ],
      '16pt',
    )
    const page: PageInfo = {
      width: 595,
      height: 842,
      content: { x: 85, y: 56, w: 453, h: 730 },
      boxes: [
        { path: 'blocks[0]', x: 85, y: 60, w: 453, h: 24 },
        { path: 'blocks[1]', x: 85, y: 100, w: 453, h: 30 },
      ],
    }

    const { container, getByLabelText, unmount } = render(
      <InlineHarness initialDoc={doc} page={page} scale={1.5} />,
    )

    const box0 = container.querySelector<HTMLElement>(
      '[data-block-path="blocks.0"]',
    )!
    fireEvent.doubleClick(box0)

    const textarea = getByLabelText('แก้ไขข้อความ') as HTMLTextAreaElement
    expect(textarea.value).toBe('เรื่อง {{subject}}')
    expect(textarea.style.left).toBe(`${85 * 1.5}px`)
    expect(textarea.style.top).toBe(`${60 * 1.5}px`)
    expect(textarea.style.width).toBe(`${453 * 1.5}px`)
    expect(textarea.style.minHeight).toBe(`${24 * 1.5}px`)
    expect(textarea.style.fontSize).toBe(`${16 * 1.5}px`)
    // Toolbar is hidden while inline editing
    expect(container.querySelector('.stage-toolbar')).toBeNull()

    unmount()

    // Check paragraph with explicit block font size (20pt * 1.5 = 30px)
    const second = render(
      <InlineHarness initialDoc={doc} page={page} scale={1.5} />,
    )
    const box1 = second.container.querySelector<HTMLElement>(
      '[data-block-path="blocks.1"]',
    )!
    fireEvent.doubleClick(box1)
    const textarea2 = second.getByLabelText(
      'แก้ไขข้อความ',
    ) as HTMLTextAreaElement
    expect(textarea2.style.fontSize).toBe(`${20 * 1.5}px`)
  })

  it('Ctrl+Enter commits via updateBlock and closes the editor', () => {
    const doc = createDoc([{ type: 'paragraph', text: 'ข้อความเดิม' }])
    const page: PageInfo = {
      width: 595,
      height: 842,
      content: { x: 85, y: 56, w: 453, h: 730 },
      boxes: [{ path: 'blocks[0]', x: 85, y: 60, w: 453, h: 24 }],
    }
    let latestEditor: EditorState | null = null

    const { container, getByLabelText, queryByLabelText } = render(
      <InlineHarness
        initialDoc={doc}
        page={page}
        onState={(s) => {
          latestEditor = s
        }}
      />,
    )

    const box = container.querySelector<HTMLElement>('.stage-box')!
    fireEvent.doubleClick(box)

    const textarea = getByLabelText('แก้ไขข้อความ') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'ข้อความใหม่' } })
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })

    expect(queryByLabelText('แก้ไขข้อความ')).toBeNull()
    expect((latestEditor!.doc.blocks[0] as any).text).toBe('ข้อความใหม่')
  })

  it('blur commits and closes the editor', () => {
    const doc = createDoc([{ type: 'paragraph', text: 'ก่อนแก้' }])
    const page: PageInfo = {
      width: 595,
      height: 842,
      content: { x: 85, y: 56, w: 453, h: 730 },
      boxes: [{ path: 'blocks[0]', x: 85, y: 60, w: 453, h: 24 }],
    }
    let latestEditor: EditorState | null = null

    const { container, getByLabelText, queryByLabelText } = render(
      <InlineHarness
        initialDoc={doc}
        page={page}
        onState={(s) => {
          latestEditor = s
        }}
      />,
    )

    const box = container.querySelector<HTMLElement>('.stage-box')!
    fireEvent.doubleClick(box)

    const textarea = getByLabelText('แก้ไขข้อความ') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'บันทึกเมื่อ blur' } })
    fireEvent.blur(textarea)

    expect(queryByLabelText('แก้ไขข้อความ')).toBeNull()
    expect((latestEditor!.doc.blocks[0] as any).text).toBe('บันทึกเมื่อ blur')
  })

  it('Esc cancels and leaves doc unchanged', () => {
    const doc = createDoc([{ type: 'paragraph', text: 'ห้ามเปลี่ยน' }])
    const page: PageInfo = {
      width: 595,
      height: 842,
      content: { x: 85, y: 56, w: 453, h: 730 },
      boxes: [{ path: 'blocks[0]', x: 85, y: 60, w: 453, h: 24 }],
    }
    let latestEditor: EditorState | null = null

    const { container, getByLabelText, queryByLabelText } = render(
      <InlineHarness
        initialDoc={doc}
        page={page}
        onState={(s) => {
          latestEditor = s
        }}
      />,
    )

    const box = container.querySelector<HTMLElement>('.stage-box')!
    fireEvent.doubleClick(box)

    const textarea = getByLabelText('แก้ไขข้อความ') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'แก้ไขชั่วคราว' } })
    fireEvent.keyDown(textarea, { key: 'Escape' })

    expect(queryByLabelText('แก้ไขข้อความ')).toBeNull()
    expect((latestEditor!.doc.blocks[0] as any).text).toBe('ห้ามเปลี่ยน')
  })

  it('plain Enter inserts a newline without committing', () => {
    const doc = createDoc([{ type: 'paragraph', text: 'บรรทัดแรก' }])
    const page: PageInfo = {
      width: 595,
      height: 842,
      content: { x: 85, y: 56, w: 453, h: 730 },
      boxes: [{ path: 'blocks[0]', x: 85, y: 60, w: 453, h: 24 }],
    }
    let latestEditor: EditorState | null = null

    const { container, getByLabelText } = render(
      <InlineHarness
        initialDoc={doc}
        page={page}
        onState={(s) => {
          latestEditor = s
        }}
      />,
    )

    const box = container.querySelector<HTMLElement>('.stage-box')!
    fireEvent.doubleClick(box)

    const textarea = getByLabelText('แก้ไขข้อความ') as HTMLTextAreaElement
    textarea.setSelectionRange(9, 9)
    fireEvent.keyDown(textarea, { key: 'Enter' })

    // Still open, newline inserted in textarea, doc not yet committed
    expect(getByLabelText('แก้ไขข้อความ')).not.toBeNull()
    expect(textarea.value).toBe('บรรทัดแรก\n')
    expect((latestEditor!.doc.blocks[0] as any).text).toBe('บรรทัดแรก')
  })

  it('Enter with a paragraph selected and focus on overlay opens the editor', () => {
    const doc = createDoc([{ type: 'paragraph', text: 'เปิดด้วย Enter' }])
    const page: PageInfo = {
      width: 595,
      height: 842,
      content: { x: 85, y: 56, w: 453, h: 730 },
      boxes: [{ path: 'blocks[0]', x: 85, y: 60, w: 453, h: 24 }],
    }

    const { container, getByLabelText } = render(
      <InlineHarness
        initialDoc={doc}
        page={page}
        initialSelected={['blocks', 0]}
      />,
    )

    const overlay = container.querySelector<HTMLElement>('.stage-overlay')!
    overlay.focus()
    fireEvent.keyDown(overlay, { key: 'Enter' })

    const textarea = getByLabelText('แก้ไขข้อความ') as HTMLTextAreaElement
    expect(textarea.value).toBe('เปิดด้วย Enter')
  })

  it('double-click on a runs paragraph or an image calls onFocusProperties instead', () => {
    const doc = createDoc([
      { type: 'paragraph', runs: [{ text: 'ข้อความซับซ้อน', bold: true }] },
      { type: 'image', src: 'asset:garuda' },
    ])
    const page: PageInfo = {
      width: 595,
      height: 842,
      content: { x: 85, y: 56, w: 453, h: 730 },
      boxes: [
        { path: 'blocks[0]', x: 85, y: 60, w: 453, h: 24 },
        { path: 'blocks[1]', x: 85, y: 120, w: 100, h: 100 },
      ],
    }
    const onFocusProperties = vi.fn()

    const { container, queryByLabelText } = render(
      <InlineHarness
        initialDoc={doc}
        page={page}
        onFocusProperties={onFocusProperties}
      />,
    )

    const runsBox = container.querySelector<HTMLElement>(
      '[data-block-path="blocks.0"]',
    )!
    fireEvent.doubleClick(runsBox)
    expect(queryByLabelText('แก้ไขข้อความ')).toBeNull()
    expect(onFocusProperties).toHaveBeenCalledTimes(1)

    const imageBox = container.querySelector<HTMLElement>(
      '[data-block-path="blocks.1"]',
    )!
    fireEvent.doubleClick(imageBox)
    expect(queryByLabelText('แก้ไขข้อความ')).toBeNull()
    expect(onFocusProperties).toHaveBeenCalledTimes(2)
  })

  it('table text cell edit updates only that cell via replaceBlock', () => {
    const doc = createDoc([
      {
        type: 'table',
        columns: [{ width: '50%' }, { width: '50%' }],
        header: [[{ text: 'หัว 1' }, { text: 'หัว 2' }]],
        rows: [
          [
            { text: 'ซ้ายเดิม' },
            { text: 'ขวาเดิม', align: 'right' },
          ],
        ],
      },
    ])
    const page: PageInfo = {
      width: 595,
      height: 842,
      content: { x: 85, y: 56, w: 453, h: 730 },
      boxes: [
        { path: 'blocks[0]', x: 85, y: 60, w: 453, h: 80 },
        { path: 'blocks[0].rows[0][0]', x: 85, y: 90, w: 226, h: 24 },
        { path: 'blocks[0].rows[0][1]', x: 311, y: 90, w: 226, h: 24 },
      ],
    }
    let latestEditor: EditorState | null = null

    const { container, getByLabelText, queryByLabelText } = render(
      <InlineHarness
        initialDoc={doc}
        page={page}
        onState={(s) => {
          latestEditor = s
        }}
      />,
    )

    const cellBox = container.querySelector<HTMLElement>(
      '[data-source-path="blocks[0].rows[0][1]"]',
    )!
    fireEvent.doubleClick(cellBox)

    const textarea = getByLabelText('แก้ไขข้อความ') as HTMLTextAreaElement
    expect(textarea.value).toBe('ขวาเดิม')

    fireEvent.change(textarea, { target: { value: 'ขวาใหม่' } })
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })

    expect(queryByLabelText('แก้ไขข้อความ')).toBeNull()
    const updatedTable = latestEditor!.doc.blocks[0] as TableBlock
    const rows = updatedTable.rows as Array<Array<{ text?: string; align?: string }>>
    expect(rows[0]![0]!.text).toBe('ซ้ายเดิม')
    expect(rows[0]![1]!.text).toBe('ขวาใหม่')
    expect(rows[0]![1]!.align).toBe('right')
    expect(updatedTable.header?.[0]?.[0]?.text).toBe('หัว 1')
  })

  it('{ } button opens the variable picker and inserts {{path}} at the caret', () => {
    const doc = createDoc([{ type: 'paragraph', text: 'เรียน คุณ' }])
    const page: PageInfo = {
      width: 595,
      height: 842,
      content: { x: 85, y: 56, w: 453, h: 730 },
      boxes: [{ path: 'blocks[0]', x: 85, y: 60, w: 453, h: 24 }],
    }
    let latestEditor: EditorState | null = null

    const { container, getByLabelText, getByRole } = render(
      <InlineHarness
        initialDoc={doc}
        page={page}
        onState={(s) => {
          latestEditor = s
        }}
      />,
    )

    const box = container.querySelector<HTMLElement>('.stage-box')!
    fireEvent.doubleClick(box)

    const textarea = getByLabelText('แก้ไขข้อความ') as HTMLTextAreaElement
    // Place caret after "เรียน " (index 6)
    textarea.setSelectionRange(6, 6)

    const pickerTrigger = getByLabelText('{ } ตัวแปร')
    fireEvent.click(pickerTrigger)

    const option = getByRole('option', { name: 'author.name' })
    fireEvent.click(option)

    expect(textarea.value).toBe('เรียน {{author.name}}คุณ')
    expect(latestEditor!.selectedPath).toEqual(['blocks', 0])

    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })
    expect((latestEditor!.doc.blocks[0] as any).text).toBe(
      'เรียน {{author.name}}คุณ',
    )
  })
})
