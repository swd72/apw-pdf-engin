import {
  parseExpression,
  FILTERS,
  lookupPath,
  type Block,
  type DocumentDef,
  type Expr,
} from '@apw-pdf/core'
import { getBlock, type BlockPath } from './docModel.js'

export interface Binding {
  blockPath: BlockPath
  field: string
  expr: string
  path: string
  filter?: string
}

export const FILTER_NAMES: string[] = Object.keys(FILTERS)

const BINDING_RE = /\{\{\s*([^}]+?)\s*\}\}/g

function scanString(
  str: string | undefined,
  blockPath: BlockPath,
  field: string,
  result: Binding[],
) {
  if (!str || typeof str !== 'string') return
  BINDING_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = BINDING_RE.exec(str)) !== null) {
    const rawInner = match[1]!.trim()
    const pipeIdx = rawInner.indexOf('|')
    let varPath = rawInner
    let filter: string | undefined = undefined
    if (pipeIdx !== -1) {
      varPath = rawInner.slice(0, pipeIdx).trim()
      filter = rawInner.slice(pipeIdx + 1).trim()
    }
    result.push({
      blockPath,
      field,
      expr: rawInner,
      path: varPath,
      filter: filter || undefined,
    })
  }
}

function extractExprPaths(expr: Expr): string[] {
  const paths: string[] = []
  function walk(e: Expr) {
    if (!e) return
    if (e.kind === 'path') {
      paths.push(e.segments.join('.'))
    } else if (e.kind === 'not') {
      walk(e.expr)
    } else if (e.kind === 'binary') {
      walk(e.left)
      walk(e.right)
    }
  }
  walk(expr)
  return paths
}

export function scanBindings(doc: DocumentDef): Binding[] {
  if (!doc || !Array.isArray(doc.blocks)) return []
  const result: Binding[] = []

  function walkBlock(block: Block, blockPath: BlockPath) {
    if (!block || typeof block !== 'object') return

    switch (block.type) {
      case 'paragraph': {
        scanString(block.text, blockPath, 'text', result)
        if (Array.isArray(block.runs)) {
          block.runs.forEach((run, rIdx) => {
            if ('text' in run && typeof run.text === 'string') {
              scanString(run.text, blockPath, `runs[${rIdx}].text`, result)
            }
            if ('fill' in run && typeof run.fill === 'string') {
              scanString(run.fill, blockPath, `runs[${rIdx}].fill`, result)
            }
            if ('checkbox' in run && typeof run.checkbox === 'string') {
              scanString(run.checkbox, blockPath, `runs[${rIdx}].checkbox`, result)
            }
          })
        }
        break
      }
      case 'signature': {
        scanString(block.name, blockPath, 'name', result)
        if (block.prefix) {
          scanString(block.prefix, blockPath, 'prefix', result)
        }
        if (Array.isArray(block.positions)) {
          block.positions.forEach((pos, pIdx) => {
            scanString(pos, blockPath, `positions[${pIdx}]`, result)
          })
        }
        break
      }
      case 'image': {
        scanString(block.src, blockPath, 'src', result)
        break
      }
      case 'if': {
        if (typeof block.test === 'string') {
          try {
            const ast = parseExpression(block.test)
            const paths = extractExprPaths(ast)
            for (const p of paths) {
              result.push({
                blockPath,
                field: 'test',
                expr: block.test,
                path: p,
              })
            }
          } catch {
            // Ignore incomplete / invalid expression during editing
          }
        }
        if (Array.isArray(block.then)) {
          block.then.forEach((child, i) => walkBlock(child, [...blockPath, 'then', i]))
        }
        if (Array.isArray(block.else)) {
          block.else.forEach((child, i) => walkBlock(child, [...blockPath, 'else', i]))
        }
        break
      }
      case 'each': {
        if (Array.isArray(block.blocks)) {
          block.blocks.forEach((child, i) => walkBlock(child, [...blockPath, 'blocks', i]))
        }
        break
      }
      case 'columns': {
        if (Array.isArray(block.columns)) {
          block.columns.forEach((col, cIdx) => {
            if (Array.isArray(col.blocks)) {
              col.blocks.forEach((child, bIdx) =>
                walkBlock(child, [...blockPath, 'columns', cIdx, 'blocks', bIdx]),
              )
            }
          })
        }
        break
      }
      case 'table': {
        if (Array.isArray(block.header)) {
          block.header.forEach((row, rIdx) => {
            if (Array.isArray(row)) {
              row.forEach((cell, cIdx) => {
                scanString(cell.text, blockPath, `header[${rIdx}][${cIdx}].text`, result)
                if (Array.isArray(cell.blocks)) {
                  cell.blocks.forEach((child, bIdx) =>
                    walkBlock(child, [...blockPath, 'header', rIdx, cIdx, 'blocks', bIdx]),
                  )
                }
              })
            }
          })
        }
        if (Array.isArray(block.rows)) {
          block.rows.forEach((row, rIdx) => {
            if (Array.isArray(row)) {
              row.forEach((cell, cIdx) => {
                scanString(cell.text, blockPath, `rows[${rIdx}][${cIdx}].text`, result)
                if (Array.isArray(cell.blocks)) {
                  cell.blocks.forEach((child, bIdx) =>
                    walkBlock(child, [...blockPath, 'rows', rIdx, cIdx, 'blocks', bIdx]),
                  )
                }
              })
            }
          })
        } else if (
          block.rows &&
          typeof block.rows === 'object' &&
          Array.isArray(block.rows.cells)
        ) {
          block.rows.cells.forEach((cell, cIdx) => {
            scanString(cell.text, blockPath, `rows.cells[${cIdx}].text`, result)
            if (Array.isArray(cell.blocks)) {
              cell.blocks.forEach((child, bIdx) =>
                walkBlock(child, [...blockPath, 'rows', 'cells', cIdx, 'blocks', bIdx]),
              )
            }
          })
        }
        if (Array.isArray(block.footer)) {
          block.footer.forEach((row, rIdx) => {
            if (Array.isArray(row)) {
              row.forEach((cell, cIdx) => {
                scanString(cell.text, blockPath, `footer[${rIdx}][${cIdx}].text`, result)
                if (Array.isArray(cell.blocks)) {
                  cell.blocks.forEach((child, bIdx) =>
                    walkBlock(child, [...blockPath, 'footer', rIdx, cIdx, 'blocks', bIdx]),
                  )
                }
              })
            }
          })
        }
        break
      }
    }
  }

  doc.blocks.forEach((b, i) => walkBlock(b, ['blocks', i]))
  return result
}

export function scopeAt(
  doc: DocumentDef,
  blockPath: BlockPath,
): Array<{ name: string; arrayPath: string }> {
  if (!doc || !Array.isArray(blockPath) || blockPath.length === 0) return []
  const scopes: Array<{ name: string; arrayPath: string }> = []

  for (let k = 2; k <= blockPath.length; k++) {
    const sub = blockPath.slice(0, k)
    const block = getBlock(doc, sub)
    if (!block) continue

    if (block.type === 'each' && blockPath.length > k) {
      if (block.as && block.of) {
        scopes.push({ name: block.as, arrayPath: block.of })
      }
    } else if (
      block.type === 'table' &&
      block.rows &&
      typeof block.rows === 'object' &&
      !Array.isArray(block.rows) &&
      'each' in block.rows &&
      'as' in block.rows
    ) {
      if (blockPath.length > k && blockPath[k] === 'rows') {
        scopes.push({ name: block.rows.as, arrayPath: block.rows.each })
      }
    }
  }

  return scopes
}

export function unresolved(doc: DocumentDef, data: unknown): Binding[] {
  const bindings = scanBindings(doc)
  const unresolvedList: Binding[] = []

  for (const b of bindings) {
    if (!b.path || b.path.trim() === '') continue
    const segments = b.path.trim().split('.')
    const firstSeg = segments[0]!
    const restSegs = segments.slice(1)

    let scopes = scopeAt(doc, b.blockPath)
    const block = getBlock(doc, b.blockPath)
    if (
      block &&
      block.type === 'table' &&
      block.rows &&
      typeof block.rows === 'object' &&
      !Array.isArray(block.rows) &&
      'each' in block.rows &&
      'as' in block.rows &&
      b.field.startsWith('rows')
    ) {
      scopes = [...scopes, { name: block.rows.as, arrayPath: block.rows.each }]
    }

    const matchingScope = scopes.find((s) => s.name === firstSeg)
    if (matchingScope) {
      const arrayLookup = lookupPath(data, matchingScope.arrayPath.split('.'))
      if (arrayLookup.found && Array.isArray(arrayLookup.value)) {
        const arr = arrayLookup.value
        if (arr.length > 0) {
          const firstRow = arr[0]
          if (restSegs.length > 0) {
            const rowLookup = lookupPath(firstRow, restSegs)
            if (!rowLookup.found) {
              unresolvedList.push(b)
            }
          }
        }
      }
    } else {
      if (!data || typeof data !== 'object') {
        unresolvedList.push(b)
      } else {
        const res = lookupPath(data, segments)
        if (!res.found) {
          unresolvedList.push(b)
        }
      }
    }
  }

  return unresolvedList
}
