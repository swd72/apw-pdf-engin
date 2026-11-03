# Designer B1 — Visual Block Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Visual tab to `apps/designer` where a developer builds a `DocumentDef` from blocks and binds it to free-form JSON data, with live engine preview.

**Architecture:** Pure, React-free modules (`docModel`, `dataModel`, `bindings`) hold all logic and are unit-tested. A `useEditorState` hook wires them to React. `BlockTree`, `Inspector`, `DataPanel`, `BindingInput` are thin components over those modules. `App` gets a Visual | JSON tab over the same `doc`/`data` state.

**Tech Stack:** TypeScript, React 19, vitest (+ jsdom, `@testing-library/react`), `@apw-pdf/core` (`parseDocument`, `parseExpression`, `FILTERS`, `blockSchema`).

**Spec:** `docs/superpowers/specs/2026-11-03-designer-b1-visual-editor-design.md` (builds on phase A, branch `feat/template-designer`)

## Global Constraints

- Source of truth is `DocumentDef`; no ids or extra keys are added to saved documents (schema rejects unknown keys).
- Data is free-form JSON; no required schema. Saved `dataSchema` = `inferJsonSchema(data)`; saved `example` = current data.
- All new logic modules are pure (no React, no DOM) and never mutate their input.
- Invalid or half-built documents must never throw in the editor; operations on a bad path return the input unchanged.
- Engine facts verified for this plan: `{{ }}` supports paths + filters only; `if.test` supports paths, literals, `!`, `&&`, `||`, `== != >= <= > <` (no arithmetic, so totals live in data); filters = `Object.keys(FILTERS)` from `@apw-pdf/core`; the engine exposes no block layout boxes (B3 is dropped).
- Tests live next to the code (`*.test.ts[x]`), `@vitest-environment jsdom` only for component tests (this app's `vite.config.ts` already routes `src/**` to jsdom). Component tests call `cleanup()` in `afterEach`.
- Code style: no semicolons, single quotes, 2-space indent, `.js` suffix on relative imports.
- Commands run via `npx pnpm@9 --filter designer test`; shell commands prefixed `rtk` where the user's CLAUDE.md requires.
- Dependencies: none new.

## Review Focus

- Moving a block into itself or one of its own descendants is impossible (control disabled, `docModel` returns input).
- `unresolved` flags a table/`each` loop variable's fields only inside its own scope and never flags them inside it; a variable used outside the loop is flagged.
- Renaming a data key does not silently rewrite `{{ }}` references; old references become unresolved warnings.
- Changing a data value type is lossless or rejected (`"12"`→`12` ok, `"abc"`→number rejected, object→text rejected when non-empty).
- A table bound to an empty array (`items: []`) neither crashes `listPaths`/`inferJsonSchema` nor the editor.
- Converting a table cell `{ text }` → `{ blocks }` keeps the text as a paragraph block; round-trips through the JSON tab.
- Switching to the JSON tab with a schema-invalid doc still shows its text; switching back is blocked until it passes `parseDocument`.

---

### Task 1: `docModel` and `blockCatalog`

**Files:**
- Create: `apps/designer/src/editor/docModel.ts`, `apps/designer/src/editor/blockCatalog.ts`
- Test: `apps/designer/src/editor/docModel.test.ts`, `apps/designer/src/editor/blockCatalog.test.ts`

**Interfaces:**
- Produces:
  - `type BlockPath = (string | number)[]` (e.g. `['blocks', 2, 'columns', 0, 'blocks', 1]`)
  - `getBlock(doc: DocumentDef, path: BlockPath): Block | undefined`
  - `listChildren(block: Block): Array<{ key: BlockPath; label: string }>` (child lists a block can hold: `columns[i].blocks`, `each.blocks`, `if.then`, `if.else`, table cell blocks)
  - `insertBlock(doc, parentListPath: BlockPath, index: number, block: Block): DocumentDef`
  - `removeBlock(doc, path): DocumentDef`
  - `moveBlock(doc, path, delta: -1 | 1): DocumentDef`
  - `moveInto(doc, path, targetListPath: BlockPath): DocumentDef` and `moveOut(doc, path): DocumentDef`
  - `duplicateBlock(doc, path): DocumentDef`
  - `canMoveInto(doc, path, targetListPath): boolean`
  - `BLOCK_TYPES: Array<{ type: Block['type']; label: string; create(): Block }>` (paragraph, image, table, columns, signature, spacer, line, pageBreak, each, if)

- [ ] **Step 1: Write failing tests** in `docModel.test.ts`: `insertBlock at root index 0`; `insertBlock into columns[0].blocks`; `removeBlock nested path`; `moveBlock swaps neighbours and is a no-op at the edges`; `moveInto appends to the target list`; `moveInto refuses own descendant (canMoveInto false, doc returned unchanged)`; `moveOut places the block after its parent`; `duplicateBlock deep-copies (mutating the copy leaves the original)`; `invalid path returns the same doc object`; `inputs are never mutated` (deep-freeze the input doc). In `blockCatalog.test.ts`: `every BLOCK_TYPES create() output passes parseDocument when placed in a minimal document` (use `memo.document` page/font as the base).
- [ ] **Step 2: Run** `npx pnpm@9 --filter designer test` → new tests FAIL (modules missing).
- [ ] **Step 3: Implement `docModel.ts`**: structural-sharing copy along the path (clone only the touched spine). Path addressing is generic over arrays/objects, so list paths and block paths use the same walker. `canMoveInto` rejects when `targetListPath` starts with `path`.
- [ ] **Step 4: Implement `blockCatalog.ts`**: `create()` factories must produce schema-valid blocks (read `columnWidthSpecSchema` in `packages/core/src/schema.ts` for valid column widths; image default `src: 'asset:garuda'`; table default 2 columns, one header row, one body row).
- [ ] **Step 5: Run** designer tests → PASS.
- [ ] **Step 6: Commit** `feat(designer): docModel path operations and block catalog`

### Task 2: `dataModel`

**Files:**
- Create: `apps/designer/src/editor/dataModel.ts`
- Test: `apps/designer/src/editor/dataModel.test.ts`

**Interfaces:**
- Produces:
  - `type DataPath = (string | number)[]`
  - `interface PathInfo { path: string; type: 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array'; rowFields?: string[] }` where `path` is dotted (`signer.name`, `items`) and `rowFields` lists keys of the first element for arrays of objects
  - `listPaths(data: unknown): PathInfo[]`
  - `setAtPath(data, path: DataPath, value: unknown): unknown`
  - `removeAtPath(data, path): unknown`
  - `renameKey(data, path: DataPath, newKey: string): { ok: true; data: unknown } | { ok: false; reason: 'duplicate' | 'empty' | 'invalid' }`
  - `addArrayItem(data, path: DataPath, item?: unknown): unknown` (default item copies the shape of the first element, strings emptied, numbers 0)
  - `convertType(value: unknown, to: PathInfo['type']): { ok: true; value: unknown } | { ok: false }`
  - `inferJsonSchema(data: unknown): object`
  - `isUsableKey(key: string): boolean` (matches `/^[a-zA-Z0-9_$]+$/`, not `__proto__`/`constructor`/`prototype`, same rule as the engine)

- [ ] **Step 1: Write failing tests**: `listPaths lists nested scalars, objects and arrays with rowFields`; `listPaths on empty array and null does not throw`; `setAtPath creates intermediate objects and does not mutate input`; `removeAtPath on array index and on key`; `renameKey rejects duplicate and empty and keeps key order`; `addArrayItem copies first-element shape with emptied values`; `convertType "12" to number ok, "abc" to number rejected, "" to number rejected, number to string ok, non-empty object to string rejected`; `inferJsonSchema scalars, nested object, array of objects, empty array gives items {}`; `isUsableKey rejects "a b", "__proto__" and accepts "item_1"`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the functions per the interface; `inferJsonSchema` returns JSON Schema draft-07-style (`type`, `properties`, `items`), no `required` list (data is free-form).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(designer): free-form data model helpers`

### Task 3: `bindings`

**Files:**
- Create: `apps/designer/src/editor/bindings.ts`
- Test: `apps/designer/src/editor/bindings.test.ts`

**Interfaces:**
- Consumes: `listPaths`/`DataPath` helpers from Task 2; `parseExpression`, `FILTERS`, `Block`, `DocumentDef` from `@apw-pdf/core`.
- Produces:
  - `interface Binding { blockPath: (string | number)[]; field: string; expr: string; path: string; filter?: string }` (`path` = variable path inside `{{ }}`, `field` = where it was found, e.g. `text`, `runs[0].text`, `rows[1][0].text`)
  - `scanBindings(doc: DocumentDef): Binding[]` (scans `text`, `runs[].text`, `runs[].fill`, table header/rows/footer cells `text`, nested blocks, `signature.name`/`positions`/`prefix`, and `if.test` via `parseExpression`)
  - `unresolved(doc: DocumentDef, data: unknown): Binding[]`
  - `FILTER_NAMES: string[]` (`Object.keys(FILTERS)`)
  - `scopeAt(doc: DocumentDef, blockPath: (string | number)[]): Array<{ name: string; arrayPath: string }>` (enclosing `each` block and table-`each` loop variables)

- [ ] **Step 1: Write failing tests**: `scanBindings finds {{x}} in paragraph text, runs, table cells and nested columns`; `scanBindings parses filter and args ("date | thaiDate:'long'")`; `scanBindings reads paths from if.test`; `unresolved reports a variable missing from data`; `unresolved does not flag loop variable fields inside an each block or a table each`; `unresolved flags the loop variable used outside its loop`; `unresolved is empty when every path exists`; `scopeAt returns the each variable with its array path`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**: scan `{{ ... }}` with `/\{\{\s*([^}]+?)\s*\}\}/g`, split the inner text on the first `|` for `path` vs filter. Resolution: first segment must be a top-level data key or an in-scope loop variable; for a loop variable, the remaining segments are checked against the first row of its array when a row exists, otherwise treated as resolved.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(designer): variable binding scan and resolution`

### Task 4: `useEditorState`

**Files:**
- Create: `apps/designer/src/editor/useEditorState.ts`
- Test: `apps/designer/src/editor/useEditorState.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `useEditorState(initial: { doc: DocumentDef; data: unknown }, onChange: (next: { doc: DocumentDef; data: unknown }) => void): EditorState` with `{ doc, data, selectedPath: BlockPath | null, select(path | null), addBlock(listPath, index, type), removeSelected(), moveSelected(delta), moveSelectedInto(listPath), moveSelectedOut(), duplicateSelected(), updateBlock(path, patch: Record<string, unknown>), replaceBlock(path, block: Block), setData(next: unknown), warnings: Binding[] }`. `warnings` = `unresolved(doc, data)`. Every mutation calls `onChange`. After remove, selection moves to the nearest sibling or parent.

- [ ] **Step 1: Write failing tests** with `renderHook` (`@testing-library/react`): `addBlock appends and selects it`; `removeSelected selects the previous sibling, then the parent`; `updateBlock merges a patch and calls onChange once`; `setData recomputes warnings`; `selecting an invalid path clears the selection`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** with `useReducer`-free simple state: keep `doc`/`data` in `useState`, derive `warnings` with `useMemo`. Re-sync when `initial` identity changes (template switched).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(designer): editor state hook`

### Task 5: `BindingInput` and `DataPanel`

**Files:**
- Create: `apps/designer/src/components/BindingInput.tsx`, `apps/designer/src/components/DataPanel.tsx`
- Test: `apps/designer/src/components/BindingInput.test.tsx`, `apps/designer/src/components/DataPanel.test.tsx`

**Interfaces:**
- Consumes: `listPaths`, `FILTER_NAMES`, `scopeAt`, `isUsableKey`, `renameKey`, `setAtPath`, `removeAtPath`, `addArrayItem`, `convertType`.
- Produces:
  - `BindingInput(props: { value: string; onChange(next: string): void; data: unknown; scope?: Array<{ name: string; arrayPath: string }>; multiline?: boolean; unresolved?: string[] })`: after the user types `{{`, shows suggestions (data paths plus loop-variable fields from `scope`); after `|`, shows `FILTER_NAMES`; picking inserts text. Unresolved variable names are listed in a small warning line.
  - `DataPanel(props: { data: unknown; onChange(next: unknown): void })`: tree editor — per row: key (rename), value editor by type, type selector, remove; arrays have "add item"; objects have "add key"; keys not passing `isUsableKey` show a "not usable in {{ }}" badge.

- [ ] **Step 1: Write failing tests**: `BindingInput shows data paths after typing {{`; `BindingInput lists filters after typing a pipe`; `BindingInput suggests loop variable fields from scope`; `BindingInput lists unresolved names`; `DataPanel adds a key`; `DataPanel renames a key and rejects a duplicate with an inline message`; `DataPanel changes type string to number only when lossless`; `DataPanel adds an array item copying the first row shape`; `DataPanel removes an item`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** both components using the pure helpers; no extra libraries (plain `<input>`/`<textarea>`/`<ul role="listbox">`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(designer): binding input and data panel`

### Task 6: `BlockTree`

**Files:**
- Create: `apps/designer/src/components/BlockTree.tsx`
- Test: `apps/designer/src/components/BlockTree.test.tsx`

**Interfaces:**
- Consumes: `EditorState` (Task 4), `BLOCK_TYPES`, `listChildren`, `canMoveInto`.
- Produces: `BlockTree(props: { state: EditorState })` — renders every block (nested through `listChildren`) with a one-line summary (type + first 24 chars of `text` / `src` / table source), a warning dot when a binding in that block is unresolved, selected highlight, per-node buttons: up, down, into previous container, out, duplicate, delete (each disabled when illegal), and an "Add block" menu (from `BLOCK_TYPES`) at the end of every list.

- [ ] **Step 1: Write failing tests**: `renders nested blocks inside columns`; `clicking a node selects it`; `add-block menu inserts a paragraph at the end of the clicked list`; `move-into is disabled for the first block and for a block into its own descendant`; `delete removes the node`; `unresolved binding shows a warning dot on the owning node`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** with accessible roles (`role="tree"`, `treeitem`, buttons with `aria-label`s `Move up`, `Move down`, `Move into previous`, `Move out`, `Duplicate`, `Delete`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(designer): block tree`

### Task 7: Inspectors

**Files:**
- Create: `apps/designer/src/components/Inspector.tsx`, `apps/designer/src/components/inspectors/{ParagraphInspector,TableInspector,ColumnsInspector,SignatureInspector,ImageInspector,SpacerInspector,LineInspector,EachIfInspector,GenericJsonInspector}.tsx`
- Test: `apps/designer/src/components/inspectors/inspectors.test.tsx`

**Interfaces:**
- Consumes: `EditorState`, `BindingInput`, `scopeAt`, `listPaths`.
- Produces: `Inspector(props: { state: EditorState })` — reads `state.selectedPath`, renders the form for that block's `type`; each form calls `state.updateBlock(path, patch)` or `state.replaceBlock(path, block)`. Field coverage:
  - **Paragraph:** `text` (BindingInput multiline) or `runs` list (text, bold, italic, underline, size, colour, plus add tab / fill with leader / checkbox / line break / page number / page count); style fields `align` (incl. `thaiDistributed`), `firstLineIndent`, `indentLeft`, `indentRight`, `spaceBefore`, `spaceAfter`, `lineSpacing`, `font` overrides, `keepWithNext`, `keepLinesTogether`, `widowControl`, `tabs`; `style` dropdown from `doc.styles` keys.
  - **Table:** columns (add/remove/move, `width`, `align`), header/footer cell text, body mode fixed rows vs `each` (array picker from `listPaths` filtered to arrays + `as` identifier, validated with the schema's safe-identifier rule), `repeatHeader`, `border`, `cellPadding`, `allowRowSplit`, `colSpan`/`rowSpan`, and an action "Convert cell to blocks" that replaces `{ text }` with `{ blocks: [{ type: 'paragraph', text }] }`.
  - **Columns:** per column `width`, `align`, add/remove column; `gap`, `keepTogether`.
  - **Signature, Image, Spacer, Line, Each, If:** every field in the schema (`If.test` is a plain text input, `Each.of`/`as` as in the table).
  - **GenericJsonInspector:** textarea with the block's JSON; applies only when it passes `blockSchema.safeParse`, otherwise shows the issues.
  - Nothing selected: show document-level hint text.

- [ ] **Step 1: Write failing tests**: `ParagraphInspector edits text and updates the block`; `ParagraphInspector sets align to thaiDistributed`; `TableInspector adds a column`; `TableInspector switches to each rows with an array path and a valid as`; `TableInspector rejects an invalid as identifier`; `TableInspector converts a text cell to blocks keeping the text`; `ColumnsInspector adds a column`; `EachIfInspector edits if.test`; `GenericJsonInspector applies valid JSON and shows issues for invalid`; `Inspector shows the hint when nothing is selected`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** forms; numeric/length inputs keep the raw string (lengths like `'2cm'`, `'16pt'` are schema-validated by `parseDocument` at the app level, not by the form).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(designer): block inspectors`

### Task 8: `VisualEditor`, tab wiring and save

**Files:**
- Create: `apps/designer/src/components/VisualEditor.tsx`
- Modify: `apps/designer/src/App.tsx` (top-level Visual | JSON tab; wire `doc`/`data` state; save uses `inferJsonSchema`), `apps/designer/src/lib/api.ts` only if the save payload type needs `dataSchema`
- Test: `apps/designer/src/components/VisualEditor.test.tsx`, `apps/designer/src/lib/editorSync.test.ts`
- Create: `apps/designer/src/lib/editorSync.ts`

**Interfaces:**
- Consumes: everything above; existing `validateDocumentText`, `validateJsonText`, `PreviewPane`.
- Produces:
  - `VisualEditor(props: { doc: DocumentDef; data: unknown; onChange(next: { doc: DocumentDef; data: unknown }): void })` — three columns: left `BlockTree` + `DataPanel`, right `Inspector`; preview stays in the existing preview pane of `App`.
  - `editorSync.ts`: `docToText(doc: DocumentDef): string` (pretty JSON); `textToDoc(text: string): { ok: true; doc: DocumentDef } | { ok: false; issues: Issue[] }` (JSON parse + `parseDocument`).
- Behaviour: the tab switch Visual→JSON always succeeds (text from `docToText`, even for a schema-invalid doc); JSON→Visual calls `textToDoc` and stays on JSON with the issues shown when it fails. Preview feeds from the same `validDoc`/`validData` as phase A (last good render kept on invalid input). Save sends `dataSchema: inferJsonSchema(data)` and `example: data`.

- [ ] **Step 1: Write failing tests**: `docToText then textToDoc round-trips memo.document`; `textToDoc returns issues for invalid JSON and for schema-invalid documents`; `VisualEditor renders tree, data panel and inspector, and adding a block calls onChange with the new doc`; `switching to JSON with a schema-invalid doc shows its text`; `switching back to Visual is blocked while the text is invalid`; `save payload carries inferJsonSchema(data)` (test the payload builder as a pure function exported from `editorSync.ts`: `buildSaveRecord({ name, description, doc, data }): TemplateRecord`).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `editorSync.ts` and `VisualEditor.tsx`; modify `App.tsx` for the tab and to use `buildSaveRecord`. Keep the phase-A JSON tab code path unchanged.
- [ ] **Step 4: Run** `npx pnpm@9 --filter designer test` and `npx pnpm@9 --filter designer build` → both pass.
- [ ] **Step 5: Commit** `feat(designer): visual editor tab with free-form data`

### Task 9: End-to-end check and docs

**Files:**
- Modify: `README.md` (Template Designer section: Visual tab, free-form data, bindings)
- Modify: `docs/superpowers/specs/2026-11-03-designer-b1-visual-editor-design.md` (mark the three open items resolved: no arithmetic in expressions; no layout boxes so B3 is dropped; filters = `Object.keys(FILTERS)`)

- [ ] **Step 1: Run** `npx pnpm@9 test` (all packages) → green.
- [ ] **Step 2: Browser check** with `npx pnpm@9 --filter designer dev`: from a new template, add a paragraph, a table, and a columns block; in the data panel create `items` (array of objects) and `title`; bind a paragraph to `{{title}}` and the table to `items` via `each`; the preview canvas has non-transparent pixels and shows the rows; an unknown variable shows the warning; Save, reload, reopen, then flip to the JSON tab and back with nothing lost.
- [ ] **Step 3: Update README and spec**, then commit `docs: designer B1 usage and resolved open items`.
