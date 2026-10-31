const THAI_DIGITS = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'] as const

export function toThaiDigits(s: string): string {
  return s.replace(/[0-9]/g, (ch) => THAI_DIGITS[ch.charCodeAt(0) - 48]!)
}
