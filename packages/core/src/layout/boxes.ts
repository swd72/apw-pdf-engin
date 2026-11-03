import type { BlockBox, LayoutItem, PageInfo, Rect } from './tree.js'

export type { BlockBox, PageInfo, Rect }

const BLOCK_KEY_RE =
  /^blocks\[\d+\](?:\.(?:blocks|then|else)\[\d+\]|\.columns\[\d+\]\.blocks\[\d+\]|\.(?:rows|header|footer)\[\d+\]\[\d+\](?:\.blocks\[\d+\])?)*/

const INST_SUFFIX_RE = /(?:#\d+)+$/

export function blockKeyOf(sourcePath: string): string | null {
  const m = BLOCK_KEY_RE.exec(sourcePath)
  return m ? m[0] : null
}

export function parseInst(inst: string | undefined): number[] | undefined {
  if (!inst) return undefined
  const m = INST_SUFFIX_RE.exec(inst)
  if (!m) return undefined
  return m[0]
    .slice(1)
    .split('#')
    .map((s) => Number(s))
}

export function glyphBoxes(items: LayoutItem[]): BlockBox[] {
  const out: BlockBox[] = []
  const open = new Map<string, BlockBox>()

  for (const item of items) {
    if (item.kind !== 'glyphs') continue
    const key = blockKeyOf(item.sourcePath)
    if (key === null) continue

    const w = item.glyphs.reduce((sum, g) => sum + g.advance, 0)
    const x = item.x
    const y = item.y - 0.8 * item.size
    const h = 1.05 * item.size

    const instMatch = INST_SUFFIX_RE.exec(item.sourcePath)
    const openKey = instMatch ? `${key}${instMatch[0]}` : key

    const existing = open.get(openKey)
    if (
      existing &&
      y <= existing.y + existing.h + 0.6 * item.size &&
      y >= existing.y - 1e-6
    ) {
      const left = Math.min(existing.x, x)
      const top = Math.min(existing.y, y)
      const right = Math.max(existing.x + existing.w, x + w)
      const bottom = Math.max(existing.y + existing.h, y + h)
      existing.x = left
      existing.y = top
      existing.w = right - left
      existing.h = bottom - top
    } else {
      const inst = instMatch ? parseInst(instMatch[0]) : undefined
      const box: BlockBox =
        inst !== undefined ? { path: key, x, y, w, h, inst } : { path: key, x, y, w, h }
      out.push(box)
      open.set(openKey, box)
    }
  }

  return out
}
