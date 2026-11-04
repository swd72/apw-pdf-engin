# @apw-pdf/templates

Built-in Thai government document templates (`memo`, `external-letter`, `leave-sick-personal-maternity`, `leave-vacation`) and Garuda emblem asset (`garuda-placeholder.png`) for `@apw-pdf`, compliant with the Prime Minister's Office Regulations on Official Correspondence.

## Installation

```bash
pnpm add @apw-pdf/templates @apw-pdf/core
```

## Minimal Usage

```ts
import {
  memo,
  externalLetter,
  leaveSickPersonalMaternity,
  leaveVacation,
  templates,
} from '@apw-pdf/templates'

const { doc, data } = memo.build({
  agency: 'กองกลาง',
  docNo: 'กค 0405.4/123',
  date: '2026-10-31',
  subject: 'ขออนุมัติจัดซื้อวัสดุสำนักงาน',
  to: 'ปลัดกระทรวง',
  body: ['เนื้อหาย่อหน้าที่ 1'],
  signer: { name: 'นายสมชาย ใจดี', positions: ['ผู้อำนวยการกองกลาง'] },
})
```

## Documentation

See the [main repository README](https://github.com/swd72/apw-pdf-engin#readme) for full documentation.

## License

MIT
