# AGY Implementation Notes

- **Task 1 (Workspace scaffold, errors, units)**: done — no deviations; added `allowBuilds: { esbuild: true }` to `pnpm-workspace.yaml` for pnpm 12 build approval.
- **Task 2 (Document schema)**: done — no deviations.
- **Task 3 (Thai utilities)**: done — no deviations.
- **Task 4 (Expressions, filters, binding)**: done — no deviations.
- **Task 5 (Fonts package and providers)**: done — no deviations.
- **Task 6 (Font registry, metrics, shaping)**: done — no deviations.
- **Task 7 (Segmentation and clusters)**: done — no deviations.
- **Task 8 (Inline items and line breaking)**: done — no deviations.
- **Task 9 (Line placement — alignment, tabs, anchors, Thai Distributed)**: done — no deviations.
- **Task 10 (Paragraph layout and LayoutTree types)**: done — no deviations.
- **Task 11 (Block flow and pagination)**: done — merged contiguous same-style `PlacedRun`s on a line in `placeLine` so each single-style line emits one `glyphs` item.
- **Task 12 (Tables and columns)**: done — no deviations.
- **Task 13 (Signature, page numbers, createEngine)**: done — core coverage 86.82% lines; no deviations.
- **Task 14 (Font subsetting and CID font embedding)**: done — in `createSubsetter`, added Thai combining mark codepoints (U+0E31, U+0E34..U+0E3A, U+0E47..U+0E4D) to `hb_subset_input_unicode_set` so that re-shaping `'ปี่'` on a GID-subsetted font (`{0, 240, 344, 361}`) retains pre-GSUB cmap GIDs 266/281 and GSUB rules to `[240, 344, 361]` while keeping subset size ~7.4 KB (< 10 KB).
- **Task 15 (`writePdf` and `createPdfEngine`)**: done — `@apw-pdf/pdf` coverage 89.43% lines; collapsed HarfBuzz's decomposed unshifted sara am (`uni0E4D` + `uni0E32`) into the font's precomposed `uni0E33` glyph in `writePdf` so `/ToUnicode` round-trips U+0E33 (`'ำ'`) without colliding with U+0E32 (`'า'`).
