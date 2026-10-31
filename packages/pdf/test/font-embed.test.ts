import { describe, it, expect } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import * as hb from 'harfbuzzjs'
import { PDFDocument, PDFDict, PDFName, PDFRawStream } from 'pdf-lib'
import { FontRegistry } from '@apw-pdf/core'
import { fontsDir, fontFileName } from '@apw-pdf/fonts/node'
import { fontFileName as getFileName } from '@apw-pdf/fonts'
import { createSubsetter } from '../src/hbsubset.js'
import { buildToUnicodeCMap } from '../src/tounicode.js'
import { embedCidFont } from '../src/cidfont.js'

const require = createRequire(import.meta.url)

function fontProvider() {
  return {
    async load(family: string, style: { bold: boolean; italic: boolean }) {
      const fName = (getFileName ?? fontFileName)(family, style.bold, style.italic)
      const buf = await fs.readFile(path.join(fontsDir, fName))
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
    },
  }
}

describe('font subsetting and CID font embedding', () => {
  it('subset keeps GIDs and produces < 10 KB font that shapes ปี่ to the same GIDs', async () => {
    const wasmPath = require.resolve('harfbuzzjs/dist/harfbuzz-subset.wasm')
    const wasmBytes = await fs.readFile(wasmPath)
    const subset = await createSubsetter(wasmBytes)

    const reg = FontRegistry.create(fontProvider())
    const font = await reg.get('THSarabunIT9', false, false)
    const origRun = font.shape('ปี่', 16)
    const origGids = origRun.glyphs.map((g) => g.id)
    expect(origGids).toEqual([240, 344, 361])

    const subsetBytes = subset(font.bytes, [0, 240, 344, 361])
    expect(subsetBytes.byteLength).toBeLessThan(10 * 1024)
    expect(subsetBytes.byteLength).toBeGreaterThan(100)

    const blob = new hb.Blob(subsetBytes)
    const face = new hb.Face(blob, 0)
    const subFont = new hb.Font(face)
    const buf = new hb.Buffer()
    buf.addText('ปี่')
    buf.guessSegmentProperties()
    hb.shape(subFont, buf)
    const subGids = buf.getGlyphInfos().map((info) => info.codepoint)
    expect(subGids).toEqual([240, 344, 361])
  })

  it('builds ToUnicode CMap with bfchar entries in hex UTF-16BE', () => {
    const cmap = buildToUnicodeCMap(
      new Map([
        [240, 'ป'],
        [344, 'ี'],
        [361, '่'],
      ]),
    )
    expect(cmap).toContain('<00F0> <0E1B>')
    expect(cmap).toContain('<0158> <0E35>')
    expect(cmap).toContain('<0169> <0E48>')
    expect(cmap).toContain('begincmap')
    expect(cmap).toContain('endcmap')
  })

  it('embeds CIDFontType2 / Type0 dictionary with /FontFile2 stream into PDFDocument', async () => {
    const wasmPath = require.resolve('harfbuzzjs/dist/harfbuzz-subset.wasm')
    const wasmBytes = await fs.readFile(wasmPath)
    const subset = await createSubsetter(wasmBytes)

    const reg = FontRegistry.create(fontProvider())
    const font = await reg.get('THSarabunIT9', false, false)

    const doc = await PDFDocument.create()
    const page = doc.addPage([595.28, 841.89])
    const usage = new Map<number, string>([
      [240, 'ป'],
      [344, 'ี'],
      [361, '่'],
    ])
    const fontRef = embedCidFont(doc, font, usage, subset)
    page.node.setFontDictionary(PDFName.of('F1'), fontRef)

    const saved = await doc.save()
    const reloaded = await PDFDocument.load(saved)
    const fontObj = reloaded.context.lookup(fontRef, PDFDict)
    expect(fontObj.get(PDFName.of('Subtype'))).toEqual(PDFName.of('Type0'))
    expect(fontObj.get(PDFName.of('Encoding'))).toEqual(PDFName.of('Identity-H'))

    let foundFontFile2 = false
    for (const [, obj] of reloaded.context.enumerateIndirectObjects()) {
      if (obj instanceof PDFDict && obj.has(PDFName.of('FontFile2'))) {
        const ff2 = reloaded.context.lookup(obj.get(PDFName.of('FontFile2')))
        expect(ff2).toBeInstanceOf(PDFRawStream)
        foundFontFile2 = true
      }
    }
    expect(foundFontFile2).toBe(true)
  })
})
