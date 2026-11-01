import { ApwPdfError } from '../errors.js'

const MONTHS_LONG = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
] as const

const MONTHS_SHORT = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
] as const

function parseDateParts(value: Date | string): { year: number; month: number; day: number } {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new ApwPdfError('INVALID_VALUE', 'Invalid Date object')
    }
    return {
      year: value.getFullYear(),
      month: value.getMonth(),
      day: value.getDate(),
    }
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
    if (isoMatch) {
      const year = Number(isoMatch[1])
      const month = Number(isoMatch[2]) - 1
      const day = Number(isoMatch[3])
      const d = new Date(year, month, day)
      if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) {
        throw new ApwPdfError('INVALID_VALUE', `Invalid ISO date: "${value}"`)
      }
      return { year, month, day }
    }

    const isoDateTimeMatch = /^(\d{4})-(\d{2})-(\d{2})T/.exec(trimmed)
    if (isoDateTimeMatch) {
      const yPart = Number(isoDateTimeMatch[1])
      const mPart = Number(isoDateTimeMatch[2]) - 1
      const dPart = Number(isoDateTimeMatch[3])
      const calCheck = new Date(yPart, mPart, dPart)
      if (
        calCheck.getFullYear() !== yPart ||
        calCheck.getMonth() !== mPart ||
        calCheck.getDate() !== dPart
      ) {
        throw new ApwPdfError('INVALID_VALUE', `Invalid date string: "${value}"`)
      }
      const d = new Date(trimmed)
      if (Number.isNaN(d.getTime())) {
        throw new ApwPdfError('INVALID_VALUE', `Invalid date string: "${value}"`)
      }
      return {
        year: d.getFullYear(),
        month: d.getMonth(),
        day: d.getDate(),
      }
    }

    throw new ApwPdfError('INVALID_VALUE', `Invalid date string: "${value}"`)
  }

  throw new ApwPdfError('INVALID_VALUE', `Invalid date input: ${String(value)}`)
}

export function formatThaiDate(
  value: Date | string,
  style: 'long' | 'short' | 'monthYear' = 'long',
): string {
  const { year, month, day } = parseDateParts(value)
  const beYear = year + 543

  switch (style) {
    case 'long':
      return `${day} ${MONTHS_LONG[month]} ${beYear}`
    case 'short':
      return `${day} ${MONTHS_SHORT[month]} ${String(beYear).slice(-2)}`
    case 'monthYear':
      return `${MONTHS_LONG[month]} ${beYear}`
    default:
      throw new ApwPdfError('INVALID_VALUE', `Invalid Thai date style: ${String(style)}`)
  }
}
