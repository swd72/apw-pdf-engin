# Template Designer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local web app (`apps/designer`) to create, edit, live-preview and save JSON PDF templates in the same file format as MCP `save_template`.

**Architecture:** Vite + React app. A Vite dev-server middleware exposes `/api/templates` backed by a pure fs module (`templateStore`). The editor sits behind an `EditorPane` interface; phase 1 ships a CodeMirror JSON implementation. Preview reuses `@apw-pdf/react` `PdfPreview`.

**Tech Stack:** TypeScript, Vite 6, React 19, CodeMirror 6, vitest, `@apw-pdf/{core,templates,react,fonts,mcp}`.

**Spec:** `docs/superpowers/specs/2026-11-03-template-designer-design.md`

## Global Constraints

- Saved file format: `{ name, description, document, dataSchema, example }` (JSON, 2-space indent), file `<name>.json` in the template dir.
- Template dir default `apps/designer/saved-templates`, overridden by env `APW_PDF_TEMPLATE_DIR`.
- Payload limit 1 MB (`1024 * 1024` bytes, same as MCP).
- Name validation and path containment come from `@apw-pdf/mcp` (`validateTemplateName`, `resolveInside`, `PathNotAllowedError`); do not reimplement.
- Builtin templates (`templates` from `@apw-pdf/templates`) are read-only: no overwrite, no delete (HTTP 403).
- Document validation uses `parseDocument` from `@apw-pdf/core` (throws `ApwPdfError`).
- Commands run through `npx pnpm@9` on this machine (global pnpm shim is broken). Shell commands are prefixed with `rtk`.
- No auth, DB, drag-drop, or version history (spec non-goals).

## Review Focus

- Template name `../evil`, `a/b`, empty, or with `.json` suffix → rejected, nothing written.
- PUT of a name that already exists without `?overwrite=true` → 409, file unchanged.
- PUT with a valid-JSON but schema-invalid `document` → 422 with issue paths, nothing written.
- Request body larger than 1 MB → 413, nothing written.
- A corrupt/hand-edited `*.json` in the saved dir must not break `GET /api/templates` (skip it, still list the rest).
- Editor content that is invalid JSON mid-typing → preview keeps last good render, no crash.

---

### Task 1: Fix blank preview (pdfjs worker + error logging)

**Files:**
- Modify: `packages/react/src/PdfPreview.tsx` (the `catch {}` block)
- Modify: `examples/vite-react/src/main.tsx`
- Test: `packages/react/test/PdfPreview.error.test.tsx`

**Interfaces:**
- Produces: `PdfPreview` logs render failures via `console.error('[apw-pdf] preview render failed', err)`.

- [ ] **Step 1: Write failing test `logs pdfjs render errors instead of swallowing them`**: mock `pdfjs-dist` so `getDocument().promise` rejects; render `PdfPreview` under a provider stub that yields `status: 'ready'` with non-empty `bytes`; assert `console.error` was called with a first arg containing `[apw-pdf] preview render failed`. Follow the existing mocking style in `packages/react/test/`.
- [ ] **Step 2: Run** `rtk npx pnpm@9 --filter @apw-pdf/react test` → Expected: new test FAILS.
- [ ] **Step 3: Replace the empty `catch` in `PdfPreview.tsx`** with a `console.error` call (keep the comment about jsdom noise out; errors must be visible).
- [ ] **Step 4: In `examples/vite-react/src/main.tsx`** add `import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'` and `GlobalWorkerOptions.workerSrc = workerSrc` (import `GlobalWorkerOptions` from `pdfjs-dist`); add `pdfjs-dist@^4.10.38` to that example's dependencies.
- [ ] **Step 5: Run** react tests → PASS. Then `rtk npx pnpm@9 --filter vite-react dev`, open `http://localhost:5173/`, check canvas has non-transparent pixels (browser JS: count pixels with alpha > 0 is > 0).
- [ ] **Step 6: Commit** `fix(react): log preview render errors; set pdfjs workerSrc in vite example`

### Task 2: Scaffold `apps/designer` and `templateStore`

**Files:**
- Modify: `pnpm-workspace.yaml` (add `"apps/*"`), `vitest.workspace.ts` (add `'apps/*'`), `.eslintrc.cjs`/root `lint` glob only if needed
- Create: `apps/designer/package.json`, `tsconfig.json`, `vite.config.ts` (placeholder, no plugin yet), `index.html`, `scripts/copy-assets.mjs` (copy of `examples/vite-react/scripts/copy-assets.mjs`, same outputs into `apps/designer/public`)
- Create: `apps/designer/server/templateStore.ts`
- Test: `apps/designer/server/templateStore.test.ts`

**Interfaces:**
- Produces (all in `templateStore.ts`):
  - `interface TemplateRecord { name: string; description: string; document: unknown; dataSchema: object; example: unknown }`
  - `interface TemplateSummary { name: string; description: string; source: 'builtin' | 'saved' }`
  - `class StoreError extends Error { status: 403 | 404 | 409 | 413 | 422; issues?: Array<{ path: string; message: string }> }`
  - `createTemplateStore(dir: string): { list(): Promise<TemplateSummary[]>; get(name: string): Promise<TemplateRecord & { source: 'builtin' | 'saved' }>; put(record: TemplateRecord, opts: { overwrite: boolean }): Promise<void>; remove(name: string): Promise<void> }`

- [ ] **Step 1: Write failing tests** (temp dir per test, `fs.mkdtemp`): `put then get round-trips a record`; `list includes builtin 'memo' with source builtin and saved entries`; `put rejects name "../evil" with PathNotAllowedError and writes nothing`; `put of existing name without overwrite throws StoreError 409`; `put of builtin name 'memo' throws StoreError 403`; `put with schema-invalid document throws StoreError 422 with issues[0].path defined and writes nothing`; `put over 1 MB throws StoreError 413`; `remove deletes saved, throws 403 for builtin, 404 for missing`; `list skips a corrupt .json file and still lists the rest`; `get unknown name throws 404`.
- [ ] **Step 2: Run** `rtk npx pnpm@9 install` then `rtk npx pnpm@9 --filter designer test` → FAIL (module missing).
- [ ] **Step 3: Implement `createTemplateStore`** per the interface: validate with `validateTemplateName`/`resolveInside`; `parseDocument` errors mapped to `StoreError(422)` using `ApwPdfError` details (`path`, `message`); write with flag `'wx'` unless `overwrite`, map `EEXIST` to 409; builtin lookup via `Object.hasOwn(templates, name)`; `list` tolerates missing dir and corrupt files.
- [ ] **Step 4: `package.json`** for `designer`: private, type module, scripts `dev` (with `predev` copy-assets), `build`, `test` (`vitest run`); dependencies `@apw-pdf/{core,templates,react,fonts,mcp}` `workspace:*`, `react`, `react-dom`, `pdfjs-dist`, `codemirror`, `@codemirror/lang-json`, `@codemirror/lint`, `@codemirror/state`, `@codemirror/view`; devDependencies vite, `@vitejs/plugin-react`, vitest, jsdom, `@testing-library/react`, types.
- [ ] **Step 5: Run** designer tests → PASS.
- [ ] **Step 6: Commit** `feat(designer): scaffold app and file-backed template store`

### Task 3: Template HTTP API (Vite middleware)

**Files:**
- Create: `apps/designer/server/templateApi.ts`
- Modify: `apps/designer/vite.config.ts` (register plugin; dir from `process.env.APW_PDF_TEMPLATE_DIR ?? <app>/saved-templates`)
- Test: `apps/designer/server/templateApi.test.ts`

**Interfaces:**
- Consumes: `createTemplateStore`, `StoreError` (Task 2).
- Produces: `createTemplateApiHandler(store): (req: IncomingMessage, res: ServerResponse, next: () => void) => void`; `templateApiPlugin(dir: string): import('vite').Plugin`. Routes: `GET /api/templates`, `GET|PUT|DELETE /api/templates/:name`; PUT body is a `TemplateRecord` JSON, `?overwrite=true` allowed. Error body `{ error: string, issues?: [...] }` with the `StoreError.status`.

- [ ] **Step 1: Write failing tests** starting the handler on `http.createServer` (port 0) with a temp-dir store, using `fetch`: `GET /api/templates lists builtin memo`; `PUT then GET round-trip`; `PUT existing without overwrite → 409, with ?overwrite=true → 200`; `PUT invalid document → 422 body has issues`; `PUT body > 1 MB → 413 before parsing completes`; `PUT /api/templates/..%2Fevil → 4xx and nothing written`; `DELETE builtin → 403`; `non-/api path calls next()`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** handler: read body with a byte counter that aborts at the limit (413); path name taken from URL and `decodeURIComponent`'d then passed to the store; the URL name must equal `record.name` else 422; JSON parse failure → 400.
- [ ] **Step 4: Wire the plugin** via `configureServer(server) { server.middlewares.use(handler) }`.
- [ ] **Step 5: Run** tests → PASS.
- [ ] **Step 6: Commit** `feat(designer): /api/templates dev-server middleware`

### Task 4: Validation lib and EditorPane (JSON)

**Files:**
- Create: `apps/designer/src/lib/validate.ts`, `src/lib/api.ts`, `src/components/EditorPane.ts` (types only), `src/components/JsonEditorPane.tsx`
- Test: `apps/designer/src/lib/validate.test.ts`, `src/components/JsonEditorPane.test.tsx`

**Interfaces:**
- Produces:
  - `interface Issue { path: string; message: string; line?: number }`
  - `validateDocumentText(text: string): { ok: true; value: unknown } | { ok: false; issues: Issue[] }` (invalid JSON → one issue with `path: ''` and `line` from the JSON parse position when available; schema failures → `parseDocument` issues)
  - `validateJsonText(text: string)` same shape, JSON syntax only (used for example data)
  - `interface EditorPaneProps { value: string; onChange(next: string): void; issues: Issue[] }` and `type EditorPane = (props: EditorPaneProps) => JSX.Element` in `EditorPane.ts`
  - `api.ts`: `listTemplates()`, `getTemplate(name)`, `saveTemplate(record, overwrite)`, `deleteTemplate(name)`; non-2xx throws `ApiError { status, issues? }`
  - `JsonEditorPane: EditorPane` (CodeMirror 6, json language, lint markers from `issues` with `line`)

- [ ] **Step 1: Write failing tests**: `validateDocumentText returns ok for memo.document JSON`; `returns issue with path for schema-invalid document`; `returns single issue for truncated JSON`; `JsonEditorPane calls onChange when text changes` (jsdom, drive via `EditorView` dispatch or exposed textbox) and `renders without crashing with issues containing line numbers`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the three files as specified; `api.ts` is a thin `fetch` client against `/api/templates`.
- [ ] **Step 3b: Add `align` autocomplete** to `JsonEditorPane`: a CodeMirror completion source offering `left | center | right | justify | thaiDistributed` when the cursor is in the value of an `"align"` key. Test `align completion lists thaiDistributed`.
- [ ] **Step 3c: New-template starter** in `src/lib/starter.ts`: `newTemplateRecord(name: string): TemplateRecord` copies `memo` and sets `align: 'thaiDistributed'` on the body paragraphs. Test `newTemplateRecord uses thaiDistributed and passes parseDocument`. `TemplateList` "New" uses it.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(designer): validation lib, api client, JSON EditorPane`

### Task 5: Preview, usage snippet, App wiring

**Files:**
- Create: `apps/designer/src/main.tsx` (sets pdfjs `workerSrc` as in Task 1), `src/App.tsx`, `src/components/TemplateList.tsx`, `src/components/PreviewPane.tsx`, `src/components/UsageSnippet.tsx`, `src/lib/snippet.ts`
- Test: `apps/designer/src/lib/snippet.test.ts`, `src/components/PreviewPane.test.tsx`

**Interfaces:**
- Consumes: `validateDocumentText`, `validateJsonText`, `api`, `JsonEditorPane`.
- Produces:
  - `buildSnippets(name: string): { react: string; cli: string }` — react string contains `PdfDownloadButton` and the template name; cli is `apw-pdf render <name> data.json -o out.pdf`
  - `PreviewPane({ doc: unknown | null; data: unknown | null })` — holds the last non-null good `doc`/`data` and keeps rendering them when props become null (invalid input); wraps `ApwPdfProvider` (`fontBaseUrl="/fonts"`, `wasmUrl="/harfbuzz-subset.wasm"`, `assets={{ garuda: '/assets/garuda-placeholder.png' }}`, `worker`) as in `examples/vite-react/src/App.tsx`.

- [ ] **Step 1: Write failing tests**: `buildSnippets includes PdfDownloadButton and the template name`; `PreviewPane keeps last good doc when doc becomes null` (assert the previously rendered alert-free canvas/aria-label remains; stub `usePdf` as the existing react tests do).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `snippet.ts`, `PreviewPane.tsx`, `UsageSnippet.tsx` (button copies via `navigator.clipboard.writeText`, wrapped in try/catch), `TemplateList.tsx` (builtin shown read-only with badge; New / Duplicate / Delete on saved; Delete confirms), `App.tsx`: three columns; editor tabs `document` / `example`; 400 ms debounce before validating; on valid → pass parsed values to `PreviewPane`, on invalid → `null` and show issues under the editor; Save button calls `saveTemplate` (first save of a new name `overwrite=false`, subsequent `true`), errors shown inline; builtin selected → editor read-only and Save becomes "Save as copy" requiring a new name.
- [ ] **Step 4: Run** designer tests → PASS.
- [ ] **Step 5: Commit** `feat(designer): preview, usage snippet and app shell`

### Task 6: End-to-end check and docs

**Files:**
- Modify: `README.md` (short "Template Designer" section: `npx pnpm@9 --filter designer dev`, env `APW_PDF_TEMPLATE_DIR`, sharing the folder with MCP)
- Modify: `.gitignore` (add `apps/designer/saved-templates/` only if the user does not want samples committed — default: do not ignore, keep a `.gitkeep`)

- [ ] **Step 1: Run** `rtk npx pnpm@9 build` and `rtk npx pnpm@9 test` → all green.
- [ ] **Step 2: Start** `rtk npx pnpm@9 --filter designer dev`; in the browser: open the app, canvas non-transparent pixels > 0; create a template from a copy of `memo`, change a field in `example`, preview updates; Save; reload page; template still listed and loads.
- [ ] **Step 3: Cross-check MCP**: set `APW_PDF_TEMPLATE_DIR` to the designer's folder and confirm `list_templates` (via `packages/mcp` test helper or a one-off script) returns the saved template.
- [ ] **Step 4: Update README**, then commit `docs: template designer usage`.
