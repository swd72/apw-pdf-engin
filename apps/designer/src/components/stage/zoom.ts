import { PAGE_SIZES, toPt, type Length } from '@apw-pdf/core'

export type ZoomMode =
  | { kind: 'fit-width' }
  | { kind: 'fit-page' }
  | { kind: 'percent'; value: number }

export const ZOOM_PRESETS = [50, 75, 100, 125, 150, 200] as const
const ZOOM_STEPS = [25, 50, 75, 100, 125, 150, 175, 200] as const

const MIN_SCALE = 0.25
const MAX_SCALE = 2.0

function clampScale(raw: number): number {
  if (!Number.isFinite(raw) || Number.isNaN(raw)) {
    return 1
  }
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, raw))
}

export function pageSizePt(doc: unknown): { width: number; height: number } {
  const fallback = { width: PAGE_SIZES.A4.width, height: PAGE_SIZES.A4.height }
  if (!doc || typeof doc !== 'object') {
    return fallback
  }

  const page = (doc as Record<string, unknown>).page
  if (!page || typeof page !== 'object') {
    return fallback
  }

  const pageObj = page as Record<string, unknown>
  const rawSize = pageObj.size
  let base: { width: number; height: number } | null = null

  if (typeof rawSize === 'string') {
    if (
      rawSize === 'A4' ||
      rawSize === 'A5' ||
      rawSize === 'Letter' ||
      rawSize === 'Legal'
    ) {
      base = {
        width: PAGE_SIZES[rawSize].width,
        height: PAGE_SIZES[rawSize].height,
      }
    }
  } else if (rawSize && typeof rawSize === 'object') {
    const sizeObj = rawSize as Record<string, unknown>
    try {
      const w = toPt(sizeObj.width as Length)
      const h = toPt(sizeObj.height as Length)
      if (Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0) {
        base = { width: w, height: h }
      }
    } catch {
      base = null
    }
  }

  if (!base) {
    return fallback
  }

  if (pageObj.orientation === 'landscape') {
    return { width: base.height, height: base.width }
  }

  return base
}

export function resolveScale(
  mode: ZoomMode,
  container: { width: number; height: number },
  page: { width: number; height: number },
  padding = 32,
): number {
  if (mode.kind === 'percent') {
    return clampScale(mode.value / 100)
  }

  const pageW = Number.isFinite(page.width) && page.width > 0 ? page.width : PAGE_SIZES.A4.width
  const pageH = Number.isFinite(page.height) && page.height > 0 ? page.height : PAGE_SIZES.A4.height
  const pad = Number.isFinite(padding) && padding >= 0 ? padding : 32

  const availW = Math.max(0, (Number.isFinite(container.width) ? container.width : 0) - pad)
  const availH = Math.max(0, (Number.isFinite(container.height) ? container.height : 0) - pad)

  if (mode.kind === 'fit-width') {
    return clampScale(availW / pageW)
  }

  return clampScale(Math.min(availW / pageW, availH / pageH))
}

export function stepZoomPercent(currentPercent: number, direction: 1 | -1): number {
  const safe = Number.isFinite(currentPercent) ? currentPercent : 100
  if (direction > 0) {
    for (const step of ZOOM_STEPS) {
      if (step > safe + 1) return step
    }
    return ZOOM_STEPS[ZOOM_STEPS.length - 1]!
  }
  for (let i = ZOOM_STEPS.length - 1; i >= 0; i--) {
    const step = ZOOM_STEPS[i]!
    if (step < safe - 1) return step
  }
  return ZOOM_STEPS[0]!
}
