import { ApwPdfError } from '../errors.js'

const THAI_NUM_WORDS = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
const THAI_POSITIONS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน']

function parseToTotalSatang(value: number | string): bigint {
  let str: string
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      throw new ApwPdfError('INVALID_VALUE', `Invalid baht amount: ${String(value)}`)
    }
    str = value.toString()
  } else if (typeof value === 'string') {
    str = value.replace(/,/g, '').trim()
    if (!str || !/^\d+(?:\.\d+)?$/.test(str)) {
      throw new ApwPdfError('INVALID_VALUE', `Invalid baht amount: "${value}"`)
    }
  } else {
    throw new ApwPdfError('INVALID_VALUE', `Invalid baht amount: ${String(value)}`)
  }

  if (!/^\d+(?:\.\d+)?$/.test(str)) {
    const n = Number(str)
    if (!Number.isFinite(n) || n < 0) {
      throw new ApwPdfError('INVALID_VALUE', `Invalid baht amount: ${String(value)}`)
    }
    str = n.toFixed(6)
  }

  const [intPart = '0', fracPart = ''] = str.split('.')
  const paddedFrac = (fracPart + '000').slice(0, 3)
  const satangTwoDigits = BigInt(paddedFrac.slice(0, 2))
  const thirdDigit = Number(paddedFrac[2] ?? '0')
  const roundUp = thirdDigit >= 5 ? 1n : 0n
  return BigInt(intPart) * 100n + satangTwoDigits + roundUp
}

function readSixDigitChunk(chunkStr: string, hasHigherChunk: boolean): string {
  const len = chunkStr.length
  let out = ''
  let hasHigherNonZeroInChunk = false

  for (let i = 0; i < len; i++) {
    const d = Number(chunkStr[i])
    const pos = len - 1 - i
    if (d === 0) continue

    if (pos === 1) {
      if (d === 1) {
        out += 'สิบ'
      } else if (d === 2) {
        out += 'ยี่สิบ'
      } else {
        out += THAI_NUM_WORDS[d] + 'สิบ'
      }
    } else if (pos === 0) {
      if (d === 1 && (hasHigherNonZeroInChunk || hasHigherChunk)) {
        out += 'เอ็ด'
      } else {
        out += THAI_NUM_WORDS[d]
      }
    } else {
      out += THAI_NUM_WORDS[d] + THAI_POSITIONS[pos]
    }

    hasHigherNonZeroInChunk = true
  }

  return out
}

function readIntegerMillions(numStr: string): string {
  const chunks: string[] = []
  for (let end = numStr.length; end > 0; end -= 6) {
    const start = Math.max(0, end - 6)
    chunks.unshift(numStr.slice(start, end))
  }

  let result = ''
  for (let i = 0; i < chunks.length; i++) {
    const hasHigherChunk = i > 0
    const text = readSixDigitChunk(chunks[i]!, hasHigherChunk)
    result += text
    if (i < chunks.length - 1) {
      result += 'ล้าน'
    }
  }
  return result
}

export function bahtText(value: number | string): string {
  const totalSatang = parseToTotalSatang(value)
  if (totalSatang === 0n) {
    return 'ศูนย์บาทถ้วน'
  }

  const baht = totalSatang / 100n
  const satang = Number(totalSatang % 100n)

  let out = ''
  if (baht > 0n) {
    out += readIntegerMillions(baht.toString()) + 'บาท'
  }

  if (satang === 0) {
    out += 'ถ้วน'
  } else {
    out += readSixDigitChunk(String(satang), false) + 'สตางค์'
  }

  return out
}
