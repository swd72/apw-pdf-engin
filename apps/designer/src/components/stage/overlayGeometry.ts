import type { BlockBox, Rect } from '@apw-pdf/core'

export function scaleRect(r: Rect, scale: number): Rect {
  return {
    x: r.x * scale,
    y: r.y * scale,
    w: r.w * scale,
    h: r.h * scale,
  }
}

export function hitOrder(boxes: BlockBox[]): BlockBox[] {
  return [...boxes].sort((a, b) => b.w * b.h - a.w * a.h)
}

export function toolbarPlacement(
  box: Rect,
  toolbar: { w: number; h: number },
  stage: { w: number; h: number },
): { x: number; y: number; placement: 'above' | 'below' } {
  const gap = 4
  const aboveY = box.y - toolbar.h - gap
  const placement: 'above' | 'below' = aboveY >= 0 ? 'above' : 'below'
  const y = placement === 'above' ? aboveY : box.y + box.h + gap
  const maxX = Math.max(0, stage.w - toolbar.w)
  const x = Math.min(Math.max(0, box.x), maxX)
  return { x, y, placement }
}
