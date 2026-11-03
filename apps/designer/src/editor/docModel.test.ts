import { describe, it, expect } from 'vitest'
import type { DocumentDef, ParagraphBlock, ColumnsBlock } from '@apw-pdf/core'
import { memo } from '@apw-pdf/templates'
import {
  getBlock,
  listChildren,
  insertBlock,
  removeBlock,
  moveBlock,
  moveBlockTo,
  moveInto,
  moveOut,
  duplicateBlock,
  canMoveInto,
} from './docModel.js'

function createBaseDoc(blocks: DocumentDef['blocks'] = []): DocumentDef {
  return {
    version: 1,
    page: memo.document.page,
    font: memo.document.font,
    blocks,
  }
}

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj
  Object.freeze(obj)
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    const val = (obj as Record<string, unknown>)[key]
    if (val && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val)
    }
  }
  return obj
}

describe('docModel', () => {
  it('insertBlock at root index 0', () => {
    const p1: ParagraphBlock = { type: 'paragraph', text: 'first' }
    const p2: ParagraphBlock = { type: 'paragraph', text: 'second' }
    const doc = createBaseDoc([p1])

    const next = insertBlock(doc, ['blocks'], 0, p2)
    expect(next.blocks).toHaveLength(2)
    expect(next.blocks[0]).toEqual(p2)
    expect(next.blocks[1]).toEqual(p1)
  })

  it('insertBlock into columns[0].blocks', () => {
    const child1: ParagraphBlock = { type: 'paragraph', text: 'child 1' }
    const child2: ParagraphBlock = { type: 'paragraph', text: 'child 2' }
    const colBlock: ColumnsBlock = {
      type: 'columns',
      columns: [{ width: '*', blocks: [child1] }],
    }
    const doc = createBaseDoc([colBlock])

    const next = insertBlock(doc, ['blocks', 0, 'columns', 0, 'blocks'], 1, child2)
    const updatedCol = next.blocks[0] as ColumnsBlock
    expect(updatedCol.columns[0]?.blocks).toHaveLength(2)
    expect(updatedCol.columns[0]?.blocks[1]).toEqual(child2)
  })

  it('removeBlock nested path', () => {
    const child1: ParagraphBlock = { type: 'paragraph', text: 'child 1' }
    const child2: ParagraphBlock = { type: 'paragraph', text: 'child 2' }
    const colBlock: ColumnsBlock = {
      type: 'columns',
      columns: [{ width: '*', blocks: [child1, child2] }],
    }
    const doc = createBaseDoc([colBlock])

    const next = removeBlock(doc, ['blocks', 0, 'columns', 0, 'blocks', 0])
    const updatedCol = next.blocks[0] as ColumnsBlock
    expect(updatedCol.columns[0]?.blocks).toHaveLength(1)
    expect(updatedCol.columns[0]?.blocks[0]).toEqual(child2)
  })

  it('moveBlock swaps neighbours and is a no-op at the edges', () => {
    const p0: ParagraphBlock = { type: 'paragraph', text: '0' }
    const p1: ParagraphBlock = { type: 'paragraph', text: '1' }
    const p2: ParagraphBlock = { type: 'paragraph', text: '2' }
    const doc = createBaseDoc([p0, p1, p2])

    const swapped = moveBlock(doc, ['blocks', 1], 1)
    expect(swapped.blocks.map((b) => (b as ParagraphBlock).text)).toEqual(['0', '2', '1'])

    const edgeUp = moveBlock(doc, ['blocks', 0], -1)
    expect(edgeUp).toBe(doc)

    const edgeDown = moveBlock(doc, ['blocks', 2], 1)
    expect(edgeDown).toBe(doc)
  })

  it('moveInto appends to the target list', () => {
    const p0: ParagraphBlock = { type: 'paragraph', text: 'standalone' }
    const colBlock: ColumnsBlock = {
      type: 'columns',
      columns: [{ width: '*', blocks: [] }],
    }
    const doc = createBaseDoc([p0, colBlock])

    const targetListPath = ['blocks', 1, 'columns', 0, 'blocks']
    expect(canMoveInto(doc, ['blocks', 0], targetListPath)).toBe(true)

    const next = moveInto(doc, ['blocks', 0], targetListPath)
    expect(next.blocks).toHaveLength(1)
    const updatedCol = next.blocks[0] as ColumnsBlock
    expect(updatedCol.columns[0]?.blocks).toHaveLength(1)
    expect(updatedCol.columns[0]?.blocks[0]).toEqual(p0)
  })

  it('moveInto refuses own descendant (canMoveInto false, doc returned unchanged)', () => {
    const colBlock: ColumnsBlock = {
      type: 'columns',
      columns: [{ width: '*', blocks: [] }],
    }
    const doc = createBaseDoc([colBlock])
    const targetListPath = ['blocks', 0, 'columns', 0, 'blocks']

    expect(canMoveInto(doc, ['blocks', 0], targetListPath)).toBe(false)
    const next = moveInto(doc, ['blocks', 0], targetListPath)
    expect(next).toBe(doc)
  })

  it('moveOut places the block after its parent', () => {
    const child: ParagraphBlock = { type: 'paragraph', text: 'nested child' }
    const colBlock: ColumnsBlock = {
      type: 'columns',
      columns: [{ width: '*', blocks: [child] }],
    }
    const doc = createBaseDoc([colBlock])

    const next = moveOut(doc, ['blocks', 0, 'columns', 0, 'blocks', 0])
    expect(next.blocks).toHaveLength(2)
    const updatedCol = next.blocks[0] as ColumnsBlock
    expect(updatedCol.columns[0]?.blocks).toHaveLength(0)
    expect(next.blocks[1]).toEqual(child)
  })

  it('duplicateBlock deep-copies (mutating the copy leaves the original)', () => {
    const p: ParagraphBlock = { type: 'paragraph', text: 'original text' }
    const doc = createBaseDoc([p])

    const next = duplicateBlock(doc, ['blocks', 0])
    expect(next.blocks).toHaveLength(2)
    expect(next.blocks[0]).toEqual(p)
    expect(next.blocks[1]).toEqual(p)

    // Verify deep copy
    const copy = next.blocks[1] as ParagraphBlock
    copy.text = 'mutated'
    expect((next.blocks[0] as ParagraphBlock).text).toBe('original text')
  })

  it('invalid path returns the same doc object', () => {
    const p: ParagraphBlock = { type: 'paragraph', text: 'root' }
    const doc = createBaseDoc([p])

    expect(getBlock(doc, ['blocks', 99])).toBeUndefined()
    expect(removeBlock(doc, ['blocks', 99])).toBe(doc)
    expect(removeBlock(doc, ['invalid', 0])).toBe(doc)
    expect(insertBlock(doc, ['blocks', 99, 'columns'], 0, p)).toBe(doc)
    expect(moveBlock(doc, ['blocks', 99], 1)).toBe(doc)
    expect(moveInto(doc, ['blocks', 99], ['blocks'])).toBe(doc)
    expect(moveOut(doc, ['blocks', 0])).toBe(doc)
    expect(moveOut(doc, ['blocks', 99])).toBe(doc)
    expect(duplicateBlock(doc, ['blocks', 99])).toBe(doc)
  })

  it('inputs are never mutated', () => {
    const child: ParagraphBlock = { type: 'paragraph', text: 'child' }
    const colBlock: ColumnsBlock = {
      type: 'columns',
      columns: [{ width: '*', blocks: [child] }],
    }
    const p1: ParagraphBlock = { type: 'paragraph', text: 'p1' }
    const doc = createBaseDoc([colBlock, p1])
    deepFreeze(doc)

    expect(() => insertBlock(doc, ['blocks'], 0, { type: 'paragraph', text: 'new' })).not.toThrow()
    expect(() => removeBlock(doc, ['blocks', 1])).not.toThrow()
    expect(() => moveBlock(doc, ['blocks', 0], 1)).not.toThrow()
    expect(() => moveInto(doc, ['blocks', 1], ['blocks', 0, 'columns', 0, 'blocks'])).not.toThrow()
    expect(() => moveOut(doc, ['blocks', 0, 'columns', 0, 'blocks', 0])).not.toThrow()
    expect(() => duplicateBlock(doc, ['blocks', 0])).not.toThrow()
  })

  it('moveBlockTo reorders within the root list', () => {
    const p0: ParagraphBlock = { type: 'paragraph', text: '0' }
    const p1: ParagraphBlock = { type: 'paragraph', text: '1' }
    const p2: ParagraphBlock = { type: 'paragraph', text: '2' }
    const doc = createBaseDoc([p0, p1, p2])

    const next = moveBlockTo(doc, ['blocks', 2], ['blocks'], 0)
    expect(next.blocks.map((b) => (b as ParagraphBlock).text)).toEqual(['2', '0', '1'])
  })

  it('moveBlockTo moves into columns[0].blocks', () => {
    const p0: ParagraphBlock = { type: 'paragraph', text: 'standalone' }
    const colBlock: ColumnsBlock = {
      type: 'columns',
      columns: [{ width: '*', blocks: [] }],
    }
    const doc = createBaseDoc([colBlock, p0])

    const next = moveBlockTo(doc, ['blocks', 1], ['blocks', 0, 'columns', 0, 'blocks'], 0)
    expect(next.blocks).toHaveLength(1)
    const updatedCol = next.blocks[0] as ColumnsBlock
    expect(updatedCol.columns[0]?.blocks).toEqual([p0])
  })

  it('moveBlockTo moves out of a container to root', () => {
    const child: ParagraphBlock = { type: 'paragraph', text: 'nested' }
    const colBlock: ColumnsBlock = {
      type: 'columns',
      columns: [{ width: '*', blocks: [child] }],
    }
    const doc = createBaseDoc([colBlock])

    const next = moveBlockTo(doc, ['blocks', 0, 'columns', 0, 'blocks', 0], ['blocks'], 1)
    expect(next.blocks).toHaveLength(2)
    expect((next.blocks[0] as ColumnsBlock).columns[0]?.blocks).toHaveLength(0)
    expect(next.blocks[1]).toEqual(child)
  })

  it('moveBlockTo adjusts the index when moving later in the same list', () => {
    const p0: ParagraphBlock = { type: 'paragraph', text: '0' }
    const p1: ParagraphBlock = { type: 'paragraph', text: '1' }
    const p2: ParagraphBlock = { type: 'paragraph', text: '2' }
    const doc = createBaseDoc([p0, p1, p2])

    const next = moveBlockTo(doc, ['blocks', 0], ['blocks'], 2)
    expect(next.blocks.map((b) => (b as ParagraphBlock).text)).toEqual(['1', '2', '0'])

    const colBlock: ColumnsBlock = {
      type: 'columns',
      columns: [{ width: '*', blocks: [] }],
    }
    const docWithCol = createBaseDoc([p0, colBlock])
    const movedIntoLaterSibling = moveBlockTo(
      docWithCol,
      ['blocks', 0],
      ['blocks', 1, 'columns', 0, 'blocks'],
      0,
    )
    expect(movedIntoLaterSibling.blocks).toHaveLength(1)
    expect((movedIntoLaterSibling.blocks[0] as ColumnsBlock).columns[0]?.blocks).toEqual([p0])
  })

  it('moveBlockTo refuses its own descendant and returns the same doc', () => {
    const colBlock: ColumnsBlock = {
      type: 'columns',
      columns: [{ width: '*', blocks: [] }],
    }
    const doc = createBaseDoc([colBlock])

    const next = moveBlockTo(doc, ['blocks', 0], ['blocks', 0, 'columns', 0, 'blocks'], 0)
    expect(next).toBe(doc)
  })

  it('moveBlockTo invalid path returns the same doc', () => {
    const p0: ParagraphBlock = { type: 'paragraph', text: '0' }
    const doc = createBaseDoc([p0])

    expect(moveBlockTo(doc, ['blocks', 99], ['blocks'], 0)).toBe(doc)
    expect(moveBlockTo(doc, ['blocks', 0], ['invalid'], 0)).toBe(doc)
    expect(moveBlockTo(doc, ['blocks', 0], ['blocks'], 99)).toBe(doc)
    expect(moveBlockTo(doc, ['blocks', 0], ['blocks'], -1)).toBe(doc)
  })
})
