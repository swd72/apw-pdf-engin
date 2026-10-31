# APW PDF Engine v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pnpm monorepo of TypeScript packages that turn a JSON template + data into a PDF matching Word's layout of Thai government documents, usable from Node, React, and an MCP server.

**Architecture:** `bind → layout → LayoutTree → writePdf`. `core` (pure TS, no DOM/fs) binds data, shapes text with harfbuzzjs, breaks Thai lines with `Intl.Segmenter`, aligns (incl. Thai Distributed), and paginates into a LayoutTree of glyphs positioned in pt. `pdf` embeds retain-GID font subsets (hb-subset wasm) as CIDFontType2/Identity-H with ToUnicode and draws the tree with pdf-lib. `templates`, `node`, `react`, `raster`, `mcp` sit on top.

**Tech Stack:** Node ≥ 18, pnpm 10 workspaces, TypeScript ^5.9 (strict), tsup ^8.5, vitest ^3.2 + @vitest/coverage-v8, zod ^3.25, harfbuzzjs 1.6.4, pdf-lib 1.17.1, pdfjs-dist ^5.4, @napi-rs/canvas ^0.1.80, pngjs ^7, pixelmatch ^7, React ≥ 18 (peer), @testing-library/react ^16, jsdom, @modelcontextprotocol/sdk ^1.20.

**Spec:** `docs/superpowers/specs/2026-10-31-apw-pdf-engine-design.md` — read §3 (standard values), §5 (model), §6 (layout rules) before any task.

## Global Constraints

- `@apw-pdf/core` and `@apw-pdf/pdf` must not import `fs`, `path`, `url`, `node:*`, or touch `window`/`document`. Enforce with an ESLint `no-restricted-imports` rule in Task 1 and a test that greps their `src/`.
- All internal lengths are pt. `1in = 72pt`, `1cm = 28.346456692913385pt`, `1mm = 2.8346456692913385pt`. A4 = 595.2755905511812 × 841.8897637795276 pt.
- Length strings: `"<n>pt" | "<n>mm" | "<n>cm" | "<n>in"`; bare number = pt.
- Default tab interval 1.27cm (36pt). Widow/orphan minimum 2 lines. Signature `minLinesBefore` default 3.
- Thai Distributed weights: space = 4, inter-cluster gap = 1 (constant `DISTRIBUTE_WEIGHTS` in `core/src/layout/align.ts`).
- Font family ids: `THSarabunIT9`, `THSarabunNew`, `THSarabunPSK`, `THNiramitIT9`.
- Page number defaults: `size` 15pt, `offset` 1.25cm, format `"- {n} -"`, `from: 2`, Thai digits when `numerals: 'thai'`.
- Expression evaluation never uses `eval`/`new Function`.
- Limits: data ≤ 5 MB (JSON length), image ≤ 10 MB, ≤ 500 pages, `each` ≤ 10,000 iterations total → `LIMIT_EXCEEDED`.
- Error codes (exact strings): `SCHEMA_INVALID`, `MISSING_VARIABLE`, `EXPRESSION_INVALID`, `INVALID_VALUE`, `FONT_NOT_FOUND`, `IMAGE_LOAD_FAILED`, `IMAGE_NOT_ALLOWED`, `ANCHOR_NOT_FOUND`, `BLOCK_TOO_TALL`, `SEGMENTER_UNAVAILABLE`, `LIMIT_EXCEEDED`. Warning codes: `MISSING_GLYPH`, `FORCED_BREAK`, `FONT_STYLE_FALLBACK`, `MISSING_VARIABLE`.
- Packages are ESM-first, built by tsup to ESM + CJS + d.ts; each has `test` (`vitest run`) and `build` scripts. Coverage ≥ 80% lines per package.
- Commits: conventional (`feat:`, `test:`, `chore:`…), no attribution trailer (user's global setting).
- Fonts come from `C:\Users\apiwat\Videos\font` (SIPA, free to redistribute). Never ship the fake SVG garuda from the old HTML; templates use `asset:garuda`, and tests/examples use `packages/templates/assets/garuda-placeholder.png`.

## Review Focus

1. **Empty content** — a paragraph with `text: ""`, or `each` over `[]` — renders one empty Single-height line (Word keeps empty paragraphs), or nothing for `each`. It must not crash or emit NaN coordinates. → Task 10 and Task 4 tests.
2. **Thai numerals in mixed text** — `numerals: 'thai'` with "ติดต่อ saraban01@moph.go.th โทร 02-123-4567" converts the phone number but leaves the email/URL untouched. → Task 4 test.
3. **Unbreakable long strings in narrow table cells** (a URL in a 2cm column) are force-broken at grapheme clusters inside the cell width, with a `FORCED_BREAK` warning carrying the cell path. No glyph may extend past the cell's right padding. → Task 12 test.
4. **Characters missing from the font** (emoji "✅", Chinese "中") produce a `MISSING_GLYPH` warning with the char and path; rendering continues with glyph 0. → Task 6 and Task 15 tests.
5. **Literal braces/markup in data** — a value `"{{secret}} <b>x</b>"` is printed exactly as given and never re-bound. → Task 4 test.

---

## File Structure

```
package.json  pnpm-workspace.yaml  tsconfig.base.json  vitest.workspace.ts  .eslintrc.cjs  .gitignore
packages/
  core/src/
    index.ts                 public exports
    errors.ts                ApwPdfError, Warning, codes
    units.ts                 toPt, PAGE_SIZES, pageBox
    schema.ts                zod schemas + types (DocumentDef, Block, Inline…)
    thai/baht.ts  thai/digits.ts  thai/date.ts  thai/number.ts
    bind/expr.ts             expression tokenizer/parser/evaluator
    bind/filters.ts          filter registry
    bind/template.ts         renderString
    bind/bind.ts             bindDocument → ResolvedDocument
    fonts/provider.ts        FontProvider, ImageProvider interfaces
    fonts/metrics.ts         readFontMetrics, lineBox
    fonts/registry.ts        FontRegistry, LoadedFont, shape
    images/info.ts           readImageInfo (PNG/JPEG size)
    text/segment.ts          segmentWords
    text/clusters.ts         graphemeClusters
    layout/inline.ts         buildInlineItems
    layout/linebreak.ts      breakLines
    layout/align.ts          placeLine (alignment, tabs, anchors, distribution)
    layout/paragraph.ts      layoutParagraph
    layout/flow.ts           paginate (block flow, keeps, widow/orphan)
    layout/table.ts          layoutTable
    layout/columns.ts        layoutColumns
    layout/signature.ts      signatureToParagraphs
    layout/pagenumber.ts     applyPageNumbers
    layout/tree.ts           LayoutTree types
    engine.ts                createEngine
  core/test/…  core/test/helpers/fonts.ts (test-only fs font provider)
  fonts/files/*.ttf  fonts/LICENSE-SIPA.txt  fonts/src/index.ts  fonts/src/node.ts
  pdf/src/hbsubset.ts  pdf/src/cidfont.ts  pdf/src/tounicode.ts  pdf/src/writer.ts  pdf/src/engine.ts  pdf/src/index.ts
  templates/src/{memo,external-letter,leave-sick,leave-vacation,index,common}.ts  templates/assets/garuda-placeholder.png
  node/src/{renderer,providers,cli,index}.ts
  raster/src/index.ts
  react/src/{provider,usePdf,PdfPreview,PdfDownloadButton,worker,protocol,fetch-providers,index}.ts(x)
  mcp/src/{server,tools,paths,index}.ts  mcp/bin/apw-pdf-mcp.js
examples/express-server  examples/vite-react
```

---

## Phase A — Core

### Task 1: Workspace scaffold, errors, units

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `vitest.workspace.ts`, `.eslintrc.cjs`, `.gitignore`, `packages/core/{package.json,tsconfig.json,tsup.config.ts,vitest.config.ts}`, `packages/core/src/{index,errors,units}.ts`
- Test: `packages/core/test/units.test.ts`, `packages/core/test/purity.test.ts`

**Interfaces:**
- Produces:
  - `type ErrorCode` (union of the Global Constraints codes)
  - `class ApwPdfError extends Error { code: ErrorCode; path?: string; details?: unknown; constructor(code, message, opts?: { path?: string; details?: unknown }) }`
  - `interface Warning { code: string; message: string; path?: string }`
  - `toPt(len: Length): number`
  - `type Length = number | string`
  - `PAGE_SIZES: Record<'A4'|'A5'|'Letter'|'Legal', { width: number; height: number }>`
  - `pageBox(page: DocumentDef['page']): { width: number; height: number; margin: { top: number; bottom: number; left: number; right: number }; contentWidth: number; contentLeft: number; contentRight: number }`

- [x] **Step 1: Scaffold root.** pnpm workspace `packages/*` and `examples/*`; root scripts `build` (`pnpm -r build`), `test` (`pnpm -r test`), `lint`; ESLint `no-restricted-imports` for `fs`, `path`, `url`, `node:*` scoped to `packages/{core,pdf}/src/**`.
- [x] **Step 2: Write failing tests**

```ts
// units.test.ts
it('converts units to pt', () => {
  expect(toPt(12)).toBe(12)
  expect(toPt('3cm')).toBeCloseTo(85.0394, 4)
  expect(toPt('25mm')).toBeCloseTo(70.8661, 4)
  expect(toPt('1in')).toBe(72)
  expect(toPt('16pt')).toBe(16)
})
it('rejects bad lengths', () => {
  expect(() => toPt('3 furlongs')).toThrow(expect.objectContaining({ code: 'SCHEMA_INVALID' }))
  expect(() => toPt(-1)).toThrow()
})
it('computes A4 portrait content box for gov margins', () => {
  const b = pageBox({ size: 'A4', margin: { top: '1.5cm', bottom: '2cm', left: '3cm', right: '2cm' } })
  expect(b.width).toBeCloseTo(595.2756, 4)
  expect(b.contentWidth).toBeCloseTo(453.5433, 4)
  expect(b.contentRight).toBeCloseTo(538.5827, 4)
})
it('swaps for landscape', () => {
  expect(pageBox({ size: 'A4', orientation: 'landscape', margin: { top: 0, bottom: 0, left: 0, right: 0 } }).width).toBeCloseTo(841.8898, 4)
})
// purity.test.ts — read every file under packages/{core,pdf}/src, fail if it matches /from ['"](node:|fs|path|url)['"]|\bwindow\.|\bdocument\./
```

- [x] **Step 3: Run** `pnpm -F @apw-pdf/core exec vitest run` → FAIL (modules missing)
- [x] **Step 4: Implement** `errors.ts` and `units.ts`. Negative lengths are allowed only where the schema allows them (firstLineIndent), so `toPt` takes `{ allowNegative?: boolean }`.
- [x] **Step 5: Run** → PASS
- [x] **Step 6: Commit** `chore: scaffold monorepo with core errors and units`

### Task 2: Document schema

**Files:** Create `packages/core/src/schema.ts`. Test: `packages/core/test/schema.test.ts`

**Interfaces:**
- Consumes: `ApwPdfError`, `Length`
- Produces:
  - zod `documentSchema`, plus inferred types `DocumentDef`, `Block`, `ParagraphBlock`, `ParagraphStyle`, `Inline`, `TabStop`, `Anchor`, `ImageBlock`, `TableBlock`, `Cell`, `ColumnsBlock`, `SignatureBlock`, `SpacerBlock`, `LineBlock`, `PageBreakBlock`, `EachBlock`, `IfBlock`, `LineSpacing` — exactly as spec §5.2–5.3
  - `parseDocument(input: unknown): DocumentDef` — throws `SCHEMA_INVALID` with `path` like `blocks[3].runs[0].size` and `details` = zod issues
  - `interface TemplateDef { name: string; description: string; document: DocumentDef; dataSchema: object; example: unknown }`

- [x] **Step 1: Failing tests**
  - `parses minimal doc`: `{version:1,page:{size:'A4',margin:{top:'1.5cm',bottom:'2cm',left:'3cm',right:'2cm'}},font:{family:'THSarabunIT9',size:'16pt'},blocks:[{type:'paragraph',text:'ก'}]}` → ok
  - `reports path`: `blocks:[{type:'paragraph',runs:[{text:'x',size:'big'}]}]` → error `code==='SCHEMA_INVALID'` and `path==='blocks[0].runs[0].size'`
  - `rejects unknown block type` with path `blocks[0].type`
  - `accepts every block type from spec §5.3`: one fixture per type, parsed without error
  - `accepts tab at anchor ref`: `tabs:[{at:'@kho'}]` ok; `tabs:[{at:'kho'}]` rejected
- [x] **Step 2: Run** → FAIL
- [x] **Step 3: Implement** with recursive `z.lazy` for blocks (`each`, `if`, `columns`, cell `blocks`). Length validator = string regex `^-?\d+(\.\d+)?(pt|mm|cm|in)$` or number. Convert zod issue paths to `a[0].b` form.
- [x] **Step 4: Run** → PASS
- [x] **Step 5: Commit** `feat(core): document schema with path-aware validation`

### Task 3: Thai utilities

**Files:** Create `packages/core/src/thai/{baht,digits,date,number}.ts`. Test: `packages/core/test/thai.test.ts`

**Interfaces:**
- Produces:
  - `bahtText(value: number | string): string` — throws `INVALID_VALUE` for NaN, ±∞, or negative input
  - `toThaiDigits(s: string): string`
  - `formatNumber(value: number | string, decimals: number): string` — en-US grouping
  - `formatThaiDate(value: Date | string, style: 'long' | 'short' | 'monthYear'): string` — Buddhist year, local date parts; ISO `YYYY-MM-DD` parsed as a local date; invalid input → `INVALID_VALUE`

- [x] **Step 1: Failing tests**

```ts
it.each([
  [0, 'ศูนย์บาทถ้วน'], [1, 'หนึ่งบาทถ้วน'], [11, 'สิบเอ็ดบาทถ้วน'], [21, 'ยี่สิบเอ็ดบาทถ้วน'],
  [101, 'หนึ่งร้อยเอ็ดบาทถ้วน'], [1250.5, 'หนึ่งพันสองร้อยห้าสิบบาทห้าสิบสตางค์'],
  [1000001, 'หนึ่งล้านเอ็ดบาทถ้วน'], [21000000.25, 'ยี่สิบเอ็ดล้านบาทยี่สิบห้าสตางค์'],
  [10000000, 'สิบล้านบาทถ้วน'], [0.01, 'หนึ่งสตางค์'], ['1,500', 'หนึ่งพันห้าร้อยบาทถ้วน'],
])('bahtText(%s)', (n, s) => expect(bahtText(n)).toBe(s))
it('bahtText rounds satang half-up', () => expect(bahtText(1.005)).toBe('หนึ่งบาทหนึ่งสตางค์'))
it('rejects invalid', () => expect(() => bahtText('abc')).toThrow(expect.objectContaining({ code: 'INVALID_VALUE' })))
it('thai digits', () => expect(toThaiDigits('พ.ศ. 2569 เลข 0-9')).toBe('พ.ศ. ๒๕๖๙ เลข ๐-๙'))
it('formats number', () => expect(formatNumber(1250.5, 2)).toBe('1,250.50'))
it('thai dates', () => {
  expect(formatThaiDate('2026-10-31', 'long')).toBe('31 ตุลาคม 2569')
  expect(formatThaiDate('2026-10-31', 'short')).toBe('31 ต.ค. 69')
  expect(formatThaiDate(new Date(2027, 0, 1), 'monthYear')).toBe('มกราคม 2570')
  expect(() => formatThaiDate('31/13/2026', 'long')).toThrow(expect.objectContaining({ code: 'INVALID_VALUE' }))
})
```

  Note: `0.01 → 'หนึ่งสตางค์'` — when baht is 0 and satang > 0, omit "ศูนย์บาท".

- [x] **Step 2: Run** → FAIL
- [x] **Step 3: Implement.** Use integer arithmetic on satang (`Math.round(x*100)` after parsing a decimal string, to avoid float error). Read millions groups right-to-left in 6-digit chunks; "เอ็ด" for a 1 in the units digit only when the chunk has a higher non-zero digit, or a higher chunk exists.
- [x] **Step 4: Run** → PASS
- [x] **Step 5: Commit** `feat(core): thai baht text, digits, numbers, dates`

### Task 4: Expressions, filters, binding

**Files:** Create `packages/core/src/bind/{expr,filters,template,bind}.ts`. Test: `packages/core/test/bind.test.ts`

**Interfaces:**
- Consumes: Task 2 types, Task 3 utilities
- Produces:
  - `parseExpression(src: string): Expr` — throws `EXPRESSION_INVALID`
  - `evaluate(expr: Expr, scope: Record<string, unknown>): unknown`
  - `FILTERS: Record<string, (value: unknown, ...args: (string|number)[]) => unknown>` — `baht`, `number`, `thaiNum`, `thaiDate`, `upper`, `lower`, `default`, `prefix`
  - `renderString(tpl: string, scope: object, opts: { strict: boolean; path: string }): { value: string; warnings: Warning[] }`
  - `bindDocument(doc: DocumentDef, data: unknown, opts?: { strict?: boolean }): { doc: ResolvedDocument; warnings: Warning[] }` — `ResolvedDocument` has the same shape as `DocumentDef`, but `each`/`if` are expanded away, every string is bound, `checkbox` is a `boolean`, `table.rows` is `Cell[][]`, and numerals are converted when `numerals:'thai'`
  - Resolved types exported from `bind.ts`:
    - `ResolvedBlock = ResolvedParagraph | ResolvedImage | ResolvedTable | ResolvedColumns | ResolvedSignature | SpacerBlock | LineBlock | PageBreakBlock` (no `each`/`if`)
    - `ResolvedPageNumber = Required<DocumentDef['pageNumber']>` with defaults from Global Constraints filled in

- [x] **Step 1: Failing tests**
  - `binds dot paths and filters`: `'{{a.b | number:2}} {{amt | baht}}'` with `{a:{b:1250.5},amt:1}` → `'1,250.50 หนึ่งบาทถ้วน'`
  - `strict missing var throws`: `'{{nope}}'` → `MISSING_VARIABLE`, `path==='blocks[0].text'`; non-strict → `''` plus a warning with the same code
  - `expressions`: `evaluate(parseExpression("type == 'sick' && days >= 2"), {type:'sick',days:3}) === true`; `"!(a < 1) || b"`; string literals with escaped quotes
  - `rejects code`: `parseExpression("constructor.constructor('x')()")` → `EXPRESSION_INVALID`; path segments `__proto__`, `constructor`, `prototype` → `EXPRESSION_INVALID`
  - `each/if expansion`: `{type:'each',of:'items',as:'it',blocks:[{type:'paragraph',text:'{{it.name}}'}]}` over 2 items → 2 paragraphs; over `[]` → 0 blocks (Review Focus 1); `if` picks `then`/`else`
  - `table rows each`: `rows:{each:'items',as:'r',cells:[{text:'{{r.qty}}'}]}` → `Cell[][]` length = items
  - `checkbox expression`: `{checkbox:"{{type == 'sick'}}"}` → `{checkbox:true}`
  - `numerals thai skips email and url` (Review Focus 2): text `'ติดต่อ saraban01@moph.go.th หรือ https://a.go.th/x1 โทร 02-123-4567'` → `'ติดต่อ saraban01@moph.go.th หรือ https://a.go.th/x1 โทร ๐๒-๑๒๓-๔๕๖๗'`; run `numerals:'arabic'` is untouched
  - `bound values are literal` (Review Focus 5): data `{v:'{{secret}} <b>x</b>'}`, text `'{{v}}'` → `'{{secret}} <b>x</b>'` and no MISSING_VARIABLE
  - `limits`: `each` producing > 10,000 iterations total → `LIMIT_EXCEEDED`; `JSON.stringify(data).length > 5*1024*1024` → `LIMIT_EXCEEDED`
- [x] **Step 2: Run** → FAIL
- [x] **Step 3: Implement.** Single-pass scanner over `{{ … }}`: the output of a substitution is appended and never rescanned. Expression grammar: `or → and ('||' and)*`, `and → unary ('&&' unary)*`, `unary → '!' unary | cmp`, `cmp → primary (op primary)?`, `primary → number | string | true | false | null | path | '(' or ')'`. `each` exposes `as`, `$index`, and the parent scope. Detect email/URL tokens for numerals with `/\S+@\S+\.\S+|https?:\/\/\S+/g`.
- [x] **Step 4: Run** → PASS
- [x] **Step 5: Commit** `feat(core): safe expressions, filters, document binding`

### Task 5: Fonts package and providers

**Files:**
- Create: `packages/fonts/{package.json,LICENSE-SIPA.txt,files/*.ttf}`, `packages/fonts/src/{index,node}.ts`, `packages/core/src/fonts/provider.ts`, `packages/core/test/helpers/fonts.ts`
- Test: `packages/fonts/test/fonts.test.ts`

**Interfaces:**
- Produces:
  - `@apw-pdf/fonts`:
    - `FONT_FAMILIES: readonly ['THSarabunIT9','THSarabunNew','THSarabunPSK','THNiramitIT9']`
    - `fontFileName(family: string, bold: boolean, italic: boolean): string` — e.g. `THSarabunIT9-BoldItalic.ttf`; throws `FONT_NOT_FOUND`
  - `@apw-pdf/fonts/node`: `fontsDir: string` (absolute path to `files/`)
  - core `provider.ts`:
    - `interface FontProvider { load(family: string, style: { bold: boolean; italic: boolean }): Promise<Uint8Array> }`
    - `interface ImageProvider { load(src: string): Promise<Uint8Array> }`
  - test helper: `testFontProvider(): FontProvider` (reads `packages/fonts/files`)

- [x] **Step 1: Copy fonts** from `C:\Users\apiwat\Videos\font` and rename to ASCII `<Family>-<Regular|Bold|Italic|BoldItalic>.ttf`:
  - `THSarabunIT๙*.ttf` → THSarabunIT9
  - `TH NiramitIT๙*.ttf` and `TH Niramit AS-IT๙ Bold Italic.ttf` → THNiramitIT9
  - `thsarabunnew/*` → THSarabunNew
  - `TH-Sarabun-PSK/THSarabun*.ttf` → THSarabunPSK

  Add `LICENSE-SIPA.txt` stating the source (SIPA national fonts) and the free-use terms.
- [x] **Step 2: Failing test** — every `FONT_FAMILIES × {bold,italic}` combination resolves to an existing file in `fontsDir`, and each file starts with the TrueType magic `00 01 00 00`. `fontFileName('Comic',false,false)` throws `FONT_NOT_FOUND`.
- [x] **Step 3: Run** → FAIL
- [x] **Step 4: Implement**; set the `files` and `exports` fields (`.` and `./node`, plus `./files/*`).
- [x] **Step 5: Run** → PASS
- [x] **Step 6: Commit** `feat(fonts): bundle SIPA Thai fonts with manifest`

### Task 6: Font registry, metrics, shaping

**Files:** Create `packages/core/src/fonts/{metrics,registry}.ts`. Test: `packages/core/test/fonts.test.ts`

**Interfaces:**
- Consumes: `FontProvider`, `LineSpacing`
- Produces:
  - `interface FontSpec { family: string; size: number /*pt*/; bold: boolean; italic: boolean; color: string /*#rrggbb*/ }` — the doc-level `font` resolved to pt; passed as `base` to later tasks
  - `interface FontMetrics { upem: number; winAscent: number; winDescent: number; hheaAscender: number; hheaDescender: number; hheaLineGap: number }`
  - `readFontMetrics(os2: Uint8Array, hhea: Uint8Array, upem: number): FontMetrics` — OS/2 offsets 74/76 (uint16), hhea offsets 4/6/8 (int16)
  - `singleLineHeight(m: FontMetrics, sizePt: number): number` — spec §6.1 formula
  - `lineBox(m: FontMetrics, sizePt: number, spacing: LineSpacing): { height: number; ascent: number }`
    - single/multiple: `ascent = (winAscent + externalLeading) / upem × size`
    - exactly: `height = H`, `ascent = H × winAscent / (winAscent + winDescent)`
    - atLeast: `max`
  - `class FontRegistry { static create(provider: FontProvider): FontRegistry; get(family: string, bold: boolean, italic: boolean): Promise<LoadedFont>; byId(id: number): LoadedFont; all(): LoadedFont[] }`
  - `interface LoadedFont { id: number; family: string; bold: boolean; italic: boolean; bytes: Uint8Array; metrics: FontMetrics; shape(text: string, sizePt: number): ShapedRun }`
  - `interface ShapedGlyph { id: number; advance: number; dx: number; dy: number; cluster: number }` — pt; cluster = UTF-16 index into `text`
  - `interface ShapedRun { glyphs: ShapedGlyph[]; width: number; missing: string[] }`

- [x] **Step 1: Failing tests**

```ts
it('reads TH SarabunIT9 metrics', async () => {
  const f = await FontRegistry.create(testFontProvider()).get('THSarabunIT9', false, false)
  expect(f.metrics).toMatchObject({ upem: 1000, winAscent: 850, winDescent: 250, hheaAscender: 850, hheaDescender: -250, hheaLineGap: 30 })
})
it('single line height follows GDI formula', () =>                       // (850+250+30)/1000*16
  expect(singleLineHeight({ upem:1000, winAscent:850, winDescent:250, hheaAscender:850, hheaDescender:-250, hheaLineGap:30 }, 16)).toBeCloseTo(18.08, 4))
it('exactly 35pt box for 29pt title', () =>
  expect(lineBox(m, 29, { exactly: 35 })).toEqual({ height: 35, ascent: expect.closeTo(27.045, 3) }))
it('shapes stacked Thai marks with zero-advance marks', async () => {
  const r = f.shape('ปี่', 16)
  expect(r.glyphs.length).toBe(3)
  expect(r.glyphs[1].advance).toBe(0); expect(r.glyphs[2].advance).toBe(0)
  expect(r.glyphs.every(g => g.cluster === 0)).toBe(true)
  expect(r.width).toBeCloseTo(428 / 1000 * 16, 4)
})
it.each(['ที่', 'น้ำ', 'กุ้ง', 'ญาติ', 'ฐาน', 'ปั้น'])('shapes %s in every bundled family without missing glyphs', async (w) => {
  for (const fam of FONT_FAMILIES) expect((await reg.get(fam, false, false)).shape(w, 16).missing).toEqual([])
})
it('reports missing glyphs', () => expect(f.shape('ก✅中', 16).missing).toEqual(['✅', '中']))   // Review Focus 4
it('falls back when style file missing', …)   // provider that throws for italic → returns regular font, registry.warnings has FONT_STYLE_FALLBACK
it('unknown family → FONT_NOT_FOUND', …)
```

- [x] **Step 2: Run** → FAIL
- [x] **Step 3: Implement** with `import * as hb from 'harfbuzzjs'` (v1 class API: `new hb.Blob(bytes)`, `new hb.Face(blob)`, `new hb.Font(face)`, `new hb.Buffer()`, `buffer.addText`, `buffer.guessSegmentProperties()`, `hb.shape(font, buffer)`, `buffer.getGlyphInfosAndPositions()`). Glyph `codepoint` holds the glyph id after shaping. Scale = size / upem. Cache shaping by `(fontId, size, text)` in a `Map` per registry. Fonts are cached by family/style; ids are assigned in load order.
- [x] **Step 4: Run** → PASS
- [x] **Step 5: Commit** `feat(core): font registry, Word-compatible metrics, harfbuzz shaping`

### Task 7: Segmentation and clusters

**Files:** Create `packages/core/src/text/{segment,clusters}.ts`. Test: `packages/core/test/segment.test.ts`

**Interfaces:**
- Produces:
  - `segmentWords(text: string, dictionary?: string[]): string[]` — concatenation equals the input; whitespace is its own token
  - `graphemeClusters(text: string): string[]` — uses `Intl.Segmenter` grapheme granularity
  - `assertSegmenter(): void` — throws `SEGMENTER_UNAVAILABLE`

- [x] **Step 1: Failing tests**
  - `join invariant`: for each fixture, `segmentWords(s).join('') === s`
  - `glues open punctuation forward`: `'ขอ (ด่วน) มาก'` → contains token `'(ด่วน)'`
  - `glues close punctuation and ฯ ๆ back`: `'กรุงเทพฯ เด็กๆ'` → contains `'กรุงเทพฯ'` and `'เด็กๆ'`
  - `dictionary merge`: `segmentWords('สำนักงานสาธารณสุขจังหวัดอุทัยธานี', ['สำนักงานสาธารณสุขจังหวัด'])` → first token `'สำนักงานสาธารณสุขจังหวัด'`
  - `NBSP keeps number+unit`: `'10\u00A0บาท'` is one token
  - `graphemeClusters('น้ำกุ้ง')` → `['น้ำ','กุ้','ง']`
  - `missing segmenter`: stub `Intl.Segmenter = undefined` → `SEGMENTER_UNAVAILABLE`
- [x] **Step 2: Run** → FAIL
- [x] **Step 3: Implement.** Dictionary merge: greedy longest match of dictionary entries over the raw string first, protecting their ranges, then segment the gaps. Punctuation sets per spec §6.3.
- [x] **Step 4: Run** → PASS
- [x] **Step 5: Commit** `feat(core): thai word segmentation with punctuation and dictionary rules`

### Task 8: Inline items and line breaking

**Files:** Create `packages/core/src/layout/{inline,linebreak}.ts`. Test: `packages/core/test/linebreak.test.ts`

**Interfaces:**
- Consumes: `FontRegistry`, `segmentWords`, `graphemeClusters`, `ResolvedDocument` paragraph types
- Produces:
  - `type InlineItem` — every item has `width: number` (pt) and `path: string`:
    - `{ kind:'word'; text; font: LoadedFont; size; color; underline; shaped: ShapedRun; anchors: { name; offset: number; edge:'start'|'end' }[] }`
    - `{ kind:'space'; …same font fields }`
    - `{ kind:'tab' }`
    - `{ kind:'fill'; text; widthSpec: number|'toTab'|'toEnd'; leader:'dots'|'line'|'none'; align; font; size }`
    - `{ kind:'checkbox'; checked: boolean; font; size }` — glyph ☐ U+2610 / ☑ U+2611; if the font lacks it, draw a square of side 0.7em as `rect`/`line` items
    - `{ kind:'break' }`
    - `{ kind:'pageNumber'|'pageCount'; font; size }` — width of the "00" placeholder
  - `buildInlineItems(p: ResolvedParagraph, ctx: { fonts: FontRegistry; base: FontSpec; dictionary: string[]; path: string }): Promise<{ items: InlineItem[]; warnings: Warning[] }>`
  - `interface BrokenLine { items: InlineItem[]; isLast: boolean; endsWithBreak: boolean }`
  - `breakLines(items: InlineItem[], widthFor: (lineIndex: number) => number, measureTabs: (items: InlineItem[]) => number): { lines: BrokenLine[]; warnings: Warning[] }` — `measureTabs` returns the natural width with tabs resolved (provided by Task 9's `naturalWidth`)

- [x] **Step 1: Failing tests** (use THSarabunIT9 16pt)
  - `fills greedily`: 30 repetitions of `'ทดสอบ '` with width 200pt → each line's natural width ≤ 200, and adding the next word would exceed it
  - `trailing spaces hang`: a line ending in a space is not broken early because of that space; the space item is dropped from the line end
  - `forced break` (Review Focus 3): `'https://example.go.th/very/long/path/without/spaces'` in 40pt → several lines, each ≤ 40pt, broken at grapheme boundaries, with warning `FORCED_BREAK`
  - `explicit break`: `{lineBreak:true}` ends a line; that line has `endsWithBreak`
  - `first line width`: `widthFor(0)=100`, `widthFor(n>0)=200` is respected
  - `mixed runs`: bold run + regular run are shaped with their own fonts; `items[i].font.bold` matches the run
  - `empty paragraph` (Review Focus 1): `text:''` → exactly 1 line with 0 items
- [x] **Step 2: Run** → FAIL
- [x] **Step 3: Implement.** One word item per segment token per run; whitespace → space item. Word Thai leading punctuation stays attached because Task 7 already glued it.
- [x] **Step 4: Run** → PASS
- [x] **Step 5: Commit** `feat(core): inline items and greedy Thai line breaking`

### Task 9: Line placement — alignment, tabs, anchors, Thai Distributed

**Files:** Create `packages/core/src/layout/align.ts`. Test: `packages/core/test/align.test.ts`

**Interfaces:**
- Consumes: `BrokenLine`, `InlineItem`
- Produces:
  - `DISTRIBUTE_WEIGHTS = { space: 4, cluster: 1 } as const`
  - `interface AnchorTable { get(name: string): number | undefined; set(name: string, x: number): void }` — absolute x on the current page
  - `naturalWidth(items: InlineItem[], ctx: TabCtx): number`
  - `interface TabCtx { lineStartX: number; tabs: { at: number; align; leader }[]; defaultInterval: 36; contentRight: number }` — tab `at` values are already resolved to absolute x
  - `resolveTabStops(tabs: TabStop[], indentLeftX: number, anchors: AnchorTable, path: string): TabCtx['tabs']` — numeric `at` is measured from `indentLeftX`; `@name` → `anchors.get` or throw `ANCHOR_NOT_FOUND`
  - `placeLine(line: BrokenLine, opts: { x: number; width: number; align; tab: TabCtx; anchors: AnchorTable }): PlacedRun[]`
  - `interface PlacedRun { font: LoadedFont; size; color; x: number; glyphs: { id; dx; dy; advance }[]; text: string; clusters: number[]; path: string; underline?: boolean | 'dotted' }` — plus `PlacedShape { kind:'line'|'rect' … }` for fill leaders and checkbox fallback
  - Glyph advances inside a run already include the distributed extra spacing

- [x] **Step 1: Failing tests**
  - `left/center/right`: `placeLine` x of the first glyph = x, `x + (w-natural)/2`, `x + w - natural`
  - `justify`: extra space goes only to space items; the last line is left-aligned
  - `thaiDistributed reaches right edge`: a non-last line of `'ด้วยสำนักงานมีความประสงค์ขอจัดซื้อวัสดุ'…` → last glyph's x + advance === x + width (±0.01); gaps between clusters grow by `extra × 1/W`, spaces by `extra × 4/W`, where W = Σ weights; marks inside a cluster keep their dx/dy relative to the base
  - `thaiDistributed last line left`: `isLast` or `endsWithBreak` → natural spacing
  - `tab stops`: with tab at 8cm, the text after the tab starts at `indentLeftX + 226.77`; right tab ends there; decimal tab aligns '.' there; leader `dots` emits a dotted `line` shape between
  - `default tabs`: no tabs defined → next multiple of 36pt from indentLeftX
  - `anchors`: a word with anchor `{name:'kho', index:6}` → `anchors.get('kho')` equals the x of the cluster containing char 6, after alignment; `edge:'end'` = the end of that cluster
  - `@anchor tab`: `resolveTabStops([{at:'@kho'}], …)` uses the anchor; missing → `ANCHOR_NOT_FOUND`
  - `fill toEnd`: dotted leader from the current x to `contentRight`, with text drawn on top left-aligned (or centered when `align:'center'`)
- [x] **Step 2: Run** → FAIL
- [x] **Step 3: Implement.** Distribution only applies to the segment after the last tab (spec §6.4). Cluster gaps = boundaries between grapheme clusters inside word items plus boundaries between adjacent items; underline is drawn as a line shape 1.2pt below the baseline, thickness 0.05em.
- [x] **Step 4: Run** → PASS
- [x] **Step 5: Commit** `feat(core): alignment, tab stops, anchors, Thai distributed spacing`

### Task 10: Paragraph layout and LayoutTree types

**Files:** Create `packages/core/src/layout/{paragraph,tree}.ts`. Test: `packages/core/test/paragraph.test.ts`

**Interfaces:**
- Consumes: Tasks 6–9
- Produces:
  - `tree.ts`: `LayoutTree`, `LayoutPage`, `LayoutItem` exactly as spec §6.7, plus `FontRef = { id; family; bold; italic }`
  - `interface LaidLine { height: number; ascent: number; runs: PlacedRun[]; shapes: PlacedShape[]; pendingAnchors: … }` — x is absolute, y is relative to the line top
  - `interface ParagraphLayout { lines: LaidLine[]; spaceBefore: number; spaceAfter: number; keepWithNext: boolean; keepLinesTogether: boolean; widowControl: boolean; path: string }`
  - `layoutParagraph(p: ResolvedParagraph, ctx: { fonts; base: FontSpec; styles; dictionary; contentLeft: number; contentWidth: number; anchors: AnchorTable; path: string }): Promise<{ layout: ParagraphLayout; warnings: Warning[] }>`

- [x] **Step 1: Failing tests**
  - `indents`: `indentLeft:'1cm', firstLineIndent:'2.5cm'` → line 0 starts at contentLeft + 28.35 + 70.87; line 1 at contentLeft + 28.35
  - `hanging indent`: `firstLineIndent:'-1cm', indentLeft:'2cm'` → line 0 at +28.35, rest at +56.69
  - `line height uses tallest run`: a line mixing a 16pt and a 20pt bold run → height = singleLineHeight(20pt)
  - `exactly spacing`: `lineSpacing:{exactly:'35pt'}` → every line height 35
  - `empty paragraph height` (Review Focus 1): `text:''` → 1 line of height 18.08 (IT9 16pt); no NaN in any field
  - `style reference`: `style:'label'` merges `styles.label`, and block props override the style
- [x] **Step 2: Run** → FAIL
- [x] **Step 3: Implement**
- [x] **Step 4: Run** → PASS
- [x] **Step 5: Commit** `feat(core): paragraph layout with indents and line spacing`

### Task 11: Block flow and pagination

**Files:** Create `packages/core/src/layout/flow.ts`, `packages/core/src/images/info.ts`. Test: `packages/core/test/flow.test.ts`

**Interfaces:**
- Consumes: `layoutParagraph`, `pageBox`, `ImageProvider`
- Produces:
  - `readImageInfo(bytes: Uint8Array): { format: 'png' | 'jpeg'; width: number; height: number }` — throws `IMAGE_LOAD_FAILED` for other formats
  - `interface FlowContext { fonts; images: ImageProvider; doc: ResolvedDocument; box: ReturnType<typeof pageBox>; bodyTop: (pageIndex: number) => number; anchors: AnchorTable; warnings: Warning[]; imageCache: Map<string, Uint8Array> }`
  - `paginate(blocks: ResolvedBlock[], ctx: FlowContext): Promise<LayoutPage[]>` — handles paragraph, spacer, line, pageBreak, image (inline and anchored); delegates table/columns/signature through a `layoutBlock` dispatch, which Tasks 12–13 register
  - `interface Fragment { height: number; spaceBefore: number; spaceAfter: number; items(yTop: number): LayoutItem[]; splittable: false } | { …splittable: true; split(avail: number): [Fragment, Fragment] | null; minHeadLines; … }` — the internal flow unit that tables and signatures also produce

- [x] **Step 1: Failing tests** (A4, gov margins, bodyTop = margin top)
  - `flows to second page`: 80 paragraphs of 1 line → page count 2; first item on page 2 at y = 42.52 + ascent
  - `drops spaceBefore at top after auto break, keeps after pageBreak`
  - `widow/orphan`: a 5-line paragraph with room for 1 line → all 5 move to the next page; room for 3 → 3 + 2; room for 4 → 3 + 2 (never leaves 1 widow line)
  - `keepWithNext`: a heading with keepWithNext at the page bottom moves together with the next paragraph's first 2 lines
  - `keepLinesTogether` moves the whole paragraph
  - `anchored image doesn't consume flow`: memo garuda `anchor:{relativeTo:'margin', x:0, y:0}`, height 1.5cm → image item at x = 85.04, y = 42.52, h = 42.52, w from aspect ratio; the next paragraph still starts at y = 42.52
  - `inline image centered`: `align:'center'` width 3cm → x = 311.81 − 42.52
  - `spacer`: `{height:{lines:2}}` → the next baseline moves down by 2 × 18.08; `{height:'1cm'}` → by 28.35
  - `line`: `{type:'line', style:'dashed', thickness:'1pt'}` → a `line` item spanning contentLeft..contentRight with `dash` set
  - `BLOCK_TOO_TALL`: a 30cm image → error with `path:'blocks[0]'`
  - `500-page limit` → `LIMIT_EXCEEDED`; image > 10 MB → `LIMIT_EXCEEDED`
- [x] **Step 2: Run** → FAIL
- [x] **Step 3: Implement.** Y grows downward from the page top (the writer flips it). Glyph item `y` = baseline.
- [x] **Step 4: Run** → PASS
- [x] **Step 5: Commit** `feat(core): block flow pagination with keeps and widow control`

### Task 12: Tables and columns

**Files:** Create `packages/core/src/layout/{table,columns}.ts`. Test: `packages/core/test/table.test.ts`

**Interfaces:**
- Consumes: `Fragment`, `layoutParagraph`, the flow dispatch from Task 11
- Produces:
  - `layoutTable(t: ResolvedTable, ctx: FlowContext, x: number, width: number, path: string): Promise<Fragment>` — splittable between rows
  - `layoutColumns(c: ResolvedColumns, ctx, x, width, path): Promise<Fragment>` — never splittable in v1
  - `resolveColumnWidths(specs: (Length|`${number}%`|'*')[], total: number): number[]` — fixed first, then %, then `*` share the remainder equally

- [x] **Step 1: Failing tests**
  - `column widths`: `['2cm','50%','*']` over 453.54 → `[56.69, 226.77, 170.08]`
  - `borders and padding`: each cell draws 4 border lines of `border.width` (default 0.5pt); text starts at cell x + padding (default 3pt left/right, 1pt top)
  - `row height = max cell`; `vAlign:'middle'` centers
  - `colSpan` merges widths; `rowSpan` spans heights
  - `split between rows + repeatHeader`: 60 rows → 2 pages; page 2 starts with the header row; no row is cut
  - `row taller than page` with `allowRowSplit:false` → `BLOCK_TOO_TALL` with path `blocks[i].rows[j]`
  - `long URL in narrow cell` (Review Focus 3): 2cm column → all glyph x + advance ≤ cell right − padding, plus a `FORCED_BREAK` warning whose path contains `.rows[0][0]`
  - `columns side by side`: two 50% columns with a 6pt gap; the right column's first glyph x = contentLeft + (453.54 − 6)/2 + 6; height = max of the column heights
- [x] **Step 2: Run** → FAIL
- [x] **Step 3: Implement**
- [x] **Step 4: Run** → PASS
- [x] **Step 5: Commit** `feat(core): tables with header repeat and side-by-side columns`

### Task 13: Signature, page numbers, `createEngine`

**Files:** Create `packages/core/src/layout/{signature,pagenumber}.ts`, `packages/core/src/engine.ts`; update `index.ts`. Test: `packages/core/test/engine.test.ts`

**Interfaces:**
- Consumes: everything above
- Produces:
  - `layoutSignature(s: ResolvedSignature, ctx: FlowContext, path: string): Promise<Fragment>` — unsplittable
    - optional `prefix` (e.g. "(ลงชื่อ)") sits on the image line, ending at `startAt − 0.5em`
    - image centered over the name line
    - name line = `"(" + name + ")"` starting at `startAt`
    - each position line centered on the name line's center
    - the fragment's `spaceBefore` = `(linesBefore − 1) × single`
  - flow rule: when the signature does not fit, pull the last `minLinesBefore` lines of the preceding paragraph(s) to the next page together with it
  - `applyPageNumbers(pages: LayoutPage[], cfg: ResolvedPageNumber, ctx): void` — fills page numbers on pages with index + 1 ≥ `from`; `bodyTop(i)` = `max(margin.top, offset + singleLineHeight(size))` on those pages
  - `interface Engine { fonts: FontRegistry; validate(doc: unknown, data: unknown): { ok: boolean; issues: { path?: string; code: string; message: string }[] }; layout(doc: unknown, data: unknown, opts?: { strict?: boolean }): Promise<LayoutTree> }`
  - `createEngine(opts: { fonts: FontProvider; images?: ImageProvider }): Promise<Engine>` — `validate` runs parse + bind (strict) and collects issues without throwing; `layout` = parse → bind → paginate → page numbers → `LayoutTree` (warnings merged)

- [x] **Step 1: Failing tests**
  - `signature geometry`: `startAt:'center'`, name 'นายสมชาย ใจดี', positions ['ผู้อำนวยการ'] → first glyph of "(" at x = 311.81; the position line's center = the name line's center (±0.01); the name baseline is 4 × 18.08 below the previous baseline when `linesBefore: 4`
  - `signature pulls 3 lines`: fill a page so the signature overflows → the next page holds ≥ 3 body lines before the signature; the previous page ends earlier
  - `page numbers from page 2`: a 2-page doc with `numerals:'thai'` → page 1 has no number; page 2 has glyph text '- ๒ -' centered at x = 311.81, 15pt, top at offset 1.25cm; the page-2 body starts at max(42.52, 35.43 + singleLineHeight(15)) = 52.38 (±0.01)
  - `{pageNumber:true}` and `{pageCount:true}` inline items are resolved after pagination
  - `validate` returns `{ok:false, issues:[{code:'MISSING_VARIABLE', path:'blocks[2].text'}]}` and never throws
  - `layout deterministic`: the same input laid out twice → deep-equal trees
- [x] **Step 2: Run** → FAIL
- [x] **Step 3: Implement**
- [x] **Step 4: Run** `pnpm -F @apw-pdf/core exec vitest run --coverage` → PASS, lines ≥ 80%
- [x] **Step 5: Commit** `feat(core): signature blocks, page numbers, engine API`

## Phase B — PDF writer

### Task 14: Font subsetting and CID font embedding

**Files:** Create `packages/pdf/{package.json,tsconfig.json,tsup.config.ts}`, `packages/pdf/src/{hbsubset,cidfont,tounicode}.ts`. Test: `packages/pdf/test/font-embed.test.ts`

**Interfaces:**
- Consumes: `LoadedFont`
- Produces:
  - `createSubsetter(wasm: Uint8Array | ArrayBuffer): Promise<(font: Uint8Array, glyphIds: Iterable<number>) => Uint8Array>`
  - `buildToUnicodeCMap(map: Map<number, string>): string` — a `bfchar` entry per glyph, in chunks of ≤ 100
  - `embedCidFont(doc: PDFDocument, font: LoadedFont, usage: Map<number, string /*unicode*/>, subset: Subsetter): PDFRef` — a Type0 dict with `/Encoding /Identity-H`, a descendant CIDFontType2 with `/CIDToGIDMap /Identity`, `/W` from shaped advances in font units ×1000/upem, a FontDescriptor (flags 32, ascent/descent from the metrics, bbox from `head`) with `/FontFile2` = flate stream of the subset, and `/ToUnicode`

- [x] **Step 1: Failing tests**
  - `subset keeps gids`: subset THSarabunIT9 with glyphs {0, 240, 344, 361} → output < 10 KB; parse it with harfbuzzjs; shaping 'ปี่' on the subset yields the same glyph ids [240, 344, 361]
  - `ToUnicode`: `buildToUnicodeCMap(new Map([[240,'ป'],[344,'ี'],[361,'่']]))` contains `<00F0> <0E1B>`, `begincmap`, `endcmap`
  - `embed`: embedding into a new pdf-lib doc, then `doc.save()` and reloading with pdf-lib, gives a font dict with `/Subtype /Type0` and a `/FontFile2` stream
- [x] **Step 2: Run** → FAIL
- [x] **Step 3: Implement the subsetter** by instantiating the standalone wasm (it has no imports). Export calls:

```ts
// copy bytes in: p = malloc(n); new Uint8Array(memory.buffer).set(bytes, p)   — re-read memory.buffer after every malloc (it may grow)
// blob = hb_blob_create(p, n, 2 /*HB_MEMORY_MODE_WRITABLE*/, 0, 0); face = hb_face_create(blob, 0)
// input = hb_subset_input_create_or_fail(); set = hb_subset_input_glyph_set(input); hb_set_add(set, gid) for each
// hb_subset_input_set_flags(input, 0x2 /*RETAIN_GIDS*/ | 0x1 /*NO_HINTING*/)
// sub = hb_subset_or_fail(face, input); out = hb_face_reference_blob(sub)
// len = hb_blob_get_length(out); data = hb_blob_get_data(out, lenPtr); copy out
// destroy: hb_blob_destroy(out), hb_face_destroy(sub), hb_subset_input_destroy(input), hb_face_destroy(face), hb_blob_destroy(blob), free(p), free(lenPtr)
```

  `cidfont.ts` builds the dicts with `doc.context.obj({...})`, `doc.context.flateStream(bytes)`, and `doc.context.register(...)`.
- [x] **Step 4: Run** → PASS
- [x] **Step 5: Commit** `feat(pdf): retain-gid font subsetting and CID font embedding`

### Task 15: `writePdf` and `createPdfEngine`

**Files:** Create `packages/pdf/src/{writer,engine,index}.ts`. Test: `packages/pdf/test/writer.test.ts`

**Interfaces:**
- Consumes: `LayoutTree`, `Engine`, `createEngine`, Task 14
- Produces:
  - `writePdf(tree: LayoutTree, opts: { fonts: FontRegistry; images: ImageProvider; subset: Subsetter; meta?: DocumentDef['meta']; creationDate?: Date }): Promise<Uint8Array>`
  - `interface PdfEngine extends Engine { renderPdf(doc: unknown, data: unknown, opts?: { strict?: boolean; creationDate?: Date }): Promise<{ bytes: Uint8Array; pageCount: number; warnings: Warning[] }> }`
  - `createPdfEngine(opts: { fonts: FontProvider; images?: ImageProvider; subsetWasm: Uint8Array | ArrayBuffer | (() => Promise<Uint8Array | ArrayBuffer>) }): Promise<PdfEngine>`

- [ ] **Step 1: Failing tests** (pdfjs-dist as a devDependency, for reading back)
  - `text round-trip`: render a doc with paragraph 'ด้วยสำนักงานขอจัดซื้อวัสดุ จำนวน ๑๐ รายการ' → pdfjs `getTextContent` joined without spaces equals the source without spaces
  - `positions`: the first glyph-run transform from pdfjs has x ≈ 85.04 and y ≈ 841.89 − baseline (±0.05)
  - `page size`: A4 mediabox `[0 0 595.2756 841.8898]`
  - `images`: PNG and JPEG fixtures embed; the image op's matrix width/height = layout w/h
  - `lines/rects`: a table border line appears as a path operator with the expected width
  - `deterministic`: two renders with `creationDate: new Date(0)` → identical bytes
  - `metadata`: Producer 'apw-pdf', Title from `meta.title`
  - `missing glyph` (Review Focus 4): text 'ก✅' → bytes produced, `warnings` contains `{code:'MISSING_GLYPH', path:'blocks[0]'}`
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement.**
  - Per page, emit the operators `BT /F{id} size Tf … ET`.
  - Each glyph is positioned absolutely with `Tm` per run, and a `TJ` array uses kerning numbers `-(advance_actual − advance_font) × 1000 / size` to apply distributed spacing.
  - Glyphs with non-zero dx/dy are emitted with their own `Td`.
  - Colors use `rg` (hex → 0–1).
  - Underline, lines, and rects are drawn as path ops; dashed lines use `d`.
  - Pass `useObjectStreams: false` to `save`; set dates and `/ID` deterministically from `creationDate`.
- [ ] **Step 4: Run** `pnpm -F @apw-pdf/pdf exec vitest run --coverage` → PASS, lines ≥ 80%
- [ ] **Step 5: Commit** `feat(pdf): pdf writer with shaped glyph runs and deterministic output`

## Phase C — Templates

### Task 16: Template infrastructure + บันทึกข้อความ (memo)

**Files:** Create `packages/templates/{package.json,assets/garuda-placeholder.png,scripts/make-placeholder.mjs}`, `packages/templates/src/{common,memo,index}.ts`. Test: `packages/templates/test/memo.test.ts`, `packages/templates/test/helpers.ts`

**Interfaces:**
- Consumes: `TemplateDef`, `createPdfEngine`, the test font provider
- Produces:
  - `common.ts`:
    - `GOV_PAGE` (A4; margins 1.5/2/3/2 cm)
    - `GOV_FONT` (THSarabunIT9 16pt single)
    - `GOV_PAGE_NUMBER` ({from:2, position:'top-center', format:'- {n} -', size:'15pt', offset:'1.25cm'})
    - `PARA_INDENT = '2.5cm'`
    - `defineTemplate<T>(def: TemplateDef & { build(input: T): { doc: DocumentDef; data: unknown } }): TemplateDef & { build }`
  - `memo: TemplateDef & { build(input: MemoInput) }`, where `interface MemoInput { agency: string; docNo: string; date: Date | string; subject: string; to: string; body: string[]; signer: { name: string; positions: string[]; signatureUrl?: string }; speed?: string; secrecy?: string }`
  - test helper `layoutOf(template, data): Promise<LayoutTree>`, plus `findRun(tree, textStartsWith): { page, item }`

- [ ] **Step 1: Placeholder asset.** `make-placeholder.mjs` uses pngjs to write a 300×330 px grey eagle-shaped silhouette PNG labelled "PLACEHOLDER". Commit the generated PNG. The README states that it is not for real documents.
- [ ] **Step 2: Failing conformance tests** (spec §3 / §14), using `memo.example`:
  - garuda image: x = 85.0394, y = 42.5197, h = 42.5197
  - title run 'บันทึกข้อความ': bold, size 29, line box exactly 35, horizontally centered in the content area (run center = 311.811 ± 0.05)
  - labels 'ส่วนราชการ', 'ที่', 'วันที่', 'เรื่อง' are bold 20pt; their dotted leaders end at contentRight 538.58
  - the 'วันที่' run x equals the x of 'ข' inside the title (anchor `kho`, index 6) ± 0.01
  - 'เรียน' has spaceBefore 6pt (its baseline − the previous baseline = single(16) + 6 ± 0.01)
  - first body line x = 85.04 + 70.87; body lines are distributed (the right edge of non-last lines = 538.58 ± 0.01)
  - signature '(' x = 311.81
  - a long-body example (40 paragraphs) → page 2 has '- ๒ -' and page 1 has none
- [ ] **Step 3: Run** `pnpm -F @apw-pdf/templates exec vitest run memo` → FAIL
- [ ] **Step 4: Implement** `memo.document` per spec §9.1, with `{{}}` bindings, `dataSchema` (JSON Schema draft-07), `example` (realistic Thai purchase-request memo), and a `build()` that maps `MemoInput` to `{ doc: memo.document, data }`.
- [ ] **Step 5: Run** → PASS
- [ ] **Step 6: Commit** `feat(templates): บันทึกข้อความ template with conformance tests`

### Task 17: หนังสือภายนอก (external letter)

**Files:** Create `packages/templates/src/external-letter.ts`. Test: `packages/templates/test/external-letter.test.ts`

**Interfaces:**
- Produces: `externalLetter: TemplateDef & { build(input: ExternalLetterInput) }`, where `interface ExternalLetterInput { docNo: string; agencyAddress: string[]; date: Date | string; subject: string; salutation: string; to: string; reference?: string; enclosures?: string[]; body: string[]; closing?: string; signer: { name; positions: string[]; signatureUrl? }; ownerUnit: { name: string; phone?: string; fax?: string; email?: string } }`

- [ ] **Step 1: Failing conformance tests:**
  - garuda h = 85.0394, centered (x + w/2 = 311.811), y = 42.5197
  - the 'ที่' run x = 85.04
  - the address block's longest line ends at 538.58 ± 0.05, and all its lines share the same left x
  - the first date glyph x = 311.81
  - 'เรื่อง' / 'เรียน' / 'อ้างถึง' / 'สิ่งที่ส่งมาด้วย' each have spaceBefore 6pt; when `reference` is absent, 'อ้างถึง' is not rendered
  - the closing 'ขอแสดงความนับถือ' starts at 311.81 with spaceBefore 12pt
  - the signer name baseline = closing baseline + 2 × single(16)
  - the ownerUnit lines start at 85.04 after the signature
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** per spec §9.2
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** `feat(templates): หนังสือภายนอก template with conformance tests`

### Task 18: ใบลา (leave forms)

**Files:** Create `packages/templates/src/{leave-sick,leave-vacation}.ts`; update `index.ts`. Test: `packages/templates/test/leave.test.ts`

**Interfaces:**
- Produces:
  - `leaveSickPersonalMaternity: TemplateDef & { build(input: LeaveInput) }`
  - `leaveVacation: TemplateDef & { build(input: VacationLeaveInput) }`
  - `templates: Record<string, TemplateDef>` keyed by `memo`, `external-letter`, `leave-sick-personal-maternity`, `leave-vacation`
  - The input interfaces list the spec §9.3 fields: `writtenAt`, `date`, `subject`, `to`, `name`, `position`, `level`, `affiliation`, `leaveType: 'sick'|'personal'|'maternity'`, `reason`, `from`, `toDate`, `days`, `lastLeave?: { type; from; to; days }`, `contact`, `stats: { type; taken; thisTime; total }[]`, `checker?`, `supervisor?: { opinion; name; position }`, `approver?: { approved?: boolean; name; position }`; for vacation, `accumulatedDays`, `currentYearDays`, `totalDays`, `substitute?: { name }`

- [ ] **Step 1: Failing tests**
  - every template's `example` renders without warnings
  - with all optional fields empty, the dotted leaders still render (each `fill` emits a dotted `line` item of the expected width)
  - `leaveType:'sick'` → the first checkbox is ☑ and the others ☐
  - the stats table has a header row 'ประเภทลา | ลามาแล้ว | ลาครั้งนี้ | รวมเป็น' and 3 body rows
  - each form fits on 1 page with the example data
  - `templates` has exactly 4 keys, and every `example` validates against its `dataSchema` (use a tiny JSON Schema check: required + type only)
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** `pnpm -F @apw-pdf/templates exec vitest run --coverage` → PASS
- [ ] **Step 5: Commit** `feat(templates): ใบลาป่วย/กิจ/คลอด and ใบลาพักผ่อน templates`

## Phase D — Node, raster

### Task 19: `@apw-pdf/node` renderer and CLI

**Files:** Create `packages/node/src/{providers,renderer,cli,index}.ts`, `packages/node/bin/apw-pdf.js`. Test: `packages/node/test/{renderer,providers,cli}.test.ts`

**Interfaces:**
- Consumes: `createPdfEngine`, `fontsDir`, `fontFileName`, `templates`
- Produces:
  - `fsFontProvider(dirs: string[]): FontProvider` — the first dir containing `fontFileName(...)` wins; else `FONT_NOT_FOUND`
  - `fsImageProvider(opts: { baseDir?: string; allowRemoteImages?: string[]; assets?: Record<string, string | Uint8Array> }): ImageProvider`
    - `asset:<name>` → assets, defaulting `garuda` to the placeholder
    - `data:` URLs
    - relative paths resolved under `baseDir`; anything escaping it → `IMAGE_NOT_ALLOWED`
    - `http(s)` only when the hostname is in the allowlist (exact match), else `IMAGE_NOT_ALLOWED`; fetch with a 10 s timeout and a 10 MB cap
  - `interface Renderer { render(doc: unknown, data: unknown, opts?): Promise<Uint8Array>; renderToFile(doc, data, file: string, opts?): Promise<{ pageCount; warnings }>; validate(doc, data): ReturnType<Engine['validate']>; templates: Record<string, TemplateDef> }`
  - `createRenderer(opts?: { fontDirs?: string[]; imageBaseDir?: string; allowRemoteImages?: string[]; assets?: Record<string, string | Uint8Array> }): Promise<Renderer>` — the subset wasm is read from `createRequire(import.meta.url).resolve('harfbuzzjs/dist/harfbuzz-subset.wasm')`
  - `render(doc)` also accepts a template name string, which resolves to `templates[name].document`
  - CLI commands:
    - `apw-pdf render <template.json|name> <data.json> -o <out.pdf> [--non-strict]`
    - `apw-pdf validate <template|name> <data.json>` — exit 1 on issues, printing `path code message`
    - `apw-pdf templates` — lists names and descriptions

- [ ] **Step 1: Failing tests**
  - `render memo by name` → bytes start with `%PDF-`; `renderToFile` writes the file
  - `path traversal`: `imageBaseDir: tmp`, src `'../../etc/passwd'` → `IMAGE_NOT_ALLOWED`
  - `remote image blocked by default`: src `'http://169.254.169.254/x.png'` → `IMAGE_NOT_ALLOWED`; with an allowlist containing a local test-server host → loads (spin up `http.createServer` on 127.0.0.1)
  - `CLI`: running `node bin/apw-pdf.js validate memo bad.json` exits with code 1 and prints `MISSING_VARIABLE`
  - `performance`: after one warm-up render, the memo example renders in < 200 ms (median of 5); a 20-page memo in < 1500 ms. Mark these with `test.skipIf(process.env.CI_SLOW)`.
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** `feat(node): fs providers with SSRF/traversal guards, renderer, CLI`

### Task 20: `@apw-pdf/raster` and visual regression

**Files:** Create `packages/raster/src/index.ts`, `packages/templates/test/visual.test.ts`, `packages/templates/test/__golden__/*.png`. Test: `packages/raster/test/raster.test.ts`

**Interfaces:**
- Produces: `rasterizePage(pdf: Uint8Array, pageNumber: number, opts?: { dpi?: number /* default 150, max 200 */ }): Promise<Uint8Array /* PNG */>` — uses the pdfjs-dist legacy build plus `@napi-rs/canvas`; `pageNumber` out of range → `RangeError`
- Golden workflow: when `UPDATE_GOLDEN=1`, the test writes the goldens; otherwise it compares with pixelmatch (threshold 0.1) and fails if more than 0.1% of pixels differ

- [ ] **Step 1: Failing tests**
  - an A4 page at 150 dpi → PNG of 1240×1754 px
  - dpi 300 → clamped to 200
  - page 0 → RangeError
  - a visual test for each template example, page 1
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement**, then generate the goldens with `UPDATE_GOLDEN=1 pnpm -F @apw-pdf/templates exec vitest run visual`. **Open each golden PNG and check it by eye** against spec §3 (garuda placement, title, leaders, signature). Report any visual issue before committing the goldens.
- [ ] **Step 4: Run** (without `UPDATE_GOLDEN`) → PASS
- [ ] **Step 5: Commit** `test: rasterizer and visual regression goldens for templates`

## Phase E — React

### Task 21: `@apw-pdf/react`

**Files:** Create `packages/react/src/{protocol,fetch-providers,worker,provider,usePdf,PdfPreview,PdfDownloadButton,index}.ts(x)`. Test: `packages/react/test/{usePdf,components,worker}.test.tsx`

**Interfaces:**
- Consumes: `createPdfEngine`, `fontFileName`
- Produces:
  - `protocol.ts`:
    - `type RenderRequest = { id: number; doc: unknown; data: unknown; strict?: boolean }`
    - `type RenderResponse = { id: number; ok: true; bytes: Uint8Array; pageCount: number; warnings: Warning[] } | { id: number; ok: false; error: { code: string; message: string; path?: string } }`
  - `fetchFontProvider(baseUrl: string): FontProvider` — fetches `${baseUrl}/${fontFileName(...)}` and caches the promise per file
  - `fetchImageProvider(assets?: Record<string, string>): ImageProvider` — data:, same-origin, or listed assets
  - `createRenderClient(opts: { fontBaseUrl: string; wasmUrl: string; assets?: Record<string,string>; useWorker?: boolean }): { render(req: Omit<RenderRequest,'id'>): Promise<RenderResponse>; dispose(): void }` — uses a Worker (`new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })`) when available, otherwise renders on the main thread
  - `<ApwPdfProvider fontBaseUrl wasmUrl assets? worker?>`
  - `usePdf(doc, data, opts?: { debounceMs?: number /*300*/; strict?: boolean }): { status: 'idle'|'rendering'|'ready'|'error'; url?: string; bytes?: Uint8Array; pageCount?: number; warnings: Warning[]; error?: { code; message; path? } }` — revokes old object URLs; ignores stale responses by id
  - `<PdfPreview doc data scale?={1} className? />` — renders each page to a `<canvas>` with pdfjs-dist; accessible label "หน้า n จาก N"
  - `<PdfDownloadButton doc data fileName children />` — disabled while rendering

- [ ] **Step 1: Failing tests** (jsdom; mock `createRenderClient`)
  - `debounces`: 3 data changes within 100 ms → 1 render call, after 300 ms
  - `stale responses ignored`: respond out of order → state reflects the last request
  - `revokes object URLs` on new result and on unmount (spy on `URL.revokeObjectURL`)
  - `error state` carries `code` and `path`
  - `download button` triggers an anchor click with `download="memo.pdf"`, and is disabled while `rendering`
  - `worker handler`: calling the exported `handleMessage(req)` with the memo example → `ok:true` and bytes starting with `%PDF` (runs in node with fs-backed fetch stubs)
  - `fetchFontProvider` requests `/fonts/THSarabunIT9-Bold.ttf` for bold
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement.** React is a peer dependency (≥18); pdfjs-dist is a dependency, lazy-imported in `PdfPreview`.
- [ ] **Step 4: Run** `pnpm -F @apw-pdf/react exec vitest run --coverage` → PASS, lines ≥ 80%
- [ ] **Step 5: Commit** `feat(react): usePdf hook, preview, download button, worker rendering`

## Phase F — MCP

### Task 22: `@apw-pdf/mcp`

**Files:** Create `packages/mcp/src/{paths,tools,server,index}.ts`, `packages/mcp/bin/apw-pdf-mcp.js`, `packages/mcp/README.md`. Test: `packages/mcp/test/server.test.ts`

**Interfaces:**
- Consumes: `createRenderer`, `rasterizePage`, `templates`, `parseDocument`
- Produces:
  - `resolveInside(root: string, name: string): string` — rejects absolute paths, `..`, or a resolved path outside root, with `Error('PATH_NOT_ALLOWED')`; `fileName` must match `^[\w\-ก-๙. ]{1,100}\.pdf$`
  - `createServer(opts: { outputDir: string; templateDir?: string; allowRemoteImages?: string[] }): Promise<McpServer>` — registers the 7 tools and 2 resources from spec §11; tool errors return `{ isError: true, content: [{ type:'text', text: JSON.stringify({ code, message, path }) }] }`
  - `describe_schema` text comes from a `SCHEMA_GUIDE` constant: every block and inline type with one JSON example each, the filters table, and the spec §3 standards table
  - `save_template` writes `${templateDir}/${name}.json` only when `name` matches `^[a-z0-9-]{1,64}$` and `parseDocument` succeeds; `list_templates` merges builtin and saved templates
  - bin: reads `APW_PDF_OUTPUT_DIR` (required; exits 1 with a message if missing), `APW_PDF_TEMPLATE_DIR`, `APW_PDF_ALLOW_REMOTE_IMAGES` (comma-separated), then connects a `StdioServerTransport`

- [ ] **Step 1: Failing tests** — use `InMemoryTransport.createLinkedPair()` with an SDK `Client`:
  - `listTools` returns exactly `describe_schema, list_templates, get_template, validate_document, render_pdf, render_page_png, save_template`
  - `render_pdf {templateName:'memo', data: memo.example}` → a file exists inside outputDir, `pageCount: 1`
  - `render_pdf` with `fileName:'../x.pdf'` → `isError` and `PATH_NOT_ALLOWED`; no file is written outside
  - `render_page_png` → `content[0].type === 'image'`, `mimeType 'image/png'`
  - `validate_document` with missing data → `ok:false` and issues with paths
  - `save_template {name:'my-memo', template: memo.document}`, then `list_templates` includes `{name:'my-memo', source:'saved'}`; `name:'../evil'` → error
  - `readResource('apw-pdf://standards')` contains 'ขอแสดงความนับถือ' and '2.5'
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** with `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`, `registerTool(name, { description, inputSchema }, handler)` (zod raw shapes), `registerResource`, and `StdioServerTransport` from `server/stdio.js`. Check the installed SDK's README for the exact `registerTool`/`registerResource` signatures before coding.
- [ ] **Step 4: Run** `pnpm -F @apw-pdf/mcp exec vitest run --coverage` → PASS
- [ ] **Step 5: Commit** `feat(mcp): MCP server with schema guide, render, png preview, saved templates`

## Phase G — Examples and docs

### Task 23: Examples, README, full verification

**Files:** Create `examples/express-server/{package.json,server.ts}`, `examples/vite-react/{package.json,vite.config.ts,index.html,src/App.tsx}`, `README.md` (Thai + English), `packages/*/README.md`.

**Interfaces:** Consumes the public APIs of `node`, `react`, and `templates` only.

- [ ] **Step 1: Express example:** `POST /pdf/:template` with a JSON body → `application/pdf`; a 400 with `{code, path}` on ApwPdfError; and `GET /templates`.
- [ ] **Step 2: Vite React example.** A form for the memo fields, with `<PdfPreview>` live preview and `<PdfDownloadButton>`. A copy script puts the fonts and `harfbuzz-subset.wasm` in `public/`, and the Vite config sets `optimizeDeps.exclude: ['harfbuzzjs']`.
- [ ] **Step 3: README:** install steps, a quick start per environment, a template authoring guide (blocks, units, filters, anchors) with the memo as a worked example, an MCP config snippet for Claude Desktop/Code, the standards table, the known limitation (line breaks may differ from Word's dictionary in rare cases), and the line-height calibration procedure (export the same text from Word, compare baselines, adjust `metrics.ts`).
- [ ] **Step 4: Verify the whole repo:** `pnpm install && pnpm lint && pnpm build && pnpm test` → all green, and each package's coverage ≥ 80%. Run `pnpm --filter express-server start`, POST the memo example, and open the resulting PDF.
- [ ] **Step 5: Commit** `docs: examples and README for apw-pdf`
