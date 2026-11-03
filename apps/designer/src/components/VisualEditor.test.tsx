import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import type { DocumentDef } from '@apw-pdf/core'
import { memo } from '@apw-pdf/templates'
import { VisualEditor } from './VisualEditor.js'

afterEach(() => {
  cleanup()
})

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
      } else if (block.rows && typeof block.rows === 'object' && Array.isArray(block.rows.cells)) {
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

describe('VisualEditor', () => {
  it('VisualEditor renders tree, data panel and inspector, and adding a block calls onChange with the new doc', () => {
    const doc: DocumentDef = JSON.parse(JSON.stringify(memo.document))
    const initialRootCount = doc.blocks.length
    const initialTotalBlocks = countAllBlocks(doc.blocks)
    const data = { title: 'Test template data' }
    const onChange = vi.fn()

    const { getByRole, getByText, getByDisplayValue } = render(
      <VisualEditor doc={doc} data={data} onChange={onChange} />,
    )

    // 1. Renders BlockTree with existing blocks (including nested ones)
    const tree = getByRole('tree')
    expect(tree).not.toBeNull()
    const treeitems = document.querySelectorAll('[role="treeitem"]')
    expect(treeitems.length).toBe(initialTotalBlocks)

    // 2. Renders DataPanel with key input
    expect(getByText('Data Panel')).not.toBeNull()
    expect(getByDisplayValue('title')).not.toBeNull()

    // 3. Renders Inspector (unselected state shows hint)
    expect(
      getByText('Select a block in the tree to inspect its properties.'),
    ).not.toBeNull()

    // 4. Adding a block calls onChange with the new doc
    const addButtons = document.querySelectorAll('button[aria-label="Add block"]')
    expect(addButtons.length).toBeGreaterThan(0)
    const rootAddButton = addButtons[addButtons.length - 1]!
    fireEvent.click(rootAddButton)

    // Find and click 'Paragraph' in the opened add-block menu
    const addParagraphOption = getByText('Paragraph')
    fireEvent.click(addParagraphOption)

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextPayload = onChange.mock.calls[0]![0]
    expect(nextPayload.doc.blocks.length).toBe(initialRootCount + 1)
    expect(nextPayload.data).toEqual(data)
  })

  it('renders inspector form when a block is selected in the tree', () => {
    const doc: DocumentDef = JSON.parse(JSON.stringify(memo.document))
    const data = {}
    const onChange = vi.fn()

    const { getAllByRole, getByText, queryByText } = render(
      <VisualEditor doc={doc} data={data} onChange={onChange} />,
    )

    // Initially unselected hint is visible
    expect(
      getByText(/Select a block in the tree/i),
    ).not.toBeNull()

    const treeitems = getAllByRole('treeitem')
    expect(treeitems.length).toBeGreaterThan(0)

    // Click the inner label element of the first tree item to trigger selection
    const itemLabel = treeitems[0]!.querySelector('span') ?? treeitems[0]!
    fireEvent.click(itemLabel)

    // The unselected hint should no longer be visible
    expect(
      queryByText(/Select a block in the tree/i),
    ).toBeNull()

    // The inspector header for the selected block is now rendered
    expect(getByText(/Inspector:/i)).not.toBeNull()
  })
})
