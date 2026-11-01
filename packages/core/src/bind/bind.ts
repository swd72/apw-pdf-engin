import { ApwPdfError, type Warning } from '../errors.js'
import type {
  Block,
  Cell,
  ColumnWidthSpec,
  DocumentDef,
  ImageBlock,
  Inline,
  InlineTextRun,
  LineBlock,
  PageBreakBlock,
  ParagraphBlock,
  SignatureBlock,
  SpacerBlock,
  TableBlock,
} from '../schema.js'
import { toThaiDigits } from '../thai/digits.js'
import type { Length } from '../units.js'
import { evaluate, lookupPath, parseExpression, validatePathSegments } from './expr.js'
import { renderString } from './template.js'

export type ResolvedInline =
  | InlineTextRun
  | { tab: true }
  | {
      fill: string
      width: Length | 'toTab' | 'toEnd'
      leader?: 'dots' | 'line' | 'none'
      align?: 'left' | 'center'
    }
  | { checkbox: boolean }
  | { lineBreak: true }
  | { pageNumber: true }
  | { pageCount: true }

export interface ResolvedParagraph extends Omit<ParagraphBlock, 'runs'> {
  runs?: ResolvedInline[]
}

export type ResolvedImage = ImageBlock

export interface ResolvedCell extends Omit<Cell, 'blocks'> {
  blocks?: ResolvedBlock[]
}

export interface ResolvedTable extends Omit<TableBlock, 'header' | 'rows' | 'footer'> {
  header?: ResolvedCell[][]
  rows: ResolvedCell[][]
  footer?: ResolvedCell[][]
}

export interface ResolvedColumns {
  type: 'columns'
  columns: { width: ColumnWidthSpec; align?: 'left' | 'right'; blocks: ResolvedBlock[] }[]
  gap?: Length
  keepTogether?: boolean
}

export type ResolvedSignature = SignatureBlock

export type ResolvedBlock =
  | ResolvedParagraph
  | ResolvedImage
  | ResolvedTable
  | ResolvedColumns
  | ResolvedSignature
  | SpacerBlock
  | LineBlock
  | PageBreakBlock

export type ResolvedPageNumber = Required<NonNullable<DocumentDef['pageNumber']>>

export interface ResolvedDocument extends Omit<DocumentDef, 'blocks' | 'pageNumber'> {
  pageNumber: ResolvedPageNumber
  hasExplicitPageNumber: boolean
  blocks: ResolvedBlock[]
}

const ANCHORED_URL_RE = /^https?:\/\/\S{1,2048}$/i
const ANCHORED_EMAIL_RE = /^[^@\s]{1,256}@[^@\s.]{1,256}(?:\.[^@\s.]{1,256})+$/

function isEmailOrUrlToken(token: string): boolean {
  if (token.length < 4 || token.length > 2048) return false
  return ANCHORED_URL_RE.test(token) || ANCHORED_EMAIL_RE.test(token)
}

export function convertThaiNumeralsSelective(text: string): string {
  const parts = text.split(/(\s+)/)
  let out = ''
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!
    if (i % 2 === 1 || part.length === 0) {
      out += part
    } else if (isEmailOrUrlToken(part)) {
      out += part
    } else {
      out += toThaiDigits(part)
    }
  }
  return out
}

const MAX_DATA_BYTES = 5 * 1024 * 1024
const MAX_EACH_ITERATIONS = 10_000

export function resolvePageNumber(pn?: DocumentDef['pageNumber']): ResolvedPageNumber {
  return {
    from: pn?.from ?? 2,
    position: pn?.position ?? 'top-center',
    format: pn?.format ?? '- {n} -',
    size: pn?.size ?? '15pt',
    offset: pn?.offset ?? '1.25cm',
  }
}

export function bindDocument(
  doc: DocumentDef,
  data: unknown,
  opts?: { strict?: boolean },
): { doc: ResolvedDocument; warnings: Warning[] } {
  const strict = opts?.strict ?? true
  const warnings: Warning[] = []

  const serialized = JSON.stringify(data ?? {})
  if (serialized && new TextEncoder().encode(serialized).byteLength > MAX_DATA_BYTES) {
    throw new ApwPdfError('LIMIT_EXCEEDED', 'Input data exceeds 5 MB limit')
  }

  const rootScope: Record<string, unknown> =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : {}

  let eachCount = 0
  const docThaiNumerals = doc.numerals === 'thai'

  function bindStr(
    s: string,
    scope: Record<string, unknown>,
    path: string,
    numeralsMode: 'arabic' | 'thai' = docThaiNumerals ? 'thai' : 'arabic',
  ): string {
    const res = renderString(s, scope, { strict, path })
    warnings.push(...res.warnings)
    return numeralsMode === 'thai' ? convertThaiNumeralsSelective(res.value) : res.value
  }

  function resolveCheckbox(
    raw: boolean | string,
    scope: Record<string, unknown>,
    path: string,
  ): boolean {
    if (typeof raw === 'boolean') return raw
    const trimmed = raw.trim()
    const exprSrc =
      trimmed.startsWith('{{') && trimmed.endsWith('}}')
        ? trimmed.slice(2, -2).trim()
        : trimmed
    const expr = parseExpression(exprSrc, path)
    return Boolean(evaluate(expr, scope))
  }

  function bindInline(
    run: Inline,
    scope: Record<string, unknown>,
    path: string,
  ): ResolvedInline {
    if ('text' in run) {
      const mode = run.numerals ?? (docThaiNumerals ? 'thai' : 'arabic')
      return {
        ...run,
        text: bindStr(run.text, scope, `${path}.text`, mode),
      }
    }
    if ('fill' in run) {
      return {
        ...run,
        fill: bindStr(run.fill, scope, `${path}.fill`),
      }
    }
    if ('checkbox' in run) {
      return {
        checkbox: resolveCheckbox(run.checkbox, scope, `${path}.checkbox`),
      }
    }
    return run
  }

  function bindCell(
    cell: Cell,
    scope: Record<string, unknown>,
    path: string,
  ): ResolvedCell {
    const { blocks, text, ...rest } = cell
    const out: ResolvedCell = { ...rest }
    if (text !== undefined) {
      out.text = bindStr(text, scope, `${path}.text`)
    }
    if (blocks !== undefined) {
      out.blocks = bindBlocks(blocks, scope, `${path}.blocks`)
    }
    return out
  }

  function resolveArray(
    ofPath: string,
    scope: Record<string, unknown>,
    path: string,
  ): unknown[] {
    const segments = ofPath.split('.').map((s) => s.trim())
    validatePathSegments(segments, path)
    const { found, value } = lookupPath(scope, segments)
    if (!found) {
      if (strict) {
        throw new ApwPdfError('MISSING_VARIABLE', `Missing iterable "${ofPath}"`, { path })
      }
      warnings.push({
        code: 'MISSING_VARIABLE',
        message: `Missing iterable "${ofPath}"`,
        path,
      })
      return []
    }
    if (!Array.isArray(value)) {
      if (value === null || value === undefined) return []
      throw new ApwPdfError('INVALID_VALUE', `Expected array at "${ofPath}"`, { path })
    }
    return value
  }

  function bindBlocks(
    blocks: Block[],
    scope: Record<string, unknown>,
    basePath: string,
  ): ResolvedBlock[] {
    const out: ResolvedBlock[] = []

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i]!
      const path = `${basePath}[${i}]`

      switch (b.type) {
        case 'each': {
          const arr = resolveArray(b.of, scope, `${path}.of`)
          for (let idx = 0; idx < arr.length; idx++) {
            eachCount++
            if (eachCount > MAX_EACH_ITERATIONS) {
              throw new ApwPdfError(
                'LIMIT_EXCEEDED',
                `Each loop exceeded ${MAX_EACH_ITERATIONS} iterations`,
                { path },
              )
            }
            const childScope: Record<string, unknown> = {
              ...scope,
              [b.as]: arr[idx],
              $index: idx,
            }
            out.push(...bindBlocks(b.blocks, childScope, `${path}.blocks`))
          }
          break
        }
        case 'if': {
          const expr = parseExpression(b.test, `${path}.test`)
          const cond = Boolean(evaluate(expr, scope))
          if (cond) {
            out.push(...bindBlocks(b.then, scope, `${path}.then`))
          } else if (b.else) {
            out.push(...bindBlocks(b.else, scope, `${path}.else`))
          }
          break
        }
        case 'paragraph': {
          const { runs, text, ...rest } = b
          const rp: ResolvedParagraph = { ...rest }
          if (text !== undefined) {
            rp.text = bindStr(text, scope, `${path}.text`)
          }
          if (runs !== undefined) {
            rp.runs = runs.map((r, rIdx) => bindInline(r, scope, `${path}.runs[${rIdx}]`))
          }
          out.push(rp)
          break
        }
        case 'image': {
          out.push({
            ...b,
            src: bindStr(b.src, scope, `${path}.src`, 'arabic'),
          })
          break
        }
        case 'table': {
          const header = b.header?.map((row, rIdx) =>
            row.map((c, cIdx) => bindCell(c, scope, `${path}.header[${rIdx}][${cIdx}]`)),
          )
          const footer = b.footer?.map((row, rIdx) =>
            row.map((c, cIdx) => bindCell(c, scope, `${path}.footer[${rIdx}][${cIdx}]`)),
          )
          let rows: ResolvedCell[][]
          if (Array.isArray(b.rows)) {
            rows = b.rows.map((row, rIdx) =>
              row.map((c, cIdx) => bindCell(c, scope, `${path}.rows[${rIdx}][${cIdx}]`)),
            )
          } else {
            const arr = resolveArray(b.rows.each, scope, `${path}.rows.each`)
            rows = []
            for (let idx = 0; idx < arr.length; idx++) {
              eachCount++
              if (eachCount > MAX_EACH_ITERATIONS) {
                throw new ApwPdfError(
                  'LIMIT_EXCEEDED',
                  `Table each loop exceeded ${MAX_EACH_ITERATIONS} iterations`,
                  { path: `${path}.rows` },
                )
              }
              const rowScope: Record<string, unknown> = {
                ...scope,
                [b.rows.as]: arr[idx],
                $index: idx,
              }
              rows.push(
                b.rows.cells.map((c, cIdx) =>
                  bindCell(c, rowScope, `${path}.rows.cells[${cIdx}]`),
                ),
              )
            }
          }
          out.push({
            ...b,
            header,
            rows,
            footer,
          })
          break
        }
        case 'columns': {
          out.push({
            ...b,
            columns: b.columns.map((col, cIdx) => ({
              width: col.width,
              ...(col.align ? { align: col.align } : {}),
              blocks: bindBlocks(col.blocks, scope, `${path}.columns[${cIdx}].blocks`),
            })),
          })
          break
        }
        case 'signature': {
          const sig: ResolvedSignature = {
            ...b,
            name: bindStr(b.name, scope, `${path}.name`),
          }
          if (b.prefix !== undefined) {
            sig.prefix = bindStr(b.prefix, scope, `${path}.prefix`)
          }
          if (b.image !== undefined) {
            sig.image = bindStr(b.image, scope, `${path}.image`, 'arabic')
          }
          if (b.positions !== undefined) {
            const boundPositions: string[] = []
            for (let pIdx = 0; pIdx < b.positions.length; pIdx++) {
              const pos = b.positions[pIdx]!
              const trimmed = pos.trim()
              const singleVarMatch = /^\{\{\s*([a-zA-Z0-9_.$]+)\s*\}\}$/.exec(trimmed)
              if (singleVarMatch) {
                const segs = singleVarMatch[1]!.split('.')
                validatePathSegments(segs, `${path}.positions[${pIdx}]`)
                const looked = lookupPath(scope, segs)
                if (looked.found && Array.isArray(looked.value)) {
                  for (const item of looked.value) {
                    const str = String(item ?? '')
                    boundPositions.push(
                      docThaiNumerals ? convertThaiNumeralsSelective(str) : str,
                    )
                  }
                  continue
                }
              }
              boundPositions.push(bindStr(pos, scope, `${path}.positions[${pIdx}]`))
            }
            sig.positions = boundPositions
          }
          out.push(sig)
          break
        }
        case 'spacer':
        case 'line':
        case 'pageBreak':
          out.push(b)
          break
      }
    }

    return out
  }

  const resolvedBlocks = bindBlocks(doc.blocks, rootScope, 'blocks')

  return {
    doc: {
      ...doc,
      pageNumber: resolvePageNumber(doc.pageNumber),
      hasExplicitPageNumber: doc.pageNumber !== undefined,
      blocks: resolvedBlocks,
    },
    warnings,
  }
}
