import type { DocumentDef, Length } from '@apw-pdf/core'
import {
  defineTemplate,
  GOV_FONT,
  GOV_PAGE,
  GOV_PAGE_NUMBER,
  PARA_INDENT,
} from './common.js'

export interface ExternalLetterInput {
  docNo: string
  agencyAddress: string[]
  date: Date | string
  subject: string
  salutation: string
  to: string
  reference?: string
  enclosures?: string[]
  body: string[]
  paragraphSpacing?: Length
  closing?: string
  signer: {
    name: string
    positions: string[]
    signatureUrl?: string
  }
  ownerUnit: {
    name: string
    phone?: string
    fax?: string
    email?: string
  }
}

const externalLetterDocument: DocumentDef = {
  version: 1,
  meta: {
    title: 'หนังสือภายนอก',
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
      height: '3cm',
      align: 'center',
    },
    {
      type: 'columns',
      gap: 0,
      columns: [
        {
          width: '50%',
          blocks: [
            {
              type: 'paragraph',
              text: 'ที่  {{docNo}}',
            },
          ],
        },
        {
          width: '50%',
          align: 'right',
          blocks: [
            {
              type: 'each',
              of: 'agencyAddress',
              as: 'addrLine',
              blocks: [
                {
                  type: 'paragraph',
                  text: '{{addrLine}}',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'paragraph',
      tabs: [{ at: '8cm', align: 'left' }],
      runs: [
        { tab: true },
        { text: '{{date | thaiDate:"long"}}' },
      ],
    },
    {
      type: 'paragraph',
      spaceBefore: '6pt',
      text: 'เรื่อง  {{subject}}',
    },
    {
      type: 'paragraph',
      spaceBefore: '6pt',
      text: '{{salutation | default:"เรียน"}}  {{to}}',
    },
    {
      type: 'if',
      test: 'reference',
      then: [
        {
          type: 'paragraph',
          spaceBefore: '6pt',
          text: 'อ้างถึง  {{reference}}',
        },
      ],
    },
    {
      type: 'if',
      test: 'enclosures.0',
      then: [
        {
          type: 'paragraph',
          spaceBefore: '6pt',
          text: 'สิ่งที่ส่งมาด้วย  {{enclosures.0}}',
        },
      ],
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
      type: 'paragraph',
      spaceBefore: '12pt',
      indentLeft: '8cm',
      text: '{{closing | default:"ขอแสดงความนับถือ"}}',
    },
    {
      type: 'signature',
      startAt: 'center',
      linesBefore: 2,
      minLinesBefore: 3,
      name: '{{signer.name}}',
      positions: ['{{signer.positions}}'],
    },
    {
      type: 'paragraph',
      spaceBefore: '12pt',
      text: '{{ownerUnit.name}}',
    },
    {
      type: 'if',
      test: 'ownerUnit.phone',
      then: [
        {
          type: 'paragraph',
          text: 'โทร. {{ownerUnit.phone}}',
        },
      ],
    },
    {
      type: 'if',
      test: 'ownerUnit.fax',
      then: [
        {
          type: 'paragraph',
          text: 'โทรสาร {{ownerUnit.fax}}',
        },
      ],
    },
    {
      type: 'if',
      test: 'ownerUnit.email',
      then: [
        {
          type: 'paragraph',
          text: 'ไปรษณีย์อิเล็กทรอนิกส์ {{ownerUnit.email}}',
        },
      ],
    },
  ],
}

const externalLetterDataSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: [
    'docNo',
    'agencyAddress',
    'date',
    'subject',
    'salutation',
    'to',
    'body',
    'signer',
    'ownerUnit',
  ],
  properties: {
    docNo: { type: 'string' },
    agencyAddress: { type: 'array', items: { type: 'string' } },
    date: { type: 'string' },
    subject: { type: 'string' },
    salutation: { type: 'string' },
    to: { type: 'string' },
    reference: { type: 'string' },
    enclosures: { type: 'array', items: { type: 'string' } },
    body: { type: 'array', items: { type: 'string' } },
    paragraphSpacing: { type: ['string', 'number'] },
    closing: { type: 'string' },
    signer: {
      type: 'object',
      required: ['name', 'positions'],
      properties: {
        name: { type: 'string' },
        positions: { type: 'array', items: { type: 'string' } },
        signatureUrl: { type: 'string' },
      },
    },
    ownerUnit: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        phone: { type: 'string' },
        fax: { type: 'string' },
        email: { type: 'string' },
      },
    },
  },
}

const externalLetterExample: ExternalLetterInput = {
  docNo: 'กค ๐๔๐๕.๔/ว ๑๒๓๔',
  agencyAddress: [
    'กรมบัญชีกลาง',
    'ถนนพระรามที่ ๖ แขวงพญาไท',
    'เขตพญาไท กรุงเทพฯ ๑๐๔๐๐',
  ],
  date: '2026-10-31',
  subject: 'ซักซ้อมความเข้าใจเกี่ยวกับแนวทางปฏิบัติในการจัดซื้อจัดจ้างพัสดุ',
  salutation: 'เรียน',
  to: 'ปลัดกระทรวง อธิบดี อธิการบดี ผู้ว่าราชการจังหวัด',
  reference: 'หนังสือกรมบัญชีกลาง ด่วนที่สุด ที่ กค ๐๔๐๕.๔/ว ๘๙ ลงวันที่ ๑๕ มีนาคม ๒๕๖๙',
  enclosures: ['แนวทางปฏิบัติในการจัดซื้อจัดจ้างพัสดุ จำนวน ๑ ชุด'],
  body: [
    'ตามหนังสือที่อ้างถึง กรมบัญชีกลางได้กำหนดแนวทางปฏิบัติในการจัดซื้อจัดจ้างพัสดุประจำปีงบประมาณ พ.ศ. ๒๕๖๙ เพื่อให้หน่วยงานของรัฐถือปฏิบัติเป็นแนวทางเดียวกัน นั้น',
    'กรมบัญชีกลางขอเรียนว่า เพื่อให้การบริหารงานพัสดุของหน่วยงานของรัฐเป็นไปด้วยความคล่องตัวและมีประสิทธิภาพ จึงขอส่งแนวทางปฏิบัติในการจัดซื้อจัดจ้างพัสดุมาเพื่อโปรดทราบและแจ้งให้หน่วยงานในสังกัดถือปฏิบัติต่อไป',
    'จึงเรียนมาเพื่อโปรดทราบและดำเนินการต่อไป',
  ],
  closing: 'ขอแสดงความนับถือ',
  signer: {
    name: 'นายประเสริฐ ทรงธรรม',
    positions: ['อธิบดีกรมบัญชีกลาง'],
  },
  ownerUnit: {
    name: 'กองการพัสดุภาครัฐ',
    phone: '0 2127 7000 ต่อ 4551',
    fax: '0 2127 7185',
    email: 'saraban@cgd.go.th',
  },
}

export const externalLetter = defineTemplate<ExternalLetterInput>({
  name: 'external-letter',
  description: 'หนังสือภายนอก (หนังสือติดต่อราชการทั่วไป)',
  document: externalLetterDocument,
  dataSchema: externalLetterDataSchema,
  example: externalLetterExample,
  build(input: ExternalLetterInput) {
    if (
      input.paragraphSpacing !== undefined &&
      input.paragraphSpacing !== 0 &&
      input.paragraphSpacing !== '0pt'
    ) {
      const customBlocks = externalLetterDocument.blocks.map((b) => {
        if (b.type === 'each' && b.of === 'body') {
          return {
            ...b,
            blocks: b.blocks.map((inner) =>
              inner.type === 'paragraph'
                ? { ...inner, spaceBefore: input.paragraphSpacing }
                : inner,
            ),
          }
        }
        return b
      })
      return {
        doc: { ...externalLetterDocument, blocks: customBlocks },
        data: input,
      }
    }
    return {
      doc: externalLetterDocument,
      data: input,
    }
  },
})
