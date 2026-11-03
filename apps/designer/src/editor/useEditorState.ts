import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import type { Block, DocumentDef } from '@apw-pdf/core'
import {
  getBlock,
  insertBlock,
  removeBlock,
  moveBlock,
  canMoveInto,
  moveInto,
  moveOut,
  duplicateBlock,
  type BlockPath,
} from './docModel.js'
import { BLOCK_TYPES } from './blockCatalog.js'
import { unresolved, type Binding } from './bindings.js'

export interface EditorState {
  doc: DocumentDef
  data: unknown
  selectedPath: BlockPath | null
  select(path: BlockPath | null): void
  addBlock(listPath: BlockPath, index: number, type: Block['type']): void
  removeSelected(): void
  moveSelected(delta: -1 | 1): void
  moveSelectedInto(targetListPath: BlockPath): void
  moveSelectedOut(): void
  duplicateSelected(): void
  updateBlock(path: BlockPath, patch: Record<string, unknown>): void
  replaceBlock(path: BlockPath, block: Block): void
  setData(next: unknown): void
  warnings: Binding[]
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

export function useEditorState(
  initial: { doc: DocumentDef; data: unknown },
  onChange: (next: { doc: DocumentDef; data: unknown }) => void,
): EditorState {
  const [doc, setDoc] = useState<DocumentDef>(initial.doc)
  const [data, setDataState] = useState<unknown>(initial.data)
  const [selectedPath, setSelectedPath] = useState<BlockPath | null>(null)

  const initialRef = useRef(initial)
  useEffect(() => {
    if (initial.doc !== initialRef.current.doc && initial.doc !== doc) {
      setDoc(initial.doc)
    }
    if (initial.data !== initialRef.current.data && initial.data !== data) {
      setDataState(initial.data)
    }
    initialRef.current = initial
  }, [initial.doc, initial.data, doc, data])

  const warnings = useMemo(() => unresolved(doc, data), [doc, data])

  const select = useCallback(
    (path: BlockPath | null) => {
      if (path === null) {
        setSelectedPath(null)
        return
      }
      const block = getBlock(doc, path)
      if (block) {
        setSelectedPath(path)
      } else {
        setSelectedPath(null)
      }
    },
    [doc],
  )

  const addBlock = useCallback(
    (listPath: BlockPath, index: number, type: Block['type']) => {
      const descriptor = BLOCK_TYPES.find((d) => d.type === type)
      const block = descriptor
        ? descriptor.create()
        : ({ type, text: '' } as unknown as Block)

      const nextDoc = insertBlock(doc, listPath, index, block)
      if (nextDoc !== doc) {
        setDoc(nextDoc)
        const newPath: BlockPath = [...listPath, index]
        setSelectedPath(newPath)
        onChange({ doc: nextDoc, data })
      }
    },
    [doc, data, onChange],
  )

  const removeSelected = useCallback(() => {
    if (!selectedPath || selectedPath.length === 0) return
    const parentListPath = selectedPath.slice(0, -1)
    const index = selectedPath[selectedPath.length - 1]
    if (typeof index !== 'number') return

    const nextDoc = removeBlock(doc, selectedPath)
    if (nextDoc !== doc) {
      setDoc(nextDoc)

      if (index > 0) {
        setSelectedPath([...parentListPath, index - 1])
      } else {
        let parentBlockPath: BlockPath | null = null
        for (let k = selectedPath.length - 1; k >= 1; k--) {
          const sub = selectedPath.slice(0, k)
          if (getBlock(doc, sub)) {
            parentBlockPath = sub
            break
          }
        }
        setSelectedPath(parentBlockPath)
      }

      onChange({ doc: nextDoc, data })
    }
  }, [doc, data, selectedPath, onChange])

  const moveSelected = useCallback(
    (delta: -1 | 1) => {
      if (!selectedPath || selectedPath.length === 0) return
      const parentListPath = selectedPath.slice(0, -1)
      const index = selectedPath[selectedPath.length - 1]
      if (typeof index !== 'number') return

      const nextDoc = moveBlock(doc, selectedPath, delta)
      if (nextDoc !== doc) {
        setDoc(nextDoc)
        setSelectedPath([...parentListPath, index + delta])
        onChange({ doc: nextDoc, data })
      }
    },
    [doc, data, selectedPath, onChange],
  )

  const moveSelectedInto = useCallback(
    (targetListPath: BlockPath) => {
      if (!selectedPath || !canMoveInto(doc, selectedPath, targetListPath)) return
      const nextDoc = moveInto(doc, selectedPath, targetListPath)
      if (nextDoc !== doc) {
        setDoc(nextDoc)
        const targetList = getIn(nextDoc, targetListPath) as Block[]
        const newIdx = Array.isArray(targetList) ? targetList.length - 1 : 0
        setSelectedPath([...targetListPath, newIdx])
        onChange({ doc: nextDoc, data })
      }
    },
    [doc, data, selectedPath, onChange],
  )

  const moveSelectedOut = useCallback(() => {
    if (!selectedPath || selectedPath.length === 0) return
    const nextDoc = moveOut(doc, selectedPath)
    if (nextDoc !== doc) {
      setDoc(nextDoc)
      let parentBlockPath: BlockPath | null = null
      for (let k = selectedPath.length - 1; k >= 1; k--) {
        const sub = selectedPath.slice(0, k)
        if (getBlock(doc, sub)) {
          parentBlockPath = sub
          break
        }
      }
      if (parentBlockPath) {
        const parentListPath = parentBlockPath.slice(0, -1)
        const parentIndex = parentBlockPath[parentBlockPath.length - 1] as number
        setSelectedPath([...parentListPath, parentIndex + 1])
      }
      onChange({ doc: nextDoc, data })
    }
  }, [doc, data, selectedPath, onChange])

  const duplicateSelected = useCallback(() => {
    if (!selectedPath || selectedPath.length === 0) return
    const parentListPath = selectedPath.slice(0, -1)
    const index = selectedPath[selectedPath.length - 1]
    if (typeof index !== 'number') return

    const nextDoc = duplicateBlock(doc, selectedPath)
    if (nextDoc !== doc) {
      setDoc(nextDoc)
      setSelectedPath([...parentListPath, index + 1])
      onChange({ doc: nextDoc, data })
    }
  }, [doc, data, selectedPath, onChange])

  const replaceBlock = useCallback(
    (path: BlockPath, block: Block) => {
      const nextDoc = updateIn(doc, path, () => block) as DocumentDef
      if (nextDoc !== doc) {
        setDoc(nextDoc)
        onChange({ doc: nextDoc, data })
      }
    },
    [doc, data, onChange],
  )

  const updateBlock = useCallback(
    (path: BlockPath, patch: Record<string, unknown>) => {
      const current = getBlock(doc, path)
      if (!current) return
      const nextBlock = { ...current, ...patch } as Block
      replaceBlock(path, nextBlock)
    },
    [doc, replaceBlock],
  )

  const setData = useCallback(
    (next: unknown) => {
      setDataState(next)
      onChange({ doc, data: next })
    },
    [doc, onChange],
  )

  return {
    doc,
    data,
    selectedPath,
    select,
    addBlock,
    removeSelected,
    moveSelected,
    moveSelectedInto,
    moveSelectedOut,
    duplicateSelected,
    updateBlock,
    replaceBlock,
    setData,
    warnings,
  }
}
