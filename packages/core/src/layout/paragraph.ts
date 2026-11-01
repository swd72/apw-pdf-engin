import type { ResolvedParagraph } from '../bind/bind.js'
import type { Warning } from '../errors.js'
import { lineBox, type FontSpec } from '../fonts/metrics.js'
import type { FontRegistry } from '../fonts/registry.js'
import type { LineSpacing, ParagraphStyle } from '../schema.js'
import { toPt } from '../units.js'
import {
  naturalWidth,
  placeLine,
  resolveTabStops,
  type AnchorTable,
  type PlacedRun,
  type PlacedShape,
  type TabCtx,
} from './align.js'
import { buildInlineItems, type InlineItem } from './inline.js'
import { breakLines } from './linebreak.js'

export interface LaidLine {
  height: number
  ascent: number
  runs: PlacedRun[]
  shapes: PlacedShape[]
  pendingAnchors: Record<string, number>
}

export interface ParagraphLayout {
  lines: LaidLine[]
  spaceBefore: number
  spaceAfter: number
  keepWithNext: boolean
  keepLinesTogether: boolean
  widowControl: boolean
  path: string
}

function mergeParagraphWithStyle(
  p: ResolvedParagraph,
  styles?: Record<string, ParagraphStyle>,
): ResolvedParagraph {
  if (!p.style || !styles?.[p.style]) {
    return p
  }
  const st = styles[p.style]!
  return {
    ...st,
    ...p,
    font: st.font || p.font ? { ...st.font, ...p.font } : undefined,
  }
}

export async function layoutParagraph(
  p: ResolvedParagraph,
  ctx: {
    fonts: FontRegistry
    base: FontSpec
    styles?: Record<string, ParagraphStyle>
    dictionary: string[]
    contentLeft: number
    contentWidth: number
    anchors: AnchorTable
    path: string
    lineSpacing?: LineSpacing
  },
): Promise<{ layout: ParagraphLayout; warnings: Warning[] }> {
  const merged = mergeParagraphWithStyle(p, ctx.styles)
  const warnings: Warning[] = []

  const paraFont: FontSpec = {
    family: merged.font?.family ?? ctx.base.family,
    size: merged.font?.size !== undefined ? toPt(merged.font.size) : ctx.base.size,
    bold: merged.font?.bold ?? ctx.base.bold,
    italic: merged.font?.italic ?? ctx.base.italic,
    color: merged.font?.color ?? ctx.base.color,
  }

  const defaultLoadedFont = await ctx.fonts.get(paraFont.family, paraFont.bold, paraFont.italic)

  const { items, warnings: inlineWarnings } = await buildInlineItems(merged, {
    fonts: ctx.fonts,
    base: ctx.base,
    dictionary: ctx.dictionary,
    path: ctx.path,
  })
  warnings.push(...inlineWarnings)

  const indentLeft = merged.indentLeft !== undefined ? toPt(merged.indentLeft) : 0
  const indentRight = merged.indentRight !== undefined ? toPt(merged.indentRight) : 0
  const firstLineIndent =
    merged.firstLineIndent !== undefined
      ? toPt(merged.firstLineIndent, { allowNegative: true })
      : 0

  const indentLeftX = ctx.contentLeft + indentLeft
  const contentRight = ctx.contentLeft + ctx.contentWidth - indentRight

  const resolvedTabs = resolveTabStops(merged.tabs, indentLeftX, ctx.anchors, ctx.path)
  const baseTabCtx: TabCtx = {
    lineStartX: indentLeftX,
    indentLeftX,
    tabs: resolvedTabs,
    defaultInterval: 36,
    contentRight,
  }

  const widthFor = (lineIndex: number): number => {
    const startX = lineIndex === 0 ? indentLeftX + firstLineIndent : indentLeftX
    return Math.max(1, contentRight - startX)
  }

  const { lines: brokenLines, warnings: breakWarnings } = breakLines(
    items,
    widthFor,
    (lineItems: InlineItem[], lineIndex = 0) =>
      naturalWidth(lineItems, {
        ...baseTabCtx,
        lineStartX: lineIndex === 0 ? indentLeftX + firstLineIndent : indentLeftX,
      }),
  )
  warnings.push(...breakWarnings)

  const spacing: LineSpacing = merged.lineSpacing ?? ctx.lineSpacing ?? 'single'
  const align = merged.align ?? 'left'
  const laidLines: LaidLine[] = []

  for (let i = 0; i < brokenLines.length; i++) {
    const bLine = brokenLines[i]!
    const lineStartX = i === 0 ? indentLeftX + firstLineIndent : indentLeftX
    const lineWidth = Math.max(0, contentRight - lineStartX)

    const defaultBox = lineBox(defaultLoadedFont.metrics, paraFont.size, spacing)
    let maxHeight = defaultBox.height
    let maxAscent = defaultBox.ascent

    for (const it of bLine.items) {
      if ('font' in it && 'size' in it) {
        const box = lineBox(it.font.metrics, it.size, spacing)
        if (box.height > maxHeight) maxHeight = box.height
        if (box.ascent > maxAscent) maxAscent = box.ascent
      }
    }

    const pendingAnchors: Record<string, number> = {}
    const lineAnchors: AnchorTable = {
      get(name: string): number | undefined {
        return pendingAnchors[name] ?? ctx.anchors.get(name)
      },
      set(name: string, x: number): void {
        pendingAnchors[name] = x
        ctx.anchors.set(name, x)
      },
    }

    const placed = placeLine(bLine, {
      x: lineStartX,
      width: lineWidth,
      align,
      tab: baseTabCtx,
      anchors: lineAnchors,
    })

    laidLines.push({
      height: maxHeight,
      ascent: maxAscent,
      runs: placed.runs,
      shapes: placed.shapes,
      pendingAnchors,
    })
  }

  const spaceBefore = merged.spaceBefore !== undefined ? toPt(merged.spaceBefore) : 0
  const spaceAfter = merged.spaceAfter !== undefined ? toPt(merged.spaceAfter) : 0

  return {
    layout: {
      lines: laidLines,
      spaceBefore,
      spaceAfter,
      keepWithNext: merged.keepWithNext ?? false,
      keepLinesTogether: merged.keepLinesTogether ?? false,
      widowControl: merged.widowControl ?? true,
      path: ctx.path,
    },
    warnings,
  }
}
