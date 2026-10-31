import { ApwPdfError } from '../errors.js'

export function formatNumber(value: number | string, decimals = 2): string {
  let num: number
  if (typeof value === 'number') {
    num = value
  } else if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim()
    num = cleaned === '' ? NaN : Number(cleaned)
  } else {
    num = NaN
  }

  if (!Number.isFinite(num) || !Number.isInteger(decimals) || decimals < 0 || decimals > 20) {
    throw new ApwPdfError('INVALID_VALUE', `Invalid number format input: ${String(value)}`)
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num)
}
