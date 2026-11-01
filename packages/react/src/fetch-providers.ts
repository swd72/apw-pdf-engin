import {
  ApwPdfError,
  type FontProvider,
  type ImageProvider,
} from '@apw-pdf/core'
import { fontFileName } from '@apw-pdf/fonts'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

function decodeDataUrlBrowser(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(',')
  if (commaIdx === -1) {
    throw new ApwPdfError('IMAGE_LOAD_FAILED', 'Invalid data: URL')
  }
  const header = dataUrl.slice(5, commaIdx)
  const payload = dataUrl.slice(commaIdx + 1)
  if (header.toLowerCase().endsWith(';base64')) {
    const cleanLen = payload.replace(/\s+/g, '').length
    if (Math.floor((cleanLen * 3) / 4) > MAX_IMAGE_BYTES) {
      throw new ApwPdfError('LIMIT_EXCEEDED', 'Image exceeds 10 MB limit')
    }
    const binStr = atob(payload)
    if (binStr.length > MAX_IMAGE_BYTES) {
      throw new ApwPdfError('LIMIT_EXCEEDED', 'Image exceeds 10 MB limit')
    }
    const out = new Uint8Array(binStr.length)
    for (let i = 0; i < binStr.length; i++) {
      out[i] = binStr.charCodeAt(i)
    }
    return out
  }
  const out = new TextEncoder().encode(decodeURIComponent(payload))
  if (out.byteLength > MAX_IMAGE_BYTES) {
    throw new ApwPdfError('LIMIT_EXCEEDED', 'Image exceeds 10 MB limit')
  }
  return out
}

export function fetchFontProvider(baseUrl: string): FontProvider {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  const cache = new Map<string, Promise<Uint8Array>>()

  return {
    load(
      family: string,
      style: { bold: boolean; italic: boolean },
    ): Promise<Uint8Array> {
      const fileName = fontFileName(family, style.bold, style.italic)
      const hit = cache.get(fileName)
      if (hit) return hit

      const url = `${normalizedBase}/${fileName}`
      const promise = (async () => {
        const res = await fetch(url)
        if (!res.ok) {
          throw new ApwPdfError(
            'FONT_NOT_FOUND',
            `Failed to fetch font "${url}" (HTTP ${res.status})`,
          )
        }
        const ab = await res.arrayBuffer()
        return new Uint8Array(ab)
      })()

      cache.set(fileName, promise)
      return promise
    },
  }
}

export function fetchImageProvider(
  assets?: Record<string, string>,
): ImageProvider {
  const assetMap = assets ?? {}
  const cache = new Map<string, Promise<Uint8Array>>()

  return {
    async load(ref: string): Promise<Uint8Array> {
      let target = ref
      if (ref.startsWith('asset:')) {
        const name = ref.slice('asset:'.length)
        const mapped = Object.hasOwn(assetMap, name) ? assetMap[name] : undefined
        if (!mapped) {
          throw new ApwPdfError('IMAGE_LOAD_FAILED', `Unknown asset "${name}"`)
        }
        target = mapped
      } else if (Object.hasOwn(assetMap, ref)) {
        target = assetMap[ref]!
      }

      if (/^data:/i.test(target)) {
        return decodeDataUrlBrowser(target)
      }

      const baseOrigin =
        typeof location !== 'undefined' &&
        location.origin &&
        location.origin !== 'null'
          ? location.origin
          : 'http://localhost'

      let parsed: URL
      try {
        parsed = new URL(target, baseOrigin)
      } catch {
        throw new ApwPdfError(
          'IMAGE_NOT_ALLOWED',
          `Cross-origin image "${target}" is not allowed`,
        )
      }

      if (
        parsed.origin !== baseOrigin ||
        (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
      ) {
        throw new ApwPdfError(
          'IMAGE_NOT_ALLOWED',
          `Cross-origin image "${target}" is not allowed`,
        )
      }

      const cached = cache.get(target)
      if (cached) return cached

      const promise = (async () => {
        const res = await fetch(target, {
          signal: AbortSignal.timeout(10_000),
        })
        if (!res.ok) {
          throw new ApwPdfError(
            'IMAGE_LOAD_FAILED',
            `Failed to fetch image "${target}" (HTTP ${res.status})`,
          )
        }
        const contentLength = res.headers?.get?.('content-length')
        if (contentLength !== null && contentLength !== undefined) {
          const declaredLen = Number(contentLength)
          if (Number.isFinite(declaredLen) && declaredLen > MAX_IMAGE_BYTES) {
            throw new ApwPdfError(
              'LIMIT_EXCEEDED',
              `Remote image "${target}" exceeds 10 MB limit`,
            )
          }
        }
        const ab = await res.arrayBuffer()
        if (ab.byteLength > MAX_IMAGE_BYTES) {
          throw new ApwPdfError(
            'LIMIT_EXCEEDED',
            `Remote image "${target}" exceeds 10 MB limit`,
          )
        }
        return new Uint8Array(ab)
      })()

      cache.set(target, promise)
      return promise
    },
  }
}
