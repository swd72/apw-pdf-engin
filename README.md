# APW PDF Engine (`apw-pdf`)

**ระบบสร้างเอกสาร PDF มาตรฐานงานสารบรรณราชการไทย (Thai Government Document PDF Engine)**  
A TypeScript monorepo that turns declarative JSON templates + data into PDF documents matching Microsoft Word's Thai government document layout (`ระเบียบสำนักนายกรัฐมนตรีว่าด้วยงานสารบรรณ`), usable from Node.js, React (Browser / Web Worker), CLI, and an MCP Server.

---

## โครงสร้างแพ็กเกจ (Packages)

| Package | คำอธิบาย (Description) |
|---|---|
| `@apw-pdf/core` | Pure TypeScript layout engine: units, schema, data binding/filters, HarfBuzz shaping, Thai segmentation, line breaking, Thai Distributed alignment, pagination, and `LayoutTree` generation (no `fs` or DOM). |
| `@apw-pdf/fonts` | SIPA Thai national fonts (`THSarabunIT9`, `THSarabunNew`, `THSarabunPSK`, `THNiramitIT9`) + manifest and Node path resolver. |
| `@apw-pdf/pdf` | Pure TypeScript PDF writer: retain-GID `hb-subset` Wasm font subsetting, `CIDFontType2` / `Identity-H` embedding, `/ToUnicode` CMap generation, and `pdf-lib` rendering. |
| `@apw-pdf/templates` | Builtin Thai government templates (`memo`, `external-letter`, `leave-sick-personal-maternity`, `leave-vacation`) with typed builders and JSON schemas. |
| `@apw-pdf/node` | Node.js renderer (`createRenderer`), filesystem/remote providers with path-traversal and SSRF guards, and `apw-pdf` CLI. |
| `@apw-pdf/react` | React hooks and components (`<ApwPdfProvider>`, `usePdf`, `<PdfPreview>`, `<PdfDownloadButton>`) with Web Worker rendering. |
| `@apw-pdf/raster` | PDF page rasterizer (`rasterizePage`) using `pdfjs-dist` + `@napi-rs/canvas` for visual regression and AI inspection. |
| `@apw-pdf/mcp` | Model Context Protocol (MCP) server for AI assistants to author, validate, render, and visually inspect Thai government PDFs. |

---

## การติดตั้ง (Installation)

```bash
# Node.js / Backend / CLI
pnpm add @apw-pdf/node @apw-pdf/templates

# React / Browser
pnpm add @apw-pdf/react @apw-pdf/templates @apw-pdf/fonts react react-dom

# Monorepo Development
pnpm install
pnpm build
pnpm test
```

---

## เริ่มต้นใช้งานตามสภาพแวดล้อม (Quick Start per Environment)

### 1. Node.js (`@apw-pdf/node`)

```ts
import { createRenderer } from '@apw-pdf/node'
import { memo } from '@apw-pdf/templates'

const renderer = await createRenderer()

// Render using template builder
const { doc, data } = memo.build({
  agency: 'กองเทคโนโลยีดิจิทัล โทร. ๐ ๒๑๒๓ ๔๕๖๗',
  docNo: 'นร ๐๑๐๑/๑๒๓',
  date: '2026-10-31',
  subject: 'ขออนุมัติจัดซื้อวัสดุสำนักงาน',
  to: 'ผู้อำนวยการกองเทคโนโลยีดิจิทัล',
  body: [
    'ด้วยฝ่ายบริหารทั่วไปมีความจำเป็นต้องจัดซื้อวัสดุสำนักงานเพื่อใช้ในการปฏิบัติราชการประจำไตรมาสที่ ๑',
    'จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ',
  ],
  signer: {
    name: 'นายสมชาย ใจดี',
    positions: ['นักวิชาการคอมพิวเตอร์ชำนาญการ'],
  },
})

await renderer.renderToFile(doc, data, './memo.pdf')
```

### 2. CLI (`apw-pdf`)

```bash
# ดูรายชื่อเทมเพลตมาตรฐาน
apw-pdf templates

# ตรวจสอบข้อมูลกับเทมเพลต
apw-pdf validate memo data.json

# เรนเดอร์เป็นไฟล์ PDF
apw-pdf render memo data.json -o out.pdf
```

### 3. React / Vite (`@apw-pdf/react`)

คัดลอกไฟล์ฟอนต์จาก `@apw-pdf/fonts/files/*.ttf` และ `harfbuzzjs/dist/harfbuzz-subset.wasm` ไปไว้ใน `public/` และตั้งค่า `optimizeDeps.exclude: ['harfbuzzjs']` ใน `vite.config.ts`:

```tsx
import { ApwPdfProvider, PdfPreview, PdfDownloadButton } from '@apw-pdf/react'
import { memo } from '@apw-pdf/templates'

export function MemoScreen() {
  return (
    <ApwPdfProvider fontBaseUrl="/fonts" wasmUrl="/harfbuzz-subset.wasm" worker>
      <PdfDownloadButton doc={memo.document} data={memo.example} fileName="memo.pdf">
        ดาวน์โหลด PDF
      </PdfDownloadButton>
      <PdfPreview doc={memo.document} data={memo.example} scale={1} />
    </ApwPdfProvider>
  )
}
```

### 4. MCP Server (`@apw-pdf/mcp`) สำหรับ Claude Desktop / Claude Code

เพิ่มการตั้งค่าใน `claude_desktop_config.json` หรือ `.mcp.json`:

```json
{
  "mcpServers": {
    "apw-pdf": {
      "command": "node",
      "args": ["C:/project/apw-pdf-engin/packages/mcp/bin/apw-pdf-mcp.js"],
      "env": {
        "APW_PDF_OUTPUT_DIR": "C:/project/apw-pdf-engin/out",
        "APW_PDF_TEMPLATE_DIR": "C:/project/apw-pdf-engin/saved-templates"
      }
    }
  }
}
```

### 5. Template Designer (`apps/designer`)

เว็บแอปสำหรับสร้าง แก้ไข พรีวิวสด และบันทึก JSON PDF templates ในเครื่อง:

```bash
npx pnpm@9 --filter designer dev
```

เปิดบราวเซอร์ที่ `http://localhost:5173/` สามารถกำหนดโฟลเดอร์เก็บเทมเพลตผ่านตัวแปรสภาพแวดล้อม `APW_PDF_TEMPLATE_DIR` เพื่อแชร์เทมเพลตร่วมกับ MCP Server ได้:

```bash
# แชร์โฟลเดอร์เทมเพลตร่วมกับ MCP Server
APW_PDF_TEMPLATE_DIR="C:/project/apw-pdf-engin/saved-templates" npx pnpm@9 --filter designer dev
```

#### ฟีเจอร์หลัก (Key Features)

- **Playground Layout (Visual tab)**: หน้าจอแก้ไขเทมเพลตแบบ 3 แผงที่ปรับขนาดและพับเก็บได้ — แผงซ้ายสลับระหว่าง **โครงสร้าง (Outline)** / **ข้อมูล (Data)** / **เทมเพลต (Templates)**, แผงกลางแสดงหน้ากระดาษ **PDF Preview** จากเอนจินจริงแบบเรียลไทม์ และแผงขวาแสดง **คุณสมบัติ (Properties)** ของบล็อกที่เลือกหรือการตั้งค่าเอกสาร:
  - **On-Paper Editing**: โต้ตอบและแก้ไขบล็อกบนหน้ากระดาษ PDF ได้โดยตรง:
    - **Hover & Click to Select**: ชี้เมาส์บนกระดาษเพื่อดูเส้นประและป้ายชนิดบล็อก คลิกเพื่อเลือกบล็อก (ซิงก์กับโครงสร้างและแผงคุณสมบัติ) หรือคลิกพื้นที่ว่างเพื่อกลับไปตั้งค่าเอกสาร
    - **Floating Toolbar**: แถบเครื่องมือลอยเหนือบล็อกที่เลือก (`เลื่อนขึ้น`, `เลื่อนลง`, `ทำสำเนา`, `ลบ`, `ย้ายเข้าบล็อกก่อนหน้า`, `ย้ายออกนอกกลุ่ม`, `แก้ JSON`) พร้อมระบบป้องกันการย้ายบล็อกที่อ้างอิงตัวแปรลูปออกนอกขอบเขตลูป
    - **Inline Text Editing**: ดับเบิลคลิกหรือกด `Enter` บนย่อหน้าข้อความหรือเซลล์ตารางเพื่อเปิดช่องแก้ไขข้อความพร้อมโทเค็น `{{ }}` ทับตำแหน่งจริงบนกระดาษ กด `Ctrl+Enter` (หรือคลิกนอกกรอบ) เพื่อบันทึก และกด `Esc` เพื่อยกเลิก
    - **Undo / Redo & Margin Guides**: รองรับ `Ctrl+Z` (ย้อนกลับ) และ `Ctrl+Shift+Z` / `Ctrl+Y` (ทำซ้ำ) โดยรวมการพิมพ์ต่อเนื่องเป็นขั้นเดียว พร้อมปุ่มเปิด/ปิดเส้นขอบกระดาษ (Margin guides) บนแถบเครื่องมือพรีวิว และแถบแจ้งเตือน `PDF ไม่ได้อัปเดต` เมื่อการเรนเดอร์ล้มเหลว
  - **Thai Government Presets (`สำเร็จรูป`)**: เมนู `+ เพิ่ม` มีชุดบล็อกสำเร็จรูปมาตรฐานราชการไทย (`หัวบันทึกข้อความ`, `หัวหนังสือภายนอก`, `บล็อกอนุมัติ 2 ฝั่ง`, `ตารางรายการพร้อมยอดรวม`) ที่แทรกกลุ่มบล็อกพร้อมเติมคีย์ข้อมูลตัวอย่างที่ยังขาดให้อัตโนมัติโดยไม่เขียนทับค่าเดิม
  - **Outline / Data / Properties**: จัดลำดับและลากวางบล็อกในโครงสร้าง (พร้อมป้องกันการลากบล็อกที่ใช้ตัวแปรลูปออกนอกลูป), แก้ไขข้อมูล JSON แบบอิสระในแผงข้อมูล และปรับแต่งค่าเฉพาะของแต่ละบล็อกอย่างละเอียด (เช่น `thaiDistributed`, ตาราง `each`, บล็อกลายเซ็น) ในแผงคุณสมบัติ
  - **Length Input (`LengthInput`)**: Every `Length` field in the Properties panel uses a numeric input paired with a unit selector (`pt`, `mm`, `cm`, `in`) that supports keyboard stepping (`ArrowUp`/`ArrowDown` and `Shift` ×10) and automatic unit conversion while preserving physical distance.
- **Variable Binding (`{{ }}`) & Filters**:
  - เมื่อพิมพ์ `{{` ในช่องข้อความ ระบบจะแนะนำ path ของตัวแปรจาก Data Panel และ loop variables ในขอบเขตของบล็อกนั้นโดยอัตโนมัติ
  - เมื่อพิมพ์ `|` จะแสดงรายชื่อตัวกรองมาตรฐานจาก `@apw-pdf/core` (`thaiDate`, `thaiNum`, `baht`, `number`, `prefix`, `default`, `upper`, `lower`)
  - มีการแจ้งเตือน unresolved variables เมื่อมีการอ้างถึงตัวแปรที่ยังไม่มีอยู่ในข้อมูล
- **Sync ระหว่าง Visual และ JSON Tab**:
  - แก้ไขบน state เอกสารและข้อมูล (`doc` / `data`) ชุดเดียวกัน
  - สลับจาก **Visual → JSON** ได้เสมอโดยจัดรูปแบบ Pretty JSON ให้ทันที แม้โครงสร้างเอกสารจะยังไม่ครบถ้วน
  - สลับจาก **JSON → Visual** จะตรวจสอบความถูกต้องผ่าน `parseDocument` หาก JSON หรือ schema ไม่ถูกต้อง ระบบจะคงอยู่ที่แท็บ JSON และแสดงรายการ validation issues เพื่อให้แก้ไขก่อน
- **Save Format**:
  - บันทึกในรูปแบบ `TemplateRecord` มาตรฐาน (`name`, `description`, `document`, `dataSchema`, `example`)
  - สร้าง `dataSchema` จากข้อมูลปัจจุบันให้อัตโนมัติผ่าน `inferJsonSchema(data)` และบันทึก `example` เป็นข้อมูลชุดปัจจุบัน เพื่อให้พร้อมใช้งานร่วมกับ MCP Server, CLI และ `@apw-pdf/react` ทันที

---

## คู่มือการเขียนเทมเพลต (Template Authoring Guide)

### หน่วยวัด (Units)
- รองรับ `"pt"`, `"mm"`, `"cm"`, `"in"` หรือตัวเลขล้วน (หมายถึง `pt`)
- `1 in = 72 pt`, `1 cm = 28.346456692913385 pt`, `1 mm = 2.8346456692913385 pt`
- กระดาษ A4 = `595.28 × 841.89 pt`

### ชนิดของบล็อก (Blocks)
- `paragraph`: ย่อหน้าข้อความ (`text` หรือ `runs`), รองรับ `align` (`left`, `center`, `right`, `justify`, `thaiDistributed`), `firstLineIndent`, `indentLeft`, `indentRight`, `spaceBefore`, `spaceAfter`, `lineSpacing`, `keepWithNext`, `keepLinesTogether`, `tabs` หรือ `style` (ชื่อสไตล์ที่กำหนดใน `styles`)
- `image`: รูปภาพ (`src: "asset:garuda"` หรือ data URL / path ภายใต้ `baseDir`), กำหนด `width`/`height` และ `align`
- `columns`: แบ่งคอลัมน์ซ้าย-ขวา เช่น ที่หนังสือและสถานที่ตั้งส่วนราชการในหนังสือภายนอก
- `table`: ตารางข้อมูล รองรับ `columns` (% หรือความยาว), `header`, `repeatHeader: true` เมื่อตารางข้ามหน้า, เส้นขอบและ padding
- `signature`: บล็อกลงนาม (`name`, `positions`, `startAt`, `linesBefore`, `minLinesBefore: 3` ป้องกันลายเซ็นหลุดเดี่ยวไปหน้าถัดไป, `image`)
- `spacer`, `line`, `pageBreak`, `each` (วนลูปอาร์เรย์), `if` (เงื่อนไขปลอดภัย ไม่ใช้ `eval`)

### ตัวกรองข้อมูล (Filters)
- `{{date | thaiDate:'long'}}` → `31 ตุลาคม 2569` (`'short'` เดือนย่อ `31 ต.ค. 69`, `'monthYear'` เดือนและปี `ตุลาคม 2569`)
- `{{amount | baht}}` → จำนวนเงินตัวอักษรไทย (`หนึ่งร้อยบาทถ้วน`)
- `{{amount | number:2}}` → `1,234.50`
- `{{text | thaiNum}}` → แปลงตัวเลขอารบิกเป็นเลขไทย ๐-๙
- `{{val | default:'-'}}` → ค่าเริ่มต้นเมื่อตัวแปรว่าง
- `{{val | prefix:'ที่ '}}` → เติมคำนำหน้าเมื่อมีค่า

### จุดอ้างอิงแนวตั้งข้ามบรรทัด (Anchors `@name` & Tabs)
ในบันทึกข้อความราชการ คำว่า **"วันที่"** ต้องมีตำแหน่งแนวนอน (`x`) ตรงกับตัวอักษร **"ข"** ของคำว่า **"ข้อความ"** ในหัวเรื่อง `"บันทึกข้อความ"` สามารถกำหนด `anchors: [{ name: "kho", index: 6, edge: "start" }]` บนตัวอักษร "ข" ในข้อความ แล้วตั้งค่า `tabs: [{ at: "@kho", align: "left" }]` ร่วมกับ `{ "tab": true }` ในบรรทัด `"ที่ ... วันที่ ..."` ได้โดยตรง:

```json
{
  "version": 1,
  "page": {
    "size": "A4",
    "margin": { "top": "1.5cm", "bottom": "2cm", "left": "3cm", "right": "2cm" }
  },
  "font": { "family": "THSarabunIT9", "size": "16pt" },
  "pageNumber": { "from": 2, "format": "- {n} -", "size": "15pt", "offset": "1.25cm" },
  "blocks": [
    {
      "type": "columns",
      "columns": [
        {
          "width": "2cm",
          "blocks": [{ "type": "image", "src": "asset:garuda", "height": "1.5cm", "align": "left" }]
        },
        {
          "width": "12cm",
          "blocks": [
            {
              "type": "paragraph",
              "align": "center",
              "spaceBefore": "13.5pt",
              "runs": [
                {
                  "text": "บันทึกข้อความ",
                  "bold": true,
                  "size": "29pt",
                  "anchors": [{ "name": "kho", "index": 6, "edge": "start" }]
                }
              ]
            }
          ]
        },
        { "width": "2cm", "blocks": [] }
      ]
    },
    {
      "type": "paragraph",
      "runs": [
        { "text": "ส่วนราชการ ", "bold": true, "size": "20pt" },
        { "fill": "{{agency}}", "width": "toEnd", "leader": "dots" }
      ]
    },
    {
      "type": "paragraph",
      "tabs": [{ "at": "@kho", "align": "left" }],
      "runs": [
        { "text": "ที่ ", "bold": true, "size": "20pt" },
        { "fill": "{{docNo}}", "width": "toTab", "leader": "dots" },
        { "tab": true },
        { "text": "วันที่ ", "bold": true, "size": "20pt" },
        { "fill": "{{date | thaiDate:'long'}}", "width": "toEnd", "leader": "dots" }
      ]
    }
  ]
}
```

---

## ตารางค่ามาตรฐานงานสารบรรณราชการไทย (§3 Standards Table)

| รายการ | ค่ามาตรฐาน |
|---|---|
| กระดาษ | A4 (`210 × 297 mm` = `595.28 × 841.89 pt`) |
| ขอบกระดาษ | บน `2.5 cm` (หน้าแรกที่มีครุฑเริ่มที่ `1.5 cm`), ล่าง `2 cm`, ซ้าย `3 cm`, ขวา `2 cm` |
| ฟอนต์มาตรฐาน | `THSarabunIT9` / `THSarabunNew` ขนาด `16 pt` |
| ครุฑ (บันทึกข้อความ) | สูง `1.5 cm` (`42.52 pt`) ชิดซ้าย (`x = 85.04 pt`, `y = 42.52 pt`) |
| ครุฑ (หนังสือภายนอก) | สูง `3 cm` (`85.04 pt`) กึ่งกลางหน้า (`x + w/2 = 311.81 pt`, `y = 42.52 pt`) |
| หัวเรื่อง "บันทึกข้อความ" | `29 pt` หนา กึ่งกลาง ฐานตัวอักษรระดับเดียวกับฐานครุฑ |
| หัวข้อ ส่วนราชการ/ที่/วันที่/เรื่อง | `20 pt` หนา; ข้อความข้อมูล `16 pt` |
| ย่อหน้าเนื้อหา | ย่อหน้าบรรทัดแรก `2.5 cm` (`70.87 pt`), จัดกระจายแบบไทย (`thaiDistributed`) |
| คำลงท้าย (หนังสือภายนอก) | `"ขอแสดงความนับถือ"` ที่กึ่งกลางพื้นที่พิมพ์ (`x = 311.81 pt`), `spaceBefore: 12pt` |
| บล็อกลายเซ็น | เว้นบรรทัดว่างก่อนชื่อผู้ลงนาม, `minLinesBefore: 3` |
| หมายเลขหน้า | `"- {n} -"` ขนาด `15 pt` กึ่งกลางด้านบน ห่างขอบบน `1.25 cm` เริ่มหน้า 2 |

---

## ข้อจำกัดที่ทราบ (Known Limitation)

- **การตัดคำภาษาไทยเทียบกับ Microsoft Word**: ระบบใช้ `Intl.Segmenter('th', { granularity: 'word' })` ร่วมกับกฎวรรคตอนราชการไทยและพจนานุกรมคำเฉพาะต่อเอกสาร (`document.dictionary`) ในบางกรณีที่พบได้ยาก พจนานุกรมภายในของ Microsoft Word อาจตัดคำต่างจาก `Intl.Segmenter` เล็กน้อย สามารถระบุคำเฉพาะเพิ่มเติมในฟิลด์ `dictionary: ["คำเฉพาะ"]` ของเทมเพลตเพื่อบังคับไม่ให้แยกคำได้

---

## ขั้นตอนการปรับเทียบระยะบรรทัดกับ Microsoft Word (Line-Height Calibration Procedure)

หากต้องการปรับเทียบระยะบรรทัด (`Single` line spacing) กับฟอนต์ใหม่ให้ตรงกับ Microsoft Word ระดับ `0.01 pt`:

1. เปิด Microsoft Word ตั้งค่าหน้ากระดาษ A4 ขอบบน `2.5 cm` ซ้าย `3 cm` ฟอนต์เป้าหมายขนาด `16 pt` ระยะบรรทัด `Single` (`spaceBefore = 0`, `spaceAfter = 0`)
2. พิมพ์ข้อความทดสอบ 5 บรรทัดแล้วส่งออกเป็นไฟล์ PDF จาก Word
3. อ่านค่าพิกัด `y` ของ baseline แต่ละบรรทัดจากไฟล์ PDF ของ Word เพื่อคำนวณระยะห่างระหว่างบรรทัด ($\Delta y$)
4. ตรวจสอบและปรับสูตรอ่านค่า `usWinAscent`, `usWinDescent`, `sTypoLineGap` ในไฟล์ [`packages/core/src/fonts/metrics.ts`](packages/core/src/fonts/metrics.ts) (`readFontMetrics` และ `lineBox`) แล้วรันชุดทดสอบ `pnpm -F @apw-pdf/core test`
