# Designer On-Paper Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user select, edit and manipulate blocks directly on the rendered PDF, plus presets, undo/redo and margin guides.

**Architecture:** The core engine reports where each source block landed (`BlockBox` per page, opt-in). `@apw-pdf/react` carries those boxes through the worker and lets `PdfPreview` draw an overlay over each page canvas. The designer draws hover/selection, a floating toolbar and an inline text editor on that overlay, and drives the existing `EditorState`.

**Tech Stack:** TypeScript, pnpm monorepo, React 19, vitest + jsdom (no jest-dom), pdfjs-dist.

**Spec:** `docs/superpowers/specs/2026-11-03-designer-on-paper-editing-design.md`

## Global Constraints

- Code, tests and config are written by agy (`gemini-4-argon-high`, mode `accept-edits`, never `-SkipPermissions`). agy cannot run shell commands; Claude runs tests, builds and commits after review.
- Run tests per file with a kill timer: `Start-Process node ../../node_modules/vitest/vitest.mjs run <file> --testTimeout=5000` + `WaitForExit` + `Kill()`; pnpm via `npx pnpm@9`.
- After changing `packages/core`, `packages/pdf` or `packages/react` source, rebuild them (`npx pnpm@9 --filter <pkg> build`) before testing the designer: the designer consumes `dist`.
- React rules: no fresh object/array/function literal as a prop or hook dependency that an effect depends on; no unconditional `setState` in `useEffect`; every `localStorage` access in try/catch; `ResizeObserver`/`MutationObserver` guarded for jsdom.
- Tests use plain vitest assertions (no jest-dom) and call `cleanup()` in `afterEach`.
- PDF bytes must not change because of this work: boxes are metadata only and off unless requested.
- UI text in Thai; code, comments and docs in English. Existing `aria-label`s (`Move up`, `Move down`, `Move into previous`, `Move out`, `Duplicate`, `Delete`, `Edit JSON`) are reused for the same actions.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Block inside `each` inside `columns`: its boxes must carry the source path (`blocks[i].blocks[0]` / `...columns[c].blocks[b]`), not resolved indices; clicking any instance selects the one source block.
2. Paragraph split across two pages: one box per page, both with the same path; no box spans the page gap.
3. Zoom change or re-render while hovering/editing: overlay must re-scale and never show boxes from a different document than the visible canvas (keep last good pair together).
4. Typing in the inline editor or a Properties field must not trigger the global Ctrl+Z handler, and must not create one history step per keystroke.
5. Preset insertion into a document that already has data keys with the same names: existing values stay untouched.

Each line has a test in the owning task (Tasks 1, 1, 3, 6, 7).

---

### Task 1: Core block boxes

**Files:**
- Modify: `packages/core/src/bind/bind.ts` (record source path), `packages/core/src/layout/tree.ts` (types), `packages/core/src/layout/flow.ts` (use source path, fragment boxes, anchored boxes, content box), `packages/core/src/layout/columns.ts:45` and `packages/core/src/layout/table.ts:274` (child source path), `packages/core/src/engine.ts` (layout option), `packages/core/src/index.ts` (exports), `packages/pdf/src/engine.ts` (`renderPdf` option/result)
- Create: `packages/core/src/layout/boxes.ts`
- Test: `packages/core/test/boxes.test.ts`, `packages/pdf/test/boxes.test.ts`

**Interfaces:**
- Produces (exported from `@apw-pdf/core`):
  - `interface Rect { x: number; y: number; w: number; h: number }` (points, origin top-left of page)
  - `interface BlockBox extends Rect { path: string }` (source path)
  - `interface PageInfo { width: number; height: number; content: Rect; boxes: BlockBox[] }`
  - `LayoutPage` gains `content: Rect` and `boxes: BlockBox[]` (always filled by `layout`; cheap)
  - `function blockKeyOf(sourcePath: string): string | null`
- Produces (`@apw-pdf/pdf`): `renderPdf(doc, data, { strict?, boxes?: boolean })` result gains `pages?: PageInfo[]`, present only when `boxes: true`.

- [ ] **Step 1: Write failing tests** in `packages/core/test/boxes.test.ts` using the engine test helpers already used by `packages/core/test/engine.test.ts`:
  - `top-level paragraph gets one box at content left/width` — doc with one paragraph; `pages[0].boxes` contains `{ path: 'blocks[0]' }` with `x === content.x`, `w === content.w`, `h > 0`.
  - `content box matches page margins` — doc `page.margin` `{top:'2.5cm', left:'3cm', right:'2cm', bottom:'2cm'}`: `content.x ≈ 85.04`, `content.y ≈ 70.87`, `content.w ≈ 595.28 - 85.04 - 56.69` (±0.01).
  - `blocks inside each keep the source path` — `blocks: [{type:'paragraph',text:'a'}, {type:'each', of:'xs', as:'x', blocks:[{type:'paragraph', text:'{{x}}'}]}]`, data `{xs:['1','2','3']}` → three boxes with `path === 'blocks[1].blocks[0]'` and none with `blocks[2]`/`blocks[3]`.
  - `if branches use then/else paths` — `if` true → box path `blocks[0].then[0]`; false with else → `blocks[0].else[0]`.
  - `nested column blocks get their own box inside the parent` — columns with two paragraphs → boxes `blocks[0]` plus `blocks[0].columns[0].blocks[0]` and `blocks[0].columns[1].blocks[0]`, each inside the parent box and left of/right of each other.
  - `each inside columns keeps source path` — columns col 0 `[each over xs → paragraph]` → boxes path `blocks[0].columns[0].blocks[0].blocks[0]`, one per item, not merged into one (distinct `y`).
  - `paragraph split across pages yields one box per page` — long paragraph forcing a split: box with `path 'blocks[0]'` on page 0 and page 1; each box lies within its page content area.
  - `table cells get cell boxes` — table with header row and one body row → boxes `blocks[0].header[0][0]`, `blocks[0].rows[0][1]`.
  - `anchored image gets a box` — memo-style anchored image → box `blocks[0]` with the image item's rect.
  - `blockKeyOf` table: `'blocks[2].text'→'blocks[2]'`, `'blocks[2].runs[1]'→'blocks[2]'`, `'blocks[0].columns[1].blocks[0].runs[0]'→'blocks[0].columns[1].blocks[0]'`, `'blocks[3].rows[0][1]'→'blocks[3].rows[0][1]'`, `'blocks[3].rows[0][1].blocks[0].text'→'blocks[3].rows[0][1].blocks[0]'`, `'blocks[1].then[0].positions[0]'→'blocks[1].then[0]'`, `'pageNumber'→null`.
- [ ] **Step 2: Run** `node ../../node_modules/vitest/vitest.mjs run test/boxes.test.ts` in `packages/core`. Expected: FAIL (no `boxes` / `blockKeyOf`).
- [ ] **Step 3: Implement.**
  - `bind.ts`: every resolved block produced by `bindBlocks` gets `$src: string` set to its source path (`path` variable in the loop, e.g. `blocks[1].blocks[0]`). Add `$src?: string` to the resolved block types. `parseDocument`/validation input is untouched.
  - Layout uses `block.$src ?? <computed path>` wherever it currently builds a block path: `flow.ts:612`, `columns.ts:45`, `table.ts:274`. Glyph `sourcePath` then follows automatically.
  - `boxes.ts`:
    - `blockKeyOf(p)`: return the longest prefix matching `^blocks\[\d+\](?:\.(?:blocks|then|else)\[\d+\]|\.columns\[\d+\]\.blocks\[\d+\]|\.(?:rows|header|footer)\[\d+\]\[\d+\](?:\.blocks\[\d+\])?)*`; `null` when no match.
    - `glyphBoxes(items: LayoutItem[]): BlockBox[]`: for each `glyphs` item with `blockKeyOf(sourcePath) !== null`, rect `x = item.x`, `w = Σ advance`, `y = item.y - 0.8 * size`, `h = 1.05 * size`. Walk items in order; keep `open: Map<key, BlockBox>`; merge into the open box for that key when the new rect's top ≤ open bottom + `0.6 * size` and it is not above the open top; otherwise push a new box and make it the open one.
  - `flow.ts` `flushCurrentPage`: `boxes` = for each page entry `{ path: entry.frag.path, x: ctx.box.contentLeft, y: entry.yTop, w: ctx.box.contentWidth, h: entry.frag.height }` + for each anchored item that is an `image`/`rect` the item's rect with its block path (carry the path on the `anchored` step) + `glyphBoxes(items)` for keys that are not already a top-level fragment path on this page. `content = { x: contentLeft, y: margin.top, w: contentWidth, h: height - margin.top - margin.bottom }`.
  - `packages/pdf/src/engine.ts`: when `renderOpts.boxes`, return `pages: tree.pages.map(p => ({ width, height, content, boxes }))`.
- [ ] **Step 4: Add** `packages/pdf/test/boxes.test.ts`: `renderPdf(..., { boxes: true })` returns `pages.length === pageCount` with boxes; `renderPdf` without the flag has `pages === undefined`; bytes with and without `boxes` are identical (`Buffer.compare === 0`).
- [ ] **Step 5: Run** core and pdf suites: `npx pnpm@9 --filter @apw-pdf/core test` and `--filter @apw-pdf/pdf test`. Expected: all PASS, including existing memo/external-letter position tests (proves bytes/layout unchanged).
- [ ] **Step 6: Commit** `feat(core): report source block boxes per page`.

### Task 2: React transport and overlay slot

**Files:**
- Modify: `packages/react/src/protocol.ts`, `worker.ts`, `usePdf.ts`, `PdfPreview.tsx`, `index.ts`
- Test: `packages/react/test/overlay.test.tsx`

**Interfaces:**
- Consumes: `PageInfo` from Task 1.
- Produces:
  - `RenderRequest.boxes?: boolean`; success `RenderResponse.pages?: PageInfo[]`.
  - `UsePdfOptions.boxes?: boolean`; `UsePdfState.pages?: PageInfo[]` (kept from the last success on error, like `bytes`).
  - `PdfPreviewProps.renderOverlay?: (pageIndex: number, scale: number, page: PageInfo) => React.ReactNode` and `PdfPreviewProps.onPagesChange?: (pages: PageInfo[]) => void`.
  - When `renderOverlay` is set: each canvas is wrapped in `<div class="apw-pdf-page" data-page-index={i} style="position:relative">` with the overlay in `<div class="apw-pdf-page__overlay" style="position:absolute; inset:0">`. Without it the DOM is exactly as today.

- [ ] **Step 1: Write failing tests** with a fake `RenderClient` (pattern of `packages/react/test/usePdf.test.tsx`):
  - `requests boxes only when renderOverlay is given` — spy on `client.render`; with overlay `req.boxes === true`, without `undefined`.
  - `renders overlay once per page with the scale` — fake response 2 pages; `renderOverlay` mock called with `(0, 1.5, pages[0])` and `(1, 1.5, pages[1])`; two `.apw-pdf-page__overlay` nodes exist.
  - `no wrapper without renderOverlay` — `container.querySelector('.apw-pdf-page') === null`.
  - `keeps last pages on error` — success then error response → overlay still receives the first pages.
  - `worker passes boxes to renderPdf` — `handleMessage({ ..., boxes: true })` with a mocked engine returns `pages`.
- [ ] **Step 2: Run** `node ../../node_modules/vitest/vitest.mjs run test/overlay.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** as in Interfaces. `onPagesChange` fires from an effect keyed on the `pages` reference (ref-stored callback like `onPageCountRef`).
- [ ] **Step 4: Run** react suite incl. `PdfPreview.race.test.tsx`. Expected: PASS. Build `@apw-pdf/core`, `@apw-pdf/pdf`, `@apw-pdf/react`.
- [ ] **Step 5: Commit** `feat(react): carry block boxes and add page overlay slot`.

### Task 3: Select on paper + margin guides

**Files:**
- Create: `apps/designer/src/components/stage/sourcePath.ts`, `overlayGeometry.ts`, `StageOverlay.tsx`, `stage.overlay.test.tsx`, `sourcePath.test.ts`
- Modify: `apps/designer/src/components/PreviewPane.tsx` (`PreviewPages` forwards `renderOverlay`/`onPagesChange`), `stage/PdfStage.tsx`, `VisualEditor.tsx` (pass `editor={state}`, `onEditJson`), `src/ui/ui.css`

**Interfaces:**
- Consumes: `PageInfo`, `BlockBox` (Task 1); `renderOverlay`, `onPagesChange` (Task 2); `EditorState`, `getBlock`, `BlockPath`, `blockMeta`.
- Produces:
  - `parseSourcePath(s: string): BlockPath` — `'blocks[2].columns[0].blocks[1]'` → `['blocks',2,'columns',0,'blocks',1]`; `'blocks[3].rows[0][1]'` → `['blocks',3,'rows',0,1]`.
  - `resolveSelection(doc: DocumentDef, sourcePath: string): { blockPath: BlockPath; cellPath?: BlockPath } | null` — `blockPath` = longest prefix of the parsed path for which `getBlock` returns a block; `cellPath` = prefix ending at a `rows|header|footer` cell index when that cell exists in the source doc and the remainder has no deeper block.
  - `pathKey(p: BlockPath): string` (`p.join('.')`).
  - `scaleRect(r: Rect, scale: number): Rect`; `hitOrder(boxes: BlockBox[]): BlockBox[]` (largest area first so smaller boxes render on top).
  - `PdfStageProps` gains `editor?: EditorState`, `onEditJson?(path: BlockPath): void`.
  - Stage localStorage key `apw-designer-guides` (`'1'|'0'`, default on).

- [ ] **Step 1: Write failing tests.** `sourcePath.test.ts`: parse cases above; `resolveSelection` for paragraph text path, nested columns path, `each` child path (`blocks[1].blocks[0]` → that path), table cell path giving `cellPath`, table with `rows: {each,...}` falling back to the table (no `cellPath`), unknown path → `null`.
  `stage.overlay.test.tsx` (render `StageOverlay` directly with fixed `PageInfo` and a stub editor built from `useEditorState` in a harness):
  - `hover shows outline and Thai badge` — mouseenter on box `blocks[0]` (paragraph) → element with class `stage-box--hover` and text `ข้อความ`.
  - `click selects block` — click box → `editor.selectedPath` equals `['blocks',0]`; box gets `stage-box--selected`.
  - `looped block highlights all instances` — two boxes with same path; after click both `stage-box--selected`.
  - `click on empty overlay clears selection` — click overlay background → `selectedPath === null`.
  - `boxes scale with zoom` — scale 2: box style `left` = `2*x`px, `width` = `2*w`px.
  - `guides toggle shows content rect and persists` — toggle button `aria-label="เส้นขอบกระดาษ"` in the stage toolbar; off → no `.stage-guides`; remount reads `localStorage` → still off.
  - `overlay waits for matching pages` (Review Focus 3) — PdfStage with a fake client: after doc change and before the new response, overlay still renders the previous `pages` with the previous canvas count; never `pages` from a response whose page count differs from rendered canvases.
- [ ] **Step 2: Run** both files. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `StageOverlay({ pageIndex, scale, page, editor, showGuides })`: absolutely positioned buttons-less `div`s per box (`role="button"`, `aria-label` = Thai label from `blockMeta`, `tabIndex={-1}`) in `hitOrder`; hover state local; selected when `pathKey(resolveSelection(...).blockPath) === pathKey(editor.selectedPath)`; click calls `editor.select(blockPath)` and `stopPropagation`; overlay background click → `editor.select(null)`; guides `div.stage-guides` from `page.content` dashed.
  - `PdfStage`: holds `pages` from `onPagesChange`; passes a stable `renderOverlay` (`useCallback`) only when `editor` is given; when `editor.selectedPath` changes from outside the overlay, scroll the first matching box into view (`scrollRef` + page wrapper `offsetTop` + scaled `y`). `handleScroll` uses `.apw-pdf-page` wrappers when present, else canvases.
  - CSS: hover 1px dashed `var(--accent)`, selected 1.5px solid + 7% tint, badge above top-left; all inside `ui.css`.
- [ ] **Step 4: Run** the new files and the existing stage/visual tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(designer): select blocks on the PDF with hover outline and guides`.

### Task 4: Floating toolbar

**Files:**
- Create: `apps/designer/src/components/stage/FloatingToolbar.tsx`, `floatingToolbar.test.tsx`
- Modify: `stage/StageOverlay.tsx`, `stage/overlayGeometry.ts`

**Interfaces:**
- Consumes: `EditorState` (`moveSelected`, `duplicateSelected`, `removeSelected`, `moveSelectedInto`, `moveSelectedOut`, `canMoveInto` from docModel), `onEditJson`.
- Produces: `toolbarPlacement(box: Rect, toolbar: { w: number; h: number }, stage: { w: number; h: number }): { x: number; y: number; placement: 'above' | 'below' }` — above when `box.y - h - 4 ≥ 0`, else below; `x` clamped to `[0, stage.w - toolbar.w]`.

- [ ] **Step 1: Write failing tests:** placement above / flipped below at top edge / clamped at right edge; clicking `Move up`, `Move down`, `Duplicate`, `Delete` calls the editor and keeps selection as the editor defines; `⋯` menu holds `Move into previous` (disabled when `canMoveInto` is false), `Move out`, `Edit JSON` (calls `onEditJson(path)`); toolbar renders only on the first box of the selected block, and not while inline editing.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** with `IconButton` and `Menu` from `src/ui`, same icons as `OutlineRow`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(designer): floating block toolbar on the PDF`.

### Task 5: Inline text editor

**Files:**
- Create: `apps/designer/src/components/stage/InlineTextEditor.tsx`, `inlineEditor.test.tsx`
- Modify: `stage/StageOverlay.tsx`, `VisualEditor.tsx` (focus-first-property callback reused for non-text blocks)

**Interfaces:**
- Consumes: `resolveSelection` (Task 3), `EditorState.updateBlock`, `EditorState.replaceBlock`, `VariablePicker` from `components/properties`.
- Produces: `editTarget(doc, sel): { kind: 'paragraph'; path: BlockPath; text: string } | { kind: 'cell'; tablePath: BlockPath; cellPath: BlockPath; text: string } | null` — `paragraph` only when the block has `text` and no `runs`; `cell` only when the cell is `{ text }` (no `blocks`/`runs`); else `null`.
- Cell commit writes the new text into that cell via `replaceBlock(tablePath, nextTable)`.

- [ ] **Step 1: Write failing tests:** double-click paragraph box opens a `textarea` (`aria-label="แก้ไขข้อความ"`) with raw `{{ }}` text, positioned at the scaled box, font size `= block size or doc.font.size` × scale (px from pt); Ctrl+Enter commits via `updateBlock`; blur commits; Esc cancels (doc unchanged); plain Enter inserts newline; Enter with a paragraph selected (focus on overlay) opens the editor; double-click on a `runs` paragraph or an image calls `onFocusProperties` instead; table text cell edit updates only that cell; `{ }` button opens the variable picker and inserts `{{path}}` at the caret.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Autofocus with `preventScroll`; textarea width = box width, min-height = box height; editing state lives in `StageOverlay`; toolbar hidden while editing.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(designer): edit paragraph and cell text in place on the PDF`.

### Task 6: Undo / redo

**Files:**
- Modify: `apps/designer/src/editor/useEditorState.ts`, `stage/PdfStage.tsx` (two buttons), `VisualEditor.tsx` (keyboard)
- Create: `apps/designer/src/editor/history.ts`, `history.test.ts`, `src/editor/undo.test.tsx`

**Interfaces:**
- Produces:
  - `history.ts`: `interface Snapshot { doc: DocumentDef; data: unknown }`; `createHistory(limit = 100)` returning `{ push(prev: Snapshot, mergeKey?: string, now?: number): void; undo(current: Snapshot): Snapshot | null; redo(current: Snapshot): Snapshot | null; reset(): void; canUndo(): boolean; canRedo(): boolean }`. `push` skips adding when `mergeKey` equals the last key and `now - lastTime < 600`; any push clears redo; size capped at `limit` (drop oldest).
  - `EditorState` gains `undo(): void; redo(): void; canUndo: boolean; canRedo: boolean`.
  - Every mutating method records history through one internal `commit(nextDoc, nextData, mergeKey?)`; `updateBlock`/`replaceBlock` use `mergeKey = 'block:' + path.join('.')`; `setData` uses `'data'`. Template resync (the `initial` effect) calls `reset()`.
  - Undo/redo restore `selectedPath` only if `getBlock(restored.doc, selectedPath)` exists, else `null`.
  - Keys (window listener in `VisualEditor`): Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z and Ctrl+Y redo; ignored when `event.target` is `input`, `textarea`, `select` or `[contenteditable]`.
  - Stage toolbar buttons `aria-label="ย้อนกลับ"` / `"ทำซ้ำ"`, disabled per `canUndo`/`canRedo`.

- [ ] **Step 1: Write failing tests:** `history.test.ts` — merge within 600 ms, no merge after 600 ms or different key, redo cleared by push, limit 100 drops oldest, undo on empty returns null. `undo.test.tsx` — five rapid `updateBlock` on the same path then `undo()` restores the original text in one step; `redo()` re-applies; Ctrl+Z on `document.body` undoes; Ctrl+Z dispatched on a focused `textarea` does nothing (Review Focus 4); selection cleared when the undone doc no longer has the block; template switch resets `canUndo` to false.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** History object in a `useRef`; `canUndo`/`canRedo` mirrored into state after each commit/undo/redo.
- [ ] **Step 4: Run** new files plus all existing `editor/*` and `outline` tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(designer): undo and redo with typing merge`.

### Task 7: Presets

**Files:**
- Create: `apps/designer/src/editor/presets.ts`, `presets.test.ts`
- Modify: `apps/designer/src/editor/useEditorState.ts` (`insertBlocks`), `components/outline/QuickAdd.tsx` (group), `components/outline/OutlineTree.tsx` (wire)

**Interfaces:**
- Consumes: `memo` and `externalLetter` (actual export names in `packages/templates/src/index.ts`) document blocks and examples; `commit` from Task 6.
- Produces:
  - `interface PresetDescriptor { id: 'memoHeader' | 'externalHeader' | 'approvalTwoSides' | 'itemsTable'; label: string; create(): Block[]; sampleData: Record<string, unknown> }`; `PRESETS: PresetDescriptor[]`.
  - Labels: `หัวบันทึกข้อความ`, `หัวหนังสือภายนอก`, `บล็อกอนุมัติ 2 ฝั่ง`, `ตารางรายการพร้อมยอดรวม`.
  - `memoHeader.create()` = deep copy of memo document blocks from the garuda image through the `เรียน` paragraph; `externalHeader.create()` = deep copy of the external-letter header blocks up to and including `เรียน` / `สิ่งที่ส่งมาด้วย`; sample data = the matching keys from each template's `example`.
  - `approvalTwoSides`: `columns` with two `*` columns, each `[paragraph '{{left.comment}}' | '{{right.comment}}', signature name '{{left.name}}' / '{{right.name}}', positions ['{{left.position}}'] / ['{{right.position}}']]`; sample data `left`/`right` objects with Thai sample values.
  - `itemsTable`: table, columns `[auto, *, auto, auto, auto]` (use valid `ColumnWidthSpec` values from `schema.ts`), header `ลำดับ | รายการ | จำนวน | ราคา/หน่วย | จำนวนเงิน`, `rows: { each: 'items', as: 'item', cells: ['{{item.no}}', '{{item.name}}', '{{item.qty}}', '{{item.price | number}}', '{{item.amount | number}}'] }` (the engine has no arithmetic in `{{ }}`, so the row number and amount come from data), footer row `รวมเป็นเงินทั้งสิ้น ({{total | baht}})` spanning 4 columns if the schema supports `colSpan`, else empty cells, and `{{total | number}}`; sample `items` (3 rows with `no`, `name`, `qty`, `price`, `amount`) and `total` consistent with the sum.
  - `mergeSampleData(data: unknown, sample: Record<string, unknown>): unknown` — deep merge adding only missing keys; never overwrites; non-object `data` becomes `{...sample}`.
  - `EditorState.insertBlocks(listPath: BlockPath, index: number, blocks: Block[], sampleData?: Record<string, unknown>): void` — one history step; selects the first inserted block.
  - `QuickAddProps` gains `onInsertPreset?(id: PresetDescriptor['id']): void`; group heading `สำเร็จรูป` after the basic/advanced groups; filtering by query applies to preset labels too.

- [ ] **Step 1: Write failing tests:** each preset's blocks inside `{ version: 1, blocks }` (plus `assets` for garuda presets) pass `parseDocument`; rendering each preset with its `sampleData` via `unresolved(doc, data)` returns no warnings; `mergeSampleData` keeps an existing `items` array and existing nested `left.name` (Review Focus 5); `insertBlocks` inserts all blocks at the index, adds sample keys, and one `undo()` removes both blocks and keys; QuickAdd shows `สำเร็จรูป` and calls `onInsertPreset('itemsTable')`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Deep copy with `structuredClone`.
- [ ] **Step 4: Run** presets, outline and editor tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(designer): Thai government presets`.

### Task 8: Verification and docs

**Files:**
- Modify: `README.md` (Template Designer section: playground layout, on-paper editing, shortcuts Enter / Ctrl+Enter / Esc / Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, presets, guides)

- [ ] **Step 1:** `npx pnpm@9 test` at the root. Expected: all packages PASS.
- [ ] **Step 2:** `npx pnpm@9 --filter designer build`. Expected: success.
- [ ] **Step 3: Browser check** on http://localhost:5180 at 1440px and 1024px (Claude): open `memo`; at 50%, 100%, 150% zoom the hover outline sits on the text; click `เรียน` line selects it in outline and Properties; click a body paragraph from the `each` loop selects the loop's paragraph and highlights both instances; toolbar Move down / Duplicate / Delete work; double-click edit + Ctrl+Enter updates the preview, Esc cancels; insert each preset; Ctrl+Z after typing a word undoes the word; guides toggle survives reload; no horizontal page scroll.
- [ ] **Step 4: Commit** `docs(designer): on-paper editing usage`.
