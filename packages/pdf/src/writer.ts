import {
  PDFDocument,
  PDFHexString,
  PDFName,
  type PDFImage,
  type PDFRef,
} from 'pdf-lib'
import {
  ApwPdfError,
  readImageInfo,
  type DocumentDef,
  type FontRegistry,
  type ImageProvider,
  type LayoutItem,
  type LayoutTree,
  type LoadedFont,
} from '@apw-pdf/core'
import { embedCidFont } from './cidfont.js'
import type { Subsetter } from './hbsubset.js'

export interface WritePdfOptions {
  fonts: FontRegistry
  images?: ImageProvider
  subset: Subsetter
  meta?: DocumentDef['meta']
  creationDate?: Date
}

function fmt(n: number): string {
  if (Math.abs(n) < 1e-6) return '0'
  const s = n.toFixed(4)
  return s.replace(/\.?0+$/, '')
}

function parseHexColor(hex: string): [number, number, number] {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex
  if (clean.length !== 6) return [0, 0, 0]
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  return [
    Number.isFinite(r) ? r : 0,
    Number.isFinite(g) ? g : 0,
    Number.isFinite(b) ? b : 0,
  ]
}

interface NormalizedGlyph {
  id: number
  dx: number
  dy: number
  advance: number
}

interface SaraAmInfo {
  nikhahitGid: number
  saraAaGid: number
  saraAmGid: number
}

function getSaraAmInfo(font: LoadedFont): SaraAmInfo | null {
  const shaped = font.shape('\u0E33', 16)
  if (shaped.glyphs.length === 2) {
    const nikhahitGid = shaped.glyphs[0]!.id
    const saraAaGid = shaped.glyphs[1]!.id
    return {
      nikhahitGid,
      saraAaGid,
      saraAmGid: saraAaGid + 1,
    }
  }
  return null
}

/**
 * Normalizes a glyph run for PDF output and records GID -> Unicode mappings.
 * Collapses HarfBuzz's decomposed unshifted sara am (nikhahit + sara aa) into
 * the font's precomposed uni0E33 glyph so `/ToUnicode` round-trips U+0E33 ('ำ')
 * without colliding with U+0E32 ('า').
 */
function normalizeRunAndRecordUsage(
  item: Extract<LayoutItem, { kind: 'glyphs' }>,
  saraAm: SaraAmInfo | null,
  usage: Map<number, string>,
): NormalizedGlyph[] {
  const out: NormalizedGlyph[] = []
  const { glyphs, clusters, text } = item
  let i = 0
  while (i < glyphs.length) {
    const cStart = clusters[i] ?? 0
    let j = i + 1
    while (j < glyphs.length && (clusters[j] ?? cStart) === cStart) {
      j++
    }
    const cEnd = j < glyphs.length ? (clusters[j] ?? text.length) : text.length
    const clusterText = text.slice(cStart, cEnd)
    const codePoints = Array.from(clusterText)
    let clusterGlyphs: NormalizedGlyph[] = glyphs.slice(i, j).map((g) => ({
      id: g.id,
      dx: g.dx,
      dy: g.dy,
      advance: g.advance,
    }))

    if (
      saraAm &&
      clusterText.includes('\u0E33') &&
      clusterGlyphs.length >= 2 &&
      clusterGlyphs[clusterGlyphs.length - 1]!.id === saraAm.saraAaGid
    ) {
      const nikIdx = clusterGlyphs.findIndex(
        (g) =>
          g.id === saraAm.nikhahitGid &&
          Math.abs(g.advance) < 1e-4 &&
          Math.abs(g.dx) < 1e-4 &&
          Math.abs(g.dy) < 1e-4,
      )
      if (nikIdx !== -1) {
        clusterGlyphs.splice(nikIdx, 1)
        clusterGlyphs[clusterGlyphs.length - 1] = {
          ...clusterGlyphs[clusterGlyphs.length - 1]!,
          id: saraAm.saraAmGid,
        }
      }
    }

    if (clusterGlyphs.length === 1 && codePoints.length >= 1) {
      const gid = clusterGlyphs[0]!.id
      if (gid !== 0 && !usage.has(gid)) {
        usage.set(gid, clusterText)
      }
    } else if (clusterGlyphs.length === codePoints.length) {
      for (let k = 0; k < clusterGlyphs.length; k++) {
        const gid = clusterGlyphs[k]!.id
        const ch = codePoints[k]!
        if (gid !== 0 && !usage.has(gid)) {
          usage.set(gid, ch)
        }
      }
    } else {
      for (let k = 0; k < clusterGlyphs.length; k++) {
        const gid = clusterGlyphs[k]!.id
        if (gid === 0 || usage.has(gid)) continue
        if (k < codePoints.length - 1) {
          usage.set(gid, codePoints[k]!)
        } else if (k === clusterGlyphs.length - 1 && k < codePoints.length) {
          usage.set(gid, codePoints.slice(k).join(''))
        } else if (k < codePoints.length) {
          usage.set(gid, codePoints[k]!)
        }
      }
    }

    out.push(...clusterGlyphs)
    i = j
  }
  return out
}

function deterministicIdHex(date: Date): string {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  const s = `apw-pdf:${date.getTime()}`
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ (c + i), 0x811c9dc5) >>> 0
  }
  const hex1 = h1.toString(16).padStart(8, '0')
  const hex2 = h2.toString(16).padStart(8, '0')
  return (hex1 + hex2 + hex1 + hex2).toUpperCase()
}

export async function writePdf(
  tree: LayoutTree,
  opts: WritePdfOptions,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const creationDate = opts.creationDate ?? new Date()

  doc.setProducer('apw-pdf')
  doc.setCreator('apw-pdf')
  doc.setCreationDate(creationDate)
  doc.setModificationDate(creationDate)

  if (opts.meta?.title) doc.setTitle(opts.meta.title)
  if (opts.meta?.author) doc.setAuthor(opts.meta.author)
  if (opts.meta?.subject) doc.setSubject(opts.meta.subject)

  const idHex = deterministicIdHex(creationDate)
  doc.context.trailerInfo.ID = doc.context.obj([
    PDFHexString.of(idHex),
    PDFHexString.of(idHex),
  ])

  // 1. Collect glyph usage per font and normalize runs per page
  const fontUsage = new Map<number, Map<number, string>>()
  const saraAmByFont = new Map<number, SaraAmInfo | null>()
  const normalizedRuns = new WeakMap<
    Extract<LayoutItem, { kind: 'glyphs' }>,
    NormalizedGlyph[]
  >()

  for (const page of tree.pages) {
    for (const item of page.items) {
      if (item.kind === 'glyphs') {
        let usage = fontUsage.get(item.font)
        if (!usage) {
          usage = new Map<number, string>()
          fontUsage.set(item.font, usage)
        }
        if (!saraAmByFont.has(item.font)) {
          const loaded = opts.fonts.byId(item.font)
          saraAmByFont.set(item.font, getSaraAmInfo(loaded))
        }
        const norm = normalizeRunAndRecordUsage(
          item,
          saraAmByFont.get(item.font) ?? null,
          usage,
        )
        normalizedRuns.set(item, norm)
      }
    }
  }

  // 2. Embed used CID fonts
  const embeddedFonts = new Map<number, PDFRef>()
  for (const [fontId, usage] of fontUsage.entries()) {
    const loaded = opts.fonts.byId(fontId)
    const ref = embedCidFont(doc, loaded, usage, opts.subset)
    embeddedFonts.set(fontId, ref)
  }

  // 3. Embed used images
  const embeddedImages = new Map<string, { name: string; img: PDFImage }>()
  let nextImageIdx = 1
  for (const page of tree.pages) {
    for (const item of page.items) {
      if (item.kind === 'image' && !embeddedImages.has(item.ref)) {
        let imgBytes = tree.imageCache?.get(item.ref)
        if (!imgBytes) {
          if (!opts.images) {
            throw new ApwPdfError(
              'IMAGE_LOAD_FAILED',
              `No image provider configured to load "${item.ref}"`,
            )
          }
          try {
            imgBytes = await opts.images.load(item.ref)
          } catch (err) {
            if (err instanceof ApwPdfError) throw err
            throw new ApwPdfError(
              'IMAGE_LOAD_FAILED',
              `Failed to load image "${item.ref}": ${err instanceof Error ? err.message : String(err)}`,
            )
          }
        }
        const info = readImageInfo(imgBytes)
        const embedded =
          info.format === 'png'
            ? await doc.embedPng(imgBytes)
            : await doc.embedJpg(imgBytes)
        embeddedImages.set(item.ref, {
          name: `Im${nextImageIdx++}`,
          img: embedded,
        })
      }
    }
  }

  // 4. Emit pages and content streams
  for (const layoutPage of tree.pages) {
    const page = doc.addPage([layoutPage.width, layoutPage.height])
    const pageH = layoutPage.height

    for (const [fontId, fontRef] of embeddedFonts.entries()) {
      page.node.setFontDictionary(PDFName.of(`F${fontId}`), fontRef)
    }
    for (const { name, img } of embeddedImages.values()) {
      page.node.setXObject(PDFName.of(name), img.ref)
    }

    const ops: string[] = []

    for (const item of layoutPage.items) {
      if (item.kind === 'glyphs') {
        const glyphs = normalizedRuns.get(item) ?? item.glyphs
        if (glyphs.length === 0) continue

        const loadedFont = opts.fonts.byId(item.font)
        const upem = loadedFont.metrics.upem
        const [r, g, b] = parseHexColor(item.color)
        const baseY = pageH - item.y

        ops.push('BT')
        ops.push(`${fmt(r)} ${fmt(g)} ${fmt(b)} rg`)
        ops.push(`/F${item.font} ${fmt(item.size)} Tf`)
        ops.push(`1 0 0 1 ${fmt(item.x)} ${fmt(baseY)} Tm`)

        let lineOriginX = item.x
        let lineOriginY = baseY
        let cursorX = item.x

        let idx = 0
        while (idx < glyphs.length) {
          const gl = glyphs[idx]!
          const hasOffset = Math.abs(gl.dx) > 1e-4 || Math.abs(gl.dy) > 1e-4
          if (hasOffset) {
            const gx = cursorX + gl.dx
            const gy = baseY + gl.dy
            const tx = gx - lineOriginX
            const ty = gy - lineOriginY
            const hex = gl.id.toString(16).toUpperCase().padStart(4, '0')
            ops.push(`${fmt(tx)} ${fmt(ty)} Td [<${hex}>] TJ`)
            lineOriginX = gx
            lineOriginY = gy
            cursorX += gl.advance
            idx++
          } else {
            const groupStartX = cursorX
            if (
              Math.abs(groupStartX - lineOriginX) > 1e-4 ||
              Math.abs(baseY - lineOriginY) > 1e-4
            ) {
              ops.push(
                `${fmt(groupStartX - lineOriginX)} ${fmt(baseY - lineOriginY)} Td`,
              )
              lineOriginX = groupStartX
              lineOriginY = baseY
            }
            const tjParts: string[] = []
            while (
              idx < glyphs.length &&
              Math.abs(glyphs[idx]!.dx) <= 1e-4 &&
              Math.abs(glyphs[idx]!.dy) <= 1e-4
            ) {
              const cg = glyphs[idx]!
              const hex = cg.id.toString(16).toUpperCase().padStart(4, '0')
              tjParts.push(`<${hex}>`)
              const fontAdvPt = (loadedFont.glyphAdvance(cg.id) / upem) * item.size
              const kern = -((cg.advance - fontAdvPt) * 1000) / item.size
              if (Math.abs(kern) > 0.01) {
                tjParts.push(fmt(kern))
              }
              cursorX += cg.advance
              idx++
            }
            ops.push(`[${tjParts.join(' ')}] TJ`)
          }
        }

        ops.push('ET')
      } else if (item.kind === 'line') {
        const [r, g, b] = parseHexColor(item.color)
        const y1 = pageH - item.y1
        const y2 = pageH - item.y2
        ops.push('q')
        ops.push(`${fmt(r)} ${fmt(g)} ${fmt(b)} RG`)
        ops.push(`${fmt(item.width)} w`)
        if (item.dash && item.dash.length > 0) {
          ops.push(`[${item.dash.map(fmt).join(' ')}] 0 d`)
        } else {
          ops.push('[] 0 d')
        }
        ops.push(`${fmt(item.x1)} ${fmt(y1)} m ${fmt(item.x2)} ${fmt(y2)} l S`)
        ops.push('Q')
      } else if (item.kind === 'rect') {
        const pdfY = pageH - item.y - item.h
        ops.push('q')
        if (item.fill) {
          const [fr, fg, fb] = parseHexColor(item.fill)
          ops.push(`${fmt(fr)} ${fmt(fg)} ${fmt(fb)} rg`)
        }
        if (item.stroke) {
          const [sr, sg, sb] = parseHexColor(item.stroke)
          ops.push(`${fmt(sr)} ${fmt(sg)} ${fmt(sb)} RG`)
          ops.push(`${fmt(item.strokeWidth ?? 1)} w`)
        }
        const paintOp =
          item.fill && item.stroke ? 'B' : item.fill ? 'f' : item.stroke ? 'S' : 'n'
        ops.push(
          `${fmt(item.x)} ${fmt(pdfY)} ${fmt(item.w)} ${fmt(item.h)} re ${paintOp}`,
        )
        ops.push('Q')
      } else if (item.kind === 'image') {
        const info = embeddedImages.get(item.ref)
        if (!info) continue
        const pdfY = pageH - item.y - item.h
        ops.push('q')
        ops.push(
          `${fmt(item.w)} 0 0 ${fmt(item.h)} ${fmt(item.x)} ${fmt(pdfY)} cm /${info.name} Do`,
        )
        ops.push('Q')
      }
    }

    const contentStream = doc.context.stream(ops.join('\n'))
    const contentRef = doc.context.register(contentStream)
    page.node.addContentStream(contentRef)
  }

  return doc.save({ useObjectStreams: false })
}
