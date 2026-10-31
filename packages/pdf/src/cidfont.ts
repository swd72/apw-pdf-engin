import type { LoadedFont } from '@apw-pdf/core'
import { PDFDocument, PDFName, PDFRef, PDFString } from 'pdf-lib'
import type { Subsetter } from './hbsubset.js'
import { buildToUnicodeCMap } from './tounicode.js'

function readHeadBBox(bytes: Uint8Array, upem: number): [number, number, number, number] {
  if (bytes.byteLength < 12) return [-200, -300, 1200, 1000]
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const numTables = view.getUint16(4, false)
  for (let i = 0; i < numTables; i++) {
    const entryOffset = 12 + i * 16
    if (entryOffset + 16 > bytes.byteLength) break
    const tag = String.fromCharCode(
      bytes[entryOffset]!,
      bytes[entryOffset + 1]!,
      bytes[entryOffset + 2]!,
      bytes[entryOffset + 3]!,
    )
    if (tag === 'head') {
      const tableOffset = view.getUint32(entryOffset + 8, false)
      const tableLength = view.getUint32(entryOffset + 12, false)
      if (tableOffset + 44 <= bytes.byteLength && tableLength >= 44) {
        const scale = 1000 / upem
        const xMin = Math.round(view.getInt16(tableOffset + 36, false) * scale)
        const yMin = Math.round(view.getInt16(tableOffset + 38, false) * scale)
        const xMax = Math.round(view.getInt16(tableOffset + 40, false) * scale)
        const yMax = Math.round(view.getInt16(tableOffset + 42, false) * scale)
        return [xMin, yMin, xMax, yMax]
      }
    }
  }
  return [-200, -300, 1200, 1000]
}

export function embedCidFont(
  doc: PDFDocument,
  font: LoadedFont,
  usage: Map<number, string>,
  subset: Subsetter,
): PDFRef {
  const gids = new Set<number>([0, ...usage.keys()])
  const sortedGids = Array.from(gids).sort((a, b) => a - b)

  const subsetBytes = subset(font.bytes, sortedGids)
  const fontFile2Stream = doc.context.flateStream(subsetBytes, {
    Length1: subsetBytes.byteLength,
  })
  const fontFile2Ref = doc.context.register(fontFile2Stream)

  const upem = font.metrics.upem || 1000
  const scale = 1000 / upem
  const ascent = Math.round(font.metrics.winAscent * scale)
  const descent = -Math.round(font.metrics.winDescent * scale)
  const bbox = readHeadBBox(font.bytes, upem)

  const styleSuffix =
    font.bold && font.italic
      ? '-BoldItalic'
      : font.bold
        ? '-Bold'
        : font.italic
          ? '-Italic'
          : ''
  const baseFontName = `APWPDF+${font.family}${styleSuffix}`

  const wArray: (number | number[])[] = []
  for (const gid of sortedGids) {
    const adv = Math.round(font.glyphAdvance(gid) * scale)
    wArray.push(gid, [adv])
  }

  const fontDescriptor = doc.context.obj({
    Type: 'FontDescriptor',
    FontName: PDFName.of(baseFontName),
    Flags: 32,
    FontBBox: bbox,
    ItalicAngle: font.italic ? -12 : 0,
    Ascent: ascent,
    Descent: descent,
    CapHeight: Math.round(ascent * 0.7),
    StemV: font.bold ? 120 : 80,
    FontFile2: fontFile2Ref,
  })
  const fontDescriptorRef = doc.context.register(fontDescriptor)

  const cidFont = doc.context.obj({
    Type: 'Font',
    Subtype: 'CIDFontType2',
    BaseFont: PDFName.of(baseFontName),
    CIDSystemInfo: {
      Registry: PDFString.of('Adobe'),
      Ordering: PDFString.of('Identity'),
      Supplement: 0,
    },
    FontDescriptor: fontDescriptorRef,
    DW: 1000,
    W: wArray,
    CIDToGIDMap: 'Identity',
  })
  const cidFontRef = doc.context.register(cidFont)

  const cmapText = buildToUnicodeCMap(usage)
  const toUnicodeStream = doc.context.flateStream(cmapText)
  const toUnicodeRef = doc.context.register(toUnicodeStream)

  const type0Font = doc.context.obj({
    Type: 'Font',
    Subtype: 'Type0',
    BaseFont: PDFName.of(baseFontName),
    Encoding: 'Identity-H',
    DescendantFonts: [cidFontRef],
    ToUnicode: toUnicodeRef,
  })

  return doc.context.register(type0Font)
}
