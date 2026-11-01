import { bindDocument } from './bind/bind.js'
import { ApwPdfError, type Warning } from './errors.js'
import { singleLineHeight } from './fonts/metrics.js'
import type { FontProvider, ImageProvider } from './fonts/provider.js'
import { FontRegistry } from './fonts/registry.js'
import { createAnchorTable } from './layout/align.js'
import './layout/columns.js'
import { paginate, type FlowContext } from './layout/flow.js'
import { applyPageNumbers } from './layout/pagenumber.js'
import './layout/signature.js'
import './layout/table.js'
import type { FontRef, LayoutTree } from './layout/tree.js'
import { formatZodPath, parseDocument } from './schema.js'
import { validateDocumentIntegrity } from './validate.js'
import { pageBox, toPt } from './units.js'

export interface ValidationIssue {
  path?: string
  code: string
  message: string
}

export interface Engine {
  fonts: FontRegistry
  validate(doc: unknown, data: unknown): { ok: boolean; issues: ValidationIssue[] }
  layout(doc: unknown, data: unknown, opts?: { strict?: boolean }): Promise<LayoutTree>
}

const defaultImageProvider: ImageProvider = {
  async load(src: string): Promise<Uint8Array> {
    throw new ApwPdfError('IMAGE_LOAD_FAILED', `No ImageProvider configured to load "${src}"`)
  },
}

export async function createEngine(opts: {
  fonts: FontProvider
  images?: ImageProvider
}): Promise<Engine> {
  const fonts = FontRegistry.create(opts.fonts)
  const images = opts.images ?? defaultImageProvider

  return {
    fonts,
    validate(doc: unknown, data: unknown): { ok: boolean; issues: ValidationIssue[] } {
      const integrityIssues = validateDocumentIntegrity(doc)
      try {
        const parsed = parseDocument(doc, { strict: false })
        bindDocument(parsed, data, { strict: true })
        if (integrityIssues.length > 0) {
          return { ok: false, issues: integrityIssues }
        }
        return { ok: true, issues: [] }
      } catch (err) {
        if (err instanceof ApwPdfError) {
          if (err.code === 'SCHEMA_INVALID' && Array.isArray(err.details)) {
            const issues: ValidationIssue[] = err.details.map((zIssue: any) => ({
              path: Array.isArray(zIssue.path) ? formatZodPath(zIssue.path) : err.path,
              code: 'SCHEMA_INVALID',
              message: String(zIssue.message ?? err.message),
            }))
            return { ok: false, issues: [...integrityIssues, ...(issues.length > 0 ? issues : [{ path: err.path, code: err.code, message: err.message }])] }
          }
          return {
            ok: false,
            issues: [...integrityIssues, { path: err.path, code: err.code, message: err.message }],
          }
        }
        return {
          ok: false,
          issues: [...integrityIssues, { code: 'SCHEMA_INVALID', message: String(err) }],
        }
      }
    },

    async layout(
      doc: unknown,
      data: unknown,
      layoutOpts?: { strict?: boolean },
    ): Promise<LayoutTree> {
      const strict = layoutOpts?.strict ?? true
      const parsed = parseDocument(doc, { strict })
      const integrityWarnings: Warning[] = !strict
        ? validateDocumentIntegrity(doc).map((iss) => ({
            code: iss.code,
            message: iss.message,
            path: iss.path,
          }))
        : []
      const { doc: resolvedDoc, warnings: bindWarnings } = bindDocument(parsed, data, {
        strict,
      })
      const box = pageBox(resolvedDoc.page)

      fonts.warnings = [...fonts.fallbackWarnings]
      const baseLoadedFont = await fonts.get(resolvedDoc.font.family, false, false)

      const pnCfg = resolvedDoc.pageNumber
      const pnSizePt = toPt(pnCfg.size)
      const pnOffsetPt = toPt(pnCfg.offset)
      const pnLineH = singleLineHeight(baseLoadedFont.metrics, pnSizePt)

      const bodyTop = (pageIndex: number): number => {
        const pageNum = pageIndex + 1
        if (pageNum >= pnCfg.from && pnCfg.position.startsWith('top')) {
          return Math.max(box.margin.top, pnOffsetPt + pnLineH)
        }
        return box.margin.top
      }

      const flowCtx: FlowContext = {
        fonts,
        images,
        doc: resolvedDoc,
        box,
        bodyTop,
        anchors: createAnchorTable(),
        warnings: [...bindWarnings, ...integrityWarnings],
        imageCache: new Map(),
      }

      const pages = await paginate(resolvedDoc.blocks, flowCtx)
      await applyPageNumbers(pages, pnCfg, flowCtx)

      const allWarnings = [...fonts.warnings, ...flowCtx.warnings]
      const fontRefs: FontRef[] = fonts.all().map((f) => ({
        id: f.id,
        family: f.family,
        bold: f.bold,
        italic: f.italic,
      }))

      const tree: LayoutTree = {
        pages,
        fonts: fontRefs,
        warnings: allWarnings,
      }
      Object.defineProperty(tree, 'imageCache', {
        value: flowCtx.imageCache,
        enumerable: false,
        configurable: true,
      })
      return tree
    },
  }
}
