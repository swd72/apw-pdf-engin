import { ApwPdfError } from '@apw-pdf/core'

export const FONT_FAMILIES = [
  'THSarabunNew',
  'THSarabunPSK',
] as const

export type FontFamily = (typeof FONT_FAMILIES)[number]

const FAMILY_SET = new Set<string>(FONT_FAMILIES)

export function fontFileName(family: string, bold: boolean, italic: boolean): string {
  if (!FAMILY_SET.has(family)) {
    throw new ApwPdfError('FONT_NOT_FOUND', `Unknown font family "${family}"`)
  }
  const style = bold && italic ? 'BoldItalic' : bold ? 'Bold' : italic ? 'Italic' : 'Regular'
  return `${family}-${style}.ttf`
}
