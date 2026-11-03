import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { Block, DocumentDef } from '@apw-pdf/core'
import { memo } from '@apw-pdf/templates'
import { VisualEditor } from './VisualEditor.js'

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

function countAllBlocks(blocks: any[]): number {
  let count = 0
  for (const block of blocks) {
    count++
    if (block.type === 'columns' && Array.isArray(block.columns)) {
      for (const col of block.columns) {
        if (Array.isArray(col.blocks)) {
          count += countAllBlocks(col.blocks)
        }
      }
    } else if (block.type === 'each' && Array.isArray(block.blocks)) {
      count += countAllBlocks(block.blocks)
    } else if (block.type === 'if') {
      if (Array.isArray(block.then)) count += countAllBlocks(block.then)
      if (Array.isArray(block.else)) count += countAllBlocks(block.else)
    } else if (block.type === 'table') {
      if (Array.isArray(block.header)) {
        for (const row of block.header) {
          if (Array.isArray(row)) {
            for (const cell of row) {
              if (cell && Array.isArray(cell.blocks)) {
                count += countAllBlocks(cell.blocks)
              }
            }
          }
        }
      }
      if (Array.isArray(block.rows)) {
        for (const row of block.rows) {
          if (Array.isArray(row)) {
            for (const cell of row) {
              if (cell && Array.isArray(cell.blocks)) {
                count += countAllBlocks(cell.blocks)
              }
            }
          }
        }
      } else if (
        block.rows &&
        typeof block.rows === 'object' &&
        Array.isArray(block.rows.cells)
      ) {
        for (const cell of block.rows.cells) {
          if (cell && Array.isArray(cell.blocks)) {
            count += countAllBlocks(cell.blocks)
          }
        }
      }
    }
  }
  return count
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('VisualEditor', () => {
  it('VisualEditor selecting an outline row shows its properties', () => {
    const sampleDoc = createDoc([{ type: 'paragraph', text: 'สวัสดี {{name}}' }])
    render(
      <VisualEditor
        doc={sampleDoc}
        data={{ name: 'โลก' }}
        onChange={() => {}}
        centre={<div>stage</div>}
      />,
    )
    fireEvent.click(screen.getByRole('treeitem'))
    expect(screen.getByDisplayValue('สวัสดี {{name}}')).not.toBeNull()
  })

  it('VisualEditor adding a block from the plus menu appends it and selects it', () => {
    const onDocChange = vi.fn()
    render(
      <VisualEditor
        doc={createDoc([])}
        data={{}}
        onDocChange={onDocChange}
        centre={<div>stage</div>}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '+ เพิ่ม' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'ข้อความ' }))
    expect(onDocChange).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Paragraph text')).not.toBeNull()
  })

  it('VisualEditor renders tree, data panel and inspector, and adding a block calls onChange with the new doc', () => {
    const doc: DocumentDef = JSON.parse(JSON.stringify(memo.document))
    const initialRootCount = doc.blocks.length
    const initialTotalBlocks = countAllBlocks(doc.blocks)
    const data = { title: 'Test template data' }
    const onChange = vi.fn()

    const { getByRole, getByText, getByDisplayValue } = render(
      <VisualEditor
        doc={doc}
        data={data}
        onChange={onChange}
        centre={<div>stage</div>}
      />,
    )

    // 1. Renders OutlineTree with existing blocks (including nested ones)
    const tree = getByRole('tree')
    expect(tree).not.toBeNull()
    const treeitems = document.querySelectorAll('[role="treeitem"]')
    expect(treeitems.length).toBe(initialTotalBlocks)

    // 2. Unselected state shows DocumentSettings in right panel
    expect(getByText('ตั้งค่าเอกสาร')).not.toBeNull()

    // 3. Switch to Data tab and verify key input
    fireEvent.click(getByRole('tab', { name: 'ข้อมูล' }))
    expect(getByDisplayValue('title')).not.toBeNull()

    // 4. Switch back to Outline tab and add a block
    fireEvent.click(getByRole('tab', { name: 'โครงสร้าง' }))
    fireEvent.click(getByRole('button', { name: '+ เพิ่ม' }))
    fireEvent.click(getByRole('menuitem', { name: 'ข้อความ' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextPayload = onChange.mock.calls[0]![0]
    expect(nextPayload.doc.blocks.length).toBe(initialRootCount + 1)
    expect(nextPayload.data).toEqual(data)
  })
})
