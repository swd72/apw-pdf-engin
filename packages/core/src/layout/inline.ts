import type { ResolvedInline, ResolvedParagraph } from '../bind/bind.js'
import type { Warning } from '../errors.js'
import type { FontSpec } from '../fonts/metrics.js'
import type { FontRegistry, LoadedFont, ShapedRun } from '../fonts/registry.js'
import { graphemeClusters } from '../text/clusters.js'
import { segmentWords } from '../text/segment.js'
import { toPt } from '../units.js'

export interface WordAnchor {
  name: string
  offset: number
  edge: 'start' | 'end'
}

export interface WordInlineItem {
  kind: 'word'
  text: string
  font: LoadedFont
  size: number
  color: string
  underline?: boolean | 'dotted'
  shaped: ShapedRun
  anchors: WordAnchor[]
  width: number
  path: string
}

export interface SpaceInlineItem {
  kind: 'space'
  text: string
  font: LoadedFont
  size: number
  color: string
  underline?: boolean | 'dotted'
  shaped: ShapedRun
  width: number
  path: string
}

export interface TabInlineItem {
  kind: 'tab'
  width: number
  path: string
}

export interface FillInlineItem {
  kind: 'fill'
  text: string
  widthSpec: number | 'toTab' | 'toEnd'
  leader: 'dots' | 'line' | 'none'
  align: 'left' | 'center'
  font: LoadedFont
  size: number
  color: string
  shaped: ShapedRun
  width: number
  tokens?: (WordInlineItem | SpaceInlineItem)[]
  path: string
}

export interface CheckboxInlineItem {
  kind: 'checkbox'
  checked: boolean
  font: LoadedFont
  size: number
  color: string
  shaped?: ShapedRun
  width: number
  path: string
}

export interface BreakInlineItem {
  kind: 'break'
  width: number
  path: string
}

export interface PageTokenInlineItem {
  kind: 'pageNumber' | 'pageCount'
  font: LoadedFont
  size: number
  color: string
  width: number
  path: string
}

export type InlineItem =
  | WordInlineItem
  | SpaceInlineItem
  | TabInlineItem
  | FillInlineItem
  | CheckboxInlineItem
  | BreakInlineItem
  | PageTokenInlineItem

function isWhitespaceToken(tok: string): boolean {
  return tok.length > 0 && /^[^\S\u00A0]+$/.test(tok)
}

export async function buildInlineItems(
  p: ResolvedParagraph,
  ctx: {
    fonts: FontRegistry
    base: FontSpec
    dictionary: string[]
    path: string
  },
): Promise<{ items: InlineItem[]; warnings: Warning[] }> {
  const warnings: Warning[] = []
  const items: InlineItem[] = []

  const paraFont: FontSpec = {
    family: p.font?.family ?? ctx.base.family,
    size: p.font?.size !== undefined ? toPt(p.font.size) : ctx.base.size,
    bold: p.font?.bold ?? ctx.base.bold,
    italic: p.font?.italic ?? ctx.base.italic,
    color: p.font?.color ?? ctx.base.color,
  }

  const runs: ResolvedInline[] =
    p.runs !== undefined ? p.runs : p.text !== undefined ? [{ text: p.text }] : []

  for (let rIdx = 0; rIdx < runs.length; rIdx++) {
    const run = runs[rIdx]!
    const runPath = ctx.path

    if ('text' in run) {
      const family = run.family ?? paraFont.family
      const size = run.size !== undefined ? toPt(run.size) : paraFont.size
      const bold = run.bold ?? paraFont.bold
      const italic = run.italic ?? paraFont.italic
      const color = run.color ?? paraFont.color
      const underline = run.underline
      const font = await ctx.fonts.get(family, bold, italic)

      if (run.text.length === 0) {
        continue
      }

      const tokens = segmentWords(run.text, ctx.dictionary)
      let charOffset = 0

      for (const tok of tokens) {
        const tokStart = charOffset
        const tokEnd = charOffset + tok.length
        charOffset = tokEnd

        const shaped = font.shape(tok, size)
        for (const ch of shaped.missing) {
          warnings.push({
            code: 'MISSING_GLYPH',
            message: `Missing glyph for "${ch}" in font ${font.family}`,
            path: ctx.path,
          })
        }

        if (isWhitespaceToken(tok)) {
          const clusters = graphemeClusters(tok)
          const singleSpaceShaped = font.shape(' ', size)
          for (let s = 0; s < clusters.length; s++) {
            items.push({
              kind: 'space',
              text: ' ',
              font,
              size,
              color,
              underline,
              shaped: singleSpaceShaped,
              width: singleSpaceShaped.width,
              path: runPath,
            })
          }
        } else {
          const wordAnchors: WordAnchor[] = []
          if (run.anchors) {
            for (const a of run.anchors) {
              if (a.index >= tokStart && a.index < tokEnd) {
                wordAnchors.push({
                  name: a.name,
                  offset: a.index - tokStart,
                  edge: a.edge ?? 'start',
                })
              } else if (a.index === tokEnd && tokEnd === run.text.length) {
                wordAnchors.push({
                  name: a.name,
                  offset: Math.max(0, tok.length - 1),
                  edge: a.edge ?? 'end',
                })
              }
            }
          }
          items.push({
            kind: 'word',
            text: tok,
            font,
            size,
            color,
            underline,
            shaped,
            anchors: wordAnchors,
            width: shaped.width,
            path: runPath,
          })
        }
      }
      continue
    }

    if ('tab' in run) {
      items.push({ kind: 'tab', width: 0, path: runPath })
      continue
    }

    if ('fill' in run) {
      const font = await ctx.fonts.get(paraFont.family, paraFont.bold, paraFont.italic)
      const size = paraFont.size
      const widthSpec =
        run.width === 'toTab' || run.width === 'toEnd' ? run.width : toPt(run.width)
      const shaped = font.shape(run.fill, size)
      for (const ch of shaped.missing) {
        warnings.push({
          code: 'MISSING_GLYPH',
          message: `Missing glyph for "${ch}" in font ${font.family}`,
          path: ctx.path,
        })
      }
      const tokens: (WordInlineItem | SpaceInlineItem)[] = []
      if (run.fill.length > 0) {
        const segs = segmentWords(run.fill, ctx.dictionary)
        for (const tok of segs) {
          if (isWhitespaceToken(tok)) {
            const clusters = graphemeClusters(tok)
            const singleSpaceShaped = font.shape(' ', size)
            for (let s = 0; s < clusters.length; s++) {
              tokens.push({
                kind: 'space',
                text: ' ',
                font,
                size,
                color: paraFont.color,
                shaped: singleSpaceShaped,
                width: singleSpaceShaped.width,
                path: runPath,
              })
            }
          } else {
            const tokShaped = font.shape(tok, size)
            tokens.push({
              kind: 'word',
              text: tok,
              font,
              size,
              color: paraFont.color,
              shaped: tokShaped,
              anchors: [],
              width: tokShaped.width,
              path: runPath,
            })
          }
        }
      }
      const width =
        typeof widthSpec === 'number' ? Math.max(widthSpec, shaped.width) : shaped.width
      items.push({
        kind: 'fill',
        text: run.fill,
        widthSpec,
        leader: run.leader ?? 'dots',
        align: run.align ?? 'left',
        font,
        size,
        color: paraFont.color,
        shaped,
        width,
        tokens,
        path: runPath,
      })
      continue
    }

    if ('checkbox' in run) {
      const font = await ctx.fonts.get(paraFont.family, paraFont.bold, paraFont.italic)
      const size = paraFont.size
      const glyphChar = run.checkbox ? '\u2611' : '\u2610'
      const probe = font.shape(glyphChar, size)
      const hasGlyph =
        probe.missing.length === 0 && probe.glyphs.length > 0 && probe.glyphs[0]!.id !== 0
      const width = hasGlyph ? probe.width : size * 0.7
      items.push({
        kind: 'checkbox',
        checked: run.checkbox,
        font,
        size,
        color: paraFont.color,
        shaped: hasGlyph ? probe : undefined,
        width,
        path: runPath,
      })
      continue
    }

    if ('lineBreak' in run) {
      items.push({ kind: 'break', width: 0, path: runPath })
      continue
    }

    if ('pageNumber' in run || 'pageCount' in run) {
      const font = await ctx.fonts.get(paraFont.family, paraFont.bold, paraFont.italic)
      const size = paraFont.size
      const width = font.shape('00', size).width
      items.push({
        kind: 'pageNumber' in run ? 'pageNumber' : 'pageCount',
        font,
        size,
        color: paraFont.color,
        width,
        path: runPath,
      })
      continue
    }
  }

  return { items, warnings }
}
