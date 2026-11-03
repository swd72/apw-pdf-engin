# Template Designer — Design

Date: 2026-11-03
Status: Draft, awaiting user review

## Purpose

Developers using pdfmake (e.g. `hrm-v3-frontend`) lose time hand-tuning positions and hit font drift. `apw-pdf-engin` already renders JSON templates + data to PDF. This adds a **template designer**: a small local web app to create, edit, preview and save templates, then reuse them in a project (print button via `@apw-pdf/react`, or `apw-pdf render` CLI).

Audience (phase 1): **developers (A)**. Non-technical visual editing (B) is a later phase; the design leaves a seam for it.

## Success criteria

- Create a new template, edit `document` and `example` JSON, see live PDF preview, save to disk.
- Validation errors from `parseDocument` shown with their path.
- Saved files are the same format MCP `save_template` writes, so the UI and Claude/MCP share one template folder.
- One click copies a usage snippet to wire the template into a project.
- Lightweight: no auth, no DB, no new runtime deps beyond what the example app uses plus one JSON editor.

## Non-goals (YAGNI)

Drag-and-drop layout, visual/form editor (B), auth, multi-user, version history, hosted deployment.

## Prerequisite fix

`examples/vite-react` preview renders a blank canvas: pdfjs `GlobalWorkerOptions.workerSrc` is never set, and `PdfPreview` swallows the error (`catch {}`).
- Set `workerSrc` (Vite: `pdfjs-dist/build/pdf.worker.min.mjs?url`) in the app entry.
- `PdfPreview` logs the error with `console.error` instead of ignoring it.

## Architecture

New workspace `apps/designer/` (Vite + React). No changes to existing packages except the `PdfPreview` logging tweak.

```
apps/designer/
  vite.config.ts        # includes templateApiPlugin
  server/templateApi.ts # Vite middleware: /api/templates
  src/
    App.tsx
    components/TemplateList.tsx
    components/EditorPane.tsx    # interface; JsonEditorPane is phase-1 impl
    components/PreviewPane.tsx   # wraps ApwPdfProvider + PdfPreview
    components/UsageSnippet.tsx
    lib/api.ts                   # fetch client
  saved-templates/              # default store (configurable via env APW_PDF_TEMPLATE_DIR)
```

### Template API (dev-server middleware)

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/templates` | list builtin (read-only) + saved |
| GET | `/api/templates/:name` | full record |
| PUT | `/api/templates/:name` | validate then write; `?overwrite=true` required to replace |
| DELETE | `/api/templates/:name` | saved only; builtin → 403 |

- File format: `{ name, description, document, dataSchema, example }`.
- `validateTemplateName` and path-resolve-inside logic are reused from `@apw-pdf/mcp` (`paths.ts`) rather than reimplemented. If they are not exported, export them.
- `parseDocument(document)` must pass before writing; failure → 422 with zod issues (`path`, `message`).
- Payload limit 1 MB (same as MCP).
- Builtin names cannot be overwritten.

### UI

Three columns:
1. **List**: builtin (read-only badge) + saved; New, Duplicate, Delete.
2. **Editor**: tabs `document` / `example`. JSON editor with inline error markers from validation. Debounced (~400 ms) parse; invalid JSON or schema errors do not update the preview, last good preview stays.
3. **Preview**: live PDF, Download, Print, "Copy usage snippet".

Usage snippet (copied to clipboard) for the selected template:
- React: `<PdfDownloadButton doc={...} data={...}>` import line using the saved JSON.
- CLI: `apw-pdf render <name> data.json -o out.pdf`.

### Seam for phase B

`EditorPane` is an interface `{ value: DocumentDef; onChange(next): void; errors: Issue[] }`. Phase 1 ships `JsonEditorPane`; a visual/form editor can be added and selected by a toggle without touching list, preview or API.

## Error handling

- Invalid JSON: shown inline, no API call.
- Schema invalid: 422 issues mapped to editor markers.
- Write failure / name rejected: toast with message.
- pdf render failure: preview shows `role="alert"` error (existing `PdfPreview` behavior).

## Testing

- vitest, template API: path traversal (`../evil`) rejected; builtin overwrite rejected; invalid document → 422 and nothing written; overwrite requires flag; round-trip save → list → get.
- Component tests: validation error surfaces; preview keeps last good state on invalid input.
- Browser smoke (manual or Playwright): start dev, open app, canvas has non-transparent pixels after load; save then reload shows the template.

## Open assumptions

- JSON editor library: CodeMirror 6 (smallest option with JSON lint). Revisit if bundle size matters.
- Default store is `apps/designer/saved-templates`; user can point it at the same folder as the MCP server.
