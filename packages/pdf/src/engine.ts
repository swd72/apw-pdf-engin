import {
  createEngine,
  parseDocument,
  type Engine,
  type FontProvider,
  type ImageProvider,
  type Warning,
} from '@apw-pdf/core'
import { createSubsetter } from './hbsubset.js'
import { writePdf } from './writer.js'

export interface RenderPdfOptions {
  strict?: boolean
  creationDate?: Date
}

export interface RenderPdfResult {
  bytes: Uint8Array
  pageCount: number
  warnings: Warning[]
}

export interface PdfEngine extends Engine {
  renderPdf(
    doc: unknown,
    data: unknown,
    opts?: RenderPdfOptions,
  ): Promise<RenderPdfResult>
}

export interface CreatePdfEngineOptions {
  fonts: FontProvider
  images?: ImageProvider
  subsetWasm:
    | Uint8Array
    | ArrayBuffer
    | (() => Promise<Uint8Array | ArrayBuffer>)
}

export async function createPdfEngine(
  opts: CreatePdfEngineOptions,
): Promise<PdfEngine> {
  const coreEngine = await createEngine({
    fonts: opts.fonts,
    images: opts.images,
  })
  const wasmBytes =
    typeof opts.subsetWasm === 'function'
      ? await opts.subsetWasm()
      : opts.subsetWasm
  const subset = await createSubsetter(wasmBytes)

  return {
    fonts: coreEngine.fonts,
    validate: (doc, data) => coreEngine.validate(doc, data),
    layout: (doc, data, layoutOpts) => coreEngine.layout(doc, data, layoutOpts),
    async renderPdf(
      doc: unknown,
      data: unknown,
      renderOpts?: RenderPdfOptions,
    ): Promise<RenderPdfResult> {
      const parsed = parseDocument(doc)
      const tree = await coreEngine.layout(parsed, data, {
        strict: renderOpts?.strict,
      })
      const bytes = await writePdf(tree, {
        fonts: coreEngine.fonts,
        images: opts.images,
        subset,
        meta: parsed.meta,
        creationDate: renderOpts?.creationDate,
      })
      return {
        bytes,
        pageCount: tree.pages.length,
        warnings: tree.warnings,
      }
    },
  }
}
