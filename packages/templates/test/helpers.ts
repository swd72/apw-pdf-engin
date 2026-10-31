import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import {
  createEngine,
  type DocumentDef,
  type Engine,
  type LayoutItem,
  type LayoutTree,
  type TemplateDef,
} from '@apw-pdf/core'
import { createPdfEngine, type PdfEngine } from '@apw-pdf/pdf'
import { fontFileName } from '@apw-pdf/fonts'
import { fontsDir } from '@apw-pdf/fonts/node'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const placeholderPath = path.resolve(
  __dirname,
  '../assets/garuda-placeholder.png',
)

let enginePromise: Promise<Engine> | null = null
let pdfEnginePromise: Promise<PdfEngine> | null = null

export function testFontProvider() {
  return {
    async load(family: string, style: { bold: boolean; italic: boolean }) {
      const fName = fontFileName(family, style.bold, style.italic)
      const buf = await fs.readFile(path.join(fontsDir, fName))
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
    },
  }
}

export function testImageProvider() {
  return {
    async load(ref: string): Promise<Uint8Array> {
      if (ref === 'asset:garuda' || ref === 'garuda' || ref.includes('garuda')) {
        const buf = await fs.readFile(placeholderPath)
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
      }
      const buf = await fs.readFile(path.resolve(__dirname, ref))
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
    },
  }
}

export async function getTestEngine(): Promise<Engine> {
  if (!enginePromise) {
    enginePromise = createEngine({
      fonts: testFontProvider(),
      images: testImageProvider(),
    })
  }
  return enginePromise
}

export async function getTestPdfEngine(): Promise<PdfEngine> {
  if (!pdfEnginePromise) {
    const wasmPath = require.resolve('harfbuzzjs/dist/harfbuzz-subset.wasm')
    pdfEnginePromise = createPdfEngine({
      fonts: testFontProvider(),
      images: testImageProvider(),
      subsetWasm: async () => {
        const buf = await fs.readFile(wasmPath)
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
      },
    })
  }
  return pdfEnginePromise
}

function isTemplateDef(v: unknown): v is TemplateDef {
  return (
    typeof v === 'object' &&
    v !== null &&
    'document' in v &&
    'name' in v
  )
}

export async function layoutOf(
  templateOrDoc: TemplateDef | DocumentDef,
  data: unknown,
): Promise<LayoutTree> {
  const engine = await getTestEngine()
  const doc = isTemplateDef(templateOrDoc)
    ? templateOrDoc.document
    : templateOrDoc
  return engine.layout(doc, data)
}

export function findRun(
  tree: LayoutTree,
  textStartsWith: string,
): { page: number; item: Extract<LayoutItem, { kind: 'glyphs' }> } {
  for (let p = 0; p < tree.pages.length; p++) {
    const page = tree.pages[p]!
    for (const item of page.items) {
      if (item.kind === 'glyphs' && item.text.startsWith(textStartsWith)) {
        return { page: p, item }
      }
    }
  }
  throw new Error(`Run starting with "${textStartsWith}" not found in LayoutTree`)
}

export function findRuns(
  tree: LayoutTree,
  textStartsWith: string,
): { page: number; item: Extract<LayoutItem, { kind: 'glyphs' }> }[] {
  const res: { page: number; item: Extract<LayoutItem, { kind: 'glyphs' }> }[] = []
  for (let p = 0; p < tree.pages.length; p++) {
    const page = tree.pages[p]!
    for (const item of page.items) {
      if (item.kind === 'glyphs' && item.text.startsWith(textStartsWith)) {
        res.push({ page: p, item })
      }
    }
  }
  return res
}
