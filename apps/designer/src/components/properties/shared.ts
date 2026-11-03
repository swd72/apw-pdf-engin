import type { Block } from '@apw-pdf/core'
import type { EditorState } from '../../editor/useEditorState.js'
import type { BlockPath } from '../../editor/docModel.js'
import { listPaths } from '../../editor/dataModel.js'

export function isValidSafeIdentifier(id: string): boolean {
  if (!id || typeof id !== 'string') return false
  if (id === '__proto__' || id === 'constructor' || id === 'prototype') {
    return false
  }
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(id)
}

export function isPropertySet(block: unknown, key: string): boolean {
  if (!block || typeof block !== 'object') return false
  const rec = block as Record<string, unknown>
  if (!Object.prototype.hasOwnProperty.call(rec, key)) return false
  const val = rec[key]
  return val !== undefined
}

export function applyBlockPatch<T extends Block>(
  block: T,
  patch: Record<string, unknown>,
): T {
  const copy: Record<string, unknown> = {
    ...(block as unknown as Record<string, unknown>),
  }
  for (const [key, val] of Object.entries(patch)) {
    if (val === undefined) {
      delete copy[key]
    } else {
      copy[key] = val
    }
  }
  return copy as unknown as T
}

export function commitBlockPatch(
  state: EditorState,
  path: BlockPath,
  block: Block,
  patch: Record<string, unknown>,
): void {
  const hasDelete = Object.values(patch).some((v) => v === undefined)
  const nextBlock = applyBlockPatch(block, patch)
  if (hasDelete) {
    state.replaceBlock(path, nextBlock)
  } else {
    state.updateBlock(path, patch)
  }
}

function lookupArray(data: unknown, dotPath: string): unknown[] | null {
  if (!data || typeof data !== 'object') return null
  let curr: any = data
  for (const seg of dotPath.split('.')) {
    if (curr === null || curr === undefined || typeof curr !== 'object') {
      return null
    }
    curr = curr[seg]
  }
  return Array.isArray(curr) ? curr : null
}

export function collectCandidatePaths(
  data: unknown,
  scope?: Array<{ name: string; arrayPath: string }>,
): string[] {
  const paths = listPaths(data)
  const candSet = new Set<string>()

  for (const p of paths) {
    candSet.add(p.path)
  }

  if (scope) {
    for (const s of scope) {
      const match = paths.find((p) => p.path === s.arrayPath)
      if (match?.rowFields) {
        for (const rf of match.rowFields) {
          candSet.add(`${s.name}.${rf}`)
        }
      }
      const arr = lookupArray(data, s.arrayPath)
      if (arr && arr.length > 0 && arr[0] && typeof arr[0] === 'object') {
        for (const k of Object.keys(arr[0] as Record<string, unknown>)) {
          candSet.add(`${s.name}.${k}`)
        }
      }
    }
  }

  return Array.from(candSet)
}

export function listArrayPaths(data: unknown): string[] {
  return listPaths(data)
    .filter((p) => p.type === 'array')
    .map((p) => p.path)
}
