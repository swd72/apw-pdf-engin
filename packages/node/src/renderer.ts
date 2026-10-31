import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import {
  ApwPdfError,
  type Engine,
  type TemplateDef,
  type Warning,
} from '@apw-pdf/core'
import { fontsDir } from '@apw-pdf/fonts/node'
import { createPdfEngine, type RenderPdfOptions } from '@apw-pdf/pdf'
import { templates } from '@apw-pdf/templates'
import { fsFontProvider, fsImageProvider } from './providers.js'

const require = createRequire(import.meta.url)

export interface CreateRendererOptions {
  fontDirs?: string[]
  imageBaseDir?: string
  allowRemoteImages?: string[]
  assets?: Record<string, string | Uint8Array>
}

export interface Renderer {
  render(
    doc: unknown,
    data: unknown,
    opts?: RenderPdfOptions,
  ): Promise<Uint8Array>
  renderToFile(
    doc: unknown,
    data: unknown,
    file: string,
    opts?: RenderPdfOptions,
  ): Promise<{ pageCount: number; warnings: Warning[] }>
  validate(doc: unknown, data: unknown): ReturnType<Engine['validate']>
  templates: Record<string, TemplateDef>
}

function resolveDocInput(doc: unknown): unknown {
  if (typeof doc === 'string') {
    const tpl = templates[doc]
    if (!tpl) {
      throw new ApwPdfError('SCHEMA_INVALID', `Unknown template "${doc}"`)
    }
    return tpl.document
  }
  return doc
}

export async function createRenderer(
  opts: CreateRendererOptions = {},
): Promise<Renderer> {
  const dirs = opts.fontDirs && opts.fontDirs.length > 0 ? opts.fontDirs : [fontsDir]
  const fontProvider = fsFontProvider(dirs)
  const imageProvider = fsImageProvider({
    baseDir: opts.imageBaseDir,
    allowRemoteImages: opts.allowRemoteImages,
    assets: opts.assets,
  })
  const wasmPath = require.resolve('harfbuzzjs/dist/harfbuzz-subset.wasm')
  const wasmBuf = await fs.readFile(wasmPath)
  const subsetWasm = new Uint8Array(
    wasmBuf.buffer,
    wasmBuf.byteOffset,
    wasmBuf.byteLength,
  )

  const engine = await createPdfEngine({
    fonts: fontProvider,
    images: imageProvider,
    subsetWasm,
  })

  return {
    templates,
    validate(doc: unknown, data: unknown) {
      const resolved = resolveDocInput(doc)
      return engine.validate(resolved, data)
    },
    async render(
      doc: unknown,
      data: unknown,
      renderOpts?: RenderPdfOptions,
    ): Promise<Uint8Array> {
      const resolved = resolveDocInput(doc)
      const res = await engine.renderPdf(resolved, data, renderOpts)
      return res.bytes
    },
    async renderToFile(
      doc: unknown,
      data: unknown,
      file: string,
      renderOpts?: RenderPdfOptions,
    ): Promise<{ pageCount: number; warnings: Warning[] }> {
      const resolved = resolveDocInput(doc)
      const res = await engine.renderPdf(resolved, data, renderOpts)
      await fs.mkdir(path.dirname(path.resolve(file)), { recursive: true })
      await fs.writeFile(file, res.bytes)
      return {
        pageCount: res.pageCount,
        warnings: res.warnings,
      }
    },
  }
}
