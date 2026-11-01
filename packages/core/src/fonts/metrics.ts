import { ApwPdfError } from '../errors.js'
import type { LineSpacing } from '../schema.js'
import { toPt } from '../units.js'

export interface FontSpec {
  family: string
  size: number
  bold: boolean
  italic: boolean
  color: string
}

export interface FontMetrics {
  upem: number
  winAscent: number
  winDescent: number
  hheaAscender: number
  hheaDescender: number
  hheaLineGap: number
}

export function readFontMetrics(
  os2: Uint8Array,
  hhea: Uint8Array,
  upem: number,
): FontMetrics {
  if (
    (os2.byteLength > 0 && os2.byteLength < 78) ||
    (hhea.byteLength > 0 && hhea.byteLength < 10)
  ) {
    throw new ApwPdfError(
      'FONT_INVALID',
      'Truncated OpenType OS/2 or hhea metric table',
    )
  }
  const os2View = new DataView(os2.buffer, os2.byteOffset, os2.byteLength)
  const hheaView = new DataView(hhea.buffer, hhea.byteOffset, hhea.byteLength)

  const winAscent = os2View.byteLength >= 78 ? os2View.getUint16(74, false) : 850
  const winDescent = os2View.byteLength >= 78 ? os2View.getUint16(76, false) : 250

  const hheaAscender = hheaView.byteLength >= 10 ? hheaView.getInt16(4, false) : winAscent
  const hheaDescender = hheaView.byteLength >= 10 ? hheaView.getInt16(6, false) : -winDescent
  const hheaLineGap = hheaView.byteLength >= 10 ? hheaView.getInt16(8, false) : 0

  return {
    upem,
    winAscent,
    winDescent,
    hheaAscender,
    hheaDescender,
    hheaLineGap,
  }
}

export function externalLeading(m: FontMetrics): number {
  return Math.max(
    0,
    m.hheaLineGap - (m.winAscent + m.winDescent - (m.hheaAscender - m.hheaDescender)),
  )
}

export function singleLineHeight(m: FontMetrics, sizePt: number): number {
  const ext = externalLeading(m)
  return ((m.winAscent + m.winDescent + ext) / m.upem) * sizePt
}

export function lineBox(
  m: FontMetrics,
  sizePt: number,
  spacing: LineSpacing = 'single',
): { height: number; ascent: number } {
  const ext = externalLeading(m)
  const singleH = ((m.winAscent + m.winDescent + ext) / m.upem) * sizePt
  const singleAsc = ((m.winAscent + ext) / m.upem) * sizePt

  if (spacing === 'single') {
    return { height: singleH, ascent: singleAsc }
  }
  if ('multiple' in spacing) {
    return { height: singleH * spacing.multiple, ascent: singleAsc }
  }
  if ('exactly' in spacing) {
    const H = toPt(spacing.exactly)
    const ascent = (H * m.winAscent) / (m.winAscent + m.winDescent)
    return { height: H, ascent }
  }
  if ('atLeast' in spacing) {
    const minH = toPt(spacing.atLeast)
    if (minH > singleH) {
      const ascent = (minH * m.winAscent) / (m.winAscent + m.winDescent)
      return { height: minH, ascent }
    }
    return { height: singleH, ascent: singleAsc }
  }
  return { height: singleH, ascent: singleAsc }
}
