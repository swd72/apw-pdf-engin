import { describe, it, expect } from 'vitest'
import { parseDocument, type DocumentDef } from '@apw-pdf/core'
import { memo } from '@apw-pdf/templates'
import { readPageSettings, applyPageSettings } from './pageSettings.js'

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj
  Object.freeze(obj)
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    const val = (obj as Record<string, unknown>)[key]
    if (val && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val)
    }
  }
  return obj
}

describe('pageSettings', () => {
  it('readPageSettings reads memo.document', () => {
    const settings = readPageSettings(memo.document)
    expect(settings).toEqual({
      size: 'A4',
      orientation: 'portrait',
      margin: {
        top: '1.5cm',
        bottom: '2cm',
        left: '3cm',
        right: '2cm',
      },
      fontFamily: 'THSarabunNew',
      fontSize: '16pt',
      lineSpacing: { multiple: 1130 / 1331 },
      numerals: 'thai',
    })
  })

  it('applyPageSettings changes size and keeps margin', () => {
    const next = applyPageSettings(memo.document, {
      size: 'A5',
      orientation: 'landscape',
    })
    expect(next.page.size).toBe('A5')
    expect(next.page.orientation).toBe('landscape')
    expect(next.page.margin).toEqual(memo.document.page.margin)
    expect(() => parseDocument(next)).not.toThrow()
  })

  it('applyPageSettings updates font size and numerals', () => {
    const next = applyPageSettings(memo.document, {
      fontSize: '18pt',
      numerals: 'arabic',
    })
    expect(next.font.size).toBe('18pt')
    expect(next.font.family).toBe(memo.document.font.family)
    expect(next.font.color).toBe(memo.document.font.color)
    expect(next.numerals).toBe('arabic')
    expect(next.meta).toEqual(memo.document.meta)
    expect(() => parseDocument(next)).not.toThrow()
  })

  it('applyPageSettings does not mutate the input', () => {
    const customPageDoc: DocumentDef = {
      ...structuredClone(memo.document),
      page: {
        size: { width: '210mm', height: '297mm' },
        orientation: 'portrait',
        margin: { top: '2cm', bottom: '2cm', left: '2cm', right: '2cm' },
      },
    }
    deepFreeze(customPageDoc)

    const next = applyPageSettings(customPageDoc, {
      margin: { top: '2.5cm', bottom: '2cm', left: '2.5cm', right: '2cm' },
      fontFamily: 'Sarabun',
    })
    expect(next).not.toBe(customPageDoc)
    expect(next.page.size).toEqual({ width: '210mm', height: '297mm' })
    expect(next.page.margin.top).toBe('2.5cm')
    expect(next.font.family).toBe('Sarabun')
    expect(() => parseDocument(next)).not.toThrow()
  })
})
