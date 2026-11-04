// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, renderHook, fireEvent, act, cleanup } from '@testing-library/react'
import {
  parseDocument,
  type Block,
  type DocumentDef,
  type ParagraphBlock,
  type TableBlock,
} from '@apw-pdf/core'
import { PRESETS, mergeSampleData } from './presets.js'
import { unresolved } from './bindings.js'
import { useEditorState } from './useEditorState.js'
import { QuickAdd } from '../components/outline/QuickAdd.js'

afterEach(() => {
  cleanup()
})

const NOOP = () => {}

function createDoc(
  blocks: Block[] = [],
  withGarudaAsset = false,
): DocumentDef {
  return {
    version: 1,
    page: {
      size: 'A4',
      margin: { top: '1.5cm', bottom: '2cm', left: '3cm', right: '2cm' },
    },
    font: { family: 'THSarabunNew', size: '16pt' },
    ...(withGarudaAsset ? { assets: { garuda: 'asset:garuda' } } : {}),
    blocks,
  }
}

describe('presets', () => {
  it('defines all four Thai government presets with expected ids and labels', () => {
    expect(PRESETS.map((p) => ({ id: p.id, label: p.label }))).toEqual([
      { id: 'memoHeader', label: 'หัวบันทึกข้อความ' },
      { id: 'externalHeader', label: 'หัวหนังสือภายนอก' },
      { id: 'approvalTwoSides', label: 'บล็อกอนุมัติ 2 ฝั่ง' },
      { id: 'itemsTable', label: 'ตารางรายการพร้อมยอดรวม' },
    ])
  })

  it('each preset passes parseDocument and returns a fresh deep copy', () => {
    for (const preset of PRESETS) {
      const blocksA = preset.create()
      const blocksB = preset.create()
      expect(blocksA.length).toBeGreaterThan(0)
      expect(blocksA).not.toBe(blocksB)
      expect(blocksA[0]).not.toBe(blocksB[0])

      const needsGaruda =
        preset.id === 'memoHeader' || preset.id === 'externalHeader'
      const doc = createDoc(blocksA, needsGaruda)
      const parsed = parseDocument(doc)
      expect(parsed.blocks.length).toBe(blocksA.length)
    }
  })

  it('memoHeader includes the @kho anchor-defining title block and itemsTable has colSpan: 4 footer and consistent total', () => {
    const memoPreset = PRESETS.find((p) => p.id === 'memoHeader')!
    const memoBlocks = memoPreset.create()
    const hasKhoAnchor = memoBlocks.some(
      (b) =>
        b.type === 'paragraph' &&
        Array.isArray(b.runs) &&
        b.runs.some(
          (r) =>
            'anchors' in r &&
            Array.isArray(r.anchors) &&
            r.anchors.some((a) => a.name === 'kho'),
        ),
    )
    const usesKhoTab = memoBlocks.some(
      (b) =>
        b.type === 'paragraph' &&
        Array.isArray(b.tabs) &&
        b.tabs.some((t) => t.at === '@kho'),
    )
    expect(hasKhoAnchor).toBe(true)
    expect(usesKhoTab).toBe(true)

    const tablePreset = PRESETS.find((p) => p.id === 'itemsTable')!
    const [tableBlock] = tablePreset.create() as [TableBlock]
    expect(tableBlock.type).toBe('table')
    expect(tableBlock.footer).toEqual([
      [
        {
          text: 'รวมเป็นเงินทั้งสิ้น ({{total | baht}})',
          colSpan: 4,
          align: 'center',
        },
        {
          text: '{{total | number}}',
          align: 'right',
        },
      ],
    ])
    const sampleItems = tablePreset.sampleData.items as Array<{
      amount: number
    }>
    const sumAmounts = sampleItems.reduce((sum, item) => sum + item.amount, 0)
    expect(tablePreset.sampleData.total).toBe(sumAmounts)
  })

  it('rendering each preset with its sampleData via unresolved(doc, data) returns no warnings', () => {
    for (const preset of PRESETS) {
      const needsGaruda =
        preset.id === 'memoHeader' || preset.id === 'externalHeader'
      const doc = createDoc(preset.create(), needsGaruda)
      expect(unresolved(doc, preset.sampleData)).toEqual([])
    }
  })

  it('mergeSampleData keeps an existing items array and existing nested left.name (Review Focus 5)', () => {
    const itemsPreset = PRESETS.find((p) => p.id === 'itemsTable')!
    const existingItems = [
      { no: 1, name: 'รายการที่มีอยู่แล้ว', qty: 2, price: 50, amount: 100 },
    ]
    const mergedItems = mergeSampleData(
      { items: existingItems, customField: 'keep' },
      itemsPreset.sampleData,
    )
    expect(mergedItems.items).toBe(existingItems)
    expect(mergedItems.total).toBe(itemsPreset.sampleData.total)
    expect(mergedItems.customField).toBe('keep')

    const approvalPreset = PRESETS.find((p) => p.id === 'approvalTwoSides')!
    const mergedApproval = mergeSampleData(
      { left: { name: 'ชื่อผู้เสนอเดิม' } },
      approvalPreset.sampleData,
    )
    const left = mergedApproval.left as Record<string, unknown>
    const sampleLeft = approvalPreset.sampleData.left as Record<string, unknown>
    expect(left.name).toBe('ชื่อผู้เสนอเดิม')
    expect(left.comment).toBe(sampleLeft.comment)
    expect(left.position).toBe(sampleLeft.position)
    expect(mergedApproval.right).toEqual(approvalPreset.sampleData.right)

    expect(mergeSampleData(null, { a: 1 })).toEqual({ a: 1 })
  })

  it('insertBlocks inserts all blocks at the index, adds sample keys and garuda asset, and one undo removes the blocks and the added data keys', () => {
    const initialDoc = createDoc([{ type: 'paragraph', text: 'ย่อหน้าเดิม' }])
    const initialData = { existing: 'ไม่ถูกเขียนทับ', agency: 'หน่วยงานเดิม' }
    const initial = { doc: initialDoc, data: initialData }

    const { result } = renderHook(() => useEditorState(initial, NOOP))
    const memoPreset = PRESETS.find((p) => p.id === 'memoHeader')!
    const blocksToInsert = memoPreset.create()

    act(() => {
      result.current.insertBlocks(
        ['blocks'],
        1,
        blocksToInsert,
        memoPreset.sampleData,
      )
    })

    expect(result.current.doc.blocks.length).toBe(1 + blocksToInsert.length)
    expect((result.current.doc.blocks[0] as ParagraphBlock).text).toBe(
      'ย่อหน้าเดิม',
    )
    expect(result.current.doc.assets?.garuda).toBe('asset:garuda')
    expect(() => parseDocument(result.current.doc)).not.toThrow()
    expect(result.current.selectedPath).toEqual(['blocks', 1])

    const updatedData = result.current.data as Record<string, unknown>
    expect(updatedData.existing).toBe('ไม่ถูกเขียนทับ')
    expect(updatedData.agency).toBe('หน่วยงานเดิม')
    expect(updatedData.docNo).toBe(memoPreset.sampleData.docNo)
    expect(updatedData.subject).toBe(memoPreset.sampleData.subject)
    expect(updatedData.to).toBe(memoPreset.sampleData.to)
    expect(result.current.warnings).toEqual([])

    // One undo removes the blocks, the added garuda asset, and the added data keys
    act(() => {
      result.current.undo()
    })

    expect(result.current.doc.blocks.length).toBe(1)
    expect(result.current.doc.assets).toBeUndefined()
    expect(result.current.data).toEqual({
      existing: 'ไม่ถูกเขียนทับ',
      agency: 'หน่วยงานเดิม',
    })
    expect('docNo' in (result.current.data as Record<string, unknown>)).toBe(
      false,
    )
    expect(result.current.selectedPath).toBeNull()
  })

  it('QuickAdd shows สำเร็จรูป and calls onInsertPreset("itemsTable")', () => {
    const onInsert = vi.fn()
    const onInsertPreset = vi.fn()
    const { getByText, getByRole } = render(
      React.createElement(QuickAdd, { onInsert, onInsertPreset }),
    )

    expect(getByText('สำเร็จรูป')).not.toBeNull()
    fireEvent.click(
      getByRole('menuitem', { name: 'ตารางรายการพร้อมยอดรวม' }),
    )
    expect(onInsertPreset).toHaveBeenCalledWith('itemsTable')
  })
})
