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

    for (let bIdx = 0; bIdx < col.blocks.length; bIdx++) {
      const blk = col.blocks[bIdx]!
      const blkPath = `${path}.columns[${i}].blocks[${bIdx}]`
      const res = await layoutBlockToFragment(blk, ctx, colX, colW, blkPath)
      if (res.fragment) {
        const topOff = currY + (bIdx === 0 ? 0 : res.fragment.spaceBefore)
        placements.push({ frag: res.fragment, offsetTop: topOff })
        currY = topOff + res.fragment.height + res.fragment.spaceAfter
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
