# Designer Playground UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (the controller dispatches coding to agy). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rebuild the designer screen as a resizable 3-panel playground: outline/data/templates left, PDF centre, properties right.

**Architecture:** Keep logic modules and the UI kit. Add a workspace layout (`SplitWorkspace`), a PDF stage, an outline tree, a data tree and a properties panel with progressive disclosure; rebuild `App`/`VisualEditor` on top; delete the replaced components.

**Tech Stack:** TypeScript, React 19, plain CSS variables, vitest + jsdom. No new dependencies (native DnD, `ResizeObserver` with a guard for jsdom).

**Spec:** `docs/superpowers/specs/2026-11-03-designer-playground-ui-design.md`

## Global Constraints

- Logic modules (`editor/*`, `lib/editorSync.ts`, `lib/api.ts`, `lib/validate.ts`) keep their exports; additions only.
- Keep `aria-label`s: `Move up`, `Move down`, `Move into previous`, `Move out`, `Duplicate`, `Delete` (on `⋯` menu items and keyboard-reachable controls).
- No jest-dom matchers; plain vitest assertions. Every component test file imports `afterEach` and calls `cleanup()`. Stub `ResizeObserver`/`DataTransfer` in tests where needed.
- Never pass fresh object/array/function literals as props or hook inputs where an effect depends on them; no unconditional state set in `useEffect`. Typing must not recreate the render worker (keep `PreviewPane` props stable).
- All colours/spacing/radii/fonts from `src/ui/tokens.css`; no hard-coded colours in components. Light theme only.
- `localStorage` access always inside try/catch with a working fallback.
- Style: no semicolons, single quotes, 2-space indent, `.js` suffix on relative imports; Thai UI copy (technical words such as JSON, Save stay English).
- agy runs on `gemini-4-argon-high`; agy cannot run shell commands; the controller runs tests, builds, browser checks and commits.

## Review Focus

- Dragging a splitter past the minimum width clamps; collapsing a side and reloading keeps it collapsed; unavailable `localStorage` still works.
- At 1024px the three panes fit with no horizontal scroll; at 900px side panels are collapsed to icons.
- Dropping an outline row into its own descendant is ignored; drag while a property field is focused does not lose typed text.
- Optional properties not set are hidden; adding one via "+ เพิ่มคุณสมบัติ" shows it, removing/reset hides it again, and the saved document never gains empty/default keys.
- Table with `each` over an empty array: grid editor opens and is usable.
- Unknown block type shows a read-only JSON row/properties with "Edit JSON".
- Fit-width zoom recomputes on pane resize and never yields 0 or NaN.

---

## Round 1 — Workspace and PDF stage

### Task 1: `SplitWorkspace` and sizing helpers

**Files:**
- Create: `apps/designer/src/ui/panelSizing.ts`, `apps/designer/src/ui/SplitWorkspace.tsx`
- Modify: `apps/designer/src/ui/ui.css` (workspace/splitter styles)
- Test: `apps/designer/src/ui/panelSizing.test.ts`, `apps/designer/src/ui/SplitWorkspace.test.tsx`

**Interfaces:**
- Produces:
  - `interface PanelState { left: number; right: number; leftCollapsed: boolean; rightCollapsed: boolean }`
  - `clampPanels(state: PanelState, containerWidth: number, limits?: { side: number; centre: number; collapsed: number }): PanelState` (defaults: side min 220, centre min 360, collapsed rail 44; ensures `left + right + centre ≤ container`; shrinks the dragged side first)
  - `defaultPanels(containerWidth: number): PanelState` (sides collapsed when `containerWidth < 1100`)
  - `loadPanels(key: string): PanelState | null` / `savePanels(key: string, s: PanelState): void` (try/catch, validates shape/numbers)
  - `SplitWorkspace(props: { storageKey: string; left: ReactNode; centre: ReactNode; right: ReactNode; leftRail?: ReactNode; rightRail?: ReactNode })` — three panes with two splitters (`role="separator"`, `aria-orientation="vertical"`, focusable, Left/Right arrows move 16px, Shift 64px, double-click or Enter toggles collapse); collapsed panes render the optional rail node (icons) at 44px; measures its own width with `ResizeObserver` (guarded when undefined) and re-clamps.

- [ ] **Step 1: Write failing tests**: `clampPanels keeps the centre at least 360px`; `clampPanels shrinks a side that exceeds the container`; `clampPanels leaves valid state untouched`; `defaultPanels collapses sides below 1100px`; `loadPanels returns null for corrupt data and survives storage errors`; `savePanels survives storage errors`; `SplitWorkspace arrow keys on a splitter resize the left pane`; `SplitWorkspace double click collapses and restores a side`; `SplitWorkspace restores saved sizes from storage`; `SplitWorkspace renders the rail when collapsed`.
- [ ] **Step 2: Run** `npx pnpm@9 --filter designer test` → FAIL.
- [ ] **Step 3: Implement** (pointer drag with `pointerdown`/`pointermove`/`pointerup` on the splitter; keep widths in state, persist on drag end).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(designer): resizable split workspace`

### Task 2: PDF stage

**Files:**
- Create: `apps/designer/src/components/stage/PdfStage.tsx`, `apps/designer/src/components/stage/zoom.ts`
- Modify: `apps/designer/src/components/PreviewPane.tsx` (accept `scale` and expose the rendered pages area; keep `lastGood` behaviour), `packages/react/src/PdfPreview.tsx` only if per-page `className`/page indicator hooks are needed (additions only)
- Test: `apps/designer/src/components/stage/zoom.test.ts`, `apps/designer/src/components/stage/PdfStage.test.tsx`

**Interfaces:**
- Produces:
  - `type ZoomMode = { kind: 'fit-width' } | { kind: 'fit-page' } | { kind: 'percent'; value: number }`
  - `pageSizePt(doc: unknown): { width: number; height: number }` (A4 595.28×841.89, A5, Letter, Legal, custom `{width,height}` lengths via `@apw-pdf/core` unit helpers, orientation applied; falls back to A4 on anything unparsable)
  - `resolveScale(mode: ZoomMode, container: { width: number; height: number }, page: { width: number; height: number }, padding?: number): number` (clamped 0.25–2.0, never 0/NaN)
  - `PdfStage(props: { doc: unknown | null; data: unknown | null; templateName: string })` — dark canvas, scroll area, floating toolbar (zoom −/+, mode menu with Fit width / Fit page / 50 / 75 / 100 / 125 / 150 / 200, download button), page indicator; recomputes scale on container resize.

- [ ] **Step 1: Write failing tests**: `pageSizePt reads A4 portrait and landscape`; `pageSizePt falls back to A4 for garbage`; `resolveScale fit-width uses container width minus padding`; `resolveScale fit-page uses the smaller ratio`; `resolveScale clamps to 0.25 and 2 and never returns NaN for a zero container`; `PdfStage zoom buttons change the percent mode`; `PdfStage keeps the last good render when doc becomes null` (stub client as in `PreviewPane.test.tsx`).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** tests and `npx pnpm@9 --filter designer build` → pass.
- [ ] **Step 5: Commit** `feat(designer): pdf stage with zoom and fit modes`

---

## Round 2 — Outline, data and templates (left panel)

### Task 3: Outline tree

**Files:**
- Create: `apps/designer/src/components/outline/{OutlineTree,OutlineRow,QuickAdd}.tsx`
- Reuse: `components/cards/{blockMeta,BlockPicker}.tsx`
- Test: `apps/designer/src/components/outline/outline.test.tsx`

**Interfaces:**
- Consumes: `EditorState`, `listChildren`, `canMoveInto`, `blockMeta`, `Menu`, `IconButton`.
- Produces: `OutlineTree(props: { state: EditorState })` (role `tree`; rows role `treeitem`, `aria-selected`, `aria-level`; row = icon, label, summary, warning dot; hover/selected shows only one `⋯` `Menu` with items Duplicate, Delete, Move into previous, Move out, Edit JSON, Move up, Move down (keep the aria-labels); keyboard: ↑/↓ moves selection, Alt+↑/↓ reorders, Delete removes, Ctrl+D duplicates, Enter calls `onFocusProperties` if given; HTML5 DnD reorder via `state.moveBlockTo` with a drop indicator line; header with **+ เพิ่ม** `Menu` (basic/advanced groups) and `QuickAdd` (`/` opens a searchable popover; Enter inserts after the selection or at the end)). Props also accept `onFocusProperties?: () => void` and `onEditJson?: (path: BlockPath) => void`.

- [ ] **Step 1: Write failing tests**: `OutlineTree renders nested blocks with levels`; `clicking a row selects it`; `a row shows only one menu button and no per-row move buttons`; `menu Delete removes the block`; `keyboard Delete removes the selected block`; `keyboard Alt+ArrowDown reorders`; `Ctrl+D duplicates`; `dropping a row between others calls moveBlockTo`; `dropping into its own descendant is ignored`; `QuickAdd filters types by text and inserts the chosen type`; `unresolved binding shows a warning dot`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(designer): outline tree with drag and drop and quick add`

### Task 4: Data tree and templates list

**Files:**
- Create: `apps/designer/src/components/data/DataView.tsx`, `apps/designer/src/components/templates/TemplatesView.tsx`
- Test: `apps/designer/src/components/data/DataView.test.tsx`, `apps/designer/src/components/templates/TemplatesView.test.tsx`

**Interfaces:**
- Produces: `DataView(props: { data: unknown; onChange(next: unknown): void })` — compact rows `key | value | ⋯`, type chip menu (lossless conversion via `convertType`), collapsible nested objects/arrays with guide lines, `⋯` menu (Rename, Duplicate, Remove), "Add field"/"Add item", warning chip for keys failing `isUsableKey`, inline duplicate-key message (contains the word "duplicate"). `TemplatesView(props: { items: Array<{ name: string; description: string; source: 'builtin' | 'saved' }>; selected: string | null; onSelect(name: string): void; onNew(): void; filter?: string })` — searchable list, builtin badge.

- [ ] **Step 1: Write failing tests**: port all five `DataPanel` tests to `DataView` with the same behaviour (names prefixed `DataView …`) plus `DataView collapses a nested object`; `TemplatesView filters by text`; `TemplatesView selects a template`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(designer): data tree and templates list`

---

## Round 3 — Properties panel

### Task 5: Properties framework and simple block types

**Files:**
- Create: `apps/designer/src/components/properties/{PropertiesPanel,Section,Field,AddProperty,DocumentSettings}.tsx`, `apps/designer/src/components/properties/types/{ParagraphProps,SignatureProps,ImageProps,LineProps,SpacerProps,ColumnsProps,RepeatProps,ConditionProps,JsonProps}.tsx`
- Reuse: logic from `components/inspectors/*` (move shared helpers to `components/properties/shared.ts`), `BindingInput`, `VariablePicker` (create in `components/properties/VariablePicker.tsx`: popover listing `listPaths` + loop-variable fields, filter step wrapping as `{{path | filter}}`)
- Test: `apps/designer/src/components/properties/properties.test.tsx`

**Interfaces:**
- Produces: `PropertiesPanel(props: { state: EditorState; onOpenTableEditor(path: BlockPath): void })` — picks the editor by `block.type`; no selection → `DocumentSettings` (uses `readPageSettings/applyPageSettings` plus page number and numerals). `Section(props: { title: string; defaultOpen?: boolean; children })` collapsible. `Field(props: { label: string; children; onReset?: () => void })`. `AddProperty(props: { options: Array<{ key: string; label: string; add(): void }> })` searchable popover listing only unset optional properties. Every type editor shows set properties in sections and hides unset optional ones behind `AddProperty`; reset removes the key (the document never gains empty/default keys).

- [ ] **Step 1: Write failing tests**: `PropertiesPanel shows document settings when nothing is selected`; `DocumentSettings changes font size via applyPageSettings`; `ParagraphProps edits text and variable picker inserts {{path}}`; `ParagraphProps hides unset optional properties and AddProperty reveals indentLeft`; `ParagraphProps reset removes the key from the block`; `ParagraphProps sets align thaiDistributed`; `SignatureProps edits name and positions`; `ColumnsProps adds and removes a column`; `RepeatProps edits of and as with identifier validation`; `ConditionProps edits test`; `JsonProps applies valid JSON and shows issues for invalid`; `unknown block type renders JsonProps`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(designer): properties panel with progressive disclosure`

### Task 6: Table properties and grid editor dialog

**Files:**
- Create: `apps/designer/src/components/properties/types/TableProps.tsx`, `apps/designer/src/components/table/{TableGridDialog,Dialog}.tsx`
- Test: `apps/designer/src/components/table/table.test.tsx`

**Interfaces:**
- Produces: `TableProps` (columns list with width/align/add/remove/reorder; rows source switch fixed vs from data array + loop variable validated like the schema; header/footer toggles; `repeatHeader`, `border`, `cellPadding`, `allowRowSplit` behind `AddProperty`; button **แก้ไขตาราง**), `Dialog(props: { open: boolean; title: string; onClose(): void; children })` (focus trap, Escape closes, `role="dialog"`, `aria-modal`), `TableGridDialog(props: { path: BlockPath; state: EditorState; onClose(): void })` — large editable grid for header/body/footer cells with binding inputs, add/remove/move row and column, colSpan/rowSpan fields, "แปลงเซลล์เป็นบล็อก" action keeping the text; when rows come from data, body shows one template row (the `cells` array) and a note.

- [ ] **Step 1: Write failing tests**: `TableProps adds a column`; `TableProps switches to each rows with an array and a valid as`; `TableProps rejects an invalid loop variable`; `TableProps with an empty array still opens the grid`; `TableGridDialog edits a body cell`; `TableGridDialog adds and removes a row and a column`; `TableGridDialog converts a text cell to blocks keeping the text`; `Dialog closes on Escape and traps focus`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** tests and build → pass.
- [ ] **Step 5: Commit** `feat(designer): table properties and grid editor dialog`

---

## Round 4 — Assembly, cleanup, verification

### Task 7: Rebuild `App`/`VisualEditor` and remove old components

**Files:**
- Create: `apps/designer/src/components/shell/{TopBar,UsePopover,PagePopover}.tsx`
- Modify: `apps/designer/src/App.tsx`, `apps/designer/src/components/VisualEditor.tsx` (+ its test)
- Delete: `components/BlockTree.tsx` (+test), `components/Inspector.tsx`, `components/inspectors/**`, `components/DataPanel.tsx` (+test), `components/cards/{DocumentView,InsertLine,BlockCard}.tsx` unless reused by the outline (delete otherwise, with their tests), `components/UsageSnippet.tsx` (content moves into `UsePopover`), `components/TemplateList.tsx` (replaced by `TemplatesView`)
- Test: `apps/designer/src/components/shell/shell.test.tsx`

**Interfaces:**
- Produces: `TopBar(props: { name: string; dirty: boolean; mode: 'visual' | 'json'; onMode(m): void; onSave(): void; saveLabel: string; menu: Array<{ label: string; onSelect(): void; danger?: boolean }> })`. `App` wires: `SplitWorkspace` with left tabs (โครงสร้าง / ข้อมูล / เทมเพลต, via `SegmentedControl`), centre `PdfStage`, right `PropertiesPanel`; JSON mode replaces left+right content with the existing JSON editors (document / example sub-tabs) while the stage stays; warnings strip under the top bar; all phase-A/B1 flows preserved (New/Duplicate/Delete, builtin read-only → Save as copy, `buildSaveRecord`, `textToDoc` gating when leaving JSON mode, last-good preview).

- [ ] **Step 1: Write failing tests**: `TopBar mode control calls onMode`; `TopBar menu items call onSelect`; `UsePopover shows CLI and React snippets for the template`; `PagePopover changes page size`; `VisualEditor selecting an outline row shows its properties`; `VisualEditor adding a block from the plus menu appends it and selects it`; adapt the existing VisualEditor tests.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**, then delete replaced files and remove dead imports; `rg "BlockTree|Inspector|DataPanel|TemplateList|UsageSnippet" apps/designer/src` returns nothing unintended.
- [ ] **Step 4: Run** all designer tests and `npx pnpm@9 --filter designer build` → pass.
- [ ] **Step 5: Commit** `feat(designer): playground layout replaces tree and inspector`

### Task 8: Verification and docs

**Files:**
- Modify: `README.md` (Template Designer section: playground layout, shortcuts)

- [ ] **Step 1: Run** `npx pnpm@9 test` and `npx pnpm@9 --filter designer build` → green.
- [ ] **Step 2: Browser checks (controller)**: screenshots at 1440px and 1024px (visual, json, data, templates); resize/collapse persists after reload; build a memo-like document from scratch; drag in outline; rapid typing keeps the preview painted; no horizontal scroll.
- [ ] **Step 3: Update README**, commit `docs: designer playground layout`.
