# Designer Playground UI — Design

Date: 2026-11-03
Status: Approved in chat by the user ("เริ่มเลย"). Supersedes `2026-11-03-designer-card-ui-design.md`.
Builds on: B1 logic layer (`editor/*`, `lib/editorSync.ts`, phase-A API) and the UI kit committed in `f43f1d6` (`ui/*`, `moveBlockTo`, `pageSettings`).

## Why the card design was dropped

The user rejected it: "not pretty, hard to use, too many buttons, everything fixed, not dynamic". They want a **playground** layout: **PDF preview in the centre, panels on the left and right**, like Figma/Webflow, with few visible buttons and panels the user can resize.

## Layout

```
┌ top bar: template name · Visual | JSON · Save · ⋯ ───────────────┐
├───────────────┬───────────────────────────────┬─────────────────┤
│ LEFT          │ CENTRE                        │ RIGHT           │
│ tabs:         │ PDF stage (largest area)      │ Properties of   │
│ โครงสร้าง     │ zoom / fit / page navigation  │ the selection;  │
│ ข้อมูล        │                               │ document        │
│ เทมเพลต       │                               │ settings if     │
│               │                               │ nothing chosen  │
└───────────────┴───────────────────────────────┴─────────────────┘
```

- **Resizable and collapsible panels:** drag the splitter between panes; double-click a splitter to collapse/expand that side; keyboard: focus a splitter and use Left/Right arrows (role `separator`). Sizes and collapsed state persist in `localStorage` (wrapped in try/catch). Minimum widths: sides 220px, centre 360px. Below 1100px both side panels start collapsed to icons. No horizontal page scroll at any width ≥ 900px.
- **Top bar (slim):** template name + unsaved dot; segmented **Visual | JSON**; one primary **Save** (becomes **Save as copy** for builtin templates); a `⋯` menu holding "Use in project" (opens the snippets popover), Duplicate, Delete, Page settings shortcut.

## Left panel

- **โครงสร้าง (Outline):** clean tree, one row per block: type icon, label, short summary, warning dot for unresolved variables. **No per-row buttons.** A single `⋯` appears on hover/selection (Duplicate, Delete, Move into previous, Move out, Edit JSON). Interactions: click select; drag to reorder (including into/out of containers, via `moveBlockTo`); keyboard (↑/↓ move selection, Alt+↑/↓ reorder, Delete, Ctrl+D duplicate, Enter focus first property). Header has one **+ เพิ่ม** menu (grouped: basic / advanced) and a `/` quick-add search popover.
- **ข้อมูล (Data):** compact tree `key | value | ⋯`; type as small chip with menu; nested objects/arrays collapsible with guide lines; "Add field"/"Add item". Keys unusable in `{{ }}` show a warning chip.
- **เทมเพลต (Templates):** builtin + saved list with search, New/Duplicate through the top bar `⋯` and a `+` here.

## Centre

The PDF is the main work area: A4 sheet on a dark canvas, **fit width / fit page / percentage zoom** (25–200%), vertical scroll through all pages with a page indicator, tiny floating toolbar (zoom −/+, fit, download). The preview keeps the last good render on invalid input and is debounced (existing behaviour). Clicking the PDF does not select blocks (engine exposes no layout boxes); a later round may add text-match selection.

## Right panel — Properties (dynamic, progressive disclosure)

- Shows **only the properties that apply** to the selected block type, grouped into collapsible sections (Content, Layout, Text style, Data binding, Advanced). Optional properties that are not set are hidden behind **+ เพิ่มคุณสมบัติ** (a searchable list); set properties show a small reset control. Text fields use the binding input with `{ } ตัวแปร` picker (data paths, loop-variable fields, filters).
- **Paragraph:** text, alignment (incl. Thai distributed), font (size, bold, italic, colour, family), indents and spacing, tabs, keep options, named style.
- **Table:** column list (width, align, add/remove/reorder), rows source (fixed vs from data array + loop variable), header/footer toggles, and **"แก้ไขตาราง" opens a large grid editor dialog** for cells (the right panel is too narrow for a grid). Other block types: all schema fields in the same section pattern.
- **Nothing selected:** document settings — page size/orientation/margins, font family/size/line spacing, numerals, page number.

## Visual system

Reuse `ui/tokens.css`. Calm neutral surfaces, one accent, 4/8px spacing, 14px base, subtle borders, clear hover/focus/selected states, icons 20px. Panels have a header row (title + collapse), content scrolls inside the panel, never the page. Dense but not cramped: 32px control height, 8px gaps.

## Unchanged

All logic modules, JSON mode, save format, `moveBlockTo`, `pageSettings`, UI kit.

## Success criteria

1. PDF is centred and largest; left and right panels resize/collapse and remember state.
2. A new user can add a paragraph, type in the Properties panel, bind a variable via `{ }`, add a table bound to an array and reorder blocks by dragging, with no per-row button clutter.
3. Every block type remains fully editable (properties or Edit JSON).
4. All existing logic tests pass; new tests cover splitter behaviour, sizing helpers, fit-zoom helper, outline keyboard/drag interactions, properties disclosure and the table grid dialog.
5. Screenshots at 1440px and 1024px show no clipped controls and no horizontal scroll.
6. Old `BlockTree`, `Inspector`, `inspectors/*`, `DataPanel`, `cards/DocumentView`/`InsertLine` are removed or reused; no dead code remains.

## Non-goals

Click-on-PDF selection (possible later by text matching), rich per-run text formatting, dark theme, undo/redo, multi-user.
