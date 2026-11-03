import type { ResolvedBlock, ResolvedCell, ResolvedTable } from '../bind/bind.js'
import { ApwPdfError } from '../errors.js'
import type { BorderSpec, ColumnWidthSpec } from '../schema.js'
import { toPt } from '../units.js'
import {
  layoutBlockToFragment,
  registerBlockHandler,
  type FlowContext,
  type Fragment,
} from './flow.js'
import type { LayoutItem } from './tree.js'

export function resolveColumnWidths(specs: ColumnWidthSpec[], total: number): number[] {
  const result = new Array<number>(specs.length).fill(0)
  let usedWidth = 0
  const starIndices: number[] = []

  for (let i = 0; i < specs.length; i++) {
    const s = specs[i]!
    if (s === '*') {
      starIndices.push(i)
    } else if (typeof s === 'string' && s.trim().endsWith('%')) {
      const pct = Number(s.trim().slice(0, -1))
      const w = (pct / 100) * total
      result[i] = w
      usedWidth += w
    } else {
      const w = toPt(s)
      result[i] = w
      usedWidth += w
    }
  }

  if (starIndices.length > 0) {
    const rem = Math.max(0, total - usedWidth)
    const eachStar = rem / starIndices.length
    for (const idx of starIndices) {
      result[idx] = eachStar
    }
  }

  return result
}

interface PlacedCellBox {
  rowIdx: number
  colIdx: number
  rowSpan: number
  colSpan: number
  x: number
  width: number
  padTop: number
  padBottom: number
  vAlign: 'top' | 'middle' | 'bottom'
  border: BorderSpec | undefined
  shade: string | undefined
  contentHeight: number
  renderContent(yContentStart: number): LayoutItem[]
}

interface LaidSection {
  rowHeights: number[]
  cells: PlacedCellBox[]
  totalHeight: number
  render(ySectionStart: number): LayoutItem[]
  sliceRows(startRow: number, endRow: number): LaidSection
}

function emitCellBorders(
  cellX: number,
  cellY: number,
  cellW: number,
  cellH: number,
  border: BorderSpec | undefined,
): LayoutItem[] {
  if (border === false) return []
  const spec = typeof border === 'object' ? border : {}
  const width = spec.width !== undefined ? toPt(spec.width) : 0.5
  const color = spec.color ?? '#000000'
  const dash =
    spec.style === 'dashed' ? [4, 2] : spec.style === 'dotted' ? [1, 2] : undefined
  const top = spec.top ?? true
  const bottom = spec.bottom ?? true
  const left = spec.left ?? true
  const right = spec.right ?? true

  const lines: LayoutItem[] = []
  if (top) {
    lines.push({
      kind: 'line',
      x1: cellX,
      y1: cellY,
      x2: cellX + cellW,
      y2: cellY,
      width,
      dash,
      color,
    })
  }
  if (bottom) {
    lines.push({
      kind: 'line',
      x1: cellX,
      y1: cellY + cellH,
      x2: cellX + cellW,
      y2: cellY + cellH,
      width,
      dash,
      color,
    })
  }
  if (left) {
    lines.push({
      kind: 'line',
      x1: cellX,
      y1: cellY,
      x2: cellX,
      y2: cellY + cellH,
      width,
      dash,
      color,
    })
  }
  if (right) {
    lines.push({
      kind: 'line',
      x1: cellX + cellW,
      y1: cellY,
      x2: cellX + cellW,
      y2: cellY + cellH,
      width,
      dash,
      color,
    })
  }
  return lines
}

function buildSectionFromParts(
  rowHeights: number[],
  cells: PlacedCellBox[],
): LaidSection {
  const totalHeight = rowHeights.reduce((s, h) => s + h, 0)
  const rowOffsets: number[] = []
  let acc = 0
  for (const h of rowHeights) {
    rowOffsets.push(acc)
    acc += h
  }

  return {
    rowHeights,
    cells,
    totalHeight,
    render(ySectionStart: number): LayoutItem[] {
      const items: LayoutItem[] = []
      for (const cell of cells) {
        const cellY = ySectionStart + (rowOffsets[cell.rowIdx] ?? 0)
        let cellH = 0
        for (let r = cell.rowIdx; r < cell.rowIdx + cell.rowSpan && r < rowHeights.length; r++) {
          cellH += rowHeights[r]!
        }

        if (cell.shade) {
          items.push({
            kind: 'rect',
            x: cell.x,
            y: cellY,
            w: cell.width,
            h: cellH,
            fill: cell.shade,
          })
        }

        items.push(...emitCellBorders(cell.x, cellY, cell.width, cellH, cell.border))

        let yContent = cellY + cell.padTop
        if (cell.vAlign === 'middle') {
          yContent = cellY + (cellH - cell.contentHeight) / 2
        } else if (cell.vAlign === 'bottom') {
          yContent = cellY + cellH - cell.padBottom - cell.contentHeight
        }

        items.push(...cell.renderContent(yContent))
      }
      return items
    },
    sliceRows(startRow: number, endRow: number): LaidSection {
      const slicedHeights = rowHeights.slice(startRow, endRow)
      const slicedCells = cells
        .filter((c) => c.rowIdx >= startRow && c.rowIdx < endRow)
        .map((c) => ({
          ...c,
          rowIdx: c.rowIdx - startRow,
          rowSpan: Math.min(c.rowSpan, endRow - c.rowIdx),
        }))
      return buildSectionFromParts(slicedHeights, slicedCells)
    },
  }
}

async function layoutTableSection(
  rows: ResolvedCell[][],
  colX: number[],
  colWidths: number[],
  colAligns: (string | undefined)[],
  pad: { left: number; right: number; top: number; bottom: number },
  tableBorder: BorderSpec | undefined,
  ctx: FlowContext,
  sectionPath: string,
): Promise<LaidSection> {
  const numRows = rows.length
  const numCols = colWidths.length
  const occupied: boolean[][] = Array.from({ length: numRows }, () =>
    new Array<boolean>(numCols).fill(false),
  )

  const placedCells: PlacedCellBox[] = []
  const rowHeights = new Array<number>(numRows).fill(0)

  for (let r = 0; r < numRows; r++) {
    const rowCells = rows[r]!
    let cCursor = 0

    for (let cIdx = 0; cIdx < rowCells.length; cIdx++) {
      while (cCursor < numCols && occupied[r]![cCursor]) {
        cCursor++
      }
      if (cCursor >= numCols) break

      const cell = rowCells[cIdx]!
      const colSpan = Math.min(cell.colSpan ?? 1, numCols - cCursor)
      const rowSpan = Math.min(cell.rowSpan ?? 1, numRows - r)

      for (let rr = r; rr < r + rowSpan; rr++) {
        for (let cc = cCursor; cc < cCursor + colSpan; cc++) {
          occupied[rr]![cc] = true
        }
      }

      const cellX = colX[cCursor]!
      let cellW = 0
      for (let cc = cCursor; cc < cCursor + colSpan; cc++) {
        cellW += colWidths[cc]!
      }

      const cellPath = `${sectionPath}[${r}][${cIdx}]`
      const defaultAlign = (cell.align ?? colAligns[cCursor] ?? 'left') as
        | 'left'
        | 'center'
        | 'right'
        | 'justify'
        | 'thaiDistributed'

      const cellBlocks: ResolvedBlock[] =
        cell.blocks !== undefined
          ? cell.blocks
          : [
              {
                type: 'paragraph',
                text: cell.text ?? '',
                align: defaultAlign,
              },
            ]

      const innerX = cellX + pad.left
      const innerW = Math.max(1, cellW - pad.left - pad.right)

      const cellFrags: { frag: Fragment; offsetTop: number }[] = []
      let currOffset = 0

      for (let bIdx = 0; bIdx < cellBlocks.length; bIdx++) {
        const blk = cellBlocks[bIdx]!
        const blkPath =
          blk.$src && !blk.$src.includes('.rows.cells[')
            ? blk.$src
            : cell.blocks !== undefined
              ? `${cellPath}.blocks[${bIdx}]`
              : cellPath
        const res = await layoutBlockToFragment(blk, ctx, innerX, innerW, blkPath)
        if (res.fragment) {
          if (blk.$inst && !res.fragment.inst) {
            res.fragment.inst = blk.$inst
          }
          const topOff = currOffset + (bIdx === 0 ? 0 : res.fragment.spaceBefore)
          cellFrags.push({ frag: res.fragment, offsetTop: topOff })
          currOffset = topOff + res.fragment.height + res.fragment.spaceAfter
        }
      }

      const contentHeight = currOffset
      const totalBoxHeight = contentHeight + pad.top + pad.bottom

      if (rowSpan === 1) {
        if (totalBoxHeight > rowHeights[r]!) {
          rowHeights[r] = totalBoxHeight
        }
      }

      placedCells.push({
        rowIdx: r,
        colIdx: cCursor,
        rowSpan,
        colSpan,
        x: cellX,
        width: cellW,
        padTop: pad.top,
        padBottom: pad.bottom,
        vAlign: cell.vAlign ?? 'top',
        border: cell.border !== undefined ? cell.border : tableBorder,
        shade: cell.shade,
        contentHeight,
        renderContent(yContentStart: number): LayoutItem[] {
          const out: LayoutItem[] = []
          for (const cf of cellFrags) {
            out.push(...cf.frag.items(yContentStart + cf.offsetTop))
          }
          return out
        },
      })

      cCursor += colSpan
    }
  }

  // Second pass for rowSpan > 1
  for (const cell of placedCells) {
    if (cell.rowSpan > 1) {
      let spanSum = 0
      for (let rr = cell.rowIdx; rr < cell.rowIdx + cell.rowSpan; rr++) {
        spanSum += rowHeights[rr]!
      }
      const needed = cell.contentHeight + cell.padTop + cell.padBottom
      if (needed > spanSum) {
        rowHeights[cell.rowIdx + cell.rowSpan - 1]! += needed - spanSum
      }
    }
  }

  return buildSectionFromParts(rowHeights, placedCells)
}

function makeTableFragment(
  headerSec: LaidSection | null,
  bodySec: LaidSection,
  footerSec: LaidSection | null,
  repeatHeader: boolean,
  path: string,
  inst?: string,
): Fragment {
  const headerH = headerSec ? headerSec.totalHeight : 0
  const footerH = footerSec ? footerSec.totalHeight : 0
  const totalH = headerH + bodySec.totalHeight + footerH

  const renderAll = (yTop: number): LayoutItem[] => {
    const out: LayoutItem[] = []
    let currY = yTop
    if (headerSec) {
      out.push(...headerSec.render(currY))
      currY += headerSec.totalHeight
    }
    out.push(...bodySec.render(currY))
    currY += bodySec.totalHeight
    if (footerSec) {
      out.push(...footerSec.render(currY))
    }
    return out
  }

  if (bodySec.rowHeights.length <= 1) {
    return {
      height: totalH,
      spaceBefore: 0,
      spaceAfter: 0,
      path,
      ...(inst !== undefined ? { inst } : {}),
      splittable: false,
      items: renderAll,
      pullTail(_needed: number, canPullAll: boolean) {
        if (!canPullAll || bodySec.rowHeights.length === 0) {
          return null
        }
        return {
          remain: null,
          pulled: {
            ...makeTableFragment(headerSec, bodySec, footerSec, repeatHeader, path, this.inst ?? inst),
            keepWithNext: true,
          },
          count: bodySec.rowHeights.length,
        }
      },
    }
  }

  const minHeadHeight = headerH + (bodySec.rowHeights[0] ?? 0)

  return {
    height: totalH,
    spaceBefore: 0,
    spaceAfter: 0,
    minHeadHeight,
    path,
    ...(inst !== undefined ? { inst } : {}),
    splittable: true,
    items: renderAll,
    pullTail(needed: number, canPullAll: boolean) {
      const activeInst = this.inst ?? inst
      const nRows = bodySec.rowHeights.length
      if (nRows <= needed && canPullAll) {
        return {
          remain: null,
          pulled: {
            ...makeTableFragment(headerSec, bodySec, footerSec, repeatHeader, path, activeInst),
            keepWithNext: true,
          },
          count: nRows,
        }
      }
      const k = Math.max(1, nRows - needed)
      if (k >= nRows) {
        return null
      }
      const headBody = bodySec.sliceRows(0, k)
      const tailBody = bodySec.sliceRows(k, nRows)
      const headFrag = makeTableFragment(headerSec, headBody, null, repeatHeader, path, activeInst)
      const tailFrag = {
        ...makeTableFragment(
          repeatHeader ? headerSec : null,
          tailBody,
          footerSec,
          repeatHeader,
          path,
          activeInst,
        ),
        keepWithNext: true,
      }
      return {
        remain: headFrag,
        pulled: tailFrag,
        count: nRows - k,
      }
    },
    split(avail: number): [Fragment, Fragment] | null {
      const activeInst = this.inst ?? inst
      let acc = headerH
      let k = 0
      for (let i = 0; i < bodySec.rowHeights.length; i++) {
        const rh = bodySec.rowHeights[i]!
        if (acc + rh <= avail + 1e-6) {
          acc += rh
          k = i + 1
        } else {
          break
        }
      }
      if (k >= bodySec.rowHeights.length) {
        k = bodySec.rowHeights.length - 1
      }
      if (k < 1) {
        return null
      }

      const headBody = bodySec.sliceRows(0, k)
      const tailBody = bodySec.sliceRows(k, bodySec.rowHeights.length)

      const headFrag = makeTableFragment(headerSec, headBody, null, repeatHeader, path, activeInst)
      const tailFrag = makeTableFragment(
        repeatHeader ? headerSec : null,
        tailBody,
        footerSec,
        repeatHeader,
        path,
        activeInst,
      )
      return [headFrag, tailFrag]
    },
  }
}

export async function layoutTable(
  t: ResolvedTable,
  ctx: FlowContext,
  x: number,
  width: number,
  path: string,
): Promise<Fragment> {
  const colWidths = resolveColumnWidths(
    t.columns.map((c) => c.width),
    width,
  )
  const colAligns = t.columns.map((c) => c.align)
  const colX: number[] = []
  let accX = x
  for (const w of colWidths) {
    colX.push(accX)
    accX += w
  }

  const pad =
    t.cellPadding !== undefined
      ? {
          left: toPt(t.cellPadding),
          right: toPt(t.cellPadding),
          top: toPt(t.cellPadding),
          bottom: toPt(t.cellPadding),
        }
      : { left: 3, right: 3, top: 1, bottom: 1 }

  const tableBorder: BorderSpec = t.border !== undefined ? t.border : { width: 0.5, color: '#000000' }

  const headerSec =
    t.header && t.header.length > 0
      ? await layoutTableSection(
          t.header,
          colX,
          colWidths,
          colAligns,
          pad,
          tableBorder,
          ctx,
          `${path}.header`,
        )
      : null

  const bodySec = await layoutTableSection(
    t.rows,
    colX,
    colWidths,
    colAligns,
    pad,
    tableBorder,
    ctx,
    `${path}.rows`,
  )

  const footerSec =
    t.footer && t.footer.length > 0
      ? await layoutTableSection(
          t.footer,
          colX,
          colWidths,
          colAligns,
          pad,
          tableBorder,
          ctx,
          `${path}.footer`,
        )
      : null

  const fullPageAvail = ctx.box.height - ctx.box.margin.bottom - ctx.bodyTop(0)
  const headerH = headerSec ? headerSec.totalHeight : 0
  if (!t.allowRowSplit) {
    for (let r = 0; r < bodySec.rowHeights.length; r++) {
      const rh = bodySec.rowHeights[r]!
      if (rh + headerH > fullPageAvail + 1e-6) {
        throw new ApwPdfError(
          'BLOCK_TOO_TALL',
          `Table row at ${path}.rows[${r}] exceeds page height`,
          { path: `${path}.rows[${r}]` },
        )
      }
    }
  }

  return makeTableFragment(headerSec, bodySec, footerSec, t.repeatHeader ?? false, path, t.$inst)
}

registerBlockHandler('table', layoutTable)
