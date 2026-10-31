import type { DocumentDef } from '@apw-pdf/core'
import {
  defineTemplate,
  GOV_FONT,
  GOV_PAGE,
  GOV_PAGE_NUMBER,
  PARA_INDENT,
} from './common.js'

export interface LeaveStatRow {
  type: string
  taken: number | string
  thisTime: number | string
  total: number | string
}

export interface LeaveInput {
  writtenAt: string
  date: Date | string
  subject: string
  to: string
  name: string
  position: string
  level?: string
  affiliation: string
  leaveType: 'sick' | 'personal' | 'maternity'
  reason?: string
  from: Date | string
  toDate: Date | string
  days: number | string
  lastLeave?: {
    type?: 'sick' | 'personal' | 'maternity' | string
    from?: Date | string
    to?: Date | string
    days?: number | string
  }
  contact: string
  stats: LeaveStatRow[]
  checker?: {
    name: string
    position?: string
  }
  supervisor?: {
    opinion?: string
    name: string
    position?: string
  }
  approver?: {
    approved?: boolean
    name: string
    position?: string
  }
}

const leaveSickDocument: DocumentDef = {
  version: 1,
  meta: {
    title: 'แบบใบลาป่วย ลาคลอดบุตร ลากิจส่วนตัว',
    subject: '{{subject}}',
  },
  page: GOV_PAGE,
  font: GOV_FONT,
  numerals: 'thai',
  pageNumber: GOV_PAGE_NUMBER,
  blocks: [
    {
      type: 'paragraph',
      align: 'center',
      runs: [
        {
          text: 'แบบใบลาป่วย ลาคลอดบุตร ลากิจส่วนตัว',
          bold: true,
          size: '20pt',
        },
      ],
    },
    {
      type: 'paragraph',
      indentLeft: '8cm',
      runs: [
        { text: 'เขียนที่  ' },
        { fill: '{{writtenAt}}', width: 'toEnd', leader: 'dots' },
      ],
    },
    {
      type: 'paragraph',
      indentLeft: '8cm',
      runs: [
        { text: 'วันที่  ' },
        { fill: '{{date | thaiDate:"long"}}', width: 'toEnd', leader: 'dots' },
      ],
    },
    {
      type: 'paragraph',
      runs: [
        { text: 'เรื่อง  ' },
        { fill: '{{subject}}', width: 'toEnd', leader: 'dots' },
      ],
    },
    {
      type: 'paragraph',
      runs: [
        { text: 'เรียน  ' },
        { fill: '{{to}}', width: 'toEnd', leader: 'dots' },
      ],
    },
    {
      type: 'paragraph',
      firstLineIndent: PARA_INDENT,
      tabs: [{ at: '9cm', align: 'left' }],
      runs: [
        { text: 'ข้าพเจ้า  ' },
        { fill: '{{name}}', width: 'toTab', leader: 'dots' },
        { tab: true },
        { text: '  ตำแหน่ง  ' },
        { fill: '{{position}}', width: 'toEnd', leader: 'dots' },
      ],
    },
    {
      type: 'paragraph',
      tabs: [{ at: '6cm', align: 'left' }],
      runs: [
        { text: 'ระดับ  ' },
        { fill: '{{level | default:""}}', width: 'toTab', leader: 'dots' },
        { tab: true },
        { text: '  สังกัด  ' },
        { fill: '{{affiliation}}', width: 'toEnd', leader: 'dots' },
      ],
    },
    {
      type: 'paragraph',
      indentLeft: PARA_INDENT,
      runs: [
        { checkbox: "{{leaveType == 'sick'}}" },
        { text: ' ป่วย    ' },
        { checkbox: "{{leaveType == 'personal'}}" },
        { text: ' กิจส่วนตัว    ' },
        { checkbox: "{{leaveType == 'maternity'}}" },
        { text: ' คลอดบุตร' },
      ],
    },
    {
      type: 'paragraph',
      runs: [
        { text: 'เนื่องจาก  ' },
        { fill: '{{reason | default:""}}', width: 'toEnd', leader: 'dots' },
      ],
    },
    {
      type: 'paragraph',
      tabs: [
        { at: '6.5cm', align: 'left' },
        { at: '12.5cm', align: 'left' },
      ],
      runs: [
        { text: 'ตั้งแต่วันที่  ' },
        { fill: '{{from | thaiDate:"long"}}', width: 'toTab', leader: 'dots' },
        { tab: true },
        { text: '  ถึงวันที่  ' },
        { fill: '{{toDate | thaiDate:"long"}}', width: 'toTab', leader: 'dots' },
        { tab: true },
        { text: '  มีกำหนด  ' },
        { fill: '{{days}}', width: '1.2cm', leader: 'dots', align: 'center' },
        { text: '  วัน' },
      ],
    },
    {
      type: 'paragraph',
      tabs: [
        { at: '7cm', align: 'left' },
        { at: '12.5cm', align: 'left' },
      ],
      runs: [
        { text: 'ข้าพเจ้าได้ลาครั้งสุดท้ายตั้งแต่วันที่  ' },
        {
          fill: '{{lastLeave.from | default:"" | thaiDate:"long"}}',
          width: 'toTab',
          leader: 'dots',
        },
        { tab: true },
        { text: '  ถึงวันที่  ' },
        {
          fill: '{{lastLeave.to | default:"" | thaiDate:"long"}}',
          width: 'toTab',
          leader: 'dots',
        },
        { tab: true },
        { text: '  มีกำหนด  ' },
        {
          fill: '{{lastLeave.days | default:""}}',
          width: '1cm',
          leader: 'dots',
          align: 'center',
        },
        { text: '  วัน' },
      ],
    },
    {
      type: 'paragraph',
      runs: [
        { text: 'ในระหว่างลาจะติดต่อข้าพเจ้าได้ที่  ' },
        { fill: '{{contact}}', width: 'toEnd', leader: 'dots' },
      ],
    },
    {
      type: 'signature',
      startAt: 'center',
      linesBefore: 2,
      minLinesBefore: 1,
      prefix: '(ลงชื่อ)',
      name: '{{name}}',
      positions: ['{{position}}'],
    },
    {
      type: 'columns',
      gap: '12pt',
      columns: [
        {
          width: '48%',
          blocks: [
            {
              type: 'paragraph',
              align: 'center',
              runs: [{ text: 'สถิติการลาในปีงบประมาณนี้', bold: true }],
            },
            {
              type: 'table',
              columns: [
                { width: '28%', align: 'center' },
                { width: '24%', align: 'center' },
                { width: '24%', align: 'center' },
                { width: '24%', align: 'center' },
              ],
              header: [
                [
                  { text: 'ประเภทลา', align: 'center' },
                  { text: 'ลามาแล้ว', align: 'center' },
                  { text: 'ลาครั้งนี้', align: 'center' },
                  { text: 'รวมเป็น', align: 'center' },
                ],
              ],
              rows: {
                each: 'stats',
                as: 'row',
                cells: [
                  { text: '{{row.type}}', align: 'left' },
                  { text: '{{row.taken}}', align: 'center' },
                  { text: '{{row.thisTime}}', align: 'center' },
                  { text: '{{row.total}}', align: 'center' },
                ],
              },
            },
            {
              type: 'signature',
              startAt: '1.5cm',
              linesBefore: 2,
              minLinesBefore: 1,
              prefix: '(ลงชื่อ)',
              name: '{{checker.name | default:"................................"}}',
              positions: [
                '{{checker.position | default:"ผู้ตรวจสอบ"}}',
              ],
            },
          ],
        },
        {
          width: '52%',
          blocks: [
            {
              type: 'paragraph',
              runs: [{ text: 'ความเห็นผู้บังคับบัญชา', bold: true }],
            },
            {
              type: 'paragraph',
              runs: [
                {
                  fill: '{{supervisor.opinion | default:""}}',
                  width: 'toEnd',
                  leader: 'dots',
                },
              ],
            },
            {
              type: 'signature',
              startAt: '2cm',
              linesBefore: 2,
              minLinesBefore: 1,
              prefix: '(ลงชื่อ)',
              name: '{{supervisor.name | default:"................................"}}',
              positions: [
                '{{supervisor.position | default:"หัวหน้ากลุ่มงาน"}}',
              ],
            },
            {
              type: 'paragraph',
              spaceBefore: '4pt',
              runs: [
                { text: 'คำสั่ง   ', bold: true },
                { checkbox: '{{approver.approved == true}}' },
                { text: ' อนุญาต    ' },
                { checkbox: '{{approver.approved == false}}' },
                { text: ' ไม่อนุญาต' },
              ],
            },
            {
              type: 'signature',
              startAt: '2cm',
              linesBefore: 2,
              minLinesBefore: 1,
              prefix: '(ลงชื่อ)',
              name: '{{approver.name | default:"................................"}}',
              positions: [
                '{{approver.position | default:"ผู้อำนวยการ"}}',
              ],
            },
          ],
        },
      ],
    },
  ],
}

const leaveSickDataSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: [
    'writtenAt',
    'date',
    'subject',
    'to',
    'name',
    'position',
    'affiliation',
    'leaveType',
    'from',
    'toDate',
    'days',
    'contact',
    'stats',
  ],
  properties: {
    writtenAt: { type: 'string' },
    date: { type: 'string' },
    subject: { type: 'string' },
    to: { type: 'string' },
    name: { type: 'string' },
    position: { type: 'string' },
    level: { type: 'string' },
    affiliation: { type: 'string' },
    leaveType: { type: 'string', enum: ['sick', 'personal', 'maternity'] },
    reason: { type: 'string' },
    from: { type: 'string' },
    toDate: { type: 'string' },
    days: { type: 'number' },
    lastLeave: { type: 'object' },
    contact: { type: 'string' },
    stats: { type: 'array' },
    checker: { type: 'object' },
    supervisor: { type: 'object' },
    approver: { type: 'object' },
  },
}

const leaveSickExample: LeaveInput = {
  writtenAt: 'สำนักงานเลขานุการกรม',
  date: '2026-10-31',
  subject: 'ขอลาป่วย',
  to: 'ผู้อำนวยการสำนักงานเลขานุการกรม',
  name: 'นางสาวสุดา รักงาน',
  position: 'นักวิชาการคอมพิวเตอร์',
  level: 'ปฏิบัติการ',
  affiliation: 'กลุ่มงานเทคโนโลยีสารสนเทศ',
  leaveType: 'sick',
  reason: 'มีอาการไข้หวัดและแพทย์สั่งให้พักรักษาตัว',
  from: '2026-11-01',
  toDate: '2026-11-02',
  days: 2,
  lastLeave: {
    type: 'sick',
    from: '2026-10-10',
    to: '2026-10-11',
    days: 2,
  },
  contact: '๐๘ ๑๒๓๔ ๕๖๗๘',
  stats: [
    { type: 'ป่วย', taken: 2, thisTime: 2, total: 4 },
    { type: 'กิจส่วนตัว', taken: 1, thisTime: 0, total: 1 },
    { type: 'คลอดบุตร', taken: 0, thisTime: 0, total: 0 },
  ],
  checker: {
    name: 'นางสมศรี มีวินัย',
    position: 'เจ้าพนักงานธุรการชำนาญงาน',
  },
  supervisor: {
    opinion: 'เห็นควรอนุญาต',
    name: 'นายวิชัย ใจซื่อ',
    position: 'หัวหน้ากลุ่มงานเทคโนโลยีสารสนเทศ',
  },
  approver: {
    approved: true,
    name: 'นายสมชาย ใจดี',
    position: 'ผู้อำนวยการสำนักงานเลขานุการกรม',
  },
}

export const leaveSickPersonalMaternity = defineTemplate<LeaveInput>({
  name: 'leave-sick-personal-maternity',
  description: 'แบบใบลาป่วย ลาคลอดบุตร ลากิจส่วนตัว',
  document: leaveSickDocument,
  dataSchema: leaveSickDataSchema,
  example: leaveSickExample,
  build(input: LeaveInput) {
    return {
      doc: leaveSickDocument,
      data: input,
    }
  },
})
