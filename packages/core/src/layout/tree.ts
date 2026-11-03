import type { Warning } from '../errors.js'
import type { DocumentDef } from '../schema.js'

export interface FontRef {
  id: number
  family: string
  bold: boolean
  italic: boolean
}

export type LayoutItem =
  | {
      kind: 'glyphs'
      font: number
      size: number
      color: string
      x: number
      y: number
      glyphs: { id: number; dx: number; dy: number; advance: number }[]
      text: string
      clusters: number[]
      sourcePath: string
      tokenKind?: 'pageNumber' | 'pageCount'
    }
  | {
      kind: 'line'
      x1: number
      y1: number
      x2: number
      y2: number
      width: number
      dash?: number[]
      color: string
    }
  | {
      kind: 'rect'
      x: number
      y: number
      w: number
      h: number
      fill?: string
      stroke?: string
      strokeWidth?: number
    }
  | {
      kind: 'image'
      ref: string
      x: number
      y: number
      w: number
      h: number
    }

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface BlockBox extends Rect {
  path: string
}

export interface PageInfo {
  width: number
  height: number
  content: Rect
  boxes: BlockBox[]
}

export interface LayoutPage {
  width: number
  height: number
  items: LayoutItem[]
  content: Rect
  boxes: BlockBox[]
}

export interface LayoutTree {
  pages: LayoutPage[]
  fonts: FontRef[]
  warnings: Warning[]
  meta?: DocumentDef['meta']
  imageCache?: Map<string, Uint8Array>
}
