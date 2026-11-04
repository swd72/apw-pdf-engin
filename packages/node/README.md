# @apw-pdf/node

Node.js PDF renderer and CLI (`apw-pdf`) for `@apw-pdf`. Bundles filesystem font/image providers, SIPA Thai fonts, and built-in Thai government document templates.

## Installation

```bash
pnpm add @apw-pdf/node
```

## Minimal Usage

```ts
import { writeFile } from 'node:fs/promises'
import { createRenderer } from '@apw-pdf/node'

const renderer = await createRenderer()

const data = {
  agency: 'กองกลาง สำนักงานปลัดกระทรวง',
  docNo: 'กค 0405.4/123',
  date: '2026-10-31',
  subject: 'ขออนุมัติจัดซื้อวัสดุสำนักงาน',
  to: 'ปลัดกระทรวง',
  body: ['ด้วยกองกลางมีความจำเป็นต้องจัดซื้อวัสดุสำนักงาน...'],
  signer: {
    name: 'นายสมชาย ใจดี',
    positions: ['ผู้อำนวยการกองกลาง'],
  },
}

// Render to a Uint8Array
const pdfBytes = await renderer.render('memo', { ...data })
await writeFile('memo.pdf', pdfBytes)

// Or write directly to a file
await renderer.renderToFile('memo', data, 'memo.pdf')
```

### CLI

```bash
npx apw-pdf templates
npx apw-pdf validate memo data.json
npx apw-pdf render memo data.json -o memo.pdf
```

## Documentation

See the [main repository README](https://github.com/swd72/apw-pdf-engin#readme) for full documentation.

## License

MIT
