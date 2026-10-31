import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import {
  ApwPdfError,
  type FontProvider,
  type ImageProvider,
} from '@apw-pdf/core'
import { fontFileName } from '@apw-pdf/fonts'

const require = createRequire(import.meta.url)
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

export function fsFontProvider(dirs: string[]): FontProvider {
  return {
    async load(
      family: string,
      style: { bold: boolean; italic: boolean },
    ): Promise<Uint8Array> {
      const fileName = fontFileName(family, style.bold, style.italic)
      for (const dir of dirs) {
        try {
          const buf = await fs.readFile(path.join(dir, fileName))
          return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
        } catch {
          // Try next directory
        }
      }
      throw new ApwPdfError(
        'FONT_NOT_FOUND',
        `Font file "${fileName}" not found in configured fontDirs`,
      )
    },
  }
}

export interface FsImageProviderOptions {
  baseDir?: string
  allowRemoteImages?: string[]
  assets?: Record<string, string | Uint8Array>
}

function decodeDataUrl(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(',')
  if (commaIdx === -1) {
    throw new ApwPdfError('IMAGE_LOAD_FAILED', 'Invalid data: URL')
  }
  const header = dataUrl.slice(5, commaIdx)
  const payload = dataUrl.slice(commaIdx + 1)
  const isBase64 = header.endsWith(';base64')
  const buf = isBase64
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8')
  if (buf.byteLength > MAX_IMAGE_BYTES) {
    throw new ApwPdfError(
      'LIMIT_EXCEEDED',
      `Image exceeds 10 MB limit (${buf.byteLength} bytes)`,
    )
  }
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
}

function resolveDefaultGarudaPath(): string {
  return require.resolve('@apw-pdf/templates/assets/garuda-placeholder.png')
}

export function fsImageProvider(
  opts: FsImageProviderOptions = {},
): ImageProvider {
  const baseDir = path.resolve(opts.baseDir ?? process.cwd())
  const allowlist = new Set(opts.allowRemoteImages ?? [])
  const assets = opts.assets ?? {}

  return {
    async load(ref: string): Promise<Uint8Array> {
      if (ref.startsWith('asset:')) {
        const assetName = ref.slice('asset:'.length)
        const custom = assets[assetName]
        if (custom instanceof Uint8Array) {
          if (custom.byteLength > MAX_IMAGE_BYTES) {
            throw new ApwPdfError('LIMIT_EXCEEDED', 'Asset image exceeds 10 MB limit')
          }
          return custom
        }
        if (typeof custom === 'string') {
          if (custom.startsWith('data:')) return decodeDataUrl(custom)
          const buf = await fs.readFile(custom)
          if (buf.byteLength > MAX_IMAGE_BYTES) {
            throw new ApwPdfError('LIMIT_EXCEEDED', 'Asset image exceeds 10 MB limit')
          }
          return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
        }
        if (assetName === 'garuda') {
          const buf = await fs.readFile(resolveDefaultGarudaPath())
          return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
        }
        throw new ApwPdfError(
          'IMAGE_LOAD_FAILED',
          `Unknown asset "${assetName}"`,
        )
      }

      if (ref.startsWith('data:')) {
        return decodeDataUrl(ref)
      }

      if (ref.startsWith('http://') || ref.startsWith('https://')) {
        let parsed: URL
        try {
          parsed = new URL(ref)
        } catch {
          throw new ApwPdfError('IMAGE_LOAD_FAILED', `Invalid image URL "${ref}"`)
        }
        if (!allowlist.has(parsed.hostname)) {
          throw new ApwPdfError(
            'IMAGE_NOT_ALLOWED',
            `Remote image host "${parsed.hostname}" is not in allowRemoteImages`,
          )
        }
        let res: Response
        try {
          res = await fetch(parsed, {
            signal: AbortSignal.timeout(10_000),
          })
        } catch (err) {
          throw new ApwPdfError(
            'IMAGE_LOAD_FAILED',
            `Failed to fetch remote image "${ref}": ${err instanceof Error ? err.message : String(err)}`,
          )
        }
        if (!res.ok) {
          throw new ApwPdfError(
            'IMAGE_LOAD_FAILED',
            `HTTP ${res.status} when fetching image "${ref}"`,
          )
        }
        const ab = await res.arrayBuffer()
        if (ab.byteLength > MAX_IMAGE_BYTES) {
          throw new ApwPdfError(
            'LIMIT_EXCEEDED',
            `Remote image "${ref}" exceeds 10 MB limit`,
          )
        }
        return new Uint8Array(ab)
      }

      if (ref.includes('\0') || path.isAbsolute(ref)) {
        throw new ApwPdfError(
          'IMAGE_NOT_ALLOWED',
          `Absolute or invalid image path "${ref}" is not allowed`,
        )
      }

      const resolved = path.resolve(baseDir, ref)
      const rel = path.relative(baseDir, resolved)
      if (rel.startsWith('..') || path.isAbsolute(rel)) {
        throw new ApwPdfError(
          'IMAGE_NOT_ALLOWED',
          `Image path "${ref}" escapes imageBaseDir`,
        )
      }

      let buf: Buffer
      try {
        buf = await fs.readFile(resolved)
      } catch (err) {
        throw new ApwPdfError(
          'IMAGE_LOAD_FAILED',
          `Failed to read image file "${ref}": ${err instanceof Error ? err.message : String(err)}`,
        )
      }
      if (buf.byteLength > MAX_IMAGE_BYTES) {
        throw new ApwPdfError(
          'LIMIT_EXCEEDED',
          `Image "${ref}" exceeds 10 MB limit`,
        )
      }
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
    },
  }
}
