# Designer Card UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (the controller dispatches coding to agy). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the Tree + Inspector UI with an inline card editor, new app shell, data view and shared design system.

**Architecture:** Keep all logic modules. Add a small UI kit (`src/ui/*`), a card framework (`DocumentView`, `BlockCard`, `BlockPicker`) and per-type cards that call `EditorState` actions. `VisualEditor` and `App` are rebuilt on top.

**Tech Stack:** TypeScript, React 19, plain CSS (variables), vitest + jsdom. No new dependencies (drag and drop uses native HTML5 DnD).

**Spec:** `docs/superpowers/specs/2026-11-03-designer-card-ui-design.md`

## Global Constraints

- Logic modules `editor/*` and `lib/editorSync.ts`, `lib/api.ts` keep their current exports; additions only (`moveBlockTo`, `applyPageSettings`).
- Keep these `aria-label`s on card controls: `Move up`, `Move down`, `Move into previous`, `Move out`, `Duplicate`, `Delete`.
- No jest-dom matchers; plain vitest assertions. Each component test file imports `afterEach` and calls `cleanup()`.
- Never pass fresh object/array/function literals as props or hook inputs where an effect depends on them; no unconditional state set inside `useEffect`.
- All colours, spacing, radii, fonts come from `src/ui/tokens.css` variables; no hard-coded colours in components.
- Style: no semicolons, single quotes, 2-space indent, `.js` suffix on relative imports. UI copy in Thai for labels the user sees (keep technical terms like JSON, Save in English).
- agy runs on `gemini-4-argon-high` (user rule); agy cannot run shell commands; the controller runs tests, build, browser checks and commits.

## Review Focus

- Dropping a card into its own descendant is rejected (`moveBlockTo` returns the input).
- Dragging while a text field is focused does not lose typed text.
- Typing in a card textarea updates the preview once per pause (no per-keystroke worker restarts; reuse the existing debounce) and never loses the caret.
- Table card with `each` rows bound to an empty array renders a usable empty grid.
- Cards for unknown/future block types fall back to a read-only JSON card with "Edit JSON".
- At 1024px no control is clipped and the page has no horizontal scroll.

---

## Round 1

### Task 1: Design system and UI kit

**Files:**
- Create: `apps/designer/src/ui/tokens.css`, `apps/designer/src/ui/ui.css`, `apps/designer/src/ui/{IconButton,Menu,Popover,SegmentedControl,Chip}.tsx`, `apps/designer/src/ui/icons.tsx` (inline SVG icon components: text, table, columns, signature, image, line, space, pageBreak, repeat, condition, drag, up, down, more, plus, trash, copy)
- Modify: `apps/designer/src/main.tsx` (import the two CSS files)
- Test: `apps/designer/src/ui/ui.test.tsx`

**Interfaces:**
- Produces: `IconButton(props: { label: string; icon: ReactNode; onClick(): void; disabled?: boolean })` (renders `aria-label={label}`, `title={label}`); `Menu(props: { label: string; items: Array<{ label: string; onSelect(): void; disabled?: boolean; danger?: boolean }> })` (button `aria-haspopup`, closes on select/Escape/outside click); `Popover(props: { label: string; children: ReactNode })`; `SegmentedControl<T extends string>(props: { value: T; options: Array<{ value: T; label: string }>; onChange(v: T): void })` (`role="tablist"`); `Chip(props: { tone?: 'neutral' | 'warn' | 'accent'; children })`.

- [ ] **Step 1: Write failing tests**: `IconButton exposes its label as aria-label and calls onClick`; `Menu opens on click, selects an item and closes`; `Menu closes on Escape`; `Menu disabled item does not call onSelect`; `SegmentedControl calls onChange with the clicked value`; `Popover toggles its content`.
- [ ] **Step 2: Run** `npx pnpm@9 --filter designer test` → FAIL.
- [ ] **Step 3: Implement** the kit and CSS (tokens: `--c-accent`, `--c-bg`, `--c-surface`, `--c-border`, `--c-text`, `--c-muted`, `--c-danger`, `--c-warn`, `--sp-1..6`, `--radius`, `--font`, `--fs`, `--focus`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(designer): ui kit and design tokens`

### Task 2: `moveBlockTo` and `applyPageSettings`

**Files:**
- Modify: `apps/designer/src/editor/docModel.ts` (add `moveBlockTo`)
- Create: `apps/designer/src/editor/pageSettings.ts`
- Test: `apps/designer/src/editor/docModel.test.ts` (append), `apps/designer/src/editor/pageSettings.test.ts`

**Interfaces:**
- Produces: `moveBlockTo(doc: DocumentDef, from: BlockPath, toListPath: BlockPath, index: number): DocumentDef` (removes then inserts; index is relative to the target list after removal; returns `doc` unchanged for invalid paths or when `toListPath` is inside `from`); `interface PageSettings { size: 'A4' | 'A5' | 'Letter' | 'Legal'; orientation: 'portrait' | 'landscape'; margin: { top: string; bottom: string; left: string; right: string }; fontFamily: string; fontSize: string; lineSpacing?: DocumentDef['font']['lineSpacing']; numerals: 'arabic' | 'thai' }`; `readPageSettings(doc: DocumentDef): PageSettings`; `applyPageSettings(doc: DocumentDef, patch: Partial<PageSettings>): DocumentDef` (maps to `doc.page`, `doc.font`, `doc.numerals`; preserves other keys; custom `{width,height}` page sizes are left untouched when `size` is not in the patch).

- [ ] **Step 1: Write failing tests**: `moveBlockTo reorders within the root list`; `moveBlockTo moves into columns[0].blocks`; `moveBlockTo moves out of a container to root`; `moveBlockTo adjusts the index when moving later in the same list`; `moveBlockTo refuses its own descendant and returns the same doc`; `moveBlockTo invalid path returns the same doc`; `readPageSettings reads memo.document`; `applyPageSettings changes size and keeps margin`; `applyPageSettings updates font size and numerals`; `applyPageSettings does not mutate the input`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** (reuse existing `docModel` internals; `parseDocument` must still pass for results from valid input).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(designer): moveBlockTo and page settings helpers`

### Task 3: Card framework and document view

**Files:**
- Create: `apps/designer/src/components/cards/{BlockCard,BlockPicker,DocumentView,InsertLine}.tsx`, `apps/designer/src/components/cards/blockMeta.ts`
- Test: `apps/designer/src/components/cards/cards.test.tsx`

**Interfaces:**
- Consumes: `EditorState`, `BLOCK_TYPES`, `listChildren`, `canMoveInto`, `moveBlockTo`, ui kit.
- Produces:
  - `blockMeta(type: Block['type']): { label: string; icon: ReactNode; group: 'basic' | 'advanced' }` (Thai labels: ข้อความ, ตาราง, คอลัมน์, ลงนาม, รูปภาพ, เส้นคั่น, เว้นว่าง, ขึ้นหน้าใหม่, วนซ้ำ, เงื่อนไข)
  - `BlockPicker(props: { onPick(type: Block['type']): void })` popover with large icon buttons; `advanced` group collapsed.
  - `InsertLine(props: { onPick(type): void })` the `+` line.
  - `BlockCard(props: { path: BlockPath; state: EditorState; summary?: string; children: ReactNode; renderNested?: ReactNode })` — chrome (icon, label, drag handle, up/down `IconButton`s with the kept aria-labels, `Menu` `⋯` with Duplicate, Delete, Move into previous, Move out, Edit JSON), selected highlight, warning chip when `state.warnings` has a binding in this block (`blockPath` prefix match). Drag source with `draggable` handle; sets `dataTransfer` to the JSON path.
  - `DocumentView(props: { state: EditorState; renderCard(path: BlockPath, block: Block): ReactNode })` — lists top-level blocks with `InsertLine`s between and drop zones handled via `onDragOver`/`onDrop` calling `state.moveBlockTo(from, toListPath, index)`; empty state "เริ่มต้นด้วยการเพิ่มบล็อกแรก" with the picker.
- Modify (add): `apps/designer/src/editor/useEditorState.ts`: `moveBlockTo(from: BlockPath, toListPath: BlockPath, index: number): void` on `EditorState` (calls `docModel.moveBlockTo`, selects the moved block, calls `onChange`); test in `useEditorState.test.tsx`: `moveBlockTo reorders and selects the moved block`.

- [ ] **Step 1: Write failing tests** in `cards.test.tsx`: `DocumentView shows the empty state and the picker adds a text block`; `InsertLine inserts a block of the picked type at its index`; `BlockCard up/down buttons move the block and keep their aria-labels`; `BlockCard menu Delete removes the block`; `BlockCard shows a warning chip for an unresolved variable`; `dropping a card on another list position calls moveBlockTo`; `dropping a card into its own descendant is ignored`. Hook test above.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** (native DnD events; in tests dispatch `dragstart`/`dragover`/`drop` with a minimal `DataTransfer` stub).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(designer): card framework, insert lines and drag and drop`

### Task 4: Text card, variable picker and app shell

**Files:**
- Create: `apps/designer/src/components/cards/TextCard.tsx`, `apps/designer/src/components/cards/VariablePicker.tsx`, `apps/designer/src/components/shell/{AppBar,Sidebar,PagePopover,UsePopover}.tsx`, `apps/designer/src/components/cards/FallbackCard.tsx`
- Modify: `apps/designer/src/components/VisualEditor.tsx` (rebuild: renders `DocumentView` with `TextCard`/`FallbackCard` for now), `apps/designer/src/App.tsx` (new shell: AppBar, Sidebar, two panes; modes Document | Data | JSON; Data mode still uses the existing `DataPanel` until Round 2; sticky preview with zoom 50–150%)
- Test: `apps/designer/src/components/cards/TextCard.test.tsx`, `apps/designer/src/components/shell/shell.test.tsx`

**Interfaces:**
- Produces:
  - `VariablePicker(props: { data: unknown; scope: Array<{ name: string; arrayPath: string }>; onPick(expr: string): void })` — popover listing `listPaths(data)` (+ loop-variable fields), and a filter step (from `FILTER_NAMES`) that wraps the path as `{{path | filter}}`; `onPick` receives the final `{{ ... }}` text.
  - `TextCard(props: { path: BlockPath; block: ParagraphBlock; state: EditorState })` — textarea editing `text` (when the block uses `runs`, shows a notice "ข้อความแบบหลายส่วน" and an "Edit JSON" shortcut instead of the textarea); toolbar on focus: bold, italic (→ `font.bold/italic`), alignment group incl. `thaiDistributed`, font size input (→ `font.size`), `{ } ตัวแปร` (inserts at the caret via `VariablePicker`); "ตั้งค่าเพิ่มเติม" collapsible that reuses `ParagraphInspector` for the remaining fields.
  - `AppBar(props: { name: string; dirty: boolean; mode: 'document' | 'data' | 'json'; onMode(m): void; onSave(): void; saveLabel: string; children?: ReactNode })`, `Sidebar` (template list, collapsible, remembers collapse in `localStorage` inside try/catch, collapsed by default when `innerWidth < 1200`), `PagePopover(props: { doc: DocumentDef; onChange(next: DocumentDef): void })` using `readPageSettings/applyPageSettings`, `UsePopover(props: { templateName: string })` wrapping the existing snippet content.
- Behaviour: all text edits flow through `state.updateBlock`; preview debounce stays as in phase A; the existing prompt-based New/Duplicate flows stay but are triggered from the Sidebar.

- [ ] **Step 1: Write failing tests**: `TextCard typing updates the block text`; `TextCard bold toggle sets font.bold`; `TextCard align Thai distributed sets align`; `TextCard variable picker inserts {{path}} at the caret`; `TextCard variable picker applies a filter`; `TextCard shows the runs notice for run-based paragraphs`; `PagePopover changes the font size through applyPageSettings`; `AppBar mode control calls onMode`; `Sidebar collapse state is stored and survives a storage error`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** all of the above; wire `App.tsx`; keep every phase-A and B1 behaviour tested by existing tests (adapt only tests of replaced components; keep the JSON tab untouched).
- [ ] **Step 4: Run** designer tests and `npx pnpm@9 --filter designer build` → pass.
- [ ] **Step 5: Commit** `feat(designer): text card, variable picker and new app shell`

---

## Round 2

### Task 5: Table, columns and remaining cards

**Files:**
- Create: `apps/designer/src/components/cards/{TableCard,ColumnsCard,SignatureCard,ImageCard,LineCard,SpacerCard,PageBreakCard,RepeatCard,ConditionCard}.tsx`
- Modify: `apps/designer/src/components/VisualEditor.tsx` (map every block type to its card; `FallbackCard` for unknown types)
- Test: `apps/designer/src/components/cards/typeCards.test.tsx`

**Interfaces:**
- Consumes: `BlockCard`, `EditorState`, existing inspector logic (`TableInspector` helpers for each-rows, as-identifier validation, cell conversion), `VariablePicker`, `GenericJsonInspector` (as "Edit JSON").
- Produces: one card component per block type with props `(props: { path: BlockPath; block: <BlockType>; state: EditorState })`. `TableCard`: editable grid for header/body/footer cells; add/remove/move row and column controls; per-column width and align; "ดึงแถวจากข้อมูล" switch with array picker (from `listPaths`, arrays only) and loop variable input validated as in the schema; `repeatHeader`, `border`, `cellPadding`, `allowRowSplit`, colSpan/rowSpan, cell → blocks conversion under "ตั้งค่าเพิ่มเติม". `ColumnsCard`/`RepeatCard`/`ConditionCard` render nested `DocumentView`-style lists for their child lists via `renderNested`.

- [ ] **Step 1: Write failing tests**: `TableCard edits a body cell`; `TableCard adds a row and a column`; `TableCard rows-from-data switch sets each and as`; `TableCard rejects an invalid loop variable`; `TableCard with an empty array still renders an empty grid`; `TableCard converts a text cell to blocks keeping the text`; `ColumnsCard adds a column and renders nested cards`; `SignatureCard edits name and positions`; `ImageCard edits src and width`; `LineCard and SpacerCard edit their fields`; `RepeatCard edits of and as`; `ConditionCard edits test and renders then/else areas`; `unknown block type renders FallbackCard with Edit JSON`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the cards.
- [ ] **Step 4: Run** designer tests and build → pass.
- [ ] **Step 5: Commit** `feat(designer): table, columns and remaining block cards`

### Task 6: Data view and cleanup

**Files:**
- Create: `apps/designer/src/components/data/DataView.tsx`
- Modify: `apps/designer/src/App.tsx` (Data mode uses `DataView`)
- Delete: `apps/designer/src/components/BlockTree.tsx` and its test, `Inspector.tsx`, `inspectors/*` except logic moved into cards (move reusable helpers to `components/cards/shared.ts` first), `DataPanel.tsx` and its test once `DataView` has equivalent tests
- Test: `apps/designer/src/components/data/DataView.test.tsx`

**Interfaces:**
- Produces: `DataView(props: { data: unknown; onChange(next: unknown): void })` — compact rows `key | value | ⋯`, type chip menu, collapsible nested objects/arrays with guide lines, `⋯` menu (Rename, Duplicate, Remove), "Add field"/"Add item", warning chip for keys failing `isUsableKey`; same behaviours as the old DataPanel tests.

- [ ] **Step 1: Write failing tests**: port all five `DataPanel` tests to `DataView` with the same names prefixed `DataView …` plus `DataView collapses a nested object` and `DataView rename rejects a duplicate with an inline message`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `DataView`; switch `App`; move helpers; delete the replaced components and their tests; remove unused imports.
- [ ] **Step 4: Run** designer tests and build → pass; `rg "BlockTree|Inspector|DataPanel" apps/designer/src` returns only intentional references.
- [ ] **Step 5: Commit** `feat(designer): data view and removal of the old tree and inspectors`

### Task 7: Verification pass and docs

**Files:**
- Modify: `README.md` (Template Designer section: card editor, Page and Use popovers)

- [ ] **Step 1: Run** `npx pnpm@9 test` and `npx pnpm@9 --filter designer build` → green.
- [ ] **Step 2: Browser checks (controller)**: screenshots at 1440px and 1024px of Document, Data and JSON modes; no clipped controls, no horizontal scroll; build a memo-like document from empty using only cards; drag a card; rapid typing keeps the preview painted.
- [ ] **Step 3: Update README**, commit `docs: designer card UI`.
