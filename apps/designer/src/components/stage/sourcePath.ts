import type { DocumentDef } from '@apw-pdf/core'
import { getBlock, type BlockPath } from '../../editor/docModel.js'

const TOKEN_RE = /([a-zA-Z_$][a-zA-Z0-9_$]*)|\[(\d+)\]/g

export function parseSourcePath(s: string): BlockPath {
  if (!s) return []
  const clean = s.replace(/(?:#\d+)+$/, '')
  const out: BlockPath = []
  let m: RegExpExecArray | null
  TOKEN_RE.lastIndex = 0
  while ((m = TOKEN_RE.exec(clean)) !== null) {
    if (m[1] !== undefined) {
      out.push(m[1])
    } else if (m[2] !== undefined) {
      out.push(Number(m[2]))
    }
  }
  return out
}

export function resolveSelection(
  doc: DocumentDef,
  sourcePath: string,
): { blockPath: BlockPath; cellPath?: BlockPath } | null {
  const parsed = parseSourcePath(sourcePath)
  if (parsed.length === 0) return null

  let blockPath: BlockPath | null = null
  let blockLen = 0
  for (let k = parsed.length; k >= 1; k--) {
    const candidate = parsed.slice(0, k)
    if (getBlock(doc, candidate)) {
      blockPath = candidate
      blockLen = k
      break
    }
  }

  if (!blockPath) return null

  const owningBlock = getBlock(doc, blockPath)
  if (
    owningBlock &&
    owningBlock.type === 'table' &&
    parsed.length >= blockLen + 3
  ) {
    const section = parsed[blockLen]
    const rowIdx = parsed[blockLen + 1]
    const colIdx = parsed[blockLen + 2]
    if (
      (section === 'rows' || section === 'header' || section === 'footer') &&
      typeof rowIdx === 'number' &&
      typeof colIdx === 'number'
    ) {
      const sectionData = owningBlock[section]
      if (Array.isArray(sectionData)) {
        const row = sectionData[rowIdx]
        if (Array.isArray(row)) {
          const cell = row[colIdx]
          if (cell && typeof cell === 'object') {
            return {
              blockPath,
              cellPath: parsed.slice(0, blockLen + 3),
            }
          }
        }
      }
    }
  }

  return { blockPath }
}

export function pathKey(p: BlockPath | null | undefined): string {
  return p ? p.join('.') : ''
}
