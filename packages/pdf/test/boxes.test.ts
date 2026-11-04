import { describe, it, expect } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fontFileName } from '@apw-pdf/fonts'
import { fontsDir } from '@apw-pdf/fonts/node'
import { createPdfEngine } from '../src/index.js'

const require = createRequire(import.meta.url)

function createTestFontProvider() {
  return {
    async load(family: string, style: { bold: boolean; italic: boolean }) {
      const file = fontFileName(family, style.bold, style.italic)
      const buf = await fs.readFile(path.join(fontsDir, file))
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
    },
  }
}

async function getEngine() {
  const wasmPath = require.resolve('harfbuzzjs/dist/harfbuzz-subset.wasm')
  return createPdfEngine({
    fonts: createTestFontProvider(),
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
  font: { family: 'THSarabunNew', size: '16pt' },
  blocks: [
    { type: 'paragraph' as const, text: 'ย่อหน้าแรก' },
    { type: 'paragraph' as const, text: 'ย่อหน้าที่สอง' },
  ],
}

describe('renderPdf block boxes option', () => {
  it('returns pages with boxes when boxes: true and undefined when omitted, with identical PDF bytes', async () => {
    const engine = await getEngine()
    const creationDate = new Date(0)

    const withoutBoxes = await engine.renderPdf(BASE_DOC, {}, { creationDate })
    const withBoxes = await engine.renderPdf(
      BASE_DOC,
      {},
      { creationDate, boxes: true },
    )

    expect(withoutBoxes.pages).toBeUndefined()
    expect(withBoxes.pages).toBeDefined()
    expect(withBoxes.pages?.length).toBe(withBoxes.pageCount)
    expect(withBoxes.pages?.[0]?.boxes.map((b) => b.path)).toEqual([
      'blocks[0]',
      'blocks[1]',
    ])
    expect(withBoxes.pages?.[0]?.content.w).toBeGreaterThan(0)
    expect(
      Buffer.compare(
        Buffer.from(withoutBoxes.bytes),
        Buffer.from(withBoxes.bytes),
      ),
    ).toBe(0)
  })
})
