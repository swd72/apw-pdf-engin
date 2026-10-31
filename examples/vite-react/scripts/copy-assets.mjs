import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const repoRoot = path.resolve(rootDir, '..', '..')
const publicDir = path.join(rootDir, 'public')
const publicFontsDir = path.join(publicDir, 'fonts')

await fs.mkdir(publicFontsDir, { recursive: true })

// Copy SIPA Thai fonts into public/fonts
const fontsSourceDir = path.join(repoRoot, 'packages', 'fonts', 'files')
const fontEntries = await fs.readdir(fontsSourceDir)
for (const entry of fontEntries) {
  if (entry.endsWith('.ttf')) {
    await fs.copyFile(
      path.join(fontsSourceDir, entry),
      path.join(publicFontsDir, entry),
    )
  }
}

// Copy garuda placeholder into public/assets
const publicAssetsDir = path.join(publicDir, 'assets')
await fs.mkdir(publicAssetsDir, { recursive: true })
await fs.copyFile(
  path.join(repoRoot, 'packages', 'templates', 'assets', 'garuda-placeholder.png'),
  path.join(publicAssetsDir, 'garuda-placeholder.png'),
)

// Copy harfbuzz-subset.wasm into public/
const requireFromPdf = createRequire(
  path.join(repoRoot, 'packages', 'pdf', 'package.json'),
)
const wasmPath = requireFromPdf.resolve('harfbuzzjs/dist/harfbuzz-subset.wasm')
await fs.copyFile(wasmPath, path.join(publicDir, 'harfbuzz-subset.wasm'))
