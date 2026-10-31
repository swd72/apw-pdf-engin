import { assertSegmenter } from './segment.js'

export function graphemeClusters(text: string): string[] {
  assertSegmenter()
  if (text.length === 0) return []
  const seg = new Intl.Segmenter('th', { granularity: 'grapheme' })
  const out: string[] = []
  for (const part of seg.segment(text)) {
    out.push(part.segment)
  }
  return out
}
