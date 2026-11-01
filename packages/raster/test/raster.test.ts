import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { describe, it, expect } from 'vitest'
import { readImageInfo, type DocumentDef } from '@apw-pdf/core'
import { fontFileName } from '@apw-pdf/fonts'
import { fontsDir } from '@apw-pdf/fonts/node'
import { createPdfEngine } from '@apw-pdf/pdf'
import { rasterizePage } from '../src/index.js'

const require = createRequire(import.meta.url)

async function createSampleA4Pdf(): Promise<Uint8Array> {
  const subsetWasmBytes = await fs.readFile(
    require.resolve('harfbuzzjs/dist/harfbuzz-subset.wasm'),
  )
  const engine = await createPdfEngine({
    fonts: {
      load: async (family, style) =>
        new Uint8Array(
          await fs.readFile(
            path.join(fontsDir, fontFileName(family, style.bold, style.italic)),
          ),
        ),
    },
    subsetWasm: new Uint8Array(subsetWasmBytes),
  })
  const doc: DocumentDef = {
    version: 1,
    page: {
      size: 'A4',
      margin: { top: '2.5cm', bottom: '2cm', left: '3cm', right: '2cm' },
    },
    font: { family: 'THSarabunIT9', size: '16pt' },
    blocks: [{ type: 'paragraph', text: 'บันทึกข้อความ ทดสอบ' }],
  }
  const { bytes } = await engine.renderPdf(doc, {})
  return bytes
}

describe('rasterizePage', () => {
  it('rasterizes an A4 page at 150 dpi to a 1240×1754 px PNG', async () => {
    const pdfBytes = await createSampleA4Pdf()
    const pngBytes = await rasterizePage(pdfBytes, 1, { dpi: 150 })
    const info = readImageInfo(pngBytes)
    expect(info.format).toBe('png')
    expect(info.width).toBe(1240)
    expect(info.height).toBe(1754)
  })

  it('clamps dpi > 200 to 200', async () => {
    const pdfBytes = await createSampleA4Pdf()
    const png200 = await rasterizePage(pdfBytes, 1, { dpi: 200 })
    const png300 = await rasterizePage(pdfBytes, 1, { dpi: 300 })
    const info200 = readImageInfo(png200)
    const info300 = readImageInfo(png300)
    expect(info300.width).toBe(info200.width)
    expect(info300.height).toBe(info200.height)
  })

  it('throws RangeError when pageNumber is out of range or canvas dimensions exceed cap (M10)', async () => {
    const pdfBytes = await createSampleA4Pdf()
    await expect(rasterizePage(pdfBytes, 0)).rejects.toThrow(RangeError)
    await expect(rasterizePage(pdfBytes, 2)).rejects.toThrow(RangeError)

    // Create a 3500pt x 3500pt page (at 200 DPI -> 9722x9722 px > 8192px cap)
    const subsetWasmBytes = await fs.readFile(
      require.resolve('harfbuzzjs/dist/harfbuzz-subset.wasm'),
    )
    const engine = await createPdfEngine({
      fonts: {
        load: async (family, style) =>
          new Uint8Array(
            await fs.readFile(
              path.join(fontsDir, fontFileName(family, style.bold, style.italic)),
            ),
          ),
      },
      subsetWasm: new Uint8Array(subsetWasmBytes),
    })
    const bigDoc: DocumentDef = {
      version: 1,
      page: {
        size: { width: '3500pt', height: '3500pt' },
        margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' },
      },
      font: { family: 'THSarabunIT9', size: '16pt' },
      blocks: [{ type: 'paragraph', text: 'ใหญ่' }],
    }
    const { bytes: bigPdfBytes } = await engine.renderPdf(bigDoc, {})
    await expect(rasterizePage(bigPdfBytes, 1, { dpi: 200 })).rejects.toThrow(
      RangeError,
    )
  })
})
