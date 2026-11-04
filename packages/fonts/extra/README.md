# Extra (Unpublished) Fonts

The `THSarabunIT9-*.ttf` and `THNiramitIT9-*.ttf` font files placed in this directory are **not** included in the published `@apw-pdf/fonts` npm package (`packages/fonts/package.json` only ships `files/`).

Why:
- Only the SIPA-distributed fonts (`THSarabunNew` and `THSarabunPSK`) are bundled and redistributed in `@apw-pdf/fonts`.
- `THSarabunIT9` and `THNiramitIT9` are not redistributed by this package. If your project requires them, you must obtain and supply the `.ttf` files yourself from an authorized source and load them via a custom `FontProvider` (see `../README.md`).
