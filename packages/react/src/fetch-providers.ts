import {
  ApwPdfError,
  type FontProvider,
  type ImageProvider,
} from '@apw-pdf/core'
import { fontFileName } from '@apw-pdf/fonts'

function decodeDataUrlBrowser(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(',')
  if (commaIdx === -1) {
    throw new ApwPdfError('IMAGE_LOAD_FAILED', 'Invalid data: URL')
  }
  const header = dataUrl.slice(5, commaIdx)
  const payload = dataUrl.slice(commaIdx + 1)
  if (header.endsWith(';base64')) {
    const binStr = atob(payload)
    const out = new Uint8Array(binStr.length)
    for (let i = 0; i < binStr.length; i++) {
      out[i] = binStr.charCodeAt(i)
    }
    return out
  }
  return new TextEncoder().encode(decodeURIComponent(payload))
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
        const mapped = assetMap[name]
        if (!mapped) {
          throw new ApwPdfError('IMAGE_LOAD_FAILED', `Unknown asset "${name}"`)
        }
        target = mapped
      } else if (ref in assetMap) {
        target = assetMap[ref]!
      }

      if (target.startsWith('data:')) {
        return decodeDataUrlBrowser(target)
      }

      if (
        (target.startsWith('http://') || target.startsWith('https://')) &&
        typeof location !== 'undefined' &&
        location.origin &&
        location.origin !== 'null'
      ) {
        const parsed = new URL(target, location.origin)
        if (parsed.origin !== location.origin) {
          throw new ApwPdfError(
            'IMAGE_NOT_ALLOWED',
            `Cross-origin image "${target}" is not allowed`,
          )
        }
      }

      const cached = cache.get(target)
      if (cached) return cached

      const promise = (async () => {
        const res = await fetch(target)
        if (!res.ok) {
          throw new ApwPdfError(
            'IMAGE_LOAD_FAILED',
            `Failed to fetch image "${target}" (HTTP ${res.status})`,
          )
        }
        const ab = await res.arrayBuffer()
        return new Uint8Array(ab)
      })()

      cache.set(target, promise)
      return promise
    },
  }
}
