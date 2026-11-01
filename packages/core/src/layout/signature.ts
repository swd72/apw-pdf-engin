import type { ResolvedSignature } from '../bind/bind.js'
import { lineBox } from '../fonts/metrics.js'
import { toPt } from '../units.js'
import {
  loadImageWithCache,
  registerBlockHandler,
  type FlowContext,
  type Fragment,
} from './flow.js'
import type { LayoutItem } from './tree.js'

export async function layoutSignature(
  s: ResolvedSignature,
  ctx: FlowContext,
  xOrPath: number | string,
  widthArg?: number,
  pathArg?: string,
): Promise<Fragment> {
  const x = typeof xOrPath === 'number' ? xOrPath : ctx.box.contentLeft
  const width = typeof widthArg === 'number' ? widthArg : ctx.box.contentWidth
  const path = typeof xOrPath === 'string' ? xOrPath : (pathArg ?? 'blocks[0]')

  const family = ctx.doc.font.family
  const size = toPt(ctx.doc.font.size)
  const color = ctx.doc.font.color ?? '#000000'
  const font = await ctx.fonts.get(family, false, false)
  const spacing = ctx.doc.font.lineSpacing ?? 'single'
  const box = lineBox(font.metrics, size, spacing)
  const singleH = box.height
  const ascent = box.ascent

  const startX =
    s.startAt === undefined || s.startAt === 'center'
      ? x + width / 2
      : x + toPt(s.startAt)

  const linesBefore = s.linesBefore ?? 4
  const minLinesBefore = s.minLinesBefore ?? 3

  const trimmedName = s.name.trim()
  const nameText =
    trimmedName.startsWith('(') && trimmedName.endsWith(')')
      ? trimmedName
      : `(${trimmedName})`
  const nameShaped = font.shape(nameText, size)
  for (const ch of nameShaped.missing) {
    ctx.warnings.push({
      code: 'MISSING_GLYPH',
      message: `Missing glyph for "${ch}" in font ${font.family}`,
      path,
    })
  }

  const nameW = nameShaped.width

  const hasPrefix = Boolean(s.prefix && s.prefix.length > 0)
  const hasImage = Boolean(s.image && s.image.length > 0)
  const hasTopRow = hasPrefix || hasImage

  let prefixShaped: ReturnType<typeof font.shape> | undefined
  if (hasPrefix && s.prefix) {
    prefixShaped = font.shape(s.prefix, size)
    for (const ch of prefixShaped.missing) {
      ctx.warnings.push({
        code: 'MISSING_GLYPH',
        message: `Missing glyph for "${ch}" in font ${font.family}`,
        path,
      })
    }
  }

  const prefixW = prefixShaped ? prefixShaped.width : 0
  const sigLineStartX = hasPrefix ? startX + prefixW + 4 : startX
  const sigLineW = hasPrefix
    ? Math.min(toPt('6cm'), Math.max(0, x + width - sigLineStartX))
    : 0
  const sigLineEndX = sigLineStartX + sigLineW

  const nameCenterX =
    hasPrefix && sigLineW > 0 ? (sigLineStartX + sigLineEndX) / 2 : startX + nameW / 2
  const nameX = hasPrefix && sigLineW > 0 ? nameCenterX - nameW / 2 : startX

  let imgDims: { resolvedSrc: string; w: number; h: number } | undefined
  if (hasImage && s.image) {
    const info = await loadImageWithCache(s.image, ctx, path)
    const imgH = s.imageHeight !== undefined ? toPt(s.imageHeight) : singleH * 1.5
    const imgW = imgH * (info.width / info.height)
    imgDims = { resolvedSrc: info.resolvedSrc, w: imgW, h: imgH }
  }

  const positions = s.positions ?? []
  const posShapedList = positions.map((posText) => {
    const sh = font.shape(posText, size)
    for (const ch of sh.missing) {
      ctx.warnings.push({
        code: 'MISSING_GLYPH',
        message: `Missing glyph for "${ch}" in font ${font.family}`,
        path,
      })
    }
    return { text: posText, shaped: sh }
  })

  const topRowLines = hasTopRow ? 1 : 0
  const spaceBefore = hasTopRow
    ? Math.max(0, (linesBefore - 2) * singleH)
    : Math.max(0, (linesBefore - 1) * singleH)

  const totalLines = topRowLines + 1 + posShapedList.length
  const totalHeight = totalLines * singleH

  return {
    height: totalHeight,
    spaceBefore,
    spaceAfter: 0,
    minLinesBefore,
    path,
    splittable: false,
    items(yTop: number): LayoutItem[] {
      const out: LayoutItem[] = []
      let currY = yTop

      if (hasTopRow) {
        if (prefixShaped && s.prefix) {
          out.push({
            kind: 'glyphs',
            font: font.id,
            size,
            color,
            x: startX,
            y: currY + ascent,
            glyphs: prefixShaped.glyphs.map((g) => ({
              id: g.id,
              dx: g.dx,
              dy: g.dy,
              advance: g.advance,
            })),
            text: s.prefix,
            clusters: prefixShaped.glyphs.map((g) => g.cluster),
            sourcePath: path,
          })
          if (!hasImage && sigLineW > 0) {
            out.push({
              kind: 'line',
              x1: sigLineStartX,
              y1: currY + ascent,
              x2: sigLineEndX,
              y2: currY + ascent,
              width: 0.5,
              dash: [1, 2],
              color,
            })
          }
        }
        if (imgDims && s.image) {
          const imgX = nameCenterX - imgDims.w / 2
          const imgY = currY + singleH - imgDims.h
          out.push({
            kind: 'image',
            ref: imgDims.resolvedSrc,
            x: imgX,
            y: imgY,
            w: imgDims.w,
            h: imgDims.h,
          })
        }
        currY += singleH
      }

      // Name line
      out.push({
        kind: 'glyphs',
        font: font.id,
        size,
        color,
        x: nameX,
        y: currY + ascent,
        glyphs: nameShaped.glyphs.map((g) => ({
          id: g.id,
          dx: g.dx,
          dy: g.dy,
          advance: g.advance,
        })),
        text: nameText,
        clusters: nameShaped.glyphs.map((g) => g.cluster),
        sourcePath: path,
      })
      currY += singleH

      // Position lines centered on nameCenterX
      for (const pos of posShapedList) {
        const posX = nameCenterX - pos.shaped.width / 2
        out.push({
          kind: 'glyphs',
          font: font.id,
          size,
          color,
          x: posX,
          y: currY + ascent,
          glyphs: pos.shaped.glyphs.map((g) => ({
            id: g.id,
            dx: g.dx,
            dy: g.dy,
            advance: g.advance,
          })),
          text: pos.text,
          clusters: pos.shaped.glyphs.map((g) => g.cluster),
          sourcePath: path,
        })
        currY += singleH
      }

      return out
    },
  }
}

registerBlockHandler('signature', (block, ctx, x, width, path) =>
  layoutSignature(block, ctx, x, width, path),
)
