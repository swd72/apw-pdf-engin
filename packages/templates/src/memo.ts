import type { DocumentDef } from '@apw-pdf/core'
import {
  defineTemplate,
  GOV_FONT,
  GOV_PAGE,
  GOV_PAGE_NUMBER,
  PARA_INDENT,
} from './common.js'

export interface MemoInput {
  agency: string
  docNo: string
  date: Date | string
  subject: string
  to: string
  body: string[]
  signer: {
    name: string
    positions: string[]
    signatureUrl?: string
  }
  speed?: string
  secrecy?: string
  attachments?: string
}

const memoDocument: DocumentDef = {
  version: 1,
  meta: {
    title: 'บันทึกข้อความ',
    subject: '{{subject}}',
  },
  page: GOV_PAGE,
  font: GOV_FONT,
  numerals: 'thai',
  pageNumber: GOV_PAGE_NUMBER,
  assets: {
    garuda: 'asset:garuda',
  },
  blocks: [
    {
      type: 'image',
      src: 'asset:garuda',
      height: '1.5cm',
      anchor: {
        relativeTo: 'margin',
        x: 0,
        y: 0,
      },
    },
    {
      type: 'paragraph',
      align: 'center',
      lineSpacing: { exactly: '35pt' },
      runs: [
        {
          text: 'บันทึกข้อความ',
          bold: true,
          size: '29pt',
          anchors: [
            { name: 'kho', index: 6, edge: 'start' },
            { name: 'moEnd', index: 12, edge: 'end' },
          ],
        },
      ],
    },
    {
      type: 'paragraph',
      runs: [
        { text: 'ส่วนราชการ', bold: true, size: '20pt' },
        { text: '  ' },
        { fill: '{{agency}}', width: 'toEnd', leader: 'dots' },
      ],
    },
    {
      type: 'paragraph',
      tabs: [{ at: '@kho', align: 'left' }],
      runs: [
        { text: 'ที่', bold: true, size: '20pt' },
        { text: '  ' },
        { fill: '{{docNo}}', width: 'toTab', leader: 'dots' },
        { tab: true },
        { text: 'วันที่', bold: true, size: '20pt' },
        { text: '  ' },
        { fill: '{{date | thaiDate:"long"}}', width: 'toEnd', leader: 'dots' },
      ],
    },
    {
      type: 'paragraph',
      runs: [
        { text: 'เรื่อง', bold: true, size: '20pt' },
        { text: '  ' },
        { fill: '{{subject}}', width: 'toEnd', leader: 'dots' },
      ],
    },
    {
      type: 'paragraph',
      spaceBefore: '6pt',
      text: 'เรียน  {{to}}',
    },
    {
      type: 'each',
      of: 'body',
      as: 'p',
      blocks: [
        {
          type: 'paragraph',
          align: 'thaiDistributed',
          firstLineIndent: PARA_INDENT,
          text: '{{p}}',
        },
      ],
    },
    {
      type: 'signature',
      startAt: 'center',
      linesBefore: 4,
      minLinesBefore: 3,
      name: '{{signer.name}}',
      positions: ['{{signer.positions}}'],
    },
  ],
}

const memoDataSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['agency', 'docNo', 'date', 'subject', 'to', 'body', 'signer'],
  properties: {
    agency: { type: 'string' },
    docNo: { type: 'string' },
    date: { type: 'string' },
    subject: { type: 'string' },
    to: { type: 'string' },
    body: { type: 'array', items: { type: 'string' } },
    signer: {
      type: 'object',
      required: ['name', 'positions'],
      properties: {
        name: { type: 'string' },
        positions: { type: 'array', items: { type: 'string' } },
        signatureUrl: { type: 'string' },
      },
    },
    speed: { type: 'string' },
    secrecy: { type: 'string' },
    attachments: { type: 'string' },
  },
}

const memoExample: MemoInput = {
  agency: 'กลุ่มงานบริหารทั่วไป สำนักงานเลขานุการกรม โทร. ๐ ๒๑๒๓ ๔๕๖๗',
  docNo: 'กค ๐๔๐๑.๒/๑๒๕',
  date: '2026-10-31',
  subject: 'ขออนุมัติจัดซื้อวัสดุสำนักงานประจำไตรมาสที่ ๑',
  to: 'ผู้อำนวยการสำนักงานเลขานุการกรม',
  body: [
    'ด้วยกลุ่มงานบริหารทั่วไป สำนักงานเลขานุการกรม มีความจำเป็นต้องจัดซื้อวัสดุสำนักงานเพื่อใช้ในการปฏิบัติราชการประจำไตรมาสที่ ๑ ปีงบประมาณ พ.ศ. ๒๕๗๐ จำนวน ๑๐ รายการ เป็นเงินทั้งสิ้น ๑๒,๕๐๐ บาท (หนึ่งหมื่นสองพันห้าร้อยบาทถ้วน) โดยเบิกจ่ายจากงบดำเนินงานของหน่วยงาน',
    'จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติให้ดำเนินการจัดซื้อวัสดุสำนักงานตามรายการดังกล่าวข้างต้นด้วย จะเป็นพระคุณ',
  ],
  signer: {
    name: 'นายสมชาย ใจดี',
    positions: ['นักวิชาการพัสดุชำนาญการ', 'หัวหน้าเจ้าหน้าที่'],
  },
}

export const memo = defineTemplate<MemoInput>({
  name: 'memo',
  description: 'บันทึกข้อความ (หนังสือราชการภายใน)',
  document: memoDocument,
  dataSchema: memoDataSchema,
  example: memoExample,
  build(input: MemoInput) {
    return {
      doc: memoDocument,
      data: input,
    }
  },
})
