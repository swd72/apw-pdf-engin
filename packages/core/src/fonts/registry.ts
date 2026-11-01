import * as hb from 'harfbuzzjs'
import { ApwPdfError, type Warning } from '../errors.js'
import { readFontMetrics, type FontMetrics } from './metrics.js'
import type { FontProvider } from './provider.js'

export interface ShapedGlyph {
  id: number
  advance: number
  dx: number
  dy: number
  cluster: number
}

export interface ShapedRun {
  glyphs: ShapedGlyph[]
  width: number
  missing: string[]
}

export interface LoadedFont {
  id: number
  family: string
  bold: boolean
  italic: boolean
  bytes: Uint8Array
  metrics: FontMetrics
  shape(text: string, sizePt: number): ShapedRun
  glyphAdvance(glyphId: number): number
}

const MAX_SHAPE_CACHE = 4096

export class FontRegistry {
  private provider: FontProvider
  private byKey = new Map<string, Promise<LoadedFont>>()
  private byIdMap = new Map<number, LoadedFont>()
  private nextId = 1
  private shapeCache = new Map<string, ShapedRun>()
  public fallbackWarnings: Warning[] = []
  public warnings: Warning[] = []

  private constructor(provider: FontProvider) {
    this.provider = provider
  }

  static create(provider: FontProvider): FontRegistry {
    return new FontRegistry(provider)
  }

  private key(family: string, bold: boolean, italic: boolean): string {
    return `${family}:${bold ? 1 : 0}:${italic ? 1 : 0}`
  }

  async get(family: string, bold: boolean, italic: boolean): Promise<LoadedFont> {
    const k = this.key(family, bold, italic)
    const cached = this.byKey.get(k)
    if (cached) return cached

    const promise = this.loadWithFallback(family, bold, italic)
    this.byKey.set(k, promise)
    try {
      return await promise
    } catch (err) {
      this.byKey.delete(k)
      throw err
    }
  }

  private async loadWithFallback(
    family: string,
    bold: boolean,
    italic: boolean,
  ): Promise<LoadedFont> {
    try {
      const bytes = await this.provider.load(family, { bold, italic })
      return this.instantiateFont(family, bold, italic, bytes)
    } catch (err) {
      if (!bold && !italic) {
        if (err instanceof ApwPdfError) throw err
        throw new ApwPdfError('FONT_NOT_FOUND', `Font not found: ${family}`)
      }
      const candidates: { bold: boolean; italic: boolean }[] =
        bold && italic
          ? [
              { bold: true, italic: false },
              { bold: false, italic: true },
              { bold: false, italic: false },
            ]
          : [{ bold: false, italic: false }]

      for (const cand of candidates) {
        try {
          const fallbackFont = await this.get(family, cand.bold, cand.italic)
          const warning: Warning = {
            code: 'FONT_STYLE_FALLBACK',
            message: `Font style fallback for ${family} (requested bold=${String(bold)}, italic=${String(italic)}; using bold=${String(cand.bold)}, italic=${String(cand.italic)})`,
          }
          this.fallbackWarnings.push(warning)
          this.warnings.push(warning)
          return fallbackFont
        } catch {
          // continue trying next candidate
        }
      }

      if (err instanceof ApwPdfError) throw err
      throw new ApwPdfError('FONT_NOT_FOUND', `Font not found: ${family}`)
    }
  }

  private instantiateFont(
    family: string,
    bold: boolean,
    italic: boolean,
    bytes: Uint8Array,
  ): LoadedFont {
    const id = this.nextId++
    const blob = new hb.Blob(bytes)
    const face = new hb.Face(blob, 0)
    const font = new hb.Font(face)
    const upem = face.upem || 1000
    font.setScale(upem, upem)

    const os2 = face.referenceTable('OS/2') ?? new Uint8Array(0)
    const hhea = face.referenceTable('hhea') ?? new Uint8Array(0)
    const metrics = readFontMetrics(os2, hhea, upem)

    const loaded: LoadedFont = {
      id,
      family,
      bold,
      italic,
      bytes,
      metrics,
      glyphAdvance: (glyphId: number): number => font.glyphHAdvance(glyphId),
      shape: (text: string, sizePt: number): ShapedRun => {
        if (text.length === 0) {
          return { glyphs: [], width: 0, missing: [] }
        }
        const cacheKey = `${id}:${sizePt}:${text}`
        const hit = this.shapeCache.get(cacheKey)
        if (hit) return hit

        const buf = new hb.Buffer()
        buf.addText(text)
        buf.guessSegmentProperties()
        hb.shape(font, buf)

        const scale = sizePt / upem
        const infos = buf.getGlyphInfos()
        const positions = buf.getGlyphPositions()

        const glyphs: ShapedGlyph[] = []
        const missing: string[] = []
        let width = 0

        for (let i = 0; i < infos.length; i++) {
          const info = infos[i]!
          const pos = positions[i]!
          const gid = info.codepoint
          const adv = pos.xAdvance * scale
          const dx = pos.xOffset * scale
          const dy = pos.yOffset * scale
          glyphs.push({
            id: gid,
            advance: adv,
            dx,
            dy,
            cluster: info.cluster,
          })
          width += adv
          if (gid === 0) {
            const cp = text.codePointAt(info.cluster)
            if (cp !== undefined) {
              missing.push(String.fromCodePoint(cp))
            }
          }
        }

        const run: ShapedRun = { glyphs, width, missing }
        if (this.shapeCache.size >= MAX_SHAPE_CACHE) {
          const oldest = this.shapeCache.keys().next().value
          if (oldest !== undefined) {
            this.shapeCache.delete(oldest)
          }
        }
        this.shapeCache.set(cacheKey, run)
        return run
      },
    }

    this.byIdMap.set(id, loaded)
    return loaded
  }

  byId(id: number): LoadedFont {
    const f = this.byIdMap.get(id)
    if (!f) {
      throw new ApwPdfError('FONT_NOT_FOUND', `Unknown font id ${id}`)
    }
    return f
  }

  all(): LoadedFont[] {
    return Array.from(this.byIdMap.values())
  }
}
