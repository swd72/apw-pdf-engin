import { ApwPdfError } from '../errors.js'
import type { LoadedFont } from '../fonts/registry.js'
import type { TabStop } from '../schema.js'
import { toPt } from '../units.js'
import type { InlineItem } from './inline.js'
import type { BrokenLine } from './linebreak.js'

export const DISTRIBUTE_WEIGHTS = { space: 4, cluster: 1 } as const

export interface AnchorTable {
  get(name: string): number | undefined
  set(name: string, x: number): void
}

export function createAnchorTable(): AnchorTable {
  const map = new Map<string, number>()
  return {
    get(name: string): number | undefined {
      return map.get(name)
    },
    set(name: string, x: number): void {
      map.set(name, x)
    },
  }
}

export interface ResolvedTabStop {
  at: number
  align: 'left' | 'center' | 'right' | 'decimal'
  leader: 'none' | 'dots' | 'line'
}

export interface TabCtx {
  lineStartX: number
  tabs: ResolvedTabStop[]
  defaultInterval: 36
  contentRight: number
}

export interface PlacedGlyph {
  id: number
  dx: number
  dy: number
  advance: number
}

export interface PlacedRun {
  font: LoadedFont
  size: number
  color: string
  x: number
  glyphs: PlacedGlyph[]
  text: string
  clusters: number[]
  path: string
  underline?: boolean | 'dotted'
  tokenKind?: 'pageNumber' | 'pageCount'
}

export type PlacedShape =
  | {
      kind: 'line'
      x1: number
      y1: number
      x2: number
      y2: number
      width: number
      dash?: number[]
      color: string
    }
  | {
      kind: 'rect'
      x: number
      y: number
      w: number
      h: number
      fill?: string
      stroke?: string
      strokeWidth?: number
    }

export type PlacedLineResult = PlacedRun[] & {
  runs: PlacedRun[]
  shapes: PlacedShape[]
}

export function resolveTabStops(
  tabs: TabStop[] | undefined,
  indentLeftX: number,
  anchors: AnchorTable,
  path: string,
): ResolvedTabStop[] {
  if (!tabs || tabs.length === 0) return []
  const resolved: ResolvedTabStop[] = []
  for (const t of tabs) {
    let at: number
    if (typeof t.at === 'string' && t.at.startsWith('@')) {
      const name = t.at.slice(1)
      const val = anchors.get(name)
      if (val === undefined) {
        throw new ApwPdfError('ANCHOR_NOT_FOUND', `Anchor "@${name}" not found`, { path })
      }
      at = val
    } else {
      at = indentLeftX + toPt(t.at, { path })
    }
    resolved.push({
      at,
      align: t.align ?? 'left',
      leader: t.leader ?? 'none',
    })
  }
  resolved.sort((a, b) => a.at - b.at)
  return resolved
}

function findNextTabStop(currentX: number, ctx: TabCtx): ResolvedTabStop {
  for (const t of ctx.tabs) {
    if (t.at > currentX + 1e-4) {
      return t
    }
  }
  const interval = ctx.defaultInterval || 36
  const rel = Math.max(0, currentX - ctx.lineStartX)
  const nextMult = Math.floor(rel / interval + 1e-6) + 1
  return {
    at: ctx.lineStartX + nextMult * interval,
    align: 'left',
    leader: 'none',
  }
}

function splitTabSegments(items: InlineItem[]): {
  segments: InlineItem[][]
  precededByToTabFill: boolean[]
} {
  const segments: InlineItem[][] = [[]]
  const precededByToTabFill: boolean[] = [false]

  for (let i = 0; i < items.length; i++) {
    const it = items[i]!
    if (it.kind === 'tab') {
      const prev = i > 0 ? items[i - 1] : undefined
      const wasToTab = prev?.kind === 'fill' && prev.widthSpec === 'toTab'
      segments.push([])
      precededByToTabFill.push(wasToTab)
    } else {
      segments[segments.length - 1]!.push(it)
    }
  }
  return { segments, precededByToTabFill }
}

function measurePlainSegmentWidth(items: InlineItem[]): number {
  let w = 0
  for (const it of items) {
    w += it.width
  }
  return w
}

function measureDecimalOffset(items: InlineItem[]): number {
  let w = 0
  for (const it of items) {
    if (it.kind === 'word') {
      const dotIdx = it.text.indexOf('.')
      if (dotIdx !== -1) {
        const prefix = it.text.slice(0, dotIdx)
        return w + it.font.shape(prefix, it.size).width
      }
    }
    w += it.width
  }
  return w
}

export function naturalWidth(items: InlineItem[], ctx: TabCtx): number {
  if (items.length === 0) return 0
  const { segments, precededByToTabFill } = splitTabSegments(items)
  let cursorX = ctx.lineStartX
  let lastToTabStop: ResolvedTabStop | undefined

  for (let sIdx = 0; sIdx < segments.length; sIdx++) {
    const seg = segments[sIdx]!
    if (sIdx > 0) {
      const tabStop =
        precededByToTabFill[sIdx] && lastToTabStop
          ? lastToTabStop
          : findNextTabStop(cursorX, ctx)
      const segW = measurePlainSegmentWidth(seg)
      let startX = tabStop.at
      if (tabStop.align === 'center') startX = tabStop.at - segW / 2
      else if (tabStop.align === 'right') startX = tabStop.at - segW
      else if (tabStop.align === 'decimal') startX = tabStop.at - measureDecimalOffset(seg)
      cursorX = Math.max(cursorX, startX)
    }

    for (const it of seg) {
      if (it.kind === 'fill') {
        if (it.widthSpec === 'toTab') {
          const nextTab = findNextTabStop(cursorX, ctx)
          lastToTabStop = nextTab
          const fillW = Math.max(it.shaped.width, nextTab.at - cursorX)
          cursorX += fillW
        } else if (it.widthSpec === 'toEnd') {
          const fillW = Math.max(it.shaped.width, ctx.contentRight - cursorX)
          cursorX += fillW
        } else {
          cursorX += it.widthSpec
        }
      } else {
        cursorX += it.width
      }
    }
  }

  return cursorX - ctx.lineStartX
}

interface GlyphClusterGroup {
  cluster: number
  nextCluster: number
  glyphIndices: number[]
}

function groupGlyphClusters(
  glyphs: { cluster: number }[],
  textLength: number,
): GlyphClusterGroup[] {
  if (glyphs.length === 0) return []
  const groups: GlyphClusterGroup[] = []
  for (let i = 0; i < glyphs.length; i++) {
    const c = glyphs[i]!.cluster
    const last = groups.length > 0 ? groups[groups.length - 1] : undefined
    if (last && last.cluster === c) {
      last.glyphIndices.push(i)
    } else {
      groups.push({ cluster: c, nextCluster: textLength, glyphIndices: [i] })
    }
  }
  for (let i = 0; i < groups.length - 1; i++) {
    groups[i]!.nextCluster = groups[i + 1]!.cluster
  }
  return groups
}

export function placeLine(
  line: BrokenLine,
  opts: {
    x: number
    width: number
    align: 'left' | 'center' | 'right' | 'justify' | 'thaiDistributed'
    tab: TabCtx
    anchors: AnchorTable
  },
): PlacedLineResult {
  const runs: PlacedRun[] = []
  const shapes: PlacedShape[] = []

  if (line.items.length === 0) {
    return Object.assign(runs, { runs, shapes })
  }

  const tabCtx: TabCtx = {
    ...opts.tab,
    lineStartX: opts.x,
  }

  const { segments, precededByToTabFill } = splitTabSegments(line.items)
  const hasTabs = segments.length > 1
  const natW = naturalWidth(line.items, tabCtx)

  let cursorX = opts.x
  if (!hasTabs) {
    if (opts.align === 'center') {
      cursorX = opts.x + (opts.width - natW) / 2
    } else if (opts.align === 'right') {
      cursorX = opts.x + opts.width - natW
    }
  }

  let lastToTabStop: ResolvedTabStop | undefined

  for (let sIdx = 0; sIdx < segments.length; sIdx++) {
    const seg = segments[sIdx]!
    const isLastSegment = sIdx === segments.length - 1

    if (sIdx > 0) {
      const tabStop =
        precededByToTabFill[sIdx] && lastToTabStop
          ? lastToTabStop
          : findNextTabStop(cursorX, tabCtx)
      const segW = measurePlainSegmentWidth(seg)
      let targetStartX = tabStop.at
      if (tabStop.align === 'center') targetStartX = tabStop.at - segW / 2
      else if (tabStop.align === 'right') targetStartX = tabStop.at - segW
      else if (tabStop.align === 'decimal') targetStartX = tabStop.at - measureDecimalOffset(seg)
      targetStartX = Math.max(cursorX, targetStartX)

      if (tabStop.leader !== 'none' && targetStartX > cursorX + 0.5) {
        shapes.push({
          kind: 'line',
          x1: cursorX,
          y1: 0,
          x2: targetStartX,
          y2: 0,
          width: 0.5,
          dash: tabStop.leader === 'dots' ? [1, 2] : undefined,
          color: '#000000',
        })
      }
      cursorX = targetStartX
    }

    // Calculate distribution extra for the last segment
    const shouldDistribute =
      isLastSegment &&
      !line.isLast &&
      !line.endsWithBreak &&
      (opts.align === 'justify' || opts.align === 'thaiDistributed') &&
      !seg.some((it) => it.kind === 'fill' && (it.widthSpec === 'toEnd' || it.widthSpec === 'toTab'))

    // Pre-calculate cluster groups for word items in this segment
    const wordClusters = seg.map((it) =>
      it.kind === 'word' ? groupGlyphClusters(it.shaped.glyphs, it.text.length) : [],
    )

    let spaceExtraEach = 0
    let unitExtra = 0

    if (shouldDistribute) {
      const segNatW = measurePlainSegmentWidth(seg)
      const targetRight = opts.x + opts.width
      const extra = targetRight - (cursorX + segNatW)

      if (extra > 1e-4) {
        if (opts.align === 'justify') {
          const spaceCount = seg.filter((it) => it.kind === 'space').length
          if (spaceCount > 0) {
            spaceExtraEach = extra / spaceCount
          }
        } else if (opts.align === 'thaiDistributed') {
          let totalWeight = 0
          for (let i = 0; i < seg.length; i++) {
            const it = seg[i]!
            if (it.kind === 'space') {
              totalWeight += DISTRIBUTE_WEIGHTS.space
            } else if (it.kind === 'word') {
              const cGroups = wordClusters[i]!
              if (cGroups.length > 1) {
                totalWeight += (cGroups.length - 1) * DISTRIBUTE_WEIGHTS.cluster
              }
              const nextIt = i + 1 < seg.length ? seg[i + 1] : undefined
              if (nextIt && nextIt.kind !== 'space') {
                totalWeight += DISTRIBUTE_WEIGHTS.cluster
              }
            } else {
              const nextIt = i + 1 < seg.length ? seg[i + 1] : undefined
              if (nextIt && nextIt.kind !== 'space') {
                totalWeight += DISTRIBUTE_WEIGHTS.cluster
              }
            }
          }
          if (totalWeight > 0) {
            unitExtra = extra / totalWeight
          }
        }
      }
    }

    for (let i = 0; i < seg.length; i++) {
      const it = seg[i]!
      const nextIt = i + 1 < seg.length ? seg[i + 1] : undefined

      if (it.kind === 'word') {
        const glyphs: PlacedGlyph[] = it.shaped.glyphs.map((g) => ({
          id: g.id,
          dx: g.dx,
          dy: g.dy,
          advance: g.advance,
        }))
        const clusters = it.shaped.glyphs.map((g) => g.cluster)
        const cGroups = wordClusters[i]!

        // Apply Thai distributed extra to the last glyph of each cluster
        if (unitExtra > 0 && cGroups.length > 0) {
          for (let cIdx = 0; cIdx < cGroups.length; cIdx++) {
            const grp = cGroups[cIdx]!
            const lastGlyphIdx = grp.glyphIndices[grp.glyphIndices.length - 1]!
            if (cIdx < cGroups.length - 1) {
              glyphs[lastGlyphIdx]!.advance += unitExtra * DISTRIBUTE_WEIGHTS.cluster
            } else if (nextIt && nextIt.kind !== 'space') {
              glyphs[lastGlyphIdx]!.advance += unitExtra * DISTRIBUTE_WEIGHTS.cluster
            }
          }
        }

        // Record anchors after alignment and distribution
        if (it.anchors.length > 0 && cGroups.length > 0) {
          let penX = cursorX
          for (const grp of cGroups) {
            const clusterStartX = penX
            let clusterAdv = 0
            for (const gIdx of grp.glyphIndices) {
              clusterAdv += glyphs[gIdx]!.advance
            }
            const clusterEndX = clusterStartX + clusterAdv
            for (const a of it.anchors) {
              if (a.offset >= grp.cluster && a.offset < grp.nextCluster) {
                opts.anchors.set(a.name, a.edge === 'end' ? clusterEndX : clusterStartX)
              }
            }
            penX = clusterEndX
          }
        }

        const runW = glyphs.reduce((s, g) => s + g.advance, 0)
        const placedRun: PlacedRun = {
          font: it.font,
          size: it.size,
          color: it.color,
          x: cursorX,
          glyphs,
          text: it.text,
          clusters,
          path: it.path,
          underline: it.underline,
        }
        runs.push(placedRun)

        if (it.underline) {
          shapes.push({
            kind: 'line',
            x1: cursorX,
            y1: 1.2,
            x2: cursorX + runW,
            y2: 1.2,
            width: it.size * 0.05,
            dash: it.underline === 'dotted' ? [1, 1] : undefined,
            color: it.color,
          })
        }

        cursorX += runW
        continue
      }

      if (it.kind === 'space') {
        const extraAdv =
          opts.align === 'justify'
            ? spaceExtraEach
            : opts.align === 'thaiDistributed'
              ? unitExtra * DISTRIBUTE_WEIGHTS.space
              : 0
        const glyphs: PlacedGlyph[] = it.shaped.glyphs.map((g, gIdx) => ({
          id: g.id,
          dx: g.dx,
          dy: g.dy,
          advance: g.advance + (gIdx === it.shaped.glyphs.length - 1 ? extraAdv : 0),
        }))
        const clusters = it.shaped.glyphs.map((g) => g.cluster)
        const runW = glyphs.reduce((s, g) => s + g.advance, 0)
        runs.push({
          font: it.font,
          size: it.size,
          color: it.color,
          x: cursorX,
          glyphs,
          text: it.text,
          clusters,
          path: it.path,
          underline: it.underline,
        })
        if (it.underline) {
          shapes.push({
            kind: 'line',
            x1: cursorX,
            y1: 1.2,
            x2: cursorX + runW,
            y2: 1.2,
            width: it.size * 0.05,
            dash: it.underline === 'dotted' ? [1, 1] : undefined,
            color: it.color,
          })
        }
        cursorX += runW
        continue
      }

      if (it.kind === 'fill') {
        let fillW: number
        if (it.widthSpec === 'toTab') {
          const nextTab = findNextTabStop(cursorX, tabCtx)
          lastToTabStop = nextTab
          fillW = Math.max(it.shaped.width, nextTab.at - cursorX)
        } else if (it.widthSpec === 'toEnd') {
          fillW = Math.max(it.shaped.width, tabCtx.contentRight - cursorX)
        } else {
          fillW = it.widthSpec
        }

        const fillStartX = cursorX
        const fillEndX = fillStartX + fillW

        if (it.leader !== 'none' && fillEndX > fillStartX) {
          shapes.push({
            kind: 'line',
            x1: fillStartX,
            y1: 0,
            x2: fillEndX,
            y2: 0,
            width: 0.5,
            dash: it.leader === 'dots' ? [1, 2] : undefined,
            color: it.color,
          })
        }

        if (it.text.length > 0 && it.shaped.glyphs.length > 0) {
          const textW = it.shaped.width
          const textX =
            it.align === 'center' ? fillStartX + (fillW - textW) / 2 : fillStartX
          runs.push({
            font: it.font,
            size: it.size,
            color: it.color,
            x: textX,
            glyphs: it.shaped.glyphs.map((g) => ({
              id: g.id,
              dx: g.dx,
              dy: g.dy,
              advance: g.advance,
            })),
            text: it.text,
            clusters: it.shaped.glyphs.map((g) => g.cluster),
            path: it.path,
          })
        }

        cursorX = fillEndX
        continue
      }

      if (it.kind === 'checkbox') {
        const extraAfter =
          unitExtra > 0 && nextIt && nextIt.kind !== 'space'
            ? unitExtra * DISTRIBUTE_WEIGHTS.cluster
            : 0
        if (it.shaped) {
          const glyphChar = it.checked ? '\u2611' : '\u2610'
          runs.push({
            font: it.font,
            size: it.size,
            color: it.color,
            x: cursorX,
            glyphs: it.shaped.glyphs.map((g, gIdx) => ({
              id: g.id,
              dx: g.dx,
              dy: g.dy,
              advance: g.advance + (gIdx === it.shaped!.glyphs.length - 1 ? extraAfter : 0),
            })),
            text: glyphChar,
            clusters: it.shaped.glyphs.map((g) => g.cluster),
            path: it.path,
          })
        } else {
          const boxSide = it.size * 0.55
          const boxX = cursorX + (it.width - boxSide) / 2
          const boxY = -boxSide * 0.85
          shapes.push({
            kind: 'rect',
            x: boxX,
            y: boxY,
            w: boxSide,
            h: boxSide,
            stroke: it.color,
            strokeWidth: 0.75,
          })
          if (it.checked) {
            shapes.push({
              kind: 'line',
              x1: boxX + boxSide * 0.18,
              y1: boxY + boxSide * 0.55,
              x2: boxX + boxSide * 0.42,
              y2: boxY + boxSide * 0.8,
              width: 1,
              color: it.color,
            })
            shapes.push({
              kind: 'line',
              x1: boxX + boxSide * 0.42,
              y1: boxY + boxSide * 0.8,
              x2: boxX + boxSide * 0.82,
              y2: boxY + boxSide * 0.2,
              width: 1,
              color: it.color,
            })
          }
        }
        cursorX += it.width + extraAfter
        continue
      }

      if (it.kind === 'pageNumber' || it.kind === 'pageCount') {
        const placeholder = it.font.shape('00', it.size)
        runs.push({
          font: it.font,
          size: it.size,
          color: it.color,
          x: cursorX,
          glyphs: placeholder.glyphs.map((g) => ({
            id: g.id,
            dx: g.dx,
            dy: g.dy,
            advance: g.advance,
          })),
          text: it.kind === 'pageNumber' ? '{{pageNumber}}' : '{{pageCount}}',
          clusters: placeholder.glyphs.map((g) => g.cluster),
          path: it.path,
          tokenKind: it.kind,
        })
        cursorX += it.width
        continue
      }
    }
  }

  const mergedRuns: PlacedRun[] = []
  for (const r of runs) {
    const prev = mergedRuns.length > 0 ? mergedRuns[mergedRuns.length - 1] : undefined
    if (
      prev &&
      prev.font.id === r.font.id &&
      prev.size === r.size &&
      prev.color === r.color &&
      prev.underline === r.underline &&
      prev.tokenKind === undefined &&
      r.tokenKind === undefined
    ) {
      const prevW = prev.glyphs.reduce((s, g) => s + g.advance, 0)
      if (Math.abs(prev.x + prevW - r.x) < 1e-3) {
        const textOffset = prev.text.length
        prev.text += r.text
        prev.glyphs.push(...r.glyphs)
        prev.clusters.push(...r.clusters.map((c) => c + textOffset))
        continue
      }
    }
    mergedRuns.push({
      ...r,
      glyphs: [...r.glyphs],
      clusters: [...r.clusters],
    })
  }

  return Object.assign(mergedRuns, { runs: mergedRuns, shapes })
}
