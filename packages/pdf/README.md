# @apw-pdf/pdf

Pure TypeScript PDF writer for `@apw-pdf/core`. Subsets TrueType fonts with `harfbuzz-subset.wasm` (retaining Glyph IDs), embeds `CIDFontType2` / `Identity-H` fonts with `/ToUnicode` CMaps for accurate Thai text extraction, and renders `LayoutTree` pages deterministically via `pdf-lib`.
