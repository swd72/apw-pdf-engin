import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../..')

function walkTsFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walkTsFiles(full))
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      out.push(full)
    }
  }
  return out
}

describe('purity of core and pdf packages', () => {
  it('does not import node builtins or touch window/document in packages/{core,pdf}/src', () => {
    const dirs = [
      path.join(repoRoot, 'packages/core/src'),
      path.join(repoRoot, 'packages/pdf/src'),
    ]
    const forbidden = /from\s+['"](node:|fs|path|url)['"]|\bwindow\.|\bdocument\./
    const files = dirs.flatMap(walkTsFiles)
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8')
      expect(content, `Impure reference in ${file}`).not.toMatch(forbidden)
    }
  })
})
