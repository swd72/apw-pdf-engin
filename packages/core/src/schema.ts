import { z } from 'zod'
import { ApwPdfError } from './errors.js'
import { toPt, type Length } from './units.js'
import { validateDocumentIntegrity } from './validate.js'

const POSITIVE_LENGTH_RE = /^\d+(?:\.\d+)?(pt|mm|cm|in)$/
const SIGNED_LENGTH_RE = /^-?\d+(?:\.\d+)?(pt|mm|cm|in)$/

export const lengthSchema: z.ZodType<Length> = z.custom<Length>(
  (val) => {
    if (typeof val === 'number') return Number.isFinite(val) && val >= 0
    if (typeof val === 'string') return POSITIVE_LENGTH_RE.test(val.trim())
    return false
  },
  { message: 'Invalid length (expected non-negative number or "<n>pt|mm|cm|in")' },
)

const pageDimensionSchema: z.ZodType<Length> = lengthSchema.refine(
  (val) => {
    try {
      const pt = toPt(val)
      return pt >= 72 && pt <= 5000
    } catch {
      return false
    }
  },
  { message: 'Page dimension must be between 72pt and 5000pt' },
)

const fontSizeSchema: z.ZodType<Length> = lengthSchema.refine(
  (val) => {
    try {
      const pt = toPt(val)
      return pt >= 1 && pt <= 500
    } catch {
      return false
    }
  },
  { message: 'Font size must be between 1pt and 500pt' },
)

export const signedLengthSchema: z.ZodType<Length> = z.custom<Length>(
  (val) => {
    if (typeof val === 'number') return Number.isFinite(val)
    if (typeof val === 'string') return SIGNED_LENGTH_RE.test(val.trim())
    return false
  },
  { message: 'Invalid length (expected number or "<n>pt|mm|cm|in")' },
)

export type LineSpacing =
  | 'single'
  | { multiple: number }
  | { exactly: Length }
  | { atLeast: Length }

export const lineSpacingObjectSchemas = [
  z.object({ multiple: z.number().positive() }).strict(),
  z.object({ exactly: lengthSchema }).strict(),
  z.object({ atLeast: lengthSchema }).strict(),
] as const

export const lineSpacingSchema: z.ZodType<LineSpacing> = z.union([
  z.literal('single'),
  lineSpacingObjectSchemas[0],
  lineSpacingObjectSchemas[1],
  lineSpacingObjectSchemas[2],
])

export interface Anchor {
  name: string
  index: number
  edge?: 'start' | 'end'
}

export const anchorObjectSchema = z.object({
  name: z.string().min(1),
  index: z.number().int().nonnegative(),
  edge: z.enum(['start', 'end']).optional(),
})

export const anchorSchema: z.ZodType<Anchor> = anchorObjectSchema

export interface TabStop {
  at: Length | `@${string}`
  align?: 'left' | 'center' | 'right' | 'decimal'
  leader?: 'none' | 'dots' | 'line'
}

const tabAtSchema = z.custom<Length | `@${string}`>(
  (val) => {
    if (typeof val === 'number') return Number.isFinite(val) && val >= 0
    if (typeof val === 'string') {
      const s = val.trim()
      if (s.startsWith('@') && s.length > 1) return true
      return POSITIVE_LENGTH_RE.test(s)
    }
    return false
  },
  { message: 'Invalid tab stop position (expected length or "@anchor")' },
)

export const tabStopObjectSchema = z.object({
  at: tabAtSchema,
  align: z.enum(['left', 'center', 'right', 'decimal']).optional(),
  leader: z.enum(['none', 'dots', 'line']).optional(),
})

export const tabStopSchema: z.ZodType<TabStop> = tabStopObjectSchema

export interface ParagraphStyle {
  align?: 'left' | 'center' | 'right' | 'justify' | 'thaiDistributed'
  firstLineIndent?: Length
  indentLeft?: Length
  indentRight?: Length
  spaceBefore?: Length
  spaceAfter?: Length
  lineSpacing?: LineSpacing
  tabs?: TabStop[]
  font?: Partial<{
    family: string
    size: Length
    bold: boolean
    italic: boolean
    color: string
  }>
  keepWithNext?: boolean
  keepLinesTogether?: boolean
  widowControl?: boolean
}

export const styleFontSchema = z.object({
  family: z.string().min(1).optional(),
  size: fontSizeSchema.optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  color: z.string().optional(),
})

const paragraphStyleFields = {
  align: z.enum(['left', 'center', 'right', 'justify', 'thaiDistributed']).optional(),
  firstLineIndent: signedLengthSchema.optional(),
  indentLeft: lengthSchema.optional(),
  indentRight: lengthSchema.optional(),
  spaceBefore: lengthSchema.optional(),
  spaceAfter: lengthSchema.optional(),
  lineSpacing: lineSpacingSchema.optional(),
  tabs: z.array(tabStopSchema).optional(),
  font: styleFontSchema.optional(),
  keepWithNext: z.boolean().optional(),
  keepLinesTogether: z.boolean().optional(),
  widowControl: z.boolean().optional(),
}

export const paragraphStyleObjectSchema = z.object(paragraphStyleFields)

export const paragraphStyleSchema: z.ZodType<ParagraphStyle> = paragraphStyleObjectSchema

export type InlineTextRun = {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean | 'dotted'
  size?: Length
  family?: string
  color?: string
  anchors?: Anchor[]
  numerals?: 'arabic' | 'thai'
}

export type Inline =
  | InlineTextRun
  | { tab: true }
  | {
      fill: string
      width: Length | 'toTab' | 'toEnd'
      leader?: 'dots' | 'line' | 'none'
      align?: 'left' | 'center'
    }
  | { checkbox: boolean | string }
  | { lineBreak: true }
  | { pageNumber: true }
  | { pageCount: true }

export const textRunSchema = z.object({
  text: z.string(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.union([z.boolean(), z.literal('dotted')]).optional(),
  size: fontSizeSchema.optional(),
  family: z.string().min(1).optional(),
  color: z.string().optional(),
  anchors: z.array(anchorSchema).optional(),
  numerals: z.enum(['arabic', 'thai']).optional(),
})

export const tabRunSchema = z.object({ tab: z.literal(true) })

const fillWidthSchema = z.custom<Length | 'toTab' | 'toEnd'>(
  (val) => {
    if (val === 'toTab' || val === 'toEnd') return true
    return lengthSchema.safeParse(val).success
  },
  { message: 'Invalid fill width (expected length, "toTab", or "toEnd")' },
)

export const fillRunSchema = z.object({
  fill: z.string(),
  width: fillWidthSchema,
  leader: z.enum(['dots', 'line', 'none']).optional(),
  align: z.enum(['left', 'center']).optional(),
})

export const checkboxRunSchema = z.object({
  checkbox: z.union([z.boolean(), z.string()]),
})

export const lineBreakRunSchema = z.object({ lineBreak: z.literal(true) })
export const pageNumberRunSchema = z.object({ pageNumber: z.literal(true) })
export const pageCountRunSchema = z.object({ pageCount: z.literal(true) })

export const inlineSchema: z.ZodType<Inline> = z.any().superRefine((val, ctx) => {
  if (!val || typeof val !== 'object') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Expected inline object' })
    return
  }
  const schema =
    'text' in val
      ? textRunSchema
      : 'tab' in val
        ? tabRunSchema
        : 'fill' in val
          ? fillRunSchema
          : 'checkbox' in val
            ? checkboxRunSchema
            : 'lineBreak' in val
              ? lineBreakRunSchema
              : 'pageNumber' in val
                ? pageNumberRunSchema
                : 'pageCount' in val
                  ? pageCountRunSchema
                  : null
  if (!schema) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Unknown inline run kind' })
    return
  }
  const parsed = schema.safeParse(val)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      ctx.addIssue(issue)
    }
  }
})

export interface ParagraphBlock extends ParagraphStyle {
  type: 'paragraph'
  id?: string
  style?: string
  text?: string
  runs?: Inline[]
}

export interface ImageBlock {
  type: 'image'
  src: string
  width?: Length
  height?: Length
  align?: 'left' | 'center' | 'right'
  anchor?: {
    relativeTo: 'page' | 'margin'
    x: Length | 'center'
    y: Length
  }
  spaceAfter?: Length
}

export type BorderSpec =
  | boolean
  | {
      width?: Length
      color?: string
      style?: 'solid' | 'dashed' | 'dotted'
      top?: boolean
      bottom?: boolean
      left?: boolean
      right?: boolean
    }

export const borderObjectSchema = z.object({
  width: lengthSchema.optional(),
  color: z.string().optional(),
  style: z.enum(['solid', 'dashed', 'dotted']).optional(),
  top: z.boolean().optional(),
  bottom: z.boolean().optional(),
  left: z.boolean().optional(),
  right: z.boolean().optional(),
})

export const borderSpecSchema: z.ZodType<BorderSpec> = z.union([
  z.boolean(),
  borderObjectSchema,
])

export type ColumnWidthSpec = Length | `${number}%` | '*'

export const columnWidthSpecSchema: z.ZodType<ColumnWidthSpec> = z.custom<ColumnWidthSpec>(
  (val) => {
    if (val === '*') return true
    if (typeof val === 'string' && /^\d+(?:\.\d+)?%$/.test(val.trim())) return true
    return lengthSchema.safeParse(val).success
  },
  { message: 'Invalid column width (expected length, "<n>%", or "*")' },
)

export interface Cell {
  blocks?: Block[]
  text?: string
  colSpan?: number
  rowSpan?: number
  align?: 'left' | 'center' | 'right' | 'justify' | 'thaiDistributed' | string
  vAlign?: 'top' | 'middle' | 'bottom'
  border?: BorderSpec
  shade?: string
  style?: string
}

export interface TableBlock {
  type: 'table'
  columns: { width: ColumnWidthSpec; align?: string }[]
  header?: Cell[][]
  rows: Cell[][] | { each: string; as: string; cells: Cell[] }
  footer?: Cell[][]
  repeatHeader?: boolean
  border?: BorderSpec
  cellPadding?: Length
  allowRowSplit?: boolean
}

export interface ColumnsBlock {
  type: 'columns'
  columns: { width: ColumnWidthSpec; align?: 'left' | 'right'; blocks: Block[] }[]
  gap?: Length
  keepTogether?: boolean
}

export interface SignatureBlock {
  type: 'signature'
  startAt?: Length | 'center'
  linesBefore?: number
  prefix?: string
  image?: string
  imageHeight?: Length
  name: string
  positions?: string[]
  minLinesBefore?: number
}

export interface SpacerBlock {
  type: 'spacer'
  height: Length | { lines: number }
}

export interface LineBlock {
  type: 'line'
  thickness?: Length
  style?: 'solid' | 'dashed' | 'dotted'
  spaceBefore?: Length
  spaceAfter?: Length
}

export interface PageBreakBlock {
  type: 'pageBreak'
}

export interface EachBlock {
  type: 'each'
  of: string
  as: string
  blocks: Block[]
}

export interface IfBlock {
  type: 'if'
  test: string
  then: Block[]
  else?: Block[]
}

export type Block =
  | ParagraphBlock
  | ImageBlock
  | TableBlock
  | ColumnsBlock
  | SignatureBlock
  | SpacerBlock
  | LineBlock
  | PageBreakBlock
  | EachBlock
  | IfBlock

export const paragraphBlockSchema = z.object({
  type: z.literal('paragraph'),
  id: z.string().optional(),
  style: z.string().optional(),
  text: z.string().optional(),
  runs: z.array(inlineSchema).optional(),
  ...paragraphStyleFields,
})

const imageAnchorXSchema = z.custom<Length | 'center'>(
  (val) => val === 'center' || signedLengthSchema.safeParse(val).success,
  { message: 'Invalid anchor x (expected length or "center")' },
)

export const imageAnchorSchema = z.object({
  relativeTo: z.enum(['page', 'margin']),
  x: imageAnchorXSchema,
  y: signedLengthSchema,
})

export const imageBlockSchema = z.object({
  type: z.literal('image'),
  src: z.string().min(1),
  width: lengthSchema.optional(),
  height: lengthSchema.optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  anchor: imageAnchorSchema.optional(),
  spaceAfter: lengthSchema.optional(),
})

export const cellObjectSchema = z.object({
  blocks: z.lazy(() => z.array(blockSchema)).optional(),
  text: z.string().optional(),
  colSpan: z.number().int().positive().optional(),
  rowSpan: z.number().int().positive().optional(),
  align: z.string().optional(),
  vAlign: z.enum(['top', 'middle', 'bottom']).optional(),
  border: borderSpecSchema.optional(),
  shade: z.string().optional(),
  style: z.string().optional(),
})

export const cellSchema: z.ZodType<Cell> = z.lazy(() => cellObjectSchema)

const safeIdentifierSchema = z
  .string()
  .regex(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/, 'Invalid loop variable identifier')
  .refine(
    (v) => v !== '__proto__' && v !== 'constructor' && v !== 'prototype',
    'Reserved identifier is not allowed',
  )

export const tableColumnSchema = z.object({
  width: columnWidthSpecSchema,
  align: z.string().optional(),
})

export const tableEachRowsSchema = z.object({
  each: z.string().min(1),
  as: safeIdentifierSchema,
  cells: z.array(cellSchema),
})

export const tableRowsSchema = z.union([
  z.array(z.array(cellSchema)),
  tableEachRowsSchema,
])

export const tableBlockSchema = z.object({
  type: z.literal('table'),
  columns: z.array(tableColumnSchema),
  header: z.array(z.array(cellSchema)).optional(),
  rows: tableRowsSchema,
  footer: z.array(z.array(cellSchema)).optional(),
  repeatHeader: z.boolean().optional(),
  border: borderSpecSchema.optional(),
  cellPadding: lengthSchema.optional(),
  allowRowSplit: z.boolean().optional(),
})

export const columnsColumnSchema = z.object({
  width: columnWidthSpecSchema,
  align: z.enum(['left', 'right']).optional(),
  blocks: z.lazy(() => z.array(blockSchema)),
})

export const columnsBlockSchema = z.object({
  type: z.literal('columns'),
  columns: z.array(columnsColumnSchema),
  gap: lengthSchema.optional(),
  keepTogether: z.boolean().optional(),
})

const signatureStartAtSchema = z.custom<Length | 'center'>(
  (val) => val === 'center' || lengthSchema.safeParse(val).success,
  { message: 'Invalid signature startAt (expected length or "center")' },
)

export const signatureBlockSchema = z.object({
  type: z.literal('signature'),
  startAt: signatureStartAtSchema.optional(),
  linesBefore: z.number().int().positive().optional(),
  prefix: z.string().optional(),
  image: z.string().optional(),
  imageHeight: lengthSchema.optional(),
  name: z.string(),
  positions: z.array(z.string()).optional(),
  minLinesBefore: z.number().int().nonnegative().optional(),
})

export const spacerLinesSchema = z.object({ lines: z.number().positive() })

export const spacerBlockSchema = z.object({
  type: z.literal('spacer'),
  height: z.union([lengthSchema, spacerLinesSchema]),
})

export const lineBlockSchema = z.object({
  type: z.literal('line'),
  thickness: lengthSchema.optional(),
  style: z.enum(['solid', 'dashed', 'dotted']).optional(),
  spaceBefore: lengthSchema.optional(),
  spaceAfter: lengthSchema.optional(),
})

export const pageBreakBlockSchema = z.object({
  type: z.literal('pageBreak'),
})

export const eachBlockSchema = z.object({
  type: z.literal('each'),
  of: z.string().min(1),
  as: safeIdentifierSchema,
  blocks: z.lazy(() => z.array(blockSchema)),
})

export const ifBlockSchema = z.object({
  type: z.literal('if'),
  test: z.string().min(1),
  then: z.lazy(() => z.array(blockSchema)),
  else: z.lazy(() => z.array(blockSchema)).optional(),
})

export const blockSchema: z.ZodType<Block> = z.discriminatedUnion('type', [
  paragraphBlockSchema,
  imageBlockSchema,
  tableBlockSchema,
  columnsBlockSchema,
  signatureBlockSchema,
  spacerBlockSchema,
  lineBlockSchema,
  pageBreakBlockSchema,
  eachBlockSchema,
  ifBlockSchema,
])

export interface DocumentDef {
  version: 1
  meta?: {
    title?: string
    author?: string
    subject?: string
    keywords?: string[]
  }
  page: {
    size: 'A4' | 'A5' | 'Letter' | 'Legal' | { width: Length; height: Length }
    orientation?: 'portrait' | 'landscape'
    margin: { top: Length; bottom: Length; left: Length; right: Length }
  }
  font: {
    family: string
    size: Length
    lineSpacing?: LineSpacing
    color?: string
  }
  numerals?: 'arabic' | 'thai'
  pageNumber?: {
    from?: number
    position?: 'top-center' | 'bottom-center' | 'top-right' | 'bottom-right'
    format?: string
    size?: Length
    offset?: Length
  }
  styles?: Record<string, ParagraphStyle>
  dictionary?: string[]
  assets?: Record<string, string>
  blocks: Block[]
}

export const metaSchema = z.object({
  title: z.string().optional(),
  author: z.string().optional(),
  subject: z.string().optional(),
  keywords: z.array(z.string()).optional(),
})

export const pageSizeObjSchema = z.object({
  width: pageDimensionSchema,
  height: pageDimensionSchema,
})

export const pageMarginSchema = z.object({
  top: lengthSchema,
  bottom: lengthSchema,
  left: lengthSchema,
  right: lengthSchema,
})

export const pageSchema = z.object({
  size: z.union([
    z.enum(['A4', 'A5', 'Letter', 'Legal']),
    pageSizeObjSchema,
  ]),
  orientation: z.enum(['portrait', 'landscape']).optional(),
  margin: pageMarginSchema,
})

export const fontSchema = z.object({
  family: z.string().min(1),
  size: fontSizeSchema,
  lineSpacing: lineSpacingSchema.optional(),
  color: z.string().optional(),
})

export const pageNumberSchema = z.object({
  from: z.number().int().positive().optional(),
  position: z.enum(['top-center', 'bottom-center', 'top-right', 'bottom-right']).optional(),
  format: z.string().optional(),
  size: fontSizeSchema.optional(),
  offset: lengthSchema.optional(),
})

export const documentObjectSchema = z.object({
  version: z.literal(1),
  meta: metaSchema.optional(),
  page: pageSchema,
  font: fontSchema,
  numerals: z.enum(['arabic', 'thai']).optional(),
  pageNumber: pageNumberSchema.optional(),
  styles: z.record(z.string(), paragraphStyleSchema).optional(),
  dictionary: z.array(z.string()).optional(),
  assets: z.record(z.string(), z.string()).optional(),
  blocks: z.array(blockSchema),
})

export const documentSchema: z.ZodType<DocumentDef> = documentObjectSchema

export const SCHEMA_SHAPES = {
  document: documentObjectSchema,
  meta: metaSchema,
  page: pageSchema,
  pageSizeObj: pageSizeObjSchema,
  pageMargin: pageMarginSchema,
  font: fontSchema,
  pageNumber: pageNumberSchema,
  paragraphStyle: paragraphStyleObjectSchema,
  styleFont: styleFontSchema,
  tabStop: tabStopObjectSchema,
  paragraphBlock: paragraphBlockSchema,
  imageBlock: imageBlockSchema,
  imageAnchor: imageAnchorSchema,
  tableBlock: tableBlockSchema,
  tableColumn: tableColumnSchema,
  tableEachRows: tableEachRowsSchema,
  cell: cellObjectSchema,
  border: borderObjectSchema,
  columnsBlock: columnsBlockSchema,
  columnsCol: columnsColumnSchema,
  signatureBlock: signatureBlockSchema,
  spacerBlock: spacerBlockSchema,
  spacerHeightObj: spacerLinesSchema,
  lineBlock: lineBlockSchema,
  pageBreakBlock: pageBreakBlockSchema,
  eachBlock: eachBlockSchema,
  ifBlock: ifBlockSchema,
  textRun: textRunSchema,
  anchor: anchorObjectSchema,
  tabRun: tabRunSchema,
  fillRun: fillRunSchema,
  checkboxRun: checkboxRunSchema,
  lineBreakRun: lineBreakRunSchema,
  pageNumberRun: pageNumberRunSchema,
  pageCountRun: pageCountRunSchema,
} as const

export interface TemplateDef {
  name: string
  description: string
  document: DocumentDef
  dataSchema: object
  example: unknown
  /** Optional input-dependent variant of `document` (e.g. template options). */
  build?(input: unknown): { doc: DocumentDef; data: unknown }
}

export function formatZodPath(path: (string | number)[]): string {
  let out = ''
  for (const seg of path) {
    if (typeof seg === 'number') {
      out += `[${seg}]`
    } else {
      out += out ? `.${seg}` : seg
    }
  }
  return out
}

export function parseDocument(
  input: unknown,
  opts?: { strict?: boolean },
): DocumentDef {
  const res = documentSchema.safeParse(input)
  if (!res.success) {
    const first = res.error.issues[0]
    const path = first ? formatZodPath(first.path) : undefined
    throw new ApwPdfError(
      'SCHEMA_INVALID',
      first ? `${path ? `${path}: ` : ''}${first.message}` : 'Invalid document schema',
      {
        path,
        details: res.error.issues,
      },
    )
  }
  const strict = opts?.strict ?? true
  if (strict) {
    const integrityIssues = validateDocumentIntegrity(input)
    if (integrityIssues.length > 0) {
      const first = integrityIssues[0]!
      throw new ApwPdfError(first.code as any, first.message, {
        path: first.path,
        details: integrityIssues,
      })
    }
  }
  return res.data
}
