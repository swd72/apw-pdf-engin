import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import type { Block, DocumentDef } from '@apw-pdf/core'
import {
  getBlock,
  insertBlock,
  removeBlock,
  moveBlock,
  moveBlockTo as moveBlockToDoc,
  adjustPathAfterRemoval,
  canMoveInto,
  moveInto,
  moveOut,
  duplicateBlock,
  type BlockPath,
} from './docModel.js'
import { BLOCK_TYPES } from './blockCatalog.js'
import { unresolved, type Binding } from './bindings.js'
import { createHistory } from './history.js'

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
  moveBlockTo(from: BlockPath, toListPath: BlockPath, index: number): void
  duplicateSelected(): void
  updateBlock(path: BlockPath, patch: Record<string, unknown>): void
  replaceBlock(path: BlockPath, block: Block): void
  setData(next: unknown): void
  undo(): void
  redo(): void
  canUndo: boolean
  canRedo: boolean
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
  const [selectedPath, setSelectedPathState] = useState<BlockPath | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const docRef = useRef<DocumentDef>(initial.doc)
  const dataRef = useRef<unknown>(initial.data)
  const selectedPathRef = useRef<BlockPath | null>(null)
  const historyRef = useRef(createHistory())

  const setSelectedPath = useCallback((next: BlockPath | null) => {
    selectedPathRef.current = next
    setSelectedPathState(next)
  }, [])

  const syncHistoryFlags = useCallback(() => {
    const nextUndo = historyRef.current.canUndo()
    const nextRedo = historyRef.current.canRedo()
    setCanUndo((prev) => (prev === nextUndo ? prev : nextUndo))
    setCanRedo((prev) => (prev === nextRedo ? prev : nextRedo))
  }, [])

  const commit = useCallback(
    (nextDoc: DocumentDef, nextData: unknown, mergeKey?: string) => {
      const prevDoc = docRef.current
      const prevData = dataRef.current
      if (nextDoc === prevDoc && nextData === prevData) return
      historyRef.current.push({ doc: prevDoc, data: prevData }, mergeKey)
      docRef.current = nextDoc
      dataRef.current = nextData
      setDoc(nextDoc)
      setDataState(nextData)
      syncHistoryFlags()
      onChange({ doc: nextDoc, data: nextData })
    },
    [onChange, syncHistoryFlags],
  )

  const initialRef = useRef(initial)
  useEffect(() => {
    let resynced = false
    if (
      initial.doc !== initialRef.current.doc &&
      initial.doc !== docRef.current
    ) {
      docRef.current = initial.doc
      setDoc(initial.doc)
      resynced = true
    }
    if (
      initial.data !== initialRef.current.data &&
      initial.data !== dataRef.current
    ) {
      dataRef.current = initial.data
      setDataState(initial.data)
      resynced = true
    }
    if (resynced) {
      historyRef.current.reset()
      syncHistoryFlags()
      const activePath = selectedPathRef.current
      if (activePath && !getBlock(docRef.current, activePath)) {
        setSelectedPath(null)
      }
    }
    initialRef.current = initial
  }, [initial.doc, initial.data, setSelectedPath, syncHistoryFlags])

  const warnings = useMemo(() => unresolved(doc, data), [doc, data])

  const select = useCallback(
    (path: BlockPath | null) => {
      if (path === null) {
        setSelectedPath(null)
        return
      }
      const block = getBlock(docRef.current, path)
      if (block) {
        setSelectedPath(path)
      } else {
        setSelectedPath(null)
      }
    },
    [setSelectedPath],
  )

  const addBlock = useCallback(
    (listPath: BlockPath, index: number, type: Block['type']) => {
      const descriptor = BLOCK_TYPES.find((d) => d.type === type)
      const block = descriptor
        ? descriptor.create()
        : ({ type, text: '' } as unknown as Block)

      const currentDoc = docRef.current
      const nextDoc = insertBlock(currentDoc, listPath, index, block)
      if (nextDoc !== currentDoc) {
        const newPath: BlockPath = [...listPath, index]
        setSelectedPath(newPath)
        commit(nextDoc, dataRef.current)
      }
    },
    [commit, setSelectedPath],
  )

  const removeSelected = useCallback(() => {
    const activePath = selectedPathRef.current ?? selectedPath
    if (!activePath || activePath.length === 0) return
    const parentListPath = activePath.slice(0, -1)
    const index = activePath[activePath.length - 1]
    if (typeof index !== 'number') return

    const currentDoc = docRef.current
    const nextDoc = removeBlock(currentDoc, activePath)
    if (nextDoc !== currentDoc) {
      if (index > 0) {
        setSelectedPath([...parentListPath, index - 1])
      } else {
        let parentBlockPath: BlockPath | null = null
        for (let k = activePath.length - 1; k >= 1; k--) {
          const sub = activePath.slice(0, k)
          if (getBlock(currentDoc, sub)) {
            parentBlockPath = sub
            break
          }
        }
        setSelectedPath(parentBlockPath)
      }

      commit(nextDoc, dataRef.current)
    }
  }, [selectedPath, setSelectedPath, commit])

  const moveSelected = useCallback(
    (delta: -1 | 1) => {
      const activePath = selectedPathRef.current ?? selectedPath
      if (!activePath || activePath.length === 0) return
      const parentListPath = activePath.slice(0, -1)
      const index = activePath[activePath.length - 1]
      if (typeof index !== 'number') return

      const currentDoc = docRef.current
      const nextDoc = moveBlock(currentDoc, activePath, delta)
      if (nextDoc !== currentDoc) {
        setSelectedPath([...parentListPath, index + delta])
        commit(nextDoc, dataRef.current)
      }
    },
    [selectedPath, setSelectedPath, commit],
  )

  const moveSelectedInto = useCallback(
    (targetListPath: BlockPath) => {
      const activePath = selectedPathRef.current ?? selectedPath
      const currentDoc = docRef.current
      if (!activePath || !canMoveInto(currentDoc, activePath, targetListPath)) {
        return
      }
      const nextDoc = moveInto(currentDoc, activePath, targetListPath)
      if (nextDoc !== currentDoc) {
        const targetList = getIn(nextDoc, targetListPath) as Block[]
        const newIdx = Array.isArray(targetList) ? targetList.length - 1 : 0
        setSelectedPath([...targetListPath, newIdx])
        commit(nextDoc, dataRef.current)
      }
    },
    [selectedPath, setSelectedPath, commit],
  )

  const moveSelectedOut = useCallback(() => {
    const activePath = selectedPathRef.current ?? selectedPath
    if (!activePath || activePath.length === 0) return
    const currentDoc = docRef.current
    const nextDoc = moveOut(currentDoc, activePath)
    if (nextDoc !== currentDoc) {
      let parentBlockPath: BlockPath | null = null
      for (let k = activePath.length - 1; k >= 1; k--) {
        const sub = activePath.slice(0, k)
        if (getBlock(currentDoc, sub)) {
          parentBlockPath = sub
          break
        }
      }
      if (parentBlockPath) {
        const parentListPath = parentBlockPath.slice(0, -1)
        const parentIndex = parentBlockPath[
          parentBlockPath.length - 1
        ] as number
        setSelectedPath([...parentListPath, parentIndex + 1])
      }
      commit(nextDoc, dataRef.current)
    }
  }, [selectedPath, setSelectedPath, commit])

  const moveBlockTo = useCallback(
    (from: BlockPath, toListPath: BlockPath, index: number) => {
      const currentDoc = docRef.current
      const nextDoc = moveBlockToDoc(currentDoc, from, toListPath, index)
      if (nextDoc !== currentDoc) {
        const adjustedTarget = adjustPathAfterRemoval(from, toListPath)
        setSelectedPath([...adjustedTarget, index])
        commit(nextDoc, dataRef.current)
      }
    },
    [setSelectedPath, commit],
  )

  const duplicateSelected = useCallback(() => {
    const activePath = selectedPathRef.current ?? selectedPath
    if (!activePath || activePath.length === 0) return
    const parentListPath = activePath.slice(0, -1)
    const index = activePath[activePath.length - 1]
    if (typeof index !== 'number') return

    const currentDoc = docRef.current
    const nextDoc = duplicateBlock(currentDoc, activePath)
    if (nextDoc !== currentDoc) {
      setSelectedPath([...parentListPath, index + 1])
      commit(nextDoc, dataRef.current)
    }
  }, [selectedPath, setSelectedPath, commit])

  const replaceBlock = useCallback(
    (path: BlockPath, block: Block) => {
      const currentDoc = docRef.current
      const nextDoc = updateIn(currentDoc, path, () => block) as DocumentDef
      if (nextDoc !== currentDoc) {
        commit(nextDoc, dataRef.current, `block:${path.join('.')}`)
      }
    },
    [commit],
  )

  const updateBlock = useCallback(
    (path: BlockPath, patch: Record<string, unknown>) => {
      const current = getBlock(docRef.current, path)
      if (!current) return
      const nextBlock = { ...current, ...patch } as Block
      replaceBlock(path, nextBlock)
    },
    [replaceBlock],
  )

  const setData = useCallback(
    (next: unknown) => {
      commit(docRef.current, next, 'data')
    },
    [commit],
  )

  const undo = useCallback(() => {
    const restored = historyRef.current.undo({
      doc: docRef.current,
      data: dataRef.current,
    })
    if (!restored) return
    docRef.current = restored.doc
    dataRef.current = restored.data
    setDoc(restored.doc)
    setDataState(restored.data)
    const activePath = selectedPathRef.current
    if (activePath && !getBlock(restored.doc, activePath)) {
      setSelectedPath(null)
    }
    syncHistoryFlags()
    onChange({ doc: restored.doc, data: restored.data })
  }, [onChange, setSelectedPath, syncHistoryFlags])

  const redo = useCallback(() => {
    const restored = historyRef.current.redo({
      doc: docRef.current,
      data: dataRef.current,
    })
    if (!restored) return
    docRef.current = restored.doc
    dataRef.current = restored.data
    setDoc(restored.doc)
    setDataState(restored.data)
    const activePath = selectedPathRef.current
    if (activePath && !getBlock(restored.doc, activePath)) {
      setSelectedPath(null)
    }
    syncHistoryFlags()
    onChange({ doc: restored.doc, data: restored.data })
  }, [onChange, setSelectedPath, syncHistoryFlags])

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
    moveBlockTo,
    duplicateSelected,
    updateBlock,
    replaceBlock,
    setData,
    undo,
    redo,
    canUndo,
    canRedo,
    warnings,
  }
}
