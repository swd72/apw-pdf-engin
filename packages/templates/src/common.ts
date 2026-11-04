import { ApwPdfError, type DocumentDef, type TemplateDef } from '@apw-pdf/core'

export const GOV_PAGE: DocumentDef['page'] = {
  size: 'A4',
  orientation: 'portrait',
  margin: {
    top: '1.5cm',
    bottom: '2cm',
    left: '3cm',
    right: '2cm',
  },
}

// Reproduces the TH SarabunIT9 single line height (18.08pt at 16pt) with TH Sarabun New metrics.
export const IT9_LINE_RATIO = 1130 / 1331

export const GOV_FONT: DocumentDef['font'] = {
  family: 'THSarabunNew',
  size: '16pt',
  lineSpacing: { multiple: IT9_LINE_RATIO },
  color: '#000000',
}

export const GOV_PAGE_NUMBER: NonNullable<DocumentDef['pageNumber']> = {
  from: 2,
  position: 'top-center',
  format: '- {n} -',
  size: '15pt',
  offset: '1.25cm',
}

export const PARA_INDENT = '2.5cm'

export type BuiltTemplate<T> = TemplateDef & {
  build(input: T): { doc: DocumentDef; data: unknown }
}

/**
 * Resolves a template + data into the document to render. Templates with
 * input-dependent options (e.g. external-letter paragraphSpacing) only honour
 * them through build(); callers that render by template name must use this.
 */
export function instantiateTemplate(
  tpl: TemplateDef,
  data: unknown,
): { doc: DocumentDef; data: unknown } {
  if (tpl.build && typeof data === 'object' && data !== null && !Array.isArray(data)) {
    return tpl.build(data)
  }
  return { doc: tpl.document, data }
}

export function defineTemplate<T>(def: BuiltTemplate<T>): BuiltTemplate<T> {
  return {
    ...def,
    build(input: T) {
      if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        throw new ApwPdfError(
          'SCHEMA_INVALID',
          'Template input data must be a plain object',
        )
      }
      return def.build(input)
    },
  }
}
