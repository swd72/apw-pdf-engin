import type { ReactNode } from 'react'
import type { Block } from '@apw-pdf/core'
import {
  TextIcon,
  TableIcon,
  ColumnsIcon,
  SignatureIcon,
  ImageIcon,
  LineIcon,
  SpaceIcon,
  PageBreakIcon,
  RepeatIcon,
  ConditionIcon,
} from '../../ui/icons.js'

export interface BlockMetaInfo {
  label: string
  icon: ReactNode
  group: 'basic' | 'advanced'
}

export const BLOCK_PICKER_ORDER: Block['type'][] = [
  'paragraph',
  'table',
  'columns',
  'signature',
  'image',
  'line',
  'spacer',
  'pageBreak',
  'each',
  'if',
]

export function blockMeta(type: Block['type']): BlockMetaInfo {
  switch (type) {
    case 'paragraph':
      return { label: 'ข้อความ', icon: TextIcon(), group: 'basic' }
    case 'table':
      return { label: 'ตาราง', icon: TableIcon(), group: 'basic' }
    case 'columns':
      return { label: 'คอลัมน์', icon: ColumnsIcon(), group: 'basic' }
    case 'signature':
      return { label: 'ลงนาม', icon: SignatureIcon(), group: 'basic' }
    case 'image':
      return { label: 'รูปภาพ', icon: ImageIcon(), group: 'basic' }
    case 'line':
      return { label: 'เส้นคั่น', icon: LineIcon(), group: 'basic' }
    case 'spacer':
      return { label: 'เว้นว่าง', icon: SpaceIcon(), group: 'basic' }
    case 'pageBreak':
      return { label: 'ขึ้นหน้าใหม่', icon: PageBreakIcon(), group: 'basic' }
    case 'each':
      return { label: 'วนซ้ำ', icon: RepeatIcon(), group: 'advanced' }
    case 'if':
      return { label: 'เงื่อนไข', icon: ConditionIcon(), group: 'advanced' }
    default:
      return { label: String(type), icon: TextIcon(), group: 'advanced' }
  }
}
