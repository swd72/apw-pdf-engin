# Designer Card UI — Design

Date: 2026-11-03
Status: Approved in chat by the user ("ok"); replaces the B1 Tree + Inspector UI layer.
Builds on: `2026-11-03-designer-b1-visual-editor-design.md` (logic layer stays).

## Problem

The B1 UI makes the user select a block in a tree and edit it in a separate inspector, then look at a third place (preview). Tree rows carry six tiny icon buttons, the inspector column is empty most of the time, the data panel overflows, the app bar has no hierarchy, and usage snippets eat the preview column. The user judged the UX/UI "very bad" and asked for a redesign that is **easy to use**.

## Goal

Edit the document **in one place, in reading order**, like Notion/Word: each block is a card whose content is edited inline; the PDF preview stays visible beside it.

## Layout

- **App bar:** template name + save state; segmented control **Document | Data | JSON**; one primary **Save** button (secondary: Save as copy for builtins); **Page** popover; **Use in project** popover (the usage snippets).
- **Sidebar:** template list, narrow, collapsible.
- **Left pane (editing):** depends on the mode — Document (cards), Data (data view), JSON (existing JSON editor).
- **Right pane:** sticky PDF preview with zoom, A4 sheet prominent.
- Responsive: at 1024px both panes remain usable (sidebar collapsed by default below 1200px); no horizontal page scroll.

## Document mode

- Blocks render as **cards in document order**; nested containers (`columns`, `each`, `if`, table cells with blocks) show an indented drop area inside the card.
- Between every two cards (and at the ends) a **`+` insert line**; clicking opens a picker with large icons: Text, Table, Columns, Signature, Image, Line, Space, Page break; **Advanced**: Repeat (`each`), Condition (`if`).
- Card chrome: type icon + label, drag handle, up/down buttons and a `⋯` menu (Duplicate, Delete, Move into previous, Move out, Edit JSON) visible on hover or when selected. Existing `aria-label`s are kept (`Move up`, `Move down`, `Move into previous`, `Move out`, `Duplicate`, `Delete`).
- **Drag and drop** reorders cards, including into/out of containers.
- Cards edit inline:
  - **Text card:** one multi-line field; on focus a toolbar: Bold, Italic, alignment (left, center, right, justify, Thai distributed), font size; **`{ } Variable`** picker listing data paths (and loop-variable fields in scope) and a filter submenu; "More settings" expands the remaining paragraph fields (indents, spacing, line spacing, tabs, font family/colour, keep options, named style).
  - **Table card:** a real grid; type in cells; add/remove/move rows and columns; width and alignment per column; switch **Rows from data** with an array picker and loop variable; header/footer toggles; advanced table options under "More settings".
  - **Columns card:** column widths and per-column nested areas. **Signature, Image, Line, Space, Page break:** their few fields inline. **Repeat / Condition:** the array/test field plus the nested area.
- Unresolved variables show a warning chip on the card and in a collapsible "Warnings" strip under the app bar.
- Empty document shows an empty state with the `+` picker.

## Data mode

Compact rows `key | value | ⋯`; type shown as a small chip that opens a menu; nested objects/arrays are collapsible with guide lines; remove, duplicate and rename live in `⋯`; "Add field" at the end of each object, "Add item" for arrays; keys that cannot be used in `{{ }}` show a warning chip.

## Page popover

Page size (A4, A5, Letter, Legal), orientation, margins (top/bottom/left/right), font family, font size, line spacing, numerals (arabic/thai) — map to `doc.page`, `doc.font`, `doc.numerals`.

## Visual system

One token file (CSS variables): single accent colour, neutral greys, 4/8px spacing scale, 14px base font, 6/8px radii, focus ring, explicit hover/selected/disabled/error states. Primitives: `IconButton`, `Menu`, `Popover`, `SegmentedControl`, `Chip`, card and field classes. Light theme only. Thai text uses the system Thai-capable font stack.

## Unchanged

`docModel`, `dataModel`, `bindings`, `useEditorState`, `editorSync`, phase-A API, JSON editor tab, saved file format. New pure code only where needed: `moveBlockTo` (drag and drop) and `applyPageSettings`.

## Success criteria

1. A first-time user can add a text block, type into it, add a table bound to an array, and reorder blocks without opening any separate panel.
2. Every block type that the B1 inspectors supported can still be edited (inline or via "More settings"/"Edit JSON").
3. All existing logic tests pass; new tests cover `moveBlockTo`, `applyPageSettings`, card interactions and the primitives.
4. Screenshots at 1440px and 1024px show no clipped controls and no horizontal page scroll.
5. The old `BlockTree`, `Inspector` and `inspectors/*` are removed once cards cover all types (no dead code), keeping `GenericJsonInspector` behaviour as "Edit JSON".

## Non-goals

Per-run rich text formatting, click-on-paper selection (engine exposes no layout boxes), dark theme, undo/redo (B2), multi-user.
