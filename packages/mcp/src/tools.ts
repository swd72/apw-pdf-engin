import { ApwPdfError } from '@apw-pdf/core'
import { PathNotAllowedError } from './paths.js'

export const STANDARDS_SECTION = `## มาตรฐานหนังสือราชการไทย (ระเบียบสำนักนายกรัฐมนตรีว่าด้วยงานสารบรรณ)

| รายการ | ค่ามาตรฐาน |
|---|---|
| กระดาษ | A4 (210 × 297 มม. = 595.28 × 841.89 pt) |
| ขอบกระดาษ | บน 2.5 ซม. (หน้าแรกที่มีครุฑเริ่มที่ 1.5 ซม. จากขอบบน), ล่าง 2 ซม., ซ้าย 3 ซม., ขวา 2 ซม. |
| ฟอนต์ | TH SarabunIT9 / TH Sarabun New ขนาด 16 pt (เนื้อหา) |
| ครุฑ (บันทึกข้อความ) | สูง 1.5 ซม. (42.52 pt) ชิดซ้าย (x = 3 ซม.) ห่างขอบบน 1.5 ซม. |
| ครุฑ (หนังสือภายนอก) | สูง 3 ซม. (85.04 pt) กึ่งกลางหน้า ห่างขอบบน 1.5 ซม. |
| หัวเรื่อง "บันทึกข้อความ" | 29 pt หนา กึ่งกลาง บรรทัดเดียวกับฐานครุฑ |
| หัวข้อ ส่วนราชการ/ที่/วันที่/เรื่อง | 20 pt หนา; ค่าข้อมูล 16 pt; "วันที่" ตรงกับตัว "ข" ของคำว่า "ข้อความ" |
| ย่อหน้าเนื้อหา | ย่อหน้าบรรทัดแรก 2.5 ซม. (70.87 pt), จัดกระจายแบบไทย (thaiDistributed) |
| คำลงท้าย (หนังสือภายนอก) | "ขอแสดงความนับถือ" ที่กึ่งกลางพื้นที่พิมพ์ (x = 311.81 pt), ก่อนหน้า 12 pt |
| บล็อกลายเซ็น | เว้น 2 บรรทัดว่างหลังคำลงท้าย หรือ 3 บรรทัดว่างในบันทึกข้อความ, minLinesBefore = 3 |
| หมายเลขหน้า | "- {n} -" ขนาด 15 pt กึ่งกลางด้านบน ห่างขอบบน 1.25 ซม. เริ่มหน้า 2 |`

export const BLOCKS_SECTION = `## Block Types (ชนิดของบล็อกใน \`blocks\`)

1. **paragraph**:
\`\`\`json
{ "type": "paragraph", "text": "จึงเรียนมาเพื่อโปรดพิจารณา", "style": { "firstLineIndent": "2.5cm", "align": "thaiDistributed" } }
\`\`\`

2. **image**:
\`\`\`json
{ "type": "image", "src": "asset:garuda", "height": "1.5cm", "align": "left" }
\`\`\`

3. **columns**:
\`\`\`json
{ "type": "columns", "columns": [{ "width": "50%", "blocks": [{ "type": "paragraph", "text": "ซ้าย" }] }, { "width": "50%", "blocks": [{ "type": "paragraph", "text": "ขวา" }] }] }
\`\`\`

4. **table**:
\`\`\`json
{ "type": "table", "columns": ["40%", "30%", "30%"], "repeatHeader": true, "header": [[{ "text": "รายการ" }, { "text": "จำนวน" }, { "text": "หมายเหตุ" }]], "rows": [[{ "text": "ปากกา" }, { "text": "10" }, { "text": "-" }]] }
\`\`\`

5. **signature**:
\`\`\`json
{ "type": "signature", "closing": "ขอแสดงความนับถือ", "name": "{{signer.name}}", "positions": ["{{signer.positions}}"], "left": "50%", "width": "50%", "minLinesBefore": 3 }
\`\`\`

6. **spacer**:
\`\`\`json
{ "type": "spacer", "height": "12pt" }
\`\`\`

7. **line**:
\`\`\`json
{ "type": "line", "style": "solid", "thickness": "0.5pt" }
\`\`\`

8. **pageBreak**:
\`\`\`json
{ "type": "pageBreak" }
\`\`\`

9. **each**:
\`\`\`json
{ "type": "each", "items": "body", "as": "p", "blocks": [{ "type": "paragraph", "text": "{{p}}" }] }
\`\`\`

10. **if**:
\`\`\`json
{ "type": "if", "test": "reference != ''", "then": [{ "type": "paragraph", "text": "อ้างถึง {{reference}}" }] }
\`\`\``

export const INLINE_SECTION = `## Inline Run Types (ชนิดของ \`runs\` ใน \`paragraph\`)

1. **TextRun**:
\`\`\`json
{ "text": "ส่วนราชการ ", "bold": true, "size": "20pt" }
\`\`\`

2. **Tab**:
\`\`\`json
{ "tab": true, "to": "@kho", "leader": "dot" }
\`\`\`

3. **Fill** (เส้นประ/เส้นเต็มเติมช่องว่าง):
\`\`\`json
{ "fill": "dot", "width": "toEnd" }
\`\`\`

4. **Anchor** (จุดอ้างอิงแนวตั้งข้ามบรรทัด):
\`\`\`json
{ "anchor": "kho" }
\`\`\``

export const FILTERS_SECTION = `## Filters (ตัวกรองข้อมูลใน \`{{expr | filter}}\`)

| Filter | ตัวอย่าง | ผลลัพธ์ |
|---|---|---|
| \`thaiDate\` | \`{{date \\| thaiDate:'long'}}\` | \`31 ตุลาคม 2569\` (\`'full'\` เพิ่ม พ.ศ., \`'short'\` ย่อเดือน) |
| \`thaiDigits\` | \`{{docNo \\| thaiDigits}}\` | แปลงตัวเลขอารบิกเป็นเลขไทย ๐-๙ |
| \`arabicDigits\` | \`{{text \\| arabicDigits}}\` | แปลงเลขไทยเป็นเลขอารบิก 0-9 |
| \`number\` | \`{{amount \\| number:2}}\` | \`1,234.50\` |
| \`baht\` | \`{{amount \\| baht}}\` | \`หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบสตางค์\` |
| \`upper\` / \`lower\` | \`{{code \\| upper}}\` | ตัวพิมพ์ใหญ่ / ตัวพิมพ์เล็ก |
| \`default\` | \`{{phone \\| default:'-'}}\` | ค่าเริ่มต้นเมื่อว่างหรือไม่มีค่า |`

export const SCHEMA_GUIDE = [
  '# APW PDF Schema & Standards Guide',
  BLOCKS_SECTION,
  INLINE_SECTION,
  FILTERS_SECTION,
  STANDARDS_SECTION,
].join('\n\n')

export function getSchemaGuide(
  topic?: 'blocks' | 'inline' | 'filters' | 'standards',
): string {
  switch (topic) {
    case 'blocks':
      return BLOCKS_SECTION
    case 'inline':
      return INLINE_SECTION
    case 'filters':
      return FILTERS_SECTION
    case 'standards':
      return STANDARDS_SECTION
    default:
      return SCHEMA_GUIDE
  }
}

export function formatToolError(err: unknown): {
  isError: true
  content: Array<{ type: 'text'; text: string }>
} {
  if (err instanceof ApwPdfError) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            code: err.code,
            message: err.message,
            path: err.path,
          }),
        },
      ],
    }
  }
  if (err instanceof PathNotAllowedError) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            code: err.code,
            message: err.message,
            path: err.path,
          }),
        },
      ],
    }
  }
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : String(err),
        }),
      },
    ],
  }
}
