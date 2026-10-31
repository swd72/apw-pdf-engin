# APW PDF Engine — Design Spec (v1)

- วันที่: 2026-10-31
- สถานะ: รอผู้ใช้รีวิว
- ต้นทาง: `gemini-code-1793433645040.html` (ThaiGov Report Designer Studio Pro, 2,489 บรรทัด)

## 1. เป้าหมาย

สร้าง library สำหรับ web app (React + Node.js) ที่สร้าง PDF หนังสือราชการไทยได้ **ตรงกับการพิมพ์จาก Microsoft Word** ทั้งระยะขอบ ย่อหน้า tab stop ระยะบรรทัด รูปภาพ และบล็อกลงนาม โดยนักพัฒนาสร้าง template ใหม่ได้ง่ายด้วย JSON และมี MCP server ให้ AI สร้าง/ตรวจ/เรนเดอร์เอกสารได้ครบวงจร

### ปัญหาของโค้ดเดิมที่ต้องแก้

| ปัญหา | ผลกระทบ | แนวทางใหม่ |
|---|---|---|
| engine ผูกกับ DOM (`document`, `canvas`) | ใช้ใน Node ไม่ได้ | core เป็น pure TS ไม่แตะ DOM/fs |
| สร้าง PDF ด้วย `window.print()` | แต่ละ browser scale/header/footer ต่างกัน → ไม่ตรง | เขียน PDF เองด้วยพิกัด pt |
| ฟอนต์ชี้ `file:///C:/Users/...` | deploy แล้วโหลดไม่ได้ | bundle ฟอนต์ในแพ็กเกจ `@apw-pdf/fonts` |
| วัดตัวอักษรด้วย canvas (ขึ้นกับ browser/ฟอนต์ที่โหลด) | ตัดบรรทัดต่างกันแต่ละเครื่อง | วัดด้วย harfbuzz จากไฟล์ฟอนต์จริง |
| ไม่มี pagination อัตโนมัติ (มีแค่ `pageBreak` ด้วยมือ) | ข้อความยาวล้นหน้า | flow แบ่งหน้าอัตโนมัติ + widow/orphan + keep-together |
| editor UI กับ engine ปนกันในไฟล์เดียว | reuse ไม่ได้ | แยกแพ็กเกจตามหน้าที่ |

สิ่งที่ **คงไว้** จากโค้ดเดิม: แนวคิด template JSON + `{{ตัวแปร}}`, Thai Distributed, `toThaiBahtText`, เลขไทย, ชนิดบล็อก (memoHeader, signature, dataTable, keyValueGrid, approval 2 ฝั่ง, image, spacer, divider, pageBreak) — ย้ายมาเป็น primitive + template

## 2. ขอบเขต

### v1 (spec นี้)
- `core` (schema, binding, Thai utils, layout engine), `pdf` (writer), `fonts`, `templates`, `node`, `react`, `mcp`
- Templates: บันทึกข้อความ, หนังสือภายนอก, ใบลาป่วย/ลากิจส่วนตัว/ลาคลอดบุตร, ใบลาพักผ่อน
- Preview ใน React = แสดง PDF จริงด้วย pdf.js (ตรงกับที่พิมพ์ 100%)

### ไม่อยู่ใน v1 (เฟส 2+)
- Designer Studio (UI ลากวาง 3 แผง) — จะสร้างใหม่บน core เดียวกัน พร้อม SVG renderer จาก LayoutTree สำหรับคลิกเลือกบล็อก
- Export `.docx`, ลายน้ำ, header/footer อิสระ, ลายเซ็นดิจิทัล PDF (PAdES), PDF/A
- หนังสือประทับตรา / คำสั่ง / ประกาศ / หนังสือรับรอง (ทำเป็น template เพิ่มภายหลังด้วย primitive เดิม)

## 3. ค่ามาตรฐานที่ใช้เป็นค่าเริ่มต้น

ไม่มีไฟล์ Word ต้นแบบ จึงใช้ค่าตามแนวปฏิบัติงานสารบรรณที่เผยแพร่ (อ้างอิงคู่มือคณะสถาปัตยกรรมศาสตร์ ม.ศิลปากร ปรับปรุง 22 ม.ค. 2567 ซึ่งระบุค่าเป็นตัวเลขครบที่สุด และสอดคล้องกับคู่มือ ม.สงขลานครินทร์ / สคร.) ทุกค่า override ได้ในระดับ template และเอกสาร

| รายการ | บันทึกข้อความ | หนังสือภายนอก |
|---|---|---|
| กระดาษ | A4 แนวตั้ง | A4 แนวตั้ง |
| ขอบ บน / ล่าง / ซ้าย / ขวา | 1.5 / 2 / 3 / 2 ซม. | 1.5 / 2 / 3 / 2 ซม. |
| ครุฑ | สูง 1.5 ซม. มุมบนซ้ายของพื้นที่พิมพ์ (x 3 ซม., y 1.5 ซม. จากขอบกระดาษ) | สูง 3 ซม. กึ่งกลางพื้นที่พิมพ์ y 1.5 ซม. จากขอบกระดาษ |
| ฟอนต์เนื้อหา | TH SarabunIT๙ 16pt ปกติ | TH SarabunIT๙ 16pt ปกติ |
| ระยะบรรทัด | Single | Single |
| การจัดข้อความ | ชิดขอบซ้าย-ขวา (Thai Distributed) | Thai Distributed |
| หัวเรื่อง | "บันทึกข้อความ" ตัวหนา 29pt, ระยะบรรทัด Exactly 35pt | — |
| ป้ายหัว | "ส่วนราชการ/ที่/วันที่/เรื่อง" ตัวหนา 20pt ตามด้วยจุดไข่ปลา | — |
| ตำแหน่ง "วันที่" | ตรงกับตัว "ข" ของ "บันทึกข้อความ" | วันเดือนปี เริ่มที่กึ่งกลางหน้ากระดาษ |
| ที่ / ที่อยู่ส่วนราชการ | — | "ที่" ชิดซ้าย; ที่อยู่ชิดขวา (บรรทัดยาวสุดจบที่ขอบขวา) |
| เรื่อง / เรียน / อ้างถึง / สิ่งที่ส่งมาด้วย | คำขึ้นต้น: 1 บรรทัด + Before 6pt | ระหว่างกัน: 1 บรรทัด + Before 6pt |
| ย่อหน้า | 2.5 ซม. | 2.5 ซม. |
| คำลงท้าย | — | "ขอแสดงความนับถือ" ตัวแรกที่กึ่งกลางหน้า, Before 12pt |
| ชื่อผู้ลงนาม | ตัวแรกที่กึ่งกลางหน้า เว้น 4 บรรทัดจากข้อความสุดท้าย | ตัวแรกที่กึ่งกลางหน้า เว้น 2 บรรทัดจากคำลงท้าย |
| ตำแหน่งผู้ลงนาม | จัดกึ่งกลางของบรรทัดชื่อ | จัดกึ่งกลางของบรรทัดชื่อ |
| ส่วนราชการเจ้าของเรื่อง | — | ชิดซ้ายหลังบล็อกลงนาม (โทร/โทรสาร/อีเมล) |
| เลขหน้า | ตั้งแต่หน้า 2 กึ่งกลางด้านบน 15pt รูปแบบ "- ๒ -" | เหมือนกัน |
| ข้ามหน้า | ต้องมีเนื้อหาอย่างน้อย 3 บรรทัดในหน้าถัดไปก่อนบล็อกลงนาม | เหมือนกัน |

ใบลา: ใช้รูปแบบตาม "แบบใบลาป่วย ลาคลอดบุตร ลากิจส่วนตัว" และ "แบบใบลาพักผ่อน" ท้ายระเบียบสำนักนายกรัฐมนตรีว่าด้วยการลาของข้าราชการ พ.ศ. 2555 (รายละเอียดฟิลด์ใน §9.3) — ตำแหน่งจุดไข่ปลาประมาณจากแบบฟอร์มทางการ และต้องให้ผู้ใช้ตรวจด้วยตาเทียบกับแบบที่หน่วยงานใช้

## 4. สถาปัตยกรรม

```
Template JSON + Data
   │  bind()        แทน {{var}}, filters, each/if → ResolvedDocument
   ▼
ResolvedDocument
   │  layout()      shaping (harfbuzz) → line breaking → alignment → pagination
   ▼
LayoutTree         pages[] → items[] (glyphRun, line, rect, image) พิกัด pt จากมุมซ้ายบน
   │  writePdf()    embed font subset (CIDFontType2/Identity-H + ToUnicode) → bytes
   ▼
Uint8Array (PDF)
```

pnpm workspace, TypeScript strict, build ด้วย tsup (ESM + CJS + d.ts), test ด้วย vitest

| แพ็กเกจ | หน้าที่ | dependency หลัก | runtime |
|---|---|---|---|
| `@apw-pdf/core` | schema (zod), binding, Thai utils, layout engine, `FontProvider` interface | zod, harfbuzzjs | browser + Node |
| `@apw-pdf/pdf` | LayoutTree → PDF bytes | core, pdf-lib | browser + Node |
| `@apw-pdf/fonts` | ไฟล์ TTF ของ SIPA + manifest (family → weight/style → ไฟล์) | — | asset |
| `@apw-pdf/templates` | JSON templates + builder functions + data schema ของแต่ละแบบ | core | browser + Node |
| `@apw-pdf/node` | `createRenderer()`, โหลดฟอนต์/รูปจาก fs, CLI `apw-pdf` | core, pdf, fonts, templates | Node ≥ 18 |
| `@apw-pdf/react` | `usePdf`, `<PdfPreview>`, `<PdfDownloadButton>`, Web Worker | core, pdf, pdfjs-dist | browser, React ≥ 18 |
| `@apw-pdf/raster` | PDF หน้าเดียว → PNG (ใช้ใน MCP `render_page_png` และ visual regression) | pdfjs-dist, @napi-rs/canvas | Node ≥ 18 |
| `@apw-pdf/mcp` | MCP server (stdio) | node, raster, @modelcontextprotocol/sdk | Node ≥ 18 |

กฎของขอบเขตแพ็กเกจ: `core` และ `pdf` ห้าม import `fs`, `path`, DOM — I/O ทั้งหมดผ่าน interface (`FontProvider`, `ImageProvider`) ที่ `node` และ `react` เป็นผู้ implement

## 5. Document Model

### 5.1 หน่วย
- `Length = number | "<n>pt" | "<n>mm" | "<n>cm" | "<n>in"` — number = pt
- ภายในเก็บเป็น pt เสมอ (1in = 72pt, 1cm = 28.3465pt) ปัดเศษเฉพาะตอนเขียน PDF (4 ตำแหน่ง)

### 5.2 Document

```ts
interface DocumentDef {
  version: 1
  meta?: { title?: string; author?: string; subject?: string; keywords?: string[] }
  page: { size: 'A4' | 'A5' | 'Letter' | 'Legal' | { width: Length; height: Length }
          orientation?: 'portrait' | 'landscape'
          margin: { top: Length; bottom: Length; left: Length; right: Length } }
  font: { family: string; size: Length; lineSpacing?: LineSpacing; color?: string }
  numerals?: 'arabic' | 'thai'                 // แปลงเฉพาะข้อความที่มาจาก binding + เลขหน้า
  pageNumber?: { from: number; position: 'top-center' | 'bottom-center' | 'top-right' | 'bottom-right'
                 format: string /* "- {n} -" */; size?: Length; offset?: Length }
  styles?: Record<string, ParagraphStyle>      // ตั้งชื่อ style แล้วอ้าง `style: "label"`
  dictionary?: string[]                        // คำที่ห้ามตัดกลาง เช่น ชื่อหน่วยงาน
  assets?: Record<string, string>              // ชื่อ → data URL / asset id (เช่น garuda)
  blocks: Block[]
}

type LineSpacing = 'single' | { multiple: number } | { exactly: Length } | { atLeast: Length }
```

Template = `DocumentDef` + `dataSchema` (JSON Schema ของข้อมูลที่ต้องส่ง) + `example` (ข้อมูลตัวอย่าง) + `name`/`description`

### 5.3 Blocks

```ts
type Block =
  | ParagraphBlock | ImageBlock | TableBlock | ColumnsBlock | SignatureBlock
  | SpacerBlock | LineBlock | PageBreakBlock | EachBlock | IfBlock

interface ParagraphStyle {
  align?: 'left' | 'center' | 'right' | 'justify' | 'thaiDistributed'
  firstLineIndent?: Length          // ติดลบ = hanging indent
  indentLeft?: Length; indentRight?: Length
  spaceBefore?: Length; spaceAfter?: Length
  lineSpacing?: LineSpacing
  tabs?: TabStop[]
  font?: Partial<{ family: string; size: Length; bold: boolean; italic: boolean; color: string }>
  keepWithNext?: boolean; keepLinesTogether?: boolean
  widowControl?: boolean            // ค่าเริ่มต้น true เหมือน Word
}

interface ParagraphBlock extends ParagraphStyle {
  type: 'paragraph'; id?: string; style?: string
  text?: string                     // ชวเลข = runs: [{ text }]
  runs?: Inline[]
}

type Inline =
  | { text: string; bold?: boolean; italic?: boolean; underline?: boolean | 'dotted'
      size?: Length; family?: string; color?: string; anchors?: Anchor[] }
  | { tab: true }
  | { fill: string; width: Length | 'toTab' | 'toEnd'; leader?: 'dots' | 'line' | 'none'; align?: 'left' | 'center' }
  | { checkbox: boolean | string }  // string = expression เช่น "{{type == 'sick'}}"
  | { lineBreak: true }
  | { pageNumber: true } | { pageCount: true }

interface Anchor { name: string; index: number; edge?: 'start' | 'end' }   // index = ตำแหน่งตัวอักษรใน text
interface TabStop { at: Length | `@${string}`; align?: 'left' | 'center' | 'right' | 'decimal'; leader?: 'none' | 'dots' | 'line' }

interface ImageBlock { type: 'image'; src: string; width?: Length; height?: Length
  align?: 'left' | 'center' | 'right'
  anchor?: { relativeTo: 'page' | 'margin'; x: Length | 'center'; y: Length }   // ไม่กินพื้นที่ flow
  spaceAfter?: Length }

interface TableBlock { type: 'table'; columns: { width: Length | `${number}%` | '*'; align?: string }[]
  header?: Cell[][]; rows: Cell[][] | { each: string; as: string; cells: Cell[] }
  footer?: Cell[][]; repeatHeader?: boolean; border?: BorderSpec; cellPadding?: Length
  allowRowSplit?: boolean }
interface Cell { blocks?: Block[]; text?: string; colSpan?: number; rowSpan?: number
  align?: string; vAlign?: 'top' | 'middle' | 'bottom'; border?: BorderSpec; shade?: string }

interface ColumnsBlock { type: 'columns'; columns: { width: Length | `${number}%` | '*'; blocks: Block[] }[]
  gap?: Length; keepTogether?: boolean }

interface SignatureBlock { type: 'signature'
  startAt?: Length | 'center'       // ตำแหน่งตัวแรกของบรรทัดชื่อ (ค่าเริ่มต้น 'center' = กึ่งกลางพื้นที่พิมพ์)
  linesBefore?: number               // จำนวน "Enter" ตามคู่มือ: baseline ชื่อ = baseline บรรทัดก่อนหน้า + n × Single
                                     // (memo 4 → ว่าง 3 บรรทัด, external 2 → ว่าง 1 บรรทัด)
  prefix?: string                    // เช่น "(ลงชื่อ)" สำหรับใบลา
  image?: string; imageHeight?: Length
  name: string                       // พิมพ์ในวงเล็บ: "(นายสมชาย ใจดี)"
  positions?: string[]               // แต่ละบรรทัดจัดกึ่งกลางของบรรทัดชื่อ
  minLinesBefore?: number }          // ค่าเริ่มต้น 3: ข้อความอย่างน้อย 3 บรรทัดต้องย้ายตามมาเมื่อขึ้นหน้าใหม่

interface SpacerBlock { type: 'spacer'; height: Length | { lines: number } }
interface LineBlock { type: 'line'; thickness?: Length; style?: 'solid' | 'dashed' | 'dotted'; spaceBefore?: Length; spaceAfter?: Length }
interface PageBreakBlock { type: 'pageBreak' }
interface EachBlock { type: 'each'; of: string; as: string; blocks: Block[] }
interface IfBlock { type: 'if'; test: string; then: Block[]; else?: Block[] }
```

### 5.4 Data binding

- ไวยากรณ์ `{{ path | filter:arg | filter }}` — path แบบ dot (`signer.name`, `items.0.price`)
- Expression ใน `if.test` / `checkbox`: เปรียบเทียบ `== != > < >= <=`, `&& || !`, literal string/number/bool — **ไม่ใช้ `eval`/`new Function`** (parser เขียนเอง)
- Filters v1:

| filter | ตัวอย่างผล |
|---|---|
| `baht` | `1250.5` → "หนึ่งพันสองร้อยห้าสิบบาทห้าสิบสตางค์" |
| `number:2` | `1250.5` → "1,250.50" |
| `thaiNum` | "123" → "๑๒๓" |
| `thaiDate:"long"` | `2026-10-31` → "31 ตุลาคม 2569" (พ.ศ.) |
| `thaiDate:"short"` | "31 ต.ค. 69" |
| `thaiDate:"monthYear"` | "ตุลาคม 2569" |
| `upper`, `lower`, `default:"-"`, `prefix:"..."` | ทั่วไป |

- `numerals: 'thai'` แปลงเลขอารบิกเป็นเลขไทยหลัง binding (ทั้งเอกสาร ยกเว้นที่ตั้ง `numerals: 'arabic'` ที่ run) โดยข้าม token ที่เป็นอีเมล/URL (`x1@a.go.th`, `https://...`) เพื่อไม่ให้ที่อยู่ใช้งานไม่ได้
- ค่าที่ bind แล้วเป็นข้อความตามตัวอักษรเสมอ — ไม่ถูก bind ซ้ำ (data ที่มี `{{...}}` ไม่ถูกตีความ)
- `toThaiBahtText` ของเดิมมีบั๊ก "เอ็ด" ในหลักล้าน/หลักหน่วยหลังล้าน — เขียนใหม่พร้อม test table (0, 1, 11, 21, 101, 1,000,001, 21,000,000.25 ฯลฯ)

## 6. Layout Engine

### 6.1 Fonts และ metrics
- `FontProvider.load(family, { bold, italic }) → Promise<Uint8Array>`; core cache เป็น `hb.Face`
- ไม่มีตัวเอียง/หนา → ใช้ไฟล์ที่ใกล้ที่สุด + warning `FONT_STYLE_FALLBACK` (ไม่สังเคราะห์ตัวหนาปลอม)
- ระยะบรรทัด Single ตาม GDI/Word: `lineHeight = (usWinAscent + usWinDescent + externalLeading) / unitsPerEm × size` โดย `externalLeading = max(0, hhea.lineGap − ((usWinAscent + usWinDescent) − (hhea.ascender − hhea.descender)))`; `multiple n` = Single × n; `exactly` = ค่าคงที่ (baseline วาง ascent ตามสัดส่วนแบบ Word); `atLeast` = max
- **ต้อง** มี calibration test: เทียบความสูงบรรทัด Single ของ TH SarabunIT๙/New/PSK 16pt กับค่าที่วัดจาก Word จริง 1 ครั้ง (ผู้ใช้วัดให้หรือใช้ค่าจาก PDF ที่ Word export) ถ้าไม่ตรงให้ปรับสูตรในจุดเดียว (`metrics.ts`)

### 6.2 Shaping
- harfbuzzjs (WASM) shape ทีละ run ได้ glyph id + advance + offset (จัดวรรณยุกต์/สระบนล่างผ่าน GPOS หรือ Thai PUA fallback ของ harfbuzz สำหรับฟอนต์เก่า)
- เก็บ cluster mapping (glyph → ช่วงตัวอักษร) เพื่อ ToUnicode, anchor และการกระจายช่องว่าง

### 6.3 ตัดบรรทัด
1. แบ่งคำด้วย `Intl.Segmenter('th', { granularity: 'word' })` แล้ว merge ตาม `dictionary` (คำที่ห้ามตัด) และกฎวรรคตอน: วงเล็บ/อัญประกาศเปิดติดคำหลัง, ปิด/`.,%:;ฯ ๆ` ติดคำหน้า, ตัวเลข+หน่วย (`10 บาท` ไม่แยกถ้ามี NBSP)
2. Greedy line fill แบบ Word (ไม่ใช้ Knuth-Plass เพราะ Word ไม่ใช้) — ความกว้างวัดจาก advance ที่ shape แล้ว
3. คำยาวเกินบรรทัด → ตัดระดับ grapheme cluster + warning `FORCED_BREAK`
4. ช่องว่างท้ายบรรทัดไม่นับความกว้าง (hang) เหมือน Word
5. Runtime ไม่มี `Intl.Segmenter` → error `SEGMENTER_UNAVAILABLE` (Node ≥ 18, Chrome/Edge/Safari ทันสมัย, Firefox ≥ 125)

### 6.4 การจัดแนว
- `left/center/right` ปกติ
- `justify`: กระจายช่องว่างเฉพาะ space (บรรทัดสุดท้ายของย่อหน้าชิดซ้าย)
- `thaiDistributed` (= Word `jc="thaiDistribute"`): `extra = available − natural` กระจายให้ทุกช่องระหว่าง grapheme cluster โดย space มีน้ำหนักมากกว่า (น้ำหนักเริ่มต้น space = 4, cluster gap = 1 — ปรับได้จาก calibration) บรรทัดสุดท้ายของย่อหน้าชิดซ้าย; บรรทัดที่จบด้วย `lineBreak` ก็ถือเป็นบรรทัดสุดท้าย
- ไม่กระจายข้ามขอบ tab segment — กระจายเฉพาะ segment สุดท้ายหลัง tab

### 6.5 Tab stops และ anchors
- Tab ค่าเริ่มต้นทุก 1.27 ซม. (Word default) ถ้าไม่ได้กำหนด
- `at: "@kho"` อ้าง anchor ที่ถูกวางไว้ก่อนหน้าในหน้าเดียวกัน (เช่น ตำแหน่ง "ข" ของ "บันทึกข้อความ") — anchor ที่ยังไม่ถูกวาง → error `ANCHOR_NOT_FOUND`
- `fill` กับ `width: 'toTab'` ยืดจุดไข่ปลาไปถึง tab ถัดไป; `'toEnd'` ถึงขอบขวา — ใช้ทำบรรทัด "ที่ ........ วันที่ ........" และแบบฟอร์มใบลา

### 6.6 Pagination (block flow)
- spaceBefore ที่ต้นหน้าหลังการขึ้นหน้าอัตโนมัติถูกตัดทิ้ง; หลัง `pageBreak` เก็บไว้ (เหมือน Word ค่าเริ่มต้น)
- Widow/orphan control: อย่างน้อย 2 บรรทัดต่อส่วนของย่อหน้าที่ถูกแบ่ง
- `keepWithNext`, `keepLinesTogether`, `ColumnsBlock.keepTogether`, `SignatureBlock` ไม่แบ่งเสมอ
- `SignatureBlock.minLinesBefore` (ค่าเริ่มต้น 3): ถ้าบล็อกลงนามต้องขึ้นหน้าใหม่ ให้ดึงบรรทัดเนื้อหาก่อนหน้าตามมาอย่างน้อย 3 บรรทัด
- Table: แบ่งระหว่างแถว (`allowRowSplit` ค่าเริ่มต้น false), `repeatHeader` วาดหัวตารางซ้ำทุกหน้า
- บล็อกที่แบ่งไม่ได้และสูงเกินพื้นที่หน้า → error `BLOCK_TOO_TALL` พร้อม path
- เลขหน้าทำงานแบบ header ของ Word: `offset` = ระยะจากขอบกระดาษถึงบรรทัดเลขหน้า (ค่าเริ่มต้น 1.25 ซม. = header distance ของ Word) และในหน้าที่มีเลขหน้า เนื้อหาเริ่มที่ `max(margin.top, offset + lineHeight(เลขหน้า))` — เหมือน Word ที่ header สูงเกินขอบจะดันเนื้อหาลง; ข้อความเลขหน้าเติมหลัง pagination เสร็จ (รู้ pageCount)
- `ColumnsBlock` ใน v1 ไม่แบ่งข้ามหน้าเสมอ (`keepTogether` รับไว้เพื่อความเข้ากันได้ในอนาคต) — สูงเกินหน้า → `BLOCK_TOO_TALL`

### 6.7 LayoutTree (สัญญาระหว่าง layout กับ writer)

```ts
interface LayoutTree { pages: LayoutPage[]; fonts: FontRef[]; warnings: Warning[] }
interface LayoutPage { width: number; height: number; items: LayoutItem[] }
type LayoutItem =
  | { kind: 'glyphs'; font: number; size: number; color: string; x: number; y: number   // baseline
      glyphs: { id: number; dx: number; dy: number; advance: number }[]; text: string; clusters: number[]
      sourcePath: string }                                                                  // เช่น "blocks[4]"
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; width: number; dash?: number[]; color: string }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; strokeWidth?: number }
  | { kind: 'image'; ref: string; x: number; y: number; w: number; h: number }
```

`sourcePath` เก็บไว้เพื่อ Designer Studio (เฟส 2) และข้อความ error ที่ชี้จุดได้

## 7. PDF Writer (`@apw-pdf/pdf`)
- pdf-lib สำหรับโครงสร้าง PDF; ฝังฟอนต์เองเป็น Type0 / CIDFontType2 / Identity-H โดยใช้ glyph id จาก harfbuzz ตรง ๆ (ไม่ผ่าน layout ของ pdf-lib/fontkit ซึ่งไม่รองรับ Thai shaping)
- Subset ด้วย `hb-subset` (retain GIDs) → ไฟล์เล็ก, `/W` widths จาก subset
- ToUnicode CMap สร้างจาก cluster mapping → คัดลอก/ค้นหาข้อความไทยใน PDF ได้
- รูป: PNG/JPEG ผ่าน pdf-lib, SVG แปลงเป็น path ไม่รองรับใน v1 → ต้องเป็น PNG/JPEG (ครุฑที่ bundle มาเป็น PNG 600 dpi)
- Metadata: Title/Author/Subject/Producer = "apw-pdf", CreationDate (ตั้งค่าได้เพื่อให้ output deterministic ในการทดสอบ)
- Output deterministic: input เดียวกัน + `creationDate` เดียวกัน → bytes เดียวกัน

## 8. Fonts (`@apw-pdf/fonts`)
- TH SarabunIT๙, TH Sarabun New, TH Sarabun PSK, TH NiramitIT๙ (ปกติ/หนา/เอียง/หนาเอียง) จาก `C:\Users\apiwat\Videos\font` — ฟอนต์แห่งชาติของ SIPA เผยแพร่ใช้ได้เสรี; ใส่ไฟล์ license/ที่มาไว้ในแพ็กเกจ
- ชื่อ family มาตรฐานใน JSON: `THSarabunIT9`, `THSarabunNew`, `THSarabunPSK`, `THNiramitIT9`
- ครุฑ PNG (สูง 1.5 และ 3 ซม. ใช้ไฟล์เดียว scale ได้) — ผู้ใช้ต้องจัดหาภาพครุฑทางการ; ระหว่างพัฒนาใช้ placeholder และ **ห้าม** ใช้ SVG ครุฑปลอมจากโค้ดเดิมในเอกสารจริง

## 9. Templates v1 (`@apw-pdf/templates`)

แต่ละ template export: `template` (DocumentDef ที่มี `{{}}`), `dataSchema`, `example`, และ builder

### 9.1 `memo` บันทึกข้อความ
ข้อมูล: `agency`, `docNo`, `date`, `subject`, `to`, `body: string[]` (หรือ block[]), `signer { name, positions[], signatureUrl? }`, `speed?`, `secrecy?`, `attachments?`
โครง: ครุฑ 1.5 ซม. anchored บนซ้าย → "บันทึกข้อความ" 29pt Exactly 35pt กึ่งกลาง (anchor `kho` ที่ "ข", `moEnd` ท้าย "ม") → "ส่วนราชการ" + fill toEnd → "ที่" + fill toTab + tab `@kho` + "วันที่" + fill toEnd → "เรื่อง" + fill toEnd → "เรียน" (Before 6pt) → ย่อหน้า thaiDistributed indent 2.5 ซม. → signature (linesBefore 4, startAt center)

### 9.2 `externalLetter` หนังสือภายนอก
ข้อมูล: `docNo`, `agencyAddress: string[]`, `date`, `subject`, `salutation`, `to`, `reference?`, `enclosures?: string[]`, `body`, `closing` (ค่าเริ่มต้น "ขอแสดงความนับถือ"), `signer`, `ownerUnit { name, phone?, fax?, email? }`
โครง: ครุฑ 3 ซม. กึ่งกลาง → แถว "ที่" (ซ้าย) กับที่อยู่ (columns, ขวา) → วันที่ tab ที่ center → เรื่อง/เรียน/อ้างถึง/สิ่งที่ส่งมาด้วย (Before 6pt) → ย่อหน้า → คำลงท้าย startAt center Before 12pt → signature linesBefore 2 → ส่วนราชการเจ้าของเรื่องชิดซ้าย

### 9.3 `leaveSickPersonalMaternity` และ `leaveVacation` ใบลา
ฟิลด์ตามแบบท้ายระเบียบการลา พ.ศ. 2555:
- ส่วนผู้ลา: เขียนที่, วันที่, เรื่อง, เรียน, ชื่อ, ตำแหน่ง, ระดับ, สังกัด, ประเภทลา (checkbox ป่วย/กิจส่วนตัว/คลอดบุตร), เนื่องจาก, ตั้งแต่วันที่–ถึงวันที่–มีกำหนด…วัน, ลาครั้งสุดท้าย (ตั้งแต่–ถึง–กี่วัน), ติดต่อระหว่างลาได้ที่, ลงชื่อผู้ลา
- ใบลาพักผ่อน: วันลาพักผ่อนสะสม, สิทธิปีนี้, รวม, ผู้ปฏิบัติงานแทน (ลงชื่อ)
- ตารางสถิติการลาในปีงบประมาณ: ประเภทลา | ลามาแล้ว | ลาครั้งนี้ | รวมเป็น
- ส่วนผู้ตรวจสอบ, ความเห็นผู้บังคับบัญชา, คำสั่ง (checkbox อนุญาต/ไม่อนุญาต) — แต่ละส่วนเป็น signature block
- ทั้งหมดใช้ `fill` + `checkbox` เพื่อให้ข้อความว่างยังเห็นจุดไข่ปลาเหมือนแบบฟอร์มกระดาษ

## 10. API สาธารณะ

### 10.1 core / pdf (ใช้ตรงได้ทั้ง browser และ Node)
```ts
// @apw-pdf/core
const engine = await createEngine({ fonts: FontProvider, images?: ImageProvider })
const result = engine.validate(doc, data)                       // { ok, issues: Issue[] }
const tree   = await engine.layout(doc, data)                   // LayoutTree
// @apw-pdf/pdf (core ไม่ขึ้นกับ pdf จึงห่อ engine อีกชั้น)
const pdf    = await createPdfEngine({ fonts, images?, subsetWasm })
const { bytes, pageCount, warnings } = await pdf.renderPdf(doc, data, { creationDate? })
```

### 10.2 node
```ts
import { createRenderer } from '@apw-pdf/node'
const pdf = await createRenderer({ fontDirs?: string[], allowRemoteImages?: string[] /* allowlist host */, imageBaseDir?: string })
await pdf.render(doc, data)                 // Uint8Array
await pdf.renderToFile(doc, data, 'out.pdf')
pdf.validate(doc, data)
```
CLI: `apw-pdf render <template.json|templateName> <data.json> -o out.pdf`, `apw-pdf validate ...`, `apw-pdf templates`

### 10.3 react
```tsx
const { url, bytes, status, error, warnings, pageCount } = usePdf(doc, data, { debounceMs: 300, fontBaseUrl })
<PdfPreview doc={doc} data={data} scale={1} />          // pdf.js canvas ทีละหน้า
<PdfDownloadButton doc={doc} data={data} fileName="memo.pdf">ดาวน์โหลด</PdfDownloadButton>
<ApwPdfProvider fontBaseUrl="/fonts" worker>{...}</ApwPdfProvider>
```
- เรนเดอร์ใน Web Worker (fallback main thread ถ้าสร้าง worker ไม่ได้); ยกเลิกงานเก่าเมื่อ data เปลี่ยน
- ฟอนต์โหลดจาก `fontBaseUrl` (แอปคัดลอกไฟล์จาก `@apw-pdf/fonts` ไป public/) cache ใน memory

### 10.4 templates builder
```ts
import { memo } from '@apw-pdf/templates'
const { doc, data } = memo.build({ agency, docNo, date, subject, to, body: ['...'], signer: { name, positions: ['...'] } })
```

## 11. MCP Server (`@apw-pdf/mcp`)

stdio transport; config ผ่าน env: `APW_PDF_OUTPUT_DIR` (บังคับ), `APW_PDF_TEMPLATE_DIR` (ที่เก็บ template ที่ AI บันทึก), `APW_PDF_ALLOW_REMOTE_IMAGES`

| tool | input | output |
|---|---|---|
| `describe_schema` | `{ topic?: 'blocks' \| 'inline' \| 'filters' \| 'standards' }` | คู่มือ + ตัวอย่าง JSON ของแต่ละบล็อก และตารางค่ามาตรฐาน §3 |
| `list_templates` | `{}` | `[{ name, description, source: 'builtin' \| 'saved' }]` |
| `get_template` | `{ name }` | `{ template, dataSchema, example }` |
| `validate_document` | `{ template \| templateName, data }` | `{ ok, issues: [{ path, code, message }] }` |
| `render_pdf` | `{ template \| templateName, data, fileName? }` | `{ path, pageCount, warnings }` — เขียนเฉพาะใน `APW_PDF_OUTPUT_DIR` |
| `render_page_png` | `{ template \| templateName, data, page, dpi? (≤ 200) }` | image content (PNG) ให้ AI ตรวจด้วยตา |
| `save_template` | `{ name, template, dataSchema?, example? }` | `{ path }` — validate ก่อนบันทึก, ชื่อเฉพาะ `[a-z0-9-]` |

Resources: `apw-pdf://standards` (ตาราง §3), `apw-pdf://templates/{name}`

## 12. Error และ Warning

```ts
class ApwPdfError extends Error { code: ErrorCode; path?: string; details?: unknown }
```

| code | เมื่อไร |
|---|---|
| `SCHEMA_INVALID` | JSON ไม่ตรง schema (รวม zod issues + path) |
| `MISSING_VARIABLE` | ตัวแปรไม่มีในข้อมูล (strict เป็นค่าเริ่มต้น; `strict: false` → เว้นว่าง + warning) |
| `EXPRESSION_INVALID` | `if.test` / filter parse ไม่ได้ |
| `FONT_NOT_FOUND` | ไม่มี family ใน provider |
| `IMAGE_LOAD_FAILED` / `IMAGE_NOT_ALLOWED` | โหลดรูปไม่ได้ / host ไม่อยู่ใน allowlist |
| `ANCHOR_NOT_FOUND` | อ้าง `@name` ที่ยังไม่ถูกวาง |
| `BLOCK_TOO_TALL` | บล็อกแบ่งไม่ได้แต่สูงเกินหน้า |
| `SEGMENTER_UNAVAILABLE` | runtime ไม่มี `Intl.Segmenter` |
| `INVALID_VALUE` | ค่าที่ filter รับไม่ได้ เช่น `thaiDate` กับวันที่ที่ parse ไม่ได้, `baht` กับค่าที่ไม่ใช่ตัวเลข |
| `LIMIT_EXCEEDED` | เกินขีดจำกัดใน §13 |

Warnings (ไม่หยุดเรนเดอร์): `MISSING_GLYPH` (ตัวอักษรไม่มีในฟอนต์ → จะเป็นกล่อง), `FORCED_BREAK`, `FONT_STYLE_FALLBACK`, `MISSING_VARIABLE` (non-strict) — ทุกตัวมี `path`

## 13. Security
- Expression parser เขียนเอง ไม่มี `eval`; จำกัดความลึก/ความยาว
- Node/MCP: รูปจาก URL ปิดเป็นค่าเริ่มต้น เปิดได้ด้วย host allowlist (กัน SSRF); path รูปในเครื่องต้องอยู่ใต้ `imageBaseDir` (กัน path traversal)
- MCP เขียนไฟล์เฉพาะใต้ `APW_PDF_OUTPUT_DIR`/`APW_PDF_TEMPLATE_DIR`, normalize path และปฏิเสธ `..`/absolute
- จำกัดขนาด: data ≤ 5 MB, รูปละ ≤ 10 MB, ≤ 500 หน้า, `each` ≤ 10,000 รอบ (กัน DoS)

## 14. การทดสอบ
- **Unit** (vitest): unit conversion, binding/filters/expression parser, baht text (ตารางกรณีขอบ), thaiDate (พ.ศ., ชื่อเดือน), segmentation + กฎวรรคตอน, line fill, ตัวคำนวณ thaiDistributed, tab/anchor, line height formula
- **Pagination**: widow/orphan, keepWithNext, signature `minLinesBefore`, table split + repeatHeader, spaceBefore ที่ต้นหน้า, `BLOCK_TOO_TALL`
- **Standards conformance**: เรนเดอร์ template แล้ว assert พิกัดใน LayoutTree เช่น ครุฑ memo h = 42.52pt ที่ x = 85.04pt, y = 42.52pt; ตัวแรกของเนื้อหาที่ x = 85.04pt; ย่อหน้าบรรทัดแรก x = 85.04 + 70.87pt; ขอบขวาของบรรทัด distributed = 595.28 − 56.69pt (±0.01); "วันที่" x = x ของ "ข"; ชื่อผู้ลงนามเริ่มที่กึ่งกลางพื้นที่พิมพ์; ไม่มีเลขหน้าในหน้า 1
- **Layout snapshot**: LayoutTree (ปัด 0.01pt) ของทุก template + ข้อมูลตัวอย่างยาว 1/2/3 หน้า
- **Visual regression**: PDF → PNG (pdfjs + @napi-rs/canvas, 150 dpi) เทียบ golden ด้วย pixelmatch (threshold 0.1%)
- **PDF validity**: เปิดด้วย pdfjs ได้, ข้อความที่ extract ได้ตรงกับข้อความต้นฉบับ (ทดสอบ ToUnicode)
- **React**: hook/component ด้วย @testing-library/react (mock worker)
- **MCP**: integration ผ่าน in-memory client ของ SDK — ทุก tool + กรณี path traversal
- Coverage ≥ 80% ต่อแพ็กเกจ

## 15. Performance
- เป้า: memo 1 หน้า < 200 ms บน Node หลัง warm-up (harfbuzz init + โหลดฟอนต์ครั้งเดียวต่อ renderer), เอกสาร 20 หน้า < 1.5 s
- cache shaping ต่อ (font, size, text) ภายในการเรนเดอร์หนึ่งครั้ง
- bundle `@apw-pdf/react` (ไม่รวม wasm/ฟอนต์/pdf.js) < 150 KB gzip; wasm โหลด lazy

## 16. ความเสี่ยง

| ความเสี่ยง | การลด |
|---|---|
| Word ตัดคำไทยด้วยพจนานุกรมของ Microsoft → บางบรรทัดตัดต่างจาก Word | `dictionary` ต่อเอกสาร; ยอมรับว่าเป็นข้อจำกัดเดียวที่ทราบ; ทุกอย่างอื่นตรงระดับ 0.1 มม. |
| สูตรระยะบรรทัด Single ไม่ตรง Word กับฟอนต์ SIPA บางตัว | calibration test §6.1 วัดเทียบ Word 1 ครั้ง, สูตรอยู่ไฟล์เดียว |
| น้ำหนักการกระจาย thaiDistributed ต่างจาก Word | ค่าน้ำหนักเป็น config, ปรับจากการเทียบด้วยตา |
| ฟอนต์ SIPA รุ่นเก่าใช้ PUA แทน GPOS | harfbuzz มี Thai PUA fallback; มี test วรรณยุกต์ซ้อน (ปี่, ที่, น้ำ, กุ้ง, ญ/ฐ ไม่มีเชิง) |
| แบบใบลาแต่ละหน่วยงานต่างกันเล็กน้อย | ทำเป็น JSON template ที่ copy ไปแก้ได้ |
| ครุฑทางการไม่มีในแพ็กเกจ | ผู้ใช้จัดหาไฟล์ PNG; asset slot `garuda` |

## 17. ลำดับการสร้าง (สรุป — รายละเอียดอยู่ใน implementation plan)
1. monorepo + `core` units/schema/binding/Thai utils
2. fonts + harfbuzz shaping + metrics (calibration)
3. line breaking + alignment + tabs/anchors
4. block layout + pagination + LayoutTree
5. `pdf` writer (font subset, ToUnicode, images) → render memo ได้ครั้งแรก
6. templates: memo → external → leave forms + conformance tests
7. `node` + CLI
8. `react` + worker + preview
9. `mcp`
10. visual regression + docs + ตัวอย่างแอป (Express + Vite React)
