import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packagesRoot = path.resolve(__dirname, '../../')

describe('ESM-only package configuration (F1)', () => {
  const packageDirs = fs
    .readdirSync(packagesRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => fs.existsSync(path.join(packagesRoot, name, 'package.json')))

  it('verifies packages were discovered', () => {
    expect(packageDirs.length).toBeGreaterThanOrEqual(8)
  })

  for (const pkgName of packageDirs) {
    it(`ensures ${pkgName} has ESM-only exports and no .cjs references`, () => {
      const pkgJsonPath = path.join(packagesRoot, pkgName, 'package.json')
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))

      if (pkg.main) {
        expect(pkg.main).not.toMatch(/\.cjs$/)
      }

      function checkExports(obj: unknown, currentPath = 'exports'): void {
        if (!obj || typeof obj !== 'object') return
        if (Array.isArray(obj)) {
          obj.forEach((item, idx) => checkExports(item, `${currentPath}[${idx}]`))
          return
        }
        for (const [key, value] of Object.entries(obj)) {
          if (key === 'require') {
            if (typeof value === 'string') {
              expect(value, `${pkgName} ${currentPath}.require should not point to .cjs`).not.toMatch(/\.cjs$/)
            }
          }
          checkExports(value, `${currentPath}.${key}`)
        }
      }

      if (pkg.exports) {
        checkExports(pkg.exports)
      }
    })
  }
})
