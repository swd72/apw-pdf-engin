import type { Block, DocumentDef } from '@apw-pdf/core'

export type BlockPath = (string | number)[]

function getIn(obj: unknown, path: BlockPath): unknown {
  let curr: any = obj
  for (const seg of path) {
    if (curr === null || curr === undefined || typeof curr !== 'object') {
      return undefined
    }
    curr = curr[seg]
  }
  return curr
}

function updateIn(target: any, path: BlockPath, fn: (val: any) => any): any {
  if (path.length === 0) return fn(target)
  if (target === null || target === undefined || typeof target !== 'object') {
    return target
  }
  const [head, ...tail] = path
  if (Array.isArray(target)) {
    const idx = typeof head === 'number' ? head : parseInt(String(head), 10)
    if (isNaN(idx) || idx < 0 || idx >= target.length) return target
    const nextItem = updateIn(target[idx], tail, fn)
    if (nextItem === target[idx]) return target
    const copy = [...target]
    copy[idx] = nextItem
    return copy
  } else {
    const key = String(head)
    if (!Object.prototype.hasOwnProperty.call(target, key)) return target
    const nextVal = updateIn(target[key], tail, fn)
    if (nextVal === target[key]) return target
    return { ...target, [key]: nextVal }
  }
}

export function getBlock(doc: DocumentDef, path: BlockPath): Block | undefined {
  if (!path || path.length === 0) return undefined
  const val = getIn(doc, path)
  if (val && typeof val === 'object' && typeof (val as Record<string, unknown>).type === 'string') {
    return val as Block
  }
  return undefined
}

export function listChildren(block: Block): Array<{ key: BlockPath; label: string }> {
  if (!block || typeof block !== 'object') return []
  const result: Array<{ key: BlockPath; label: string }> = []

  switch (block.type) {
    case 'columns': {
      if (Array.isArray(block.columns)) {
        block.columns.forEach((col, idx) => {
          result.push({ key: ['columns', idx, 'blocks'], label: `Column ${idx + 1}` })
        })
      }
      break
    }
    case 'each': {
      result.push({ key: ['blocks'], label: 'Blocks' })
      break
    }
    case 'if': {
      result.push({ key: ['then'], label: 'Then' })
      if (block.else !== undefined) {
        result.push({ key: ['else'], label: 'Else' })
      }
      break
    }
    case 'table': {
      if (Array.isArray(block.header)) {
        block.header.forEach((row, rIdx) => {
          if (Array.isArray(row)) {
            row.forEach((cell, cIdx) => {
              if (Array.isArray(cell?.blocks)) {
                result.push({ key: ['header', rIdx, cIdx, 'blocks'], label: `Header [${rIdx + 1}, ${cIdx + 1}]` })
              }
            })
          }
        })
      }
      if (Array.isArray(block.rows)) {
        block.rows.forEach((row, rIdx) => {
          if (Array.isArray(row)) {
            row.forEach((cell, cIdx) => {
              if (Array.isArray(cell?.blocks)) {
                result.push({ key: ['rows', rIdx, cIdx, 'blocks'], label: `Row ${rIdx + 1}, Col ${cIdx + 1}` })
              }
            })
          }
        })
      } else if (block.rows && typeof block.rows === 'object' && Array.isArray(block.rows.cells)) {
        block.rows.cells.forEach((cell, cIdx) => {
          if (Array.isArray(cell?.blocks)) {
            result.push({ key: ['rows', 'cells', cIdx, 'blocks'], label: `Body cell ${cIdx + 1}` })
          }
        })
      }
      if (Array.isArray(block.footer)) {
        block.footer.forEach((row, rIdx) => {
          if (Array.isArray(row)) {
            row.forEach((cell, cIdx) => {
              if (Array.isArray(cell?.blocks)) {
                result.push({ key: ['footer', rIdx, cIdx, 'blocks'], label: `Footer [${rIdx + 1}, ${cIdx + 1}]` })
              }
            })
          }
        })
      }
      break
    }
  }

  return result
}

export function insertBlock(
  doc: DocumentDef,
  parentListPath: BlockPath,
  index: number,
  block: Block,
): DocumentDef {
  if (!doc || !block || !Array.isArray(parentListPath)) return doc
  const targetList = getIn(doc, parentListPath)
  if (!Array.isArray(targetList)) return doc
  if (typeof index !== 'number' || index < 0 || index > targetList.length) return doc

  const updated = updateIn(doc, parentListPath, (list: Block[]) => {
    return [...list.slice(0, index), block, ...list.slice(index)]
  })
  return updated as DocumentDef
}

export function removeBlock(doc: DocumentDef, path: BlockPath): DocumentDef {
  if (!doc || !Array.isArray(path) || path.length === 0) return doc
  const parentListPath = path.slice(0, -1)
  const index = path[path.length - 1]
  if (typeof index !== 'number') return doc

  const targetList = getIn(doc, parentListPath)
  if (!Array.isArray(targetList)) return doc
  if (index < 0 || index >= targetList.length) return doc

  const updated = updateIn(doc, parentListPath, (list: Block[]) => {
    return list.filter((_, i) => i !== index)
  })
  return updated as DocumentDef
}

export function moveBlock(doc: DocumentDef, path: BlockPath, delta: -1 | 1): DocumentDef {
  if (!doc || !Array.isArray(path) || path.length === 0) return doc
  const parentListPath = path.slice(0, -1)
  const index = path[path.length - 1]
  if (typeof index !== 'number') return doc

  const targetList = getIn(doc, parentListPath)
  if (!Array.isArray(targetList)) return doc
  const targetIndex = index + delta
  if (targetIndex < 0 || targetIndex >= targetList.length) return doc

  const updated = updateIn(doc, parentListPath, (list: Block[]) => {
    const copy = [...list]
    const item = copy[index]!
    copy[index] = copy[targetIndex]!
    copy[targetIndex] = item
    return copy
  })
  return updated as DocumentDef
}

export function canMoveInto(
  doc: DocumentDef,
  path: BlockPath,
  targetListPath: BlockPath,
): boolean {
  if (!doc || !Array.isArray(path) || !Array.isArray(targetListPath)) return false
  if (path.length === 0 || targetListPath.length === 0) return false
  const block = getBlock(doc, path)
  if (!block) return false
  const targetList = getIn(doc, targetListPath)
  if (!Array.isArray(targetList)) return false

  // Reject when targetListPath starts with path
  if (targetListPath.length >= path.length) {
    const isPrefix = path.every((seg, i) => targetListPath[i] === seg)
    if (isPrefix) return false
  }
  return true
}

export function adjustPathAfterRemoval(removedPath: BlockPath, targetPath: BlockPath): BlockPath {
  const parentList = removedPath.slice(0, -1)
  const removedIdx = removedPath[removedPath.length - 1] as number
  if (targetPath.length <= parentList.length) return targetPath
  for (let i = 0; i < parentList.length; i++) {
    if (targetPath[i] !== parentList[i]) return targetPath
  }
  const nextSeg = targetPath[parentList.length]
  if (typeof nextSeg === 'number' && nextSeg > removedIdx) {
    const adjusted = [...targetPath]
    adjusted[parentList.length] = nextSeg - 1
    return adjusted
  }
  return targetPath
}

export function moveBlockTo(
  doc: DocumentDef,
  from: BlockPath,
  toListPath: BlockPath,
  index: number,
): DocumentDef {
  if (!canMoveInto(doc, from, toListPath)) return doc
  const block = getBlock(doc, from)
  if (!block) return doc

  const adjustedTarget = adjustPathAfterRemoval(from, toListPath)
  const docWithoutBlock = removeBlock(doc, from)
  if (docWithoutBlock === doc) return doc

  const targetList = getIn(docWithoutBlock, adjustedTarget)
  if (!Array.isArray(targetList)) return doc
  if (typeof index !== 'number' || index < 0 || index > targetList.length) return doc

  return insertBlock(docWithoutBlock, adjustedTarget, index, block)
}

export function moveInto(
  doc: DocumentDef,
  path: BlockPath,
  targetListPath: BlockPath,
): DocumentDef {
  if (!canMoveInto(doc, path, targetListPath)) return doc
  const block = getBlock(doc, path)
  if (!block) return doc

  const adjustedTarget = adjustPathAfterRemoval(path, targetListPath)
  const docWithoutBlock = removeBlock(doc, path)
  const targetList = getIn(docWithoutBlock, adjustedTarget)
  if (!Array.isArray(targetList)) return doc

  return insertBlock(docWithoutBlock, adjustedTarget, targetList.length, block)
}

export function moveOut(doc: DocumentDef, path: BlockPath): DocumentDef {
  if (!doc || !Array.isArray(path) || path.length === 0) return doc
  const block = getBlock(doc, path)
  if (!block) return doc

  let parentBlockPath: BlockPath | null = null
  for (let k = path.length - 1; k >= 1; k--) {
    const sub = path.slice(0, k)
    const b = getBlock(doc, sub)
    if (b) {
      parentBlockPath = sub
      break
    }
  }

  if (!parentBlockPath || parentBlockPath.length === 0) {
    return doc
  }

  const parentListPath = parentBlockPath.slice(0, -1)
  const parentIndex = parentBlockPath[parentBlockPath.length - 1]
  if (typeof parentIndex !== 'number') return doc

  const docWithoutBlock = removeBlock(doc, path)
  return insertBlock(docWithoutBlock, parentListPath, parentIndex + 1, block)
}

export function duplicateBlock(doc: DocumentDef, path: BlockPath): DocumentDef {
  if (!doc || !Array.isArray(path) || path.length === 0) return doc
  const block = getBlock(doc, path)
  if (!block) return doc

  const parentListPath = path.slice(0, -1)
  const index = path[path.length - 1]
  if (typeof index !== 'number') return doc

  const copy = structuredClone(block)
  return insertBlock(doc, parentListPath, index + 1, copy)
}
