import { ApwPdfError } from '../errors.js'

export function assertSegmenter(): void {
  if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') {
    throw new ApwPdfError(
      'SEGMENTER_UNAVAILABLE',
      'Intl.Segmenter is not available in this runtime',
    )
  }
}

function isRegularWhitespace(s: string): boolean {
  return s.length > 0 && /^[^\S\u00A0]+$/.test(s)
}

const OPEN_PUNCT_RE = /^[([{"'“‘«]+$/
const CLOSE_PUNCT_RE = /^[)\]}"'”’».,%:;!?\u0E2F\u0E46]+$/

function segmentRaw(text: string, dictionary?: string[]): string[] {
  const seg = new Intl.Segmenter('th', { granularity: 'word' })
  const dict = (dictionary ?? []).filter((d) => d.length > 0).sort((a, b) => b.length - a.length)

  if (dict.length === 0) {
    const tokens: string[] = []
    for (const part of seg.segment(text)) {
      tokens.push(part.segment)
    }
    return tokens
  }

  const tokens: string[] = []
  let gapStart = 0
  let i = 0

  while (i < text.length) {
    let matched: string | undefined
    for (const entry of dict) {
      if (text.startsWith(entry, i)) {
        matched = entry
        break
      }
    }
    if (matched) {
      if (i > gapStart) {
        for (const part of seg.segment(text.slice(gapStart, i))) {
          tokens.push(part.segment)
        }
      }
      tokens.push(matched)
      i += matched.length
      gapStart = i
    } else {
      i++
    }
  }

  if (gapStart < text.length) {
    for (const part of seg.segment(text.slice(gapStart))) {
      tokens.push(part.segment)
    }
  }

  return tokens
}

export function segmentWords(text: string, dictionary?: string[]): string[] {
  assertSegmenter()
  if (text.length === 0) return []

  const raw = segmentRaw(text, dictionary)

  // Step 1: Glue NBSP (\u00A0) with adjacent non-whitespace tokens
  const afterNbsp: string[] = []
  for (let i = 0; i < raw.length; i++) {
    const tok = raw[i]!
    if (tok === '\u00A0') {
      const prev = afterNbsp.length > 0 ? afterNbsp[afterNbsp.length - 1] : undefined
      const next = i + 1 < raw.length ? raw[i + 1] : undefined
      if (prev !== undefined && !isRegularWhitespace(prev)) {
        if (next !== undefined && !isRegularWhitespace(next)) {
          afterNbsp[afterNbsp.length - 1] = prev + tok + next
          i++
          continue
        }
        afterNbsp[afterNbsp.length - 1] = prev + tok
        continue
      }
    }
    afterNbsp.push(tok)
  }

  // Step 2: Glue open punctuation forward onto the next non-whitespace token
  const afterOpen: string[] = []
  let pendingOpen = ''
  for (let i = 0; i < afterNbsp.length; i++) {
    const tok = afterNbsp[i]!
    const prevTok = i > 0 ? afterNbsp[i - 1] : undefined
    const nextTok = i + 1 < afterNbsp.length ? afterNbsp[i + 1] : undefined

    const isStraightQuote = tok === '"' || tok === "'"
    const isOpen =
      OPEN_PUNCT_RE.test(tok) &&
      (!isStraightQuote || prevTok === undefined || isRegularWhitespace(prevTok)) &&
      nextTok !== undefined &&
      !isRegularWhitespace(nextTok)

    if (isOpen) {
      pendingOpen += tok
    } else if (pendingOpen) {
      afterOpen.push(pendingOpen + tok)
      pendingOpen = ''
    } else {
      afterOpen.push(tok)
    }
  }
  if (pendingOpen) {
    afterOpen.push(pendingOpen)
  }

  // Step 3: Glue close punctuation and ฯ / ๆ backward onto the previous non-whitespace token
  const out: string[] = []
  for (let i = 0; i < afterOpen.length; i++) {
    const tok = afterOpen[i]!
    const prev = out.length > 0 ? out[out.length - 1] : undefined
    if (CLOSE_PUNCT_RE.test(tok) && prev !== undefined && !isRegularWhitespace(prev)) {
      out[out.length - 1] = prev + tok
    } else {
      out.push(tok)
    }
  }

  return out
}
