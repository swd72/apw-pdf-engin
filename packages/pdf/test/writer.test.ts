import { describe, it, expect } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { PDFDocument } from 'pdf-lib'
import { fontFileName } from '@apw-pdf/fonts'
import { fontsDir } from '@apw-pdf/fonts/node'
import { createPdfEngine } from '../src/index.js'

const require = createRequire(import.meta.url)

// Valid 1x1 red PNG
const PNG_1X1 = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
)

// Valid 1x1 JPEG
const JPG_1X1 = Uint8Array.from(
  Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    'base64',
  ),
)

function createTestFontProvider() {
  return {
    async load(family: string, style: { bold: boolean; italic: boolean }) {
      const file = fontFileName(family, style.bold, style.italic)
      const buf = await fs.readFile(path.join(fontsDir, file))
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
    },
  }
}

function createTestImageProvider() {
  return {
    async load(ref: string): Promise<Uint8Array> {
      if (ref.endsWith('.png')) return PNG_1X1
      if (ref.endsWith('.jpg') || ref.endsWith('.jpeg')) return JPG_1X1
      throw new Error(`Unknown image: ${ref}`)
    },
  }
}

async function getEngine() {
  const wasmPath = require.resolve('harfbuzzjs/dist/harfbuzz-subset.wasm')
  return createPdfEngine({
    fonts: createTestFontProvider(),
    images: createTestImageProvider(),
    subsetWasm: async () => {
      const buf = await fs.readFile(wasmPath)
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
    },
  })
}

const BASE_DOC = {
  version: 1 as const,
  page: {
    size: 'A4' as const,
    margin: { top: '1.5cm', bottom: '2cm', left: '3cm', right: '2cm' },
  },
  font: { family: 'THSarabunIT9', size: '16pt' },
}

describe('writePdf and createPdfEngine', () => {
  it('round-trips Thai text through pdfjs getTextContent', async () => {
    const engine = await getEngine()
    const sourceText = 'ด้วยสำนักงานขอจัดซื้อวัสดุ จำนวน ๑๐ รายการ'
    const doc = {
      ...BASE_DOC,
      blocks: [{ type: 'paragraph' as const, text: sourceText }],
    }
    const { bytes, pageCount } = await engine.renderPdf(doc, {})
    expect(pageCount).toBe(1)

    const pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(bytes),
      isEvalSupported: false,
    }).promise
    const page = await pdf.getPage(1)
    const content = await page.getTextContent()
    const extracted = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join('')
      .replace(/\s+/g, '')
    expect(extracted).toBe(sourceText.replace(/\s+/g, ''))
  })

  it('positions first glyph run at x ≈ 85.04 and y ≈ 841.89 - baseline (±0.05)', async () => {
    const engine = await getEngine()
    const doc = {
      ...BASE_DOC,
      blocks: [{ type: 'paragraph' as const, text: 'สวัสดี' }],
    }
    const tree = await engine.layout(doc, {})
    const firstGlyphItem = tree.pages[0].items.find((i) => i.kind === 'glyphs')!
    expect(firstGlyphItem.kind).toBe('glyphs')

    const { bytes } = await engine.renderPdf(doc, {})
    const pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(bytes),
      isEvalSupported: false,
    }).promise
    const page = await pdf.getPage(1)
    const content = await page.getTextContent()
    const firstItem = content.items.find(
      (item): item is typeof item & { str: string; transform: number[] } =>
        'str' in item && item.str.trim().length > 0,
    )!
    expect(firstItem.transform[4]).toBeCloseTo(85.04, 1)
    if (firstGlyphItem.kind === 'glyphs') {
      expect(firstItem.transform[5]).toBeCloseTo(841.89 - firstGlyphItem.y, 1)
    }
  })

  it('sets A4 mediabox [0 0 595.2756 841.8898]', async () => {
    const engine = await getEngine()
    const doc = {
      ...BASE_DOC,
      blocks: [{ type: 'paragraph' as const, text: 'ทดสอบ' }],
    }
    const { bytes } = await engine.renderPdf(doc, {})
    const loaded = await PDFDocument.load(bytes)
    const page = loaded.getPage(0)
    const { x, y, width, height } = page.getMediaBox()
    expect(x).toBe(0)
    expect(y).toBe(0)
    expect(width).toBeCloseTo(595.2756, 3)
    expect(height).toBeCloseTo(841.8898, 3)
  })

  it('embeds PNG and JPEG images with layout width and height in CTM', async () => {
    const engine = await getEngine()
    const doc = {
      ...BASE_DOC,
      blocks: [
        {
          type: 'image' as const,
          src: 'logo.png',
          width: '1.5cm',
          height: '1.5cm',
        },
        {
          type: 'image' as const,
          src: 'photo.jpg',
          width: '2cm',
          height: '1cm',
        },
      ],
    }
    const { bytes } = await engine.renderPdf(doc, {})
    const rawText = new TextDecoder('latin1').decode(bytes)
    // 1.5cm = 42.5197pt, 2cm = 56.6929pt, 1cm = 28.3465pt, 3cm = 85.0394pt
    expect(rawText).toContain('42.5197 0 0 42.5197 85.0394')
    expect(rawText).toContain('56.6929 0 0 28.3465 85.0394')
  })

  it('draws table border lines and rects with expected stroke width', async () => {
    const engine = await getEngine()
    const doc = {
      ...BASE_DOC,
      blocks: [
        {
          type: 'table' as const,
          columns: [{ width: '*' as const }],
          rows: [[{ text: 'ข' }]],
          border: { width: '0.5pt', color: '#000000' },
        },
        {
          type: 'line' as const,
          thickness: '1pt',
          style: 'dashed' as const,
        },
        {
          type: 'paragraph' as const,
          runs: [{ checkbox: true, label: 'เลือก' }],
        },
      ],
    }
    const { bytes } = await engine.renderPdf(doc, {})
    const rawText = new TextDecoder('latin1').decode(bytes)
    expect(rawText).toContain('0.5 w')
    expect(rawText).toMatch(/\bm\b[\s\S]*\bl\b[\s\S]*\bS\b/)
    expect(rawText).toMatch(/\bre\s+S\b/)
  })

  it('produces identical bytes for two renders with creationDate: new Date(0)', async () => {
    const engine = await getEngine()
    const doc = {
      ...BASE_DOC,
      meta: { title: 'เอกสารทดสอบ' },
      blocks: [{ type: 'paragraph' as const, text: 'ข้อความทดสอบความเหมือน' }],
    }
    const r1 = await engine.renderPdf(doc, {}, { creationDate: new Date(0) })
    const r2 = await engine.renderPdf(doc, {}, { creationDate: new Date(0) })
    expect(Buffer.from(r1.bytes).equals(Buffer.from(r2.bytes))).toBe(true)
  })

  it('sets Producer to apw-pdf and Title from meta.title', async () => {
    const engine = await getEngine()
    const doc = {
      ...BASE_DOC,
      meta: {
        title: 'บันทึกข้อความทดสอบ',
        author: 'สมชาย',
        subject: 'ราชการ',
      },
      blocks: [{ type: 'paragraph' as const, text: 'เนื้อหา' }],
    }
    const { bytes } = await engine.renderPdf(doc, {})
    const loaded = await PDFDocument.load(bytes, { updateMetadata: false })
    expect(loaded.getProducer()).toBe('apw-pdf')
    expect(loaded.getTitle()).toBe('บันทึกข้อความทดสอบ')
    expect(loaded.getAuthor()).toBe('สมชาย')
    expect(loaded.getSubject()).toBe('ราชการ')
  })

  it('Review Focus 4: missing glyph in text ก✅ produces bytes and MISSING_GLYPH warning at blocks[0]', async () => {
    const engine = await getEngine()
    const doc = {
      ...BASE_DOC,
      blocks: [{ type: 'paragraph' as const, text: 'ก✅' }],
    }
    const { bytes, warnings } = await engine.renderPdf(doc, {})
    expect(bytes.byteLength).toBeGreaterThan(100)
    expect(warnings).toContainEqual(
      expect.objectContaining({
        code: 'MISSING_GLYPH',
        path: 'blocks[0]',
      }),
    )
  })
})
