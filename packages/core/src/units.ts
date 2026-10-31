import { ApwPdfError } from './errors.js'

export type Length = number | string

export const PT_PER_IN = 72
export const PT_PER_CM = 72 / 2.54 // 28.346456692913385
export const PT_PER_MM = 72 / 25.4 // 2.8346456692913385

export const PAGE_SIZES: Record<'A4' | 'A5' | 'Letter' | 'Legal', { width: number; height: number }> = {
  A4: { width: 210 * PT_PER_MM, height: 297 * PT_PER_MM },
  A5: { width: 148 * PT_PER_MM, height: 210 * PT_PER_MM },
  Letter: { width: 8.5 * PT_PER_IN, height: 11 * PT_PER_IN },
  Legal: { width: 8.5 * PT_PER_IN, height: 14 * PT_PER_IN },
}

const LENGTH_RE = /^(-?\d+(?:\.\d+)?)(pt|mm|cm|in)$/

export function toPt(len: Length, opts?: { allowNegative?: boolean; path?: string }): number {
  const allowNegative = opts?.allowNegative ?? false
  if (typeof len === 'number') {
    if (!Number.isFinite(len) || (!allowNegative && len < 0)) {
      throw new ApwPdfError('SCHEMA_INVALID', `Invalid length number: ${String(len)}`, {
        path: opts?.path,
      })
    }
    return len
  }
  if (typeof len === 'string') {
    const m = LENGTH_RE.exec(len.trim())
    if (!m) {
      throw new ApwPdfError('SCHEMA_INVALID', `Invalid length string: "${len}"`, {
        path: opts?.path,
      })
    }
    const num = Number(m[1])
    const unit = m[2]
    if (!Number.isFinite(num) || (!allowNegative && num < 0)) {
      throw new ApwPdfError('SCHEMA_INVALID', `Invalid length value: "${len}"`, {
        path: opts?.path,
      })
    }
    switch (unit) {
      case 'pt':
        return num
      case 'mm':
        return num * PT_PER_MM
      case 'cm':
        return num * PT_PER_CM
      case 'in':
        return num * PT_PER_IN
    }
  }
  throw new ApwPdfError('SCHEMA_INVALID', `Invalid length: ${String(len)}`, {
    path: opts?.path,
  })
}

export interface PageDefInput {
  size: 'A4' | 'A5' | 'Letter' | 'Legal' | { width: Length; height: Length }
  orientation?: 'portrait' | 'landscape'
  margin: { top: Length; bottom: Length; left: Length; right: Length }
}

export interface PageBox {
  width: number
  height: number
  margin: { top: number; bottom: number; left: number; right: number }
  contentWidth: number
  contentLeft: number
  contentRight: number
}

export function pageBox(page: PageDefInput): PageBox {
  const base =
    typeof page.size === 'string'
      ? PAGE_SIZES[page.size]
      : {
          width: toPt(page.size.width, { path: 'page.size.width' }),
          height: toPt(page.size.height, { path: 'page.size.height' }),
        }
  if (!base) {
    throw new ApwPdfError('SCHEMA_INVALID', `Unknown page size: ${String(page.size)}`, {
      path: 'page.size',
    })
  }
  const isLandscape = page.orientation === 'landscape'
  const width = isLandscape ? base.height : base.width
  const height = isLandscape ? base.width : base.height
  const margin = {
    top: toPt(page.margin.top, { path: 'page.margin.top' }),
    bottom: toPt(page.margin.bottom, { path: 'page.margin.bottom' }),
    left: toPt(page.margin.left, { path: 'page.margin.left' }),
    right: toPt(page.margin.right, { path: 'page.margin.right' }),
  }
  const contentLeft = margin.left
  const contentRight = width - margin.right
  const contentWidth = contentRight - contentLeft
  return {
    width,
    height,
    margin,
    contentWidth,
    contentLeft,
    contentRight,
  }
}
