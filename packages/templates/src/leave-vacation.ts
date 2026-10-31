import type { DocumentDef } from '@apw-pdf/core'
import {
  defineTemplate,
  GOV_FONT,
  GOV_PAGE,
  GOV_PAGE_NUMBER,
  PARA_INDENT,
} from './common.js'
import type { LeaveStatRow } from './leave-sick.js'

export interface VacationLeaveInput {
  writtenAt: string
  date: Date | string
  subject: string
  to: string
  name: string
  position: string
  level?: string
  affiliation: string
  accumulatedDays: number | string
  currentYearDays: number | string
  totalDays: number | string
  from: Date | string
  toDate: Date | string
  days: number | string
  contact: string
  substitute?: {
    name: string
    position?: string
  }
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

const leaveVacationDocument: DocumentDef = {
  version: 1,
  meta: {
    title: 'แบบใบลาพักผ่อน',
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
          text: 'แบบใบลาพักผ่อน',
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
      runs: [
        { text: 'มีวันลาพักผ่อนสะสม  ' },
        {
          fill: '{{accumulatedDays}}',
          width: '0.9cm',
          leader: 'dots',
          align: 'center',
        },
        { text: '  วันทำการ มีสิทธิลาพักผ่อนประจำปีนี้อีก  ' },
        {
          fill: '{{currentYearDays}}',
          width: '0.9cm',
          leader: 'dots',
          align: 'center',
        },
        { text: '  วันทำการ รวมเป็น  ' },
        {
          fill: '{{totalDays}}',
          width: '0.9cm',
          leader: 'dots',
          align: 'center',
        },
        { text: '  วันทำการ' },
      ],
    },
    {
      type: 'paragraph',
      tabs: [
        { at: '7cm', align: 'left' },
        { at: '11.8cm', align: 'left' },
      ],
      runs: [
        { text: 'ขอลาพักผ่อนตั้งแต่วันที่  ' },
        { fill: '{{from | thaiDate:"long"}}', width: 'toTab', leader: 'dots' },
        { tab: true },
        { text: '  ถึงวันที่  ' },
        { fill: '{{toDate | thaiDate:"long"}}', width: 'toTab', leader: 'dots' },
        { tab: true },
        { text: '  มีกำหนด  ' },
        { fill: '{{days}}', width: '1cm', leader: 'dots', align: 'center' },
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
      type: 'paragraph',
      runs: [
        { text: 'ในการลาครั้งนี้ ข้าพเจ้าขอมอบหมายงานในหน้าที่ให้  ' },
        {
          fill: '{{substitute.name | default:""}}',
          width: 'toEnd',
          leader: 'dots',
        },
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

const leaveVacationDataSchema = {
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
    'accumulatedDays',
    'currentYearDays',
    'totalDays',
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
    accumulatedDays: { type: 'number' },
    currentYearDays: { type: 'number' },
    totalDays: { type: 'number' },
    from: { type: 'string' },
    toDate: { type: 'string' },
    days: { type: 'number' },
    contact: { type: 'string' },
    substitute: { type: 'object' },
    stats: { type: 'array' },
    checker: { type: 'object' },
    supervisor: { type: 'object' },
    approver: { type: 'object' },
  },
}

const leaveVacationExample: VacationLeaveInput = {
  writtenAt: 'สำนักงานเลขานุการกรม',
  date: '2026-10-31',
  subject: 'ขอลาพักผ่อน',
  to: 'ผู้อำนวยการสำนักงานเลขานุการกรม',
  name: 'นายกิตติพงศ์ ตั้งใจ',
  position: 'นักวิเคราะห์นโยบายและแผน',
  level: 'ชำนาญการ',
  affiliation: 'กลุ่มงานยุทธศาสตร์และแผนงาน',
  accumulatedDays: 5,
  currentYearDays: 10,
  totalDays: 15,
  from: '2026-11-10',
  toDate: '2026-11-12',
  days: 3,
  contact: '๐๘ ๙๘๗๖ ๕๔๓๒',
  substitute: {
    name: 'นางสาวพิมพ์ใจ รอบคอบ',
    position: 'นักวิเคราะห์นโยบายและแผนปฏิบัติการ',
  },
  stats: [
    { type: 'พักผ่อน', taken: 2, thisTime: 3, total: 5 },
    { type: 'ป่วย', taken: 1, thisTime: 0, total: 1 },
    { type: 'กิจส่วนตัว', taken: 0, thisTime: 0, total: 0 },
  ],
  checker: {
    name: 'นางสมศรี มีวินัย',
    position: 'เจ้าพนักงานธุรการชำนาญงาน',
  },
  supervisor: {
    opinion: 'เห็นควรอนุญาต',
    name: 'นายวิชัย ใจซื่อ',
    position: 'หัวหน้ากลุ่มงานยุทธศาสตร์และแผนงาน',
  },
  approver: {
    approved: true,
    name: 'นายสมชาย ใจดี',
    position: 'ผู้อำนวยการสำนักงานเลขานุการกรม',
  },
}

export const leaveVacation = defineTemplate<VacationLeaveInput>({
  name: 'leave-vacation',
  description: 'แบบใบลาพักผ่อน',
  document: leaveVacationDocument,
  dataSchema: leaveVacationDataSchema,
  example: leaveVacationExample,
  build(input: VacationLeaveInput) {
    return {
      doc: leaveVacationDocument,
      data: input,
    }
  },
})
