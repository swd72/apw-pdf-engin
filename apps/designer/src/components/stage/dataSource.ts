import type { DocumentDef } from '@apw-pdf/core'
import { getBlock, type BlockPath } from '../../editor/docModel.js'
import { setAtPath } from '../../editor/dataModel.js'

export type DataSource =
  | { dataPath: (string | number)[]; label: string }
  | { repeatOf: string; itemIndex: number }

const OF_RE = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/
const AS_RE = /^[A-Za-z_$][\w$]*$/

export function enclosingEachLoops(
  doc: DocumentDef,
  blockPath: BlockPath,
): Array<{ of: string; as: string }> {
  if (!doc || !Array.isArray(blockPath) || blockPath.length === 0) return []
  const loops: Array<{ of: string; as: string }> = []
  for (let k = 2; k < blockPath.length; k++) {
    const b = getBlock(doc, blockPath.slice(0, k))
    if (b && b.type === 'each') {
      loops.push({ of: b.of, as: b.as })
    }
  }
  return loops
}

export function innermostEachOf(
  doc: DocumentDef,
  blockPath: BlockPath,
): string | null {
  const loops = enclosingEachLoops(doc, blockPath)
  return loops.length > 0 ? loops[loops.length - 1]!.of : null
}

export function formatDataPathLabel(dataPath: (string | number)[]): string {
  let out = ''
  for (let i = 0; i < dataPath.length; i++) {
    const seg = dataPath[i]!
    if (typeof seg === 'number') {
      out += `[${seg}]`
    } else {
      out += i === 0 ? seg : `.${seg}`
    }
  }
  return out
}

export function dataSourceOf(
  doc: DocumentDef,
  blockPath: BlockPath,
  inst: number[] | undefined,
): DataSource | null {
  const loops = enclosingEachLoops(doc, blockPath)
  if (loops.length === 0) return null

  const innermost = loops[loops.length - 1]!
  const itemIndex = inst && inst.length > 0 ? inst[inst.length - 1]! : 0
  const fallback: DataSource = { repeatOf: innermost.of, itemIndex }

  if (!inst || inst.length !== loops.length) {
    return fallback
  }

  const resolvedByAs = new Map<string, (string | number)[]>()
  let innermostPath: (string | number)[] = []

  for (let i = 0; i < loops.length; i++) {
    const loop = loops[i]!
    const idx = inst[i]!
    if (!Number.isInteger(idx) || idx < 0) {
      return fallback
    }
    if (!OF_RE.test(loop.of) || !AS_RE.test(loop.as)) {
      return fallback
    }
    const segs = loop.of.split('.')
    const outerResolved = resolvedByAs.get(segs[0]!)
    const basePath: (string | number)[] = outerResolved
      ? [...outerResolved, ...segs.slice(1)]
      : segs
    const itemPath: (string | number)[] = [...basePath, idx]
    resolvedByAs.set(loop.as, itemPath)
    innermostPath = itemPath
  }

  const block = getBlock(doc, blockPath)
  if (
    !block ||
    block.type !== 'paragraph' ||
    typeof block.text !== 'string' ||
    block.runs !== undefined
  ) {
    return fallback
  }

  const escapedAs = innermost.as.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const textRe = new RegExp(
    `^\\{\\{\\s*${escapedAs}((?:\\.[\\w$]+)*)\\s*\\}\\}$`,
  )
  const m = textRe.exec(block.text)
  if (!m) {
    return fallback
  }

  const tailSegs = m[1] ? m[1].slice(1).split('.') : []
  const dataPath: (string | number)[] = [...innermostPath, ...tailSegs]
  return {
    dataPath,
    label: formatDataPathLabel(dataPath),
  }
}

export function getInData(
  data: unknown,
  dataPath: (string | number)[],
): unknown {
  let curr: any = data
  for (const seg of dataPath) {
    if (curr === null || curr === undefined || typeof curr !== 'object') {
      return undefined
    }
    curr = curr[seg]
  }
  return curr
}

export function setIn(
  data: unknown,
  dataPath: (string | number)[],
  value: unknown,
): unknown {
  return setAtPath(data, dataPath, value)
}
