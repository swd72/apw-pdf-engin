import { describe, it, expect } from 'vitest'
import type { DocumentDef } from '@apw-pdf/core'
import { createHistory, type Snapshot } from './history.js'

function makeSnap(text: string): Snapshot {
  const doc: DocumentDef = {
    version: 1,
    page: {
      size: 'A4',
      margin: { top: '2cm', bottom: '2cm', left: '3cm', right: '2cm' },
    },
    font: { family: 'Sarabun', size: '16pt' },
    blocks: [{ type: 'paragraph', text }],
  }
  return { doc, data: { text } }
}

describe('createHistory', () => {
  it('undo on empty returns null and canUndo/canRedo start false', () => {
    const h = createHistory()
    const s0 = makeSnap('s0')
    expect(h.canUndo()).toBe(false)
    expect(h.canRedo()).toBe(false)
    expect(h.undo(s0)).toBeNull()
    expect(h.redo(s0)).toBeNull()
  })

  it('merges consecutive pushes with the same mergeKey within 600 ms', () => {
    const h = createHistory()
    const s0 = makeSnap('ก')
    const s1 = makeSnap('กข')
    const s2 = makeSnap('กขค')
    const s3 = makeSnap('กขคง')

    h.push(s0, 'block:blocks.0', 1000)
    h.push(s1, 'block:blocks.0', 1200)
    h.push(s2, 'block:blocks.0', 1750)

    expect(h.canUndo()).toBe(true)
    const undone = h.undo(s3)
    expect(undone).toBe(s0)
    expect(h.canUndo()).toBe(false)
    expect(h.canRedo()).toBe(true)

    const redone = h.redo(s0)
    expect(redone).toBe(s3)
    expect(h.canUndo()).toBe(true)
    expect(h.canRedo()).toBe(false)
  })

  it('does not merge after 600 ms or when mergeKey differs', () => {
    const h = createHistory()
    const s0 = makeSnap('0')
    const s1 = makeSnap('1')
    const s2 = makeSnap('2')
    const s3 = makeSnap('3')

    // >= 600 ms apart -> separate undo steps
    h.push(s0, 'block:blocks.0', 1000)
    h.push(s1, 'block:blocks.0', 1600)
    // Different mergeKey within 600 ms -> separate undo step
    h.push(s2, 'block:blocks.1', 1800)

    expect(h.undo(s3)).toBe(s2)
    expect(h.undo(s2)).toBe(s1)
    expect(h.undo(s1)).toBe(s0)
    expect(h.undo(s0)).toBeNull()
  })

  it('clears redo stack on any new push', () => {
    const h = createHistory()
    const s0 = makeSnap('0')
    const s1 = makeSnap('1')
    const s2 = makeSnap('2')

    h.push(s0, 'block:blocks.0', 1000)
    expect(h.undo(s1)).toBe(s0)
    expect(h.canRedo()).toBe(true)

    h.push(s0, 'block:blocks.0', 1100)
    expect(h.canRedo()).toBe(false)
    expect(h.redo(s2)).toBeNull()
  })

  it('caps history at limit (default 100) and drops oldest snapshots', () => {
    const h = createHistory(100)
    const snaps = Array.from({ length: 106 }, (_, i) => makeSnap(`s-${i}`))

    for (let i = 0; i < 105; i++) {
      h.push(snaps[i]!, `key-${i}`, i * 1000)
    }

    let current = snaps[105]!
    let count = 0
    let lastRestored: Snapshot | null = null
    while (h.canUndo()) {
      const prev = h.undo(current)
      expect(prev).not.toBeNull()
      current = prev!
      lastRestored = prev
      count++
    }

    expect(count).toBe(100)
    // Oldest 5 (snaps[0]..snaps[4]) were dropped, so oldest remaining is snaps[5]
    expect(lastRestored).toBe(snaps[5])
    expect(h.undo(current)).toBeNull()
  })
})
