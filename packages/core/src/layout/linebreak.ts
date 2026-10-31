import type { Warning } from '../errors.js'
import { graphemeClusters } from '../text/clusters.js'
import type { InlineItem, WordAnchor, WordInlineItem } from './inline.js'

export interface BrokenLine {
  items: InlineItem[]
  isLast: boolean
  endsWithBreak: boolean
}

function trimTrailingSpaces(items: InlineItem[]): InlineItem[] {
  let end = items.length
  while (end > 0 && items[end - 1]!.kind === 'space') {
    end--
  }
  return end === items.length ? [...items] : items.slice(0, end)
}

function createSubWord(
  orig: WordInlineItem,
  subText: string,
  subStart: number,
  subEnd: number,
): WordInlineItem {
  const shaped = orig.font.shape(subText, orig.size)
  const anchors: WordAnchor[] = []
  for (const a of orig.anchors) {
    if (a.offset >= subStart && a.offset < subEnd) {
      anchors.push({
        name: a.name,
        offset: a.offset - subStart,
        edge: a.edge,
      })
    }
  }
  return {
    ...orig,
    text: subText,
    shaped,
    anchors,
    width: shaped.width,
  }
}

export function breakLines(
  items: InlineItem[],
  widthFor: (lineIndex: number) => number,
  measureTabs: (items: InlineItem[], lineIndex?: number) => number,
): { lines: BrokenLine[]; warnings: Warning[] } {
  const warnings: Warning[] = []

  if (items.length === 0) {
    return {
      lines: [{ items: [], isLast: true, endsWithBreak: false }],
      warnings,
    }
  }

  const lines: BrokenLine[] = []
  let current: InlineItem[] = []
  let lineIndex = 0
  let afterAutoWrap = false

  function pushLine(endsWithBreak: boolean): void {
    lines.push({
      items: trimTrailingSpaces(current),
      isLast: false,
      endsWithBreak,
    })
    current = []
    lineIndex++
    afterAutoWrap = !endsWithBreak
  }

  function forceBreakWord(word: WordInlineItem): void {
    warnings.push({
      code: 'FORCED_BREAK',
      message: `Word "${word.text}" exceeds available width and was force-broken`,
      path: word.path,
    })
    const clusters = graphemeClusters(word.text)
    let pieceText = ''
    let pieceStart = 0
    let cursor = 0

    for (const cl of clusters) {
      const candText = pieceText + cl
      const candShaped = word.font.shape(candText, word.size)
      const avail = widthFor(lineIndex)

      if (pieceText.length > 0 && candShaped.width > avail + 1e-6) {
        current.push(createSubWord(word, pieceText, pieceStart, cursor))
        pushLine(false)
        pieceText = cl
        pieceStart = cursor
      } else {
        pieceText = candText
      }
      cursor += cl.length
    }

    if (pieceText.length > 0) {
      current.push(createSubWord(word, pieceText, pieceStart, cursor))
    }
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!

    if (item.kind === 'break') {
      pushLine(true)
      continue
    }

    if (item.kind === 'space') {
      if (current.length === 0 && afterAutoWrap) {
        // Drop leading space right after an automatic line wrap
        continue
      }
      current.push(item)
      continue
    }

    afterAutoWrap = false
    const avail = widthFor(lineIndex)
    const candidate = [...current, item]
    const w = measureTabs(candidate, lineIndex)

    if (w <= avail + 1e-6) {
      current.push(item)
      continue
    }

    const nonSpaceCurrent = trimTrailingSpaces(current)
    if (nonSpaceCurrent.length > 0) {
      pushLine(false)
    } else {
      current = []
    }

    const freshAvail = widthFor(lineIndex)
    if (item.kind === 'word' && measureTabs([item], lineIndex) > freshAvail + 1e-6) {
      forceBreakWord(item)
    } else {
      current.push(item)
    }
  }

  if (current.length > 0 || lines.length === 0 || items[items.length - 1]?.kind === 'break') {
    pushLine(false)
  }

  if (lines.length > 0) {
    lines[lines.length - 1]!.isLast = true
  }

  return { lines, warnings }
}
