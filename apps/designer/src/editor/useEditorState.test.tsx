import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import type { DocumentDef, ParagraphBlock, ColumnsBlock } from '@apw-pdf/core'
import { memo } from '@apw-pdf/templates'
import { useEditorState } from './useEditorState.js'

function createDoc(blocks: DocumentDef['blocks'] = []): DocumentDef {
  return {
    version: 1,
    page: memo.document.page,
    font: memo.document.font,
    blocks,
  }
}

afterEach(() => {
  cleanup()
})

describe('useEditorState', () => {
  it('addBlock appends and selects it', () => {
    const p0: ParagraphBlock = { type: 'paragraph', text: 'first' }
    const doc = createDoc([p0])
    const data = {}
    const initial = { doc, data }
    const onChange = vi.fn()

    const { result } = renderHook(() =>
      useEditorState(initial, onChange),
    )

    act(() => {
      result.current.addBlock(['blocks'], 1, 'paragraph')
    })

    expect(result.current.doc.blocks).toHaveLength(2)
    expect(result.current.selectedPath).toEqual(['blocks', 1])
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({
      doc: result.current.doc,
      data,
    })
  })

  it('removeSelected selects the previous sibling, then the parent', () => {
    const p0: ParagraphBlock = { type: 'paragraph', text: 'child 0' }
    const p1: ParagraphBlock = { type: 'paragraph', text: 'child 1' }
    const colBlock: ColumnsBlock = {
      type: 'columns',
      columns: [{ width: '*', blocks: [p0, p1] }],
    }
    const doc = createDoc([colBlock])
    const data = {}
    const initial = { doc, data }
    const onChange = vi.fn()

    const { result } = renderHook(() =>
      useEditorState(initial, onChange),
    )

    // Select second child
    act(() => {
      result.current.select(['blocks', 0, 'columns', 0, 'blocks', 1])
    })
    expect(result.current.selectedPath).toEqual(['blocks', 0, 'columns', 0, 'blocks', 1])

    // Remove child 1 -> selects previous sibling child 0
    act(() => {
      result.current.removeSelected()
    })
    expect(result.current.selectedPath).toEqual(['blocks', 0, 'columns', 0, 'blocks', 0])

    // Remove child 0 -> selects parent columns block
    act(() => {
      result.current.removeSelected()
    })
    expect(result.current.selectedPath).toEqual(['blocks', 0])
  })

  it('updateBlock merges a patch and calls onChange once', () => {
    const p0: ParagraphBlock = { type: 'paragraph', text: 'initial', align: 'left' }
    const doc = createDoc([p0])
    const data = {}
    const initial = { doc, data }
    const onChange = vi.fn()

    const { result } = renderHook(() =>
      useEditorState(initial, onChange),
    )

    act(() => {
      result.current.updateBlock(['blocks', 0], { text: 'updated', align: 'center' })
    })

    const updated = result.current.doc.blocks[0] as ParagraphBlock
    expect(updated.text).toBe('updated')
    expect(updated.align).toBe('center')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('setData recomputes warnings', () => {
    const doc = createDoc([
      {
        type: 'paragraph',
        text: 'Hello {{missing}}',
      },
    ])
    const data = {}
    const initial = { doc, data }
    const onChange = vi.fn()

    const { result } = renderHook(() =>
      useEditorState(initial, onChange),
    )

    expect(result.current.warnings).toHaveLength(1)
    expect(result.current.warnings[0]?.path).toBe('missing')

    act(() => {
      result.current.setData({ missing: 'found' })
    })

    expect(result.current.warnings).toHaveLength(0)
    expect(onChange).toHaveBeenCalledWith({
      doc,
      data: { missing: 'found' },
    })
  })

  it('selecting an invalid path clears the selection', () => {
    const p0: ParagraphBlock = { type: 'paragraph', text: 'first' }
    const doc = createDoc([p0])
    const data = {}
    const initial = { doc, data }
    const onChange = vi.fn()

    const { result } = renderHook(() =>
      useEditorState(initial, onChange),
    )

    act(() => {
      result.current.select(['blocks', 0])
    })
    expect(result.current.selectedPath).toEqual(['blocks', 0])

    act(() => {
      result.current.select(['blocks', 999])
    })
    expect(result.current.selectedPath).toBeNull()
  })

  it('does not loop when the parent re-renders with identical references', () => {
    const doc = createDoc()
    const data = {}
    const initial = { doc, data }
    const onChange = vi.fn()

    const { result, rerender } = renderHook(() =>
      useEditorState(initial, onChange),
    )

    rerender()
    rerender()

    expect(result.current.doc).toBe(doc)
    expect(result.current.data).toBe(data)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('resyncs when initial.doc changes to a new document', () => {
    const doc1 = createDoc([{ type: 'paragraph', text: 'doc 1' }])
    const doc2 = createDoc([{ type: 'paragraph', text: 'doc 2' }])
    const data = {}
    const onChange = vi.fn()

    const { result, rerender } = renderHook(
      (props: { doc: DocumentDef; data: unknown }) =>
        useEditorState(props, onChange),
      { initialProps: { doc: doc1, data } },
    )

    expect(result.current.doc.blocks[0]).toEqual({
      type: 'paragraph',
      text: 'doc 1',
    })

    rerender({ doc: doc2, data })

    expect(result.current.doc.blocks[0]).toEqual({
      type: 'paragraph',
      text: 'doc 2',
    })
  })

  it('moveBlockTo reorders and selects the moved block', () => {
    const p0: ParagraphBlock = { type: 'paragraph', text: 'first' }
    const p1: ParagraphBlock = { type: 'paragraph', text: 'second' }
    const doc = createDoc([p0, p1])
    const data = {}
    const initial = { doc, data }
    const onChange = vi.fn()

    const { result } = renderHook(() =>
      useEditorState(initial, onChange),
    )

    act(() => {
      result.current.moveBlockTo(['blocks', 0], ['blocks'], 1)
    })

    expect(result.current.doc.blocks.map((b) => (b as ParagraphBlock).text)).toEqual([
      'second',
      'first',
    ])
    expect(result.current.selectedPath).toEqual(['blocks', 1])
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
