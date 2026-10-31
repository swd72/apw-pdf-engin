import type { ResolvedPageNumber } from '../bind/bind.js'
import { lineBox } from '../fonts/metrics.js'
import { toThaiDigits } from '../thai/digits.js'
import { toPt } from '../units.js'
import type { FlowContext } from './flow.js'
import type { LayoutPage } from './tree.js'

export async function applyPageNumbers(
  pages: LayoutPage[],
  cfg: ResolvedPageNumber,
  ctx: FlowContext,
): Promise<void> {
  const isThai = ctx.doc.numerals === 'thai'
  const totalPages = pages.length

  // First resolve any inline {pageNumber:true} and {pageCount:true} tokens
  for (let i = 0; i < totalPages; i++) {
    const page = pages[i]!
    const pageNumStr = isThai ? toThaiDigits(String(i + 1)) : String(i + 1)
    const pageCountStr = isThai ? toThaiDigits(String(totalPages)) : String(totalPages)

    for (const item of page.items) {
      if (item.kind === 'glyphs' && item.tokenKind) {
        const valStr = item.tokenKind === 'pageNumber' ? pageNumStr : pageCountStr
        const font = ctx.fonts.byId(item.font)
        const shaped = font.shape(valStr, item.size)
        item.text = valStr
        item.glyphs = shaped.glyphs.map((g) => ({
          id: g.id,
          dx: g.dx,
          dy: g.dy,
          advance: g.advance,
        }))
        item.clusters = shaped.glyphs.map((g) => g.cluster)
        delete item.tokenKind
      }
    }
  }

  // Next place header/footer page numbers for pages with index + 1 >= cfg.from
  const sizePt = toPt(cfg.size)
  const offsetPt = toPt(cfg.offset)
  const font = await ctx.fonts.get(ctx.doc.font.family, false, false)
  const box = lineBox(font.metrics, sizePt, 'single')
  const color = ctx.doc.font.color ?? '#000000'

  for (let i = 0; i < totalPages; i++) {
    const pageNum = i + 1
    if (pageNum < cfg.from) continue

    const numStr = isThai ? toThaiDigits(String(pageNum)) : String(pageNum)
    const formatted = cfg.format.replace('{n}', numStr)
    const shaped = font.shape(formatted, sizePt)

    let x: number
    if (cfg.position === 'top-center' || cfg.position === 'bottom-center') {
      x = ctx.box.contentLeft + (ctx.box.contentWidth - shaped.width) / 2
    } else {
      x = ctx.box.contentRight - shaped.width
    }

    let y: number
    if (cfg.position.startsWith('top')) {
      y = offsetPt + box.ascent
    } else {
      y = ctx.box.height - offsetPt - (box.height - box.ascent)
    }

    pages[i]!.items.unshift({
      kind: 'glyphs',
      font: font.id,
      size: sizePt,
      color,
      x,
      y,
      glyphs: shaped.glyphs.map((g) => ({
        id: g.id,
        dx: g.dx,
        dy: g.dy,
        advance: g.advance,
      })),
      text: formatted,
      clusters: shaped.glyphs.map((g) => g.cluster),
      sourcePath: 'pageNumber',
    })
  }
}
