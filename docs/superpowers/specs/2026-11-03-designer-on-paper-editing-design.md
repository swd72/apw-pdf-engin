# Designer On-Paper Editing — Design

Date: 2026-11-03
Status: Draft for user review. Scope approved in chat: items 1–5 ("ทำ 1-5 ทั้งหมด").
Builds on: `2026-11-03-designer-playground-ui-design.md` (layout, panels, properties stay).
Reference: the user's prototype `D:\Apiwat\77\New folder\gemini-code-1793433645040.html` (ThaiGov Report Designer). It renders HTML, so each section is a DOM node it can hover and click. We render a real PDF, so the engine must tell the UI where each block landed.

## Goal

Work directly on the paper: hover a block on the PDF to see its outline, click to select it, use a small floating toolbar, double-click to edit text in place. Add ready-made Thai government presets, undo/redo and a margin-guides toggle.

## What we take from the prototype, and what we do not

- **Take:** dashed hover outline with a type badge (`.cr-section`), selected outline, floating tools on the selected section, in-place text editing, preset sections (memo header, external letter header, two-sided approval, items table with total), undo/redo, guides toggle, click on empty canvas clears the selection.
- **Do not take:** HTML rendering of the document (fonts drift from print, the problem this engine exists to solve), its canvas-measured Thai distributed algorithm (the engine's `thaiDistributed` is exact), `file:///` font paths, a toolbar full of controls.

## 1. Engine: block boxes

Facts found in the code:
- Every `glyphs` layout item already carries `sourcePath` (`packages/core/src/layout/tree.ts`), e.g. `blocks[3]`, `blocks[2].columns[0].blocks[1]`, table cell paths. Coordinates are PDF points, origin top-left of the page (memo test: garuda at y = 42.5197).
- Top-level fragments carry `path` and `height` and are placed at a `yTop` during pagination (`layout/flow.ts`).
- **Gap 1:** `bind` flattens `each` and `if` before layout, so layout paths index the *resolved* list, not the source document (`bind/bind.ts`). Fix: `bind` records the source path on every resolved block (e.g. `blocks[1].blocks[0]` for a block inside an `each` at `blocks[1]`); layout uses it when present. Blocks repeated by a loop produce several boxes with the same source path.
- **Gap 2:** `renderPdf` returns only bytes, page count and warnings.

Change:
- New type in `@apw-pdf/core`: `BlockBox { path: string; x: number; y: number; w: number; h: number }` (points, top-left origin), `path` is the **source** path.
- `LayoutPage` gains `boxes: BlockBox[]` and `content: { x, y, w, h }` (the page content box from margins).
- Boxes come from two places: (a) every top-level fragment piece placed on a page (`x = content left`, `w = content width`, `y = yTop`, `h = height`; a fragment split across pages yields one box per page), which covers spacers, lines, images, tables and columns; (b) nested blocks (columns children, table cell blocks, signature lines) get the union of their glyph runs' rectangles, using the run's font size for ascent/descent. Text paths such as `.text` or `.runs[2]` are trimmed to the owning block path.
- `renderPdf(doc, data, { boxes: true })` returns `boxes: BlockBox[][]` (one array per page) and `content` per page. Off by default so existing callers pay nothing.
- `@apw-pdf/react`: the worker passes `boxes: true` when the request asks for it; `RenderResponse` gains optional `pages?: { boxes: BlockBox[]; content: Box }[]`; `PdfPreview` gets an optional `renderOverlay?(pageIndex: number, scale: number, page: PageInfo) => ReactNode` drawn in a positioned layer exactly over each page canvas. No behaviour change when the prop is absent.

## 2. Select on paper

- Overlay layer per page: one transparent hit box per `BlockBox`, scaled by the current zoom. Nested boxes sit above their parents, so a click picks the innermost block.
- **Hover:** 1px dashed outline + small badge above the box with the block's Thai label (from `blockMeta`). **Selected:** 1.5px solid accent outline, faint tint. All instances of a looped block highlight together.
- **Click** a box → `select(path)`; the outline tree and the Properties panel follow. **Click** empty paper or canvas → `select(null)` (document settings). Selecting in the outline scrolls the PDF so the first box of that block is visible.
- Source path strings convert to the designer's `BlockPath` (`['blocks', 2, 'columns', 0, 'blocks', 1]`) through one tested helper `parseSourcePath`.
- While a new render is in flight the overlay keeps the last good boxes, matching the last-good preview.

## 3. Floating toolbar

Appears above the selected box (flips below when there is no room, stays inside the stage): **Move up, Move down, Duplicate, Delete**, and `⋯` (Move into previous, Move out, Edit JSON). Same `aria-label`s and actions as the outline row menu; no new logic. Hidden while dragging or inline editing.

## 4. Edit text in place

- **Double-click** a paragraph box, or press **Enter** with a paragraph selected → a textarea opens over the box (its position and width, font size scaled to the zoom) holding the raw template text including `{{ }}` tokens.
- **Ctrl+Enter** or clicking outside commits via `updateBlock(path, { text })`; **Esc** cancels. Plain Enter inserts a newline.
- Table cells whose content is plain text edit the same way (double-click the cell's box). Paragraphs that use `runs`, and all other block types, focus the first field in the Properties panel instead.
- A `{ }` button on the textarea opens the existing variable picker.

## 5a. Presets

The **+ เพิ่ม** menu gains a group **สำเร็จรูป** whose items insert a block group built only from existing schema blocks, using the builtin `memo` and `external-letter` templates in `packages/templates` as the source of layout values:

- **หัวบันทึกข้อความ:** garuda (`asset:garuda`) + title "บันทึกข้อความ" + ส่วนราชการ / ที่ / วันที่ / เรื่อง / เรียน lines.
- **หัวหนังสือภายนอก:** centred garuda, ที่, office address on the right, date, เรื่อง, เรียน, สิ่งที่ส่งมาด้วย.
- **บล็อกอนุมัติ 2 ฝั่ง:** two columns, each with a comment line and a signature.
- **ตารางรายการพร้อมยอดรวม:** table with rows from `items` (ลำดับ, รายการ, จำนวน, ราคา/หน่วย, จำนวนเงิน) and a footer total using the `baht` filter.

Each preset lists the data keys it uses; inserting it adds missing keys with sample values to the data (never overwrites existing values). Every preset passes `parseDocument`.

## 5b. Undo / redo

- `useEditorState` keeps a history of `{ doc, data }` snapshots (limit 100). Consecutive `updateBlock` calls on the same path within 600 ms merge into one step, so typing a word is one undo.
- **Ctrl+Z** undo, **Ctrl+Shift+Z** / **Ctrl+Y** redo, when focus is not inside a text field (text fields keep their native undo). Two icon buttons in the top bar, disabled when unavailable.
- History resets when another template is opened. Undo restores the selection only if the path still exists.

## 5c. Margin guides

A toggle in the PDF stage toolbar draws the page content box as a dashed rectangle on the overlay (from `content`). Default on; persisted in `localStorage` (try/catch). Guides never appear in the downloaded PDF because they live only in the overlay.

## Unchanged

PDF output bytes (boxes are metadata), the saved template format, JSON mode, panels, properties, outline, data and templates views.

## Success criteria

1. Clicking any visible text, table, image, line or spacer on the PDF selects the matching block in the outline and Properties, including blocks inside `columns`, table cells and `each` loops.
2. Hover shows the outline and Thai badge; the floating toolbar moves, duplicates and deletes the selected block.
3. Double-click a paragraph, type, Ctrl+Enter: the preview shows the new text; Esc leaves it unchanged.
4. Each preset inserts schema-valid blocks and renders without unresolved-variable warnings.
5. Ctrl+Z undoes a typed word in one step; redo restores it.
6. Guides toggle shows/hides the content box and survives reload.
7. Existing tests stay green; new tests cover boxes (top-level, split across pages, `each` source paths, columns, table cells), `parseSourcePath`, overlay hit-testing and selection, toolbar actions, inline edit commit/cancel, presets validity, history merge and limits, guides persistence.
8. Browser check at 1440px and 1024px: boxes line up with the rendered text at 50%, 100% and 150% zoom.

## Non-goals

Dragging blocks on the paper to reposition them (the document is flow layout), resizing boxes by handles, per-character rich-text editing, multi-select, dark theme.
