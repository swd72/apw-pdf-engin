import type { ResolvedColumns } from '../bind/bind.js'
import { toPt } from '../units.js'
import {
  layoutBlockToFragment,
  registerBlockHandler,
  type FlowContext,
  type Fragment,
} from './flow.js'
import { resolveColumnWidths } from './table.js'
import type { LayoutItem } from './tree.js'

export async function layoutColumns(
  c: ResolvedColumns,
  ctx: FlowContext,
  x: number,
  width: number,
  path: string,
): Promise<Fragment> {
  const gap = c.gap !== undefined ? toPt(c.gap) : 0
  const numCols = c.columns.length
  const totalWidthForCols = Math.max(0, width - gap * Math.max(0, numCols - 1))
  const colWidths = resolveColumnWidths(
    c.columns.map((col) => col.width),
    totalWidthForCols,
  )

  const colPlacements: { frag: Fragment; offsetTop: number }[][] = []
  let maxColHeight = 0

  let colX = x
  for (let i = 0; i < numCols; i++) {
    const col = c.columns[i]!
    const colW = colWidths[i]!
    const placements: { frag: Fragment; offsetTop: number }[] = []
    let currY = 0

    const isRightAlignedBlock =
      col.blocks.length > 0 &&
      col.blocks.every((b) => b.type === 'paragraph' && b.align === 'right')

    for (let bIdx = 0; bIdx < col.blocks.length; bIdx++) {
      const blk = col.blocks[bIdx]!
      const effectiveBlk =
        isRightAlignedBlock && blk.type === 'paragraph'
          ? { ...blk, align: 'left' as const }
          : blk
      const blkPath = `${path}.columns[${i}].blocks[${bIdx}]`
      const res = await layoutBlockToFragment(effectiveBlk, ctx, colX, colW, blkPath)
      if (res.fragment) {
        const topOff = currY + (bIdx === 0 ? 0 : res.fragment.spaceBefore)
        const frag = res.fragment
        placements.push({ frag, offsetTop: topOff })
        currY = topOff + frag.height + frag.spaceAfter
      }
    }

    if (isRightAlignedBlock && placements.length > 0) {
      let maxLineRight = colX
      for (const p of placements) {
        for (const it of p.frag.items(0)) {
          if (it.kind === 'glyphs') {
            const w = it.glyphs.reduce((s, g) => s + g.advance, 0)
            if (it.x + w > maxLineRight) {
              maxLineRight = it.x + w
            }
          }
        }
      }
      const shiftX = Math.max(0, colX + colW - maxLineRight)
      if (shiftX > 0) {
        for (let pIdx = 0; pIdx < placements.length; pIdx++) {
          const origFrag = placements[pIdx]!.frag
          placements[pIdx] = {
            offsetTop: placements[pIdx]!.offsetTop,
            frag: {
              ...origFrag,
              items(yTop: number): LayoutItem[] {
                return origFrag.items(yTop).map((it) => {
                  if (it.kind === 'glyphs' || it.kind === 'rect' || it.kind === 'image') {
                    return { ...it, x: it.x + shiftX }
                  }
                  if (it.kind === 'line') {
                    return { ...it, x1: it.x1 + shiftX, x2: it.x2 + shiftX }
                  }
                  return it
                })
              },
            },
          }
        }
      }
    }

    if (currY > maxColHeight) {
      maxColHeight = currY
    }
    colPlacements.push(placements)
    colX += colW + gap
  }

  return {
    height: maxColHeight,
    spaceBefore: 0,
    spaceAfter: 0,
    path,
    splittable: false,
    items(yTop: number): LayoutItem[] {
      const out: LayoutItem[] = []
      for (const placements of colPlacements) {
        for (const p of placements) {
          out.push(...p.frag.items(yTop + p.offsetTop))
        }
      }
      return out
    },
  }
}

registerBlockHandler('columns', layoutColumns)
