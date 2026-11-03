import type { Block } from '@apw-pdf/core'

export interface BlockTypeDescriptor {
  type: Block['type']
  label: string
  create(): Block
}

export const BLOCK_TYPES: BlockTypeDescriptor[] = [
  {
    type: 'paragraph',
    label: 'Paragraph',
    create: () => ({
      type: 'paragraph',
      text: 'Text',
    }),
  },
  {
    type: 'image',
    label: 'Image',
    create: () => ({
      type: 'image',
      src: 'asset:garuda',
    }),
  },
  {
    type: 'table',
    label: 'Table',
    create: () => ({
      type: 'table',
      columns: [{ width: '*' }, { width: '*' }],
      header: [[{ text: 'Header 1' }, { text: 'Header 2' }]],
      rows: [[{ text: 'Cell 1' }, { text: 'Cell 2' }]],
    }),
  },
  {
    type: 'columns',
    label: 'Columns',
    create: () => ({
      type: 'columns',
      columns: [
        { width: '*', blocks: [] },
        { width: '*', blocks: [] },
      ],
    }),
  },
  {
    type: 'signature',
    label: 'Signature',
    create: () => ({
      type: 'signature',
      name: 'Name',
    }),
  },
  {
    type: 'spacer',
    label: 'Spacer',
    create: () => ({
      type: 'spacer',
      height: '12pt',
    }),
  },
  {
    type: 'line',
    label: 'Line',
    create: () => ({
      type: 'line',
    }),
  },
  {
    type: 'pageBreak',
    label: 'Page Break',
    create: () => ({
      type: 'pageBreak',
    }),
  },
  {
    type: 'each',
    label: 'Each',
    create: () => ({
      type: 'each',
      of: 'items',
      as: 'item',
      blocks: [],
    }),
  },
  {
    type: 'if',
    label: 'If',
    create: () => ({
      type: 'if',
      test: 'true',
      then: [],
    }),
  },
]
