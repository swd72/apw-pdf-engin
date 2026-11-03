import type { DocumentDef } from '@apw-pdf/core'

export interface PageSettings {
  size: 'A4' | 'A5' | 'Letter' | 'Legal'
  orientation: 'portrait' | 'landscape'
  margin: { top: string; bottom: string; left: string; right: string }
  fontFamily: string
  fontSize: string
  lineSpacing?: DocumentDef['font']['lineSpacing']
  numerals: 'arabic' | 'thai'
}

export function readPageSettings(doc: DocumentDef): PageSettings {
  const rawSize = doc.page.size
  const size: PageSettings['size'] =
    rawSize === 'A4' || rawSize === 'A5' || rawSize === 'Letter' || rawSize === 'Legal'
      ? rawSize
      : 'A4'

  const settings: PageSettings = {
    size,
    orientation: doc.page.orientation ?? 'portrait',
    margin: {
      top: String(doc.page.margin.top),
      bottom: String(doc.page.margin.bottom),
      left: String(doc.page.margin.left),
      right: String(doc.page.margin.right),
    },
    fontFamily: doc.font.family,
    fontSize: String(doc.font.size),
    numerals: doc.numerals ?? 'arabic',
  }

  if (doc.font.lineSpacing !== undefined) {
    settings.lineSpacing = doc.font.lineSpacing
  }

  return settings
}

export function applyPageSettings(
  doc: DocumentDef,
  patch: Partial<PageSettings>,
): DocumentDef {
  const nextMargin = patch.margin
    ? {
        top: patch.margin.top ?? doc.page.margin.top,
        bottom: patch.margin.bottom ?? doc.page.margin.bottom,
        left: patch.margin.left ?? doc.page.margin.left,
        right: patch.margin.right ?? doc.page.margin.right,
      }
    : { ...doc.page.margin }

  const nextPage: DocumentDef['page'] = {
    ...doc.page,
    ...(patch.size !== undefined ? { size: patch.size } : {}),
    ...(patch.orientation !== undefined ? { orientation: patch.orientation } : {}),
    margin: nextMargin,
  }

  const nextFont: DocumentDef['font'] = {
    ...doc.font,
    ...(patch.fontFamily !== undefined ? { family: patch.fontFamily } : {}),
    ...(patch.fontSize !== undefined ? { size: patch.fontSize } : {}),
  }

  if ('lineSpacing' in patch) {
    if (patch.lineSpacing === undefined) {
      delete nextFont.lineSpacing
    } else {
      nextFont.lineSpacing = patch.lineSpacing
    }
  }

  const nextDoc: DocumentDef = {
    ...doc,
    page: nextPage,
    font: nextFont,
  }

  if (patch.numerals !== undefined) {
    nextDoc.numerals = patch.numerals
  }

  return nextDoc
}
