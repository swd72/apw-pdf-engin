import type { Block, ColumnsBlock, TableBlock } from '@apw-pdf/core'
import { memo, externalLetter } from '@apw-pdf/templates'

export interface PresetDescriptor {
  id: 'memoHeader' | 'externalHeader' | 'approvalTwoSides' | 'itemsTable'
  label: string
  create(): Block[]
  sampleData: Record<string, unknown>
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

export function mergeSampleData(
  data: unknown,
  sample: Record<string, unknown>,
): Record<string, unknown> {
  if (!isPlainObject(data)) {
    return structuredClone(sample)
  }
  let changed = false
  const next: Record<string, unknown> = { ...data }
  for (const [key, sampleVal] of Object.entries(sample)) {
    if (
      !Object.prototype.hasOwnProperty.call(data, key) ||
      data[key] === undefined
    ) {
      next[key] = structuredClone(sampleVal)
      changed = true
    } else {
      const existingVal = data[key]
      if (isPlainObject(existingVal) && isPlainObject(sampleVal)) {
        const mergedChild = mergeSampleData(existingVal, sampleVal)
        if (mergedChild !== existingVal) {
          next[key] = mergedChild
          changed = true
        }
      }
    }
  }
  return changed ? next : data
}

const memoExample = memo.example as Record<string, unknown>
const externalExample = externalLetter.example as Record<string, unknown>

const memoHeaderBlocks: Block[] = memo.document.blocks.slice(0, 6)
const externalHeaderBlocks: Block[] = externalLetter.document.blocks.slice(0, 7)

const approvalTwoSidesBlock: ColumnsBlock = {
  type: 'columns',
  columns: [
    {
      width: '*',
      blocks: [
        { type: 'paragraph', text: '{{left.comment}}' },
        {
          type: 'signature',
          name: '{{left.name}}',
          positions: ['{{left.position}}'],
        },
      ],
    },
    {
      width: '*',
      blocks: [
        { type: 'paragraph', text: '{{right.comment}}' },
        {
          type: 'signature',
          name: '{{right.name}}',
          positions: ['{{right.position}}'],
        },
      ],
    },
  ],
}

const itemsTableBlock: TableBlock = {
  type: 'table',
  columns: [
    { width: '1.5cm', align: 'center' },
    { width: '*' },
    { width: '2cm', align: 'center' },
    { width: '2.5cm', align: 'right' },
    { width: '2.5cm', align: 'right' },
  ],
  header: [
    [
      { text: 'ลำดับ', align: 'center' },
      { text: 'รายการ', align: 'center' },
      { text: 'จำนวน', align: 'center' },
      { text: 'ราคา/หน่วย', align: 'center' },
      { text: 'จำนวนเงิน', align: 'center' },
    ],
  ],
  rows: {
    each: 'items',
    as: 'item',
    cells: [
      { text: '{{item.no}}', align: 'center' },
      { text: '{{item.name}}' },
      { text: '{{item.qty}}', align: 'center' },
      { text: '{{item.price | number}}', align: 'right' },
      { text: '{{item.amount | number}}', align: 'right' },
    ],
  },
  footer: [
    [
      {
        text: 'รวมเป็นเงินทั้งสิ้น ({{total | baht}})',
        colSpan: 4,
        align: 'center',
      },
      {
        text: '{{total | number}}',
        align: 'right',
      },
    ],
  ],
}

export const PRESETS: PresetDescriptor[] = [
  {
    id: 'memoHeader',
    label: 'หัวบันทึกข้อความ',
    create: () => structuredClone(memoHeaderBlocks),
    sampleData: {
      agency: memoExample.agency,
      docNo: memoExample.docNo,
      date: memoExample.date,
      subject: memoExample.subject,
      to: memoExample.to,
    },
  },
  {
    id: 'externalHeader',
    label: 'หัวหนังสือภายนอก',
    create: () => structuredClone(externalHeaderBlocks),
    sampleData: {
      docNo: externalExample.docNo,
      agencyAddress: structuredClone(externalExample.agencyAddress),
      date: externalExample.date,
      subject: externalExample.subject,
      salutation: externalExample.salutation,
      to: externalExample.to,
      reference: externalExample.reference,
      enclosures: structuredClone(externalExample.enclosures),
    },
  },
  {
    id: 'approvalTwoSides',
    label: 'บล็อกอนุมัติ 2 ฝั่ง',
    create: () => [structuredClone(approvalTwoSidesBlock)],
    sampleData: {
      left: {
        comment: 'เห็นควรอนุมัติ',
        name: 'นางสาวสุดา รอบคอบ',
        position: 'หัวหน้ากลุ่มงานบริหารทั่วไป',
      },
      right: {
        comment: 'อนุมัติ',
        name: 'นายวิชัย บริหารดี',
        position: 'ผู้อำนวยการสำนัก',
      },
    },
  },
  {
    id: 'itemsTable',
    label: 'ตารางรายการพร้อมยอดรวม',
    create: () => [structuredClone(itemsTableBlock)],
    sampleData: {
      items: [
        {
          no: 1,
          name: 'กระดาษถ่ายเอกสาร A4 80 แกรม',
          qty: 10,
          price: 120,
          amount: 1200,
        },
        {
          no: 2,
          name: 'ปากกาลูกลื่นสีน้ำเงิน',
          qty: 20,
          price: 15,
          amount: 300,
        },
        {
          no: 3,
          name: 'แฟ้มสันกว้าง',
          qty: 10,
          price: 65,
          amount: 650,
        },
      ],
      total: 2150,
    },
  },
]
