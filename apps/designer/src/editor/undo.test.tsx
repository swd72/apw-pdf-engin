// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, renderHook, fireEvent, act, cleanup } from '@testing-library/react'
import type { Block, DocumentDef, ParagraphBlock } from '@apw-pdf/core'
import { useEditorState, type EditorState } from './useEditorState.js'
import { VisualEditor } from '../components/VisualEditor.js'
import { PdfStage } from '../components/stage/PdfStage.js'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function createDoc(blocks: Block[] = []): DocumentDef {
  return {
    version: 1,
    page: {
      size: 'A4',
      margin: { top: '2cm', bottom: '2cm', left: '3cm', right: '2cm' },
    },
    font: { family: 'Sarabun', size: '16pt' },
    blocks,
  }
}

const EMPTY_DATA: Record<string, unknown> = {}
const NOOP = () => {}
const CENTRE_STUB = <div>stage</div>

describe('undo and redo in useEditorState, VisualEditor, and PdfStage', () => {
  let store: Map<string, string>

  beforeEach(() => {
    vi.useFakeTimers()
    store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
      clear: () => {
        store.clear()
      },
    })
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('five rapid updateBlock calls on the same path then undo() restores the original text in one step; redo() re-applies', () => {
    const doc = createDoc([{ type: 'paragraph', text: 'ต้นฉบับ' }])
    const initial = { doc, data: EMPTY_DATA }

    const { result } = renderHook(() => useEditorState(initial, NOOP))

    const steps = ['ส', 'สว', 'สวั', 'สวัส', 'สวัสดี']
    for (const text of steps) {
      act(() => {
        vi.advanceTimersByTime(100)
        result.current.updateBlock(['blocks', 0], { text })
      })
    }

    expect((result.current.doc.blocks[0] as ParagraphBlock).text).toBe('สวัสดี')
    expect(result.current.canUndo).toBe(true)
    expect(result.current.canRedo).toBe(false)

    act(() => {
      result.current.undo()
    })

    expect((result.current.doc.blocks[0] as ParagraphBlock).text).toBe('ต้นฉบับ')
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(true)

    act(() => {
      result.current.redo()
    })

    expect((result.current.doc.blocks[0] as ParagraphBlock).text).toBe('สวัสดี')
    expect(result.current.canUndo).toBe(true)
    expect(result.current.canRedo).toBe(false)
  })

  it('Ctrl+Z on document.body undoes, and Ctrl+Shift+Z / Ctrl+Y redo', () => {
    const doc = createDoc([{ type: 'paragraph', text: 'ย่อหน้า 1' }])
    const onChange = vi.fn()

    const { getByRole } = render(
      <VisualEditor
        doc={doc}
        data={EMPTY_DATA}
        onChange={onChange}
        centre={CENTRE_STUB}
      />,
    )

    // Add a block via QuickAdd
    fireEvent.click(getByRole('button', { name: '+ เพิ่ม' }))
    fireEvent.click(getByRole('menuitem', { name: 'ข้อความ' }))
    expect(document.querySelectorAll('[role="treeitem"]').length).toBe(2)

    // Ctrl+Z on document.body undoes the added block
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })
    expect(document.querySelectorAll('[role="treeitem"]').length).toBe(1)

    // Ctrl+Shift+Z redoes
    fireEvent.keyDown(document.body, {
      key: 'z',
      ctrlKey: true,
      shiftKey: true,
    })
    expect(document.querySelectorAll('[role="treeitem"]').length).toBe(2)

    // Ctrl+Z undoes again, then Ctrl+Y redoes
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })
    expect(document.querySelectorAll('[role="treeitem"]').length).toBe(1)

    fireEvent.keyDown(document.body, { key: 'y', ctrlKey: true })
    expect(document.querySelectorAll('[role="treeitem"]').length).toBe(2)
  })

  it('Ctrl+Z dispatched on a focused textarea does nothing (Review Focus 4)', () => {
    const doc = createDoc([{ type: 'paragraph', text: 'ข้อความเริ่มต้น' }])

    const { getByRole, getByLabelText } = render(
      <VisualEditor
        doc={doc}
        data={EMPTY_DATA}
        onChange={NOOP}
        centre={CENTRE_STUB}
      />,
    )

    // Add a second block so canUndo is true
    fireEvent.click(getByRole('button', { name: '+ เพิ่ม' }))
    fireEvent.click(getByRole('menuitem', { name: 'ข้อความ' }))
    expect(document.querySelectorAll('[role="treeitem"]').length).toBe(2)

    const textarea = getByLabelText('Paragraph text') as HTMLTextAreaElement
    textarea.focus()

    // Dispatch Ctrl+Z on the focused textarea -> global undo must NOT run
    fireEvent.keyDown(textarea, { key: 'z', ctrlKey: true })
    expect(document.querySelectorAll('[role="treeitem"]').length).toBe(2)
  })

  it('clears selection when the undone doc no longer has the block, and keeps selection when it still exists', () => {
    const doc = createDoc([{ type: 'paragraph', text: 'บล็อกแรก' }])
    const initial = { doc, data: EMPTY_DATA }

    const { result } = renderHook(() => useEditorState(initial, NOOP))

    // Add second block -> selects ['blocks', 1]
    act(() => {
      result.current.addBlock(['blocks'], 1, 'paragraph')
    })
    expect(result.current.selectedPath).toEqual(['blocks', 1])

    // Undo adding the second block -> ['blocks', 1] no longer exists -> selectedPath becomes null
    act(() => {
      result.current.undo()
    })
    expect(result.current.doc.blocks.length).toBe(1)
    expect(result.current.selectedPath).toBeNull()

    // Select ['blocks', 0] and edit it -> undo keeps ['blocks', 0] selected
    act(() => {
      result.current.select(['blocks', 0])
      result.current.updateBlock(['blocks', 0], { text: 'แก้ไข' })
    })
    expect(result.current.selectedPath).toEqual(['blocks', 0])

    act(() => {
      result.current.undo()
    })
    expect(result.current.selectedPath).toEqual(['blocks', 0])
    expect((result.current.doc.blocks[0] as ParagraphBlock).text).toBe(
      'บล็อกแรก',
    )
  })

  it('template switch resets canUndo to false', () => {
    const doc1 = createDoc([{ type: 'paragraph', text: 'เทมเพลต 1' }])
    const doc2 = createDoc([{ type: 'paragraph', text: 'เทมเพลต 2' }])

    const { result, rerender } = renderHook(
      (props: { doc: DocumentDef; data: unknown }) =>
        useEditorState(props, NOOP),
      { initialProps: { doc: doc1, data: EMPTY_DATA } },
    )

    act(() => {
      result.current.updateBlock(['blocks', 0], { text: 'แก้ไขเทมเพลต 1' })
    })
    expect(result.current.canUndo).toBe(true)

    rerender({ doc: doc2, data: EMPTY_DATA })
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
    expect((result.current.doc.blocks[0] as ParagraphBlock).text).toBe(
      'เทมเพลต 2',
    )
  })

  it('stage toolbar buttons ย้อนกลับ and ทำซ้ำ are disabled per canUndo/canRedo and trigger undo/redo', () => {
    const doc = createDoc([{ type: 'paragraph', text: 'ก่อนแก้' }])
    let latestEditor: EditorState | null = null

    function StageHarness() {
      const initial = React.useMemo(
        () => ({ doc, data: EMPTY_DATA }),
        [],
      )
      const editor = useEditorState(initial, NOOP)
      latestEditor = editor
      return (
        <PdfStage
          doc={editor.doc}
          data={EMPTY_DATA}
          editor={editor}
        />
      )
    }

    const { getByLabelText } = render(<StageHarness />)
    const undoBtn = getByLabelText('ย้อนกลับ') as HTMLButtonElement
    const redoBtn = getByLabelText('ทำซ้ำ') as HTMLButtonElement

    expect(undoBtn.disabled).toBe(true)
    expect(redoBtn.disabled).toBe(true)

    act(() => {
      latestEditor!.updateBlock(['blocks', 0], { text: 'หลังแก้' })
    })

    expect(undoBtn.disabled).toBe(false)
    expect(redoBtn.disabled).toBe(true)

    fireEvent.click(undoBtn)
    expect((latestEditor!.doc.blocks[0] as ParagraphBlock).text).toBe('ก่อนแก้')
    expect(undoBtn.disabled).toBe(true)
    expect(redoBtn.disabled).toBe(false)

    fireEvent.click(redoBtn)
    expect((latestEditor!.doc.blocks[0] as ParagraphBlock).text).toBe('หลังแก้')
    expect(undoBtn.disabled).toBe(false)
    expect(redoBtn.disabled).toBe(true)
  })
})
