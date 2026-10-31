import { bahtText } from '../thai/baht.js'
import { toThaiDigits } from '../thai/digits.js'
import { formatThaiDate } from '../thai/date.js'
import { formatNumber } from '../thai/number.js'

export const FILTERS: Record<string, (value: unknown, ...args: (string | number)[]) => unknown> = {
  baht: (value) => bahtText(value as number | string),
  number: (value, decimals = 2) => formatNumber(value as number | string, Number(decimals)),
  thaiNum: (value) => toThaiDigits(String(value ?? '')),
  thaiDate: (value, style = 'long') =>
    value === ''
      ? ''
      : formatThaiDate(
          value as Date | string,
          String(style) as 'long' | 'short' | 'monthYear',
        ),
  upper: (value) => String(value ?? '').toUpperCase(),
  lower: (value) => String(value ?? '').toLowerCase(),
  default: (value, fallback = '') =>
    value === undefined || value === null || value === '' ? String(fallback) : value,
  prefix: (value, pre = '') =>
    value === undefined || value === null || value === '' ? '' : `${pre}${String(value)}`,
}
