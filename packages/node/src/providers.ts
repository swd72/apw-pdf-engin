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
  baseDir?: string | null
  allowRemoteImages?: string[]
  allowInsecureHttp?: boolean
  assets?: Record<string, string | Uint8Array>
}

const MAX_REDIRECTS = 5

function assertAllowedRemoteUrl(
  parsed: URL,
  allowlist: Set<string>,
  allowInsecureHttp: boolean,
): void {
  const isLoopback =
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === 'localhost' ||
    parsed.hostname === '[::1]'
  const protocolOk =
    parsed.protocol === 'https:' ||
    (parsed.protocol === 'http:' && (allowInsecureHttp || isLoopback))
  if (!protocolOk) {
    throw new ApwPdfError(
      'IMAGE_NOT_ALLOWED',
      `Remote image protocol "${parsed.protocol}" is not allowed (HTTPS required)`,
    )
  }
  if (!allowlist.has(parsed.hostname)) {
    throw new ApwPdfError(
      'IMAGE_NOT_ALLOWED',
      `Remote image host "${parsed.hostname}" is not in allowRemoteImages`,
    )
  }
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
  const baseDir = opts.baseDir === null ? null : path.resolve(opts.baseDir ?? process.cwd())
  const allowlist = new Set(opts.allowRemoteImages ?? [])
  const allowInsecureHttp = opts.allowInsecureHttp ?? false
  const assets = opts.assets ?? {}

  return {
    async load(ref: string): Promise<Uint8Array> {
      if (ref.startsWith('asset:')) {
        const assetName = ref.slice('asset:'.length)
        const custom = Object.hasOwn(assets, assetName) ? assets[assetName] : undefined
        if (custom instanceof Uint8Array) {
          if (custom.byteLength > MAX_IMAGE_BYTES) {
            throw new ApwPdfError('LIMIT_EXCEEDED', 'Asset image exceeds 10 MB limit')
          }
          return custom
        }
        if (typeof custom === 'string') {
          if (custom.startsWith('data:')) return decodeDataUrl(custom)
          let stat: Awaited<ReturnType<typeof fs.stat>>
          try {
            stat = await fs.stat(custom)
          } catch {
            throw new ApwPdfError('IMAGE_LOAD_FAILED', `Failed to read asset "${assetName}"`)
          }
          if (!stat.isFile()) {
            throw new ApwPdfError('IMAGE_NOT_ALLOWED', `Asset "${assetName}" is not a regular file`)
          }
          if (stat.size > MAX_IMAGE_BYTES) {
            throw new ApwPdfError('LIMIT_EXCEEDED', 'Asset image exceeds 10 MB limit')
          }
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

      if (/^https?:\/\//i.test(ref)) {
        let currentUrl: URL
        try {
          currentUrl = new URL(ref)
        } catch {
          throw new ApwPdfError('IMAGE_LOAD_FAILED', `Invalid image URL "${ref}"`)
        }

        let res: Response | undefined
        for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
          assertAllowedRemoteUrl(currentUrl, allowlist, allowInsecureHttp)
          try {
            res = await fetch(currentUrl, {
              redirect: 'manual',
              signal: AbortSignal.timeout(10_000),
            })
          } catch (err) {
            throw new ApwPdfError(
              'IMAGE_LOAD_FAILED',
              `Failed to fetch remote image "${ref}": ${err instanceof Error ? err.message : String(err)}`,
            )
          }

          if (res.status >= 300 && res.status < 400) {
            await res.body?.cancel().catch(() => {})
            const location = res.headers.get('location')
            if (!location || hop === MAX_REDIRECTS) {
              throw new ApwPdfError(
                'IMAGE_LOAD_FAILED',
                `Redirect failed or exceeded limit when fetching image "${ref}"`,
              )
            }
            try {
              currentUrl = new URL(location, currentUrl)
            } catch {
              throw new ApwPdfError('IMAGE_LOAD_FAILED', `Invalid redirect URL from "${ref}"`)
            }
            continue
          }
          break
        }

        if (!res || !res.ok) {
          await res?.body?.cancel().catch(() => {})
          throw new ApwPdfError(
            'IMAGE_LOAD_FAILED',
            `HTTP ${res?.status ?? 0} when fetching image "${ref}"`,
          )
        }

        const contentLength = res.headers.get('content-length')
        if (contentLength !== null) {
          const declaredLen = Number(contentLength)
          if (Number.isFinite(declaredLen) && declaredLen > MAX_IMAGE_BYTES) {
            await res.body?.cancel().catch(() => {})
            throw new ApwPdfError(
              'LIMIT_EXCEEDED',
              'Remote image exceeds 10 MB limit',
            )
          }
        }

        if (!res.body) {
          return new Uint8Array(0)
        }

        const reader = res.body.getReader()
        const chunks: Uint8Array[] = []
        let totalBytes = 0
        try {
          while (true) {
            let step: ReadableStreamReadResult<Uint8Array>
            try {
              step = await reader.read()
            } catch (err) {
              throw new ApwPdfError(
                'IMAGE_LOAD_FAILED',
                `Failed while reading remote image stream: ${err instanceof Error ? err.message : String(err)}`,
              )
            }
            if (step.done) break
            if (step.value) {
              totalBytes += step.value.byteLength
              if (totalBytes > MAX_IMAGE_BYTES) {
                await reader.cancel().catch(() => {})
                throw new ApwPdfError(
                  'LIMIT_EXCEEDED',
                  'Remote image exceeds 10 MB limit',
                )
              }
              chunks.push(step.value)
            }
          }
        } finally {
          reader.releaseLock()
        }

        const out = new Uint8Array(totalBytes)
        let offset = 0
        for (const chunk of chunks) {
          out.set(chunk, offset)
          offset += chunk.byteLength
        }
        return out
      }

      if (baseDir === null) {
        throw new ApwPdfError(
          'IMAGE_NOT_ALLOWED',
          `Local file image "${ref}" is not allowed when imageBaseDir is disabled`,
        )
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

      let stat: Awaited<ReturnType<typeof fs.stat>>
      try {
        stat = await fs.stat(resolved)
      } catch {
        throw new ApwPdfError(
          'IMAGE_LOAD_FAILED',
          `Failed to read image file "${ref}"`,
        )
      }
      if (!stat.isFile()) {
        throw new ApwPdfError(
          'IMAGE_NOT_ALLOWED',
          `Image path "${ref}" is not a regular file`,
        )
      }
      if (stat.size > MAX_IMAGE_BYTES) {
        throw new ApwPdfError(
          'LIMIT_EXCEEDED',
          `Image "${ref}" exceeds 10 MB limit`,
        )
      }

      let realBase: string
      let realTarget: string
      try {
        ;[realBase, realTarget] = await Promise.all([
          fs.realpath(baseDir),
          fs.realpath(resolved),
        ])
      } catch {
        throw new ApwPdfError(
          'IMAGE_LOAD_FAILED',
          `Failed to resolve image file "${ref}"`,
        )
      }
      const realRel = path.relative(realBase, realTarget)
      if (realRel.startsWith('..') || path.isAbsolute(realRel)) {
        throw new ApwPdfError(
          'IMAGE_NOT_ALLOWED',
          `Image path "${ref}" escapes imageBaseDir`,
        )
      }

      let buf: Buffer
      try {
        buf = await fs.readFile(realTarget)
      } catch {
        throw new ApwPdfError(
          'IMAGE_LOAD_FAILED',
          `Failed to read image file "${ref}"`,
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
