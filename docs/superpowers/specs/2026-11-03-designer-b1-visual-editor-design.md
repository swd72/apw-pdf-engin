# Designer B1 — Visual Block Editor with Free-form Data — Design

Date: 2026-11-03
Status: Draft, awaiting user review
Builds on: `2026-11-03-template-designer-design.md` (phase A, committed on `feat/template-designer`)

## Purpose

Phase A ships a JSON editor. Phase B adds a visual editor so a developer (later: non-technical users) edits a template without hand-writing JSON, in the spirit of the reference prototype (3-panel studio: tools, canvas, property inspector, data panel). B1 is the core: **block tree + inspector + free-form data panel + variable binding**.

Later rounds (separate specs): **B2** presets with parameter forms, page/font toolbar, undo/redo. **B3** click-on-paper block selection (only if the engine exposes block layout boxes; otherwise dropped).

## Principles (from the user)

- The document is `DocumentDef` only. It is the single source of truth; saved files stay in the phase-A format and work with MCP, CLI and `@apw-pdf/react` unchanged.
- **Data shape is not fixed.** Like Word, the user defines any variables, arrays and nested objects. No required schema, no fixed fields per template.
- Preview is the real engine (PDF canvas), not a DOM imitation, so what the user sees is what prints.
- The JSON editor from phase A stays as an advanced tab and must round-trip with the visual editor.

## Success criteria

- Build a document from blank using only the UI: add blocks, edit their properties, nest blocks (columns, each, if, table cells), reorder, duplicate, delete.
- Define data from scratch in the UI (scalars, nested objects, arrays) and bind any text field to it with `{{path}}` and `{{path | filter}}`.
- Bind a table's rows to any array in the data (`rows: { each, as, cells }`) and edit its columns.
- Switching between the visual view and the JSON tab loses nothing; invalid JSON blocks the switch with the error shown.
- Every edit updates the PDF preview; a document that fails `parseDocument` keeps the last good preview and shows issues.
- Saved `dataSchema` is generated from the example data automatically.

## Non-goals (B1)

Presets and parameter forms (B2); page/font toolbar and undo/redo (B2); click-on-paper selection (B3); typing directly on the paper; drag-and-drop between nesting levels (move up/down and "move into/out of" buttons only); `styles` map editor and `dictionary` editor (edit via JSON tab); multi-user.

## Architecture

Everything lives in `apps/designer/src/`. New modules (one responsibility each):

| Module | Responsibility |
|---|---|
| `editor/docModel.ts` | Pure functions over `DocumentDef`: get/set/insert/remove/move/duplicate a block by **path** (`BlockPath = (string \| number)[]`, e.g. `['blocks', 2, 'columns', 0, 'blocks', 1]`). No React. |
| `editor/blockCatalog.ts` | Per block type: label, default factory `() => Block`, which child lists it can hold (`columns[i].blocks`, `each.blocks`, `if.then/else`, table cells). |
| `editor/dataModel.ts` | Pure functions over free-form JSON: `listPaths(data)` (every scalar path and every array path, with inferred type), `setAtPath`, `removeAtPath`, `renameKey`, `addItem`, `inferJsonSchema(data)`. |
| `editor/bindings.ts` | `scanBindings(doc): Binding[]` (all `{{ }}` expressions in text/runs/cells with their path); `unresolved(doc, data): Binding[]`; `FILTERS` list (`thaiDate`, `thaiNum`, `prefix`, `number`, `baht`, `upper`, `lower`, `default`) with argument hints. |
| `editor/useEditorState.ts` | Holds `{ doc, data, selectedPath }`, exposes actions that call `docModel`/`dataModel`; emits changes to the parent. |
| `components/BlockTree.tsx` | Nested tree of blocks; select, move up/down, move into/out of the neighbouring container, duplicate, delete, "add block" menu from `blockCatalog`. |
| `components/Inspector.tsx` | Dispatches to a form per block type. |
| `components/inspectors/*.tsx` | Hand-built forms: `ParagraphInspector`, `TableInspector`, `ColumnsInspector`, `SignatureInspector`, `ImageInspector`, `SpacerInspector`, `LineInspector`, `EachIfInspector`; `GenericJsonInspector` fallback (edit that block's JSON). |
| `components/BindingInput.tsx` | Text input/textarea with `{{` autocomplete from `listPaths(data)` and `FILTERS`; highlights unresolved variables. |
| `components/DataPanel.tsx` | Tree editor for the free-form data; add/rename/delete keys, add/remove array items, change value type (text, number, true/false, object, array). |
| `components/VisualEditor.tsx` | Layout: BlockTree + Inspector + DataPanel; PreviewPane stays as is. |

`App.tsx` gains a top-level tab: **Visual | JSON**. Both edit the same `doc`/`data` held in `App`; the JSON tab remains the phase-A `JsonEditorPane`.

## Behaviour details

### Block paths and nesting
- `docModel` addresses blocks only by path; no ids are added to the saved document (paragraph `id` is untouched).
- Containers: `columns` (each column has `blocks`), `each` (`blocks`), `if` (`then`, `else`), and table cells (`cell.blocks`). Cells given as `{ text }` are shown as a text field; converting a cell to blocks is an explicit action.
- Move up/down swaps within the same list; "move into" appends to the previous sibling container, "move out" inserts after the parent. Illegal moves are disabled, not errors.

### Free-form data
- `data` is any JSON object. The data panel never rejects a key name that is a valid JS identifier path segment; other names are allowed but flagged "not usable in `{{ }}`" (engine paths).
- `listPaths` returns dotted paths for scalars (`signer.name`), array paths (`items`), and for arrays of objects the per-row field names (`items[].name`) used for the row variable inside `each` (the variable name is the block's `as`, so row paths are offered as `<as>.name`).
- Value types are inferred from JSON; the panel lets the user change the type, converting (`"12"` ↔ `12`) where lossless and warning otherwise.

### Variable binding
- `BindingInput` offers: scalar paths; inside an `each` block or an `each` table, the loop variable's fields; filters after `|`.
- `unresolved(doc, data)` powers a warning list under the inspector and a dot on the offending tree node. An unresolved variable is a warning, never blocks saving (the engine already tolerates and reports it).

### Tables
- `TableInspector` edits: columns (add, remove, move, width spec, align), header row cells, body mode **fixed rows** or **each** (`each` = any array path, `as` = identifier validated by the schema rule), footer row cells, `repeatHeader`, `border`, `cellPadding`, `allowRowSplit`.
- Each cell supports `text` with binding; `colSpan`/`rowSpan` as numbers; a "make blocks" action converts a cell into `{ blocks: [...] }`.
- Summary/total cells use ordinary bound text (e.g. `{{ total | number:2 }}`); computing totals is the data author's job in B1 (no formula engine), unless the engine already supports an expression — to be verified in the plan.

### Paragraph
- Text or runs (runs edited as a list with bold/italic/underline/size/colour per run, plus special runs: tab, fill with leader, checkbox, line break, page number/count). Style fields: `align` (including `thaiDistributed`), indents, spacing, line spacing, tabs, font overrides, keep options.
- Named `style` is a dropdown of `doc.styles` keys (read-only list in B1).

### Sync with the JSON tab
- Visual → JSON: pretty-print the current `doc`.
- JSON → Visual: allowed only if the text parses and passes `parseDocument`; otherwise stay on the JSON tab with issues shown. Unknown keys are impossible after `parseDocument` (schema rejects them).

### Save
- Uses the phase-A API. `dataSchema` is set from `inferJsonSchema(data)` on every save; `example` is the current `data`.

## Error handling

- Schema-invalid state during editing (e.g. empty `columns` array): the preview keeps the last good render, issues list names the path; the visual editor never throws on a half-built document (all `docModel` functions tolerate missing arrays and return the document unchanged on an invalid path).
- Illegal tree operations are no-ops with the control disabled.
- Data edits that would make a key empty or duplicate are rejected inline.

## Testing

- `docModel`: insert/remove/move/duplicate at root and nested paths; move-into/out; invalid path returns the same document; immutability (input not mutated).
- `dataModel`: `listPaths` on nested objects and arrays of objects; `setAtPath`/`removeAtPath`/`renameKey` (duplicate rename rejected); `inferJsonSchema` for scalars, nested, arrays (empty array → `items: {}`).
- `bindings`: `scanBindings` finds expressions in `text`, `runs`, table cells, nested blocks; `unresolved` respects `each` loop variables.
- Components (jsdom): add block via tree menu updates doc; selecting a node shows its inspector; `BindingInput` autocomplete lists a data path; DataPanel add/rename/delete round-trips; Visual↔JSON tab switch preserves the document and blocks on invalid JSON.
- Smoke (browser): build memo-like doc from blank with a table bound to an `items` array; preview renders a non-empty canvas; save, reload, reopen.

## Open items to verify during planning

1. Resolved: `{{ }}` supports paths and filters only; `if.test` supports comparisons (`==`, `!=`, `<`, `>`, `<=`, `>=`), `&&`, `||`, `!`, with no arithmetic, so computed totals live in the data.
2. Resolved: The engine exposes no block layout boxes, so B3 (click on paper) is dropped.
3. Resolved: Filters are `Object.keys(FILTERS)` from `@apw-pdf/core`.
