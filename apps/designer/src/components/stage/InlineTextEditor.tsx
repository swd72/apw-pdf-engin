import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  toPt,
  type DocumentDef,
  type Length,
  type Rect,
  type TableBlock,
} from '@apw-pdf/core'
import type { EditorState } from '../../editor/useEditorState.js'
import { getBlock, type BlockPath } from '../../editor/docModel.js'
import { scopeAt } from '../../editor/bindings.js'
import { VariablePicker } from '../properties/VariablePicker.js'
import {
  dataSourceOf,
  getInData,
  innermostEachOf,
  setIn,
} from './dataSource.js'

export type EditTarget =
  | { kind: 'paragraph'; path: BlockPath; text: string; inst?: number[] }
  | {
      kind: 'cell'
      tablePath: BlockPath
      cellPath: BlockPath
      text: string
      inst?: number[]
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

export function editTarget(
  doc: DocumentDef,
  sel:
    | { blockPath: BlockPath; cellPath?: BlockPath }
    | BlockPath
    | null
    | undefined,
): EditTarget | null {
  if (!sel) return null
  const normalized = Array.isArray(sel) ? { blockPath: sel } : sel
  const block = getBlock(doc, normalized.blockPath)
  if (!block) return null

  if (normalized.cellPath && block.type === 'table') {
    const cell = getIn(doc, normalized.cellPath) as
      | Record<string, unknown>
      | undefined
    if (
      cell &&
      typeof cell === 'object' &&
      typeof cell.text === 'string' &&
      cell.blocks === undefined &&
      cell.runs === undefined
    ) {
      return {
        kind: 'cell',
        tablePath: normalized.blockPath,
        cellPath: normalized.cellPath,
        text: cell.text,
      }
    }
    return null
  }

  if (
    block.type === 'paragraph' &&
    typeof block.text === 'string' &&
    block.runs === undefined
  ) {
    return {
      kind: 'paragraph',
      path: normalized.blockPath,
      text: block.text,
    }
  }

  return null
}

export function resolveEditFontSizePt(
  doc: DocumentDef,
  target: EditTarget,
): number {
  let rawSize: unknown = undefined

  if (target.kind === 'paragraph') {
    const block = getBlock(doc, target.path)
    if (block && block.type === 'paragraph') {
      const rec = block as unknown as Record<string, unknown>
      rawSize =
        block.font?.size ??
        rec.size ??
        (block.style ? doc.styles?.[block.style]?.font?.size : undefined)
    }
  } else {
    const cell = getIn(doc, target.cellPath) as
      | Record<string, unknown>
      | undefined
    if (cell && typeof cell === 'object') {
      const cellFont = cell.font as Record<string, unknown> | undefined
      const styleName = typeof cell.style === 'string' ? cell.style : undefined
      rawSize =
        cellFont?.size ??
        cell.size ??
        (styleName ? doc.styles?.[styleName]?.font?.size : undefined)
    }
  }

  if (rawSize === undefined) {
    rawSize = doc.font?.size
  }

  if (typeof rawSize === 'number' || typeof rawSize === 'string') {
    try {
      const pt = toPt(rawSize as Length)
      if (Number.isFinite(pt) && pt > 0) {
        return pt
      }
    } catch {
      // Fall back to default
    }
  }

  return 16
}

export function commitEditTarget(
  editor: EditorState,
  target: EditTarget,
  nextText: string,
): void {
  if (target.kind === 'paragraph') {
    editor.updateBlock(target.path, { text: nextText })
    return
  }

  const tableBlock = getBlock(editor.doc, target.tablePath)
  if (!tableBlock || tableBlock.type !== 'table') return
  const relPath = target.cellPath.slice(target.tablePath.length)
  const nextTable = updateIn(
    tableBlock,
    relPath,
    (cell: Record<string, unknown>) => ({
      ...cell,
      text: nextText,
    }),
  ) as TableBlock
  editor.replaceBlock(target.tablePath, nextTable)
}

export interface InlineTextEditorProps {
  editor: EditorState
  target: EditTarget
  inst?: number[]
  box: Rect
  scale: number
  onCommit?(text: string): void
  onCancel?(): void
}

export function InlineTextEditor({
  editor,
  target,
  inst,
  box,
  scale,
  onCommit,
  onCancel,
}: InlineTextEditorProps) {
  const effectiveInst = inst ?? target.inst

  const dataSource = useMemo(
    () =>
      target.kind === 'paragraph'
        ? dataSourceOf(editor.doc, target.path, effectiveInst)
        : null,
    [editor.doc, target, effectiveInst],
  )

  const loopOf = useMemo(
    () =>
      target.kind === 'paragraph'
        ? innermostEachOf(editor.doc, target.path)
        : null,
    [editor.doc, target],
  )

  const initialDataValue = useMemo(() => {
    if (dataSource && 'dataPath' in dataSource) {
      return getInData(editor.data, dataSource.dataPath)
    }
    return undefined
  }, [dataSource, editor.data])

  const canEditData =
    dataSource !== null &&
    'dataPath' in dataSource &&
    (typeof initialDataValue === 'string' ||
      typeof initialDataValue === 'number')

  const initialMode: 'data' | 'template' = canEditData ? 'data' : 'template'
  const initialText = canEditData ? String(initialDataValue) : target.text

  const [mode, setMode] = useState<'data' | 'template'>(initialMode)
  const modeRef = useRef<'data' | 'template'>(initialMode)
  const [draft, setDraft] = useState<string>(initialText)
  const draftRef = useRef<string>(initialText)
  const closedRef = useRef(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const caretRangeRef = useRef<{ before: string; after: string } | null>(null)

  const updateDraft = useCallback((next: string) => {
    draftRef.current = next
    setDraft(next)
  }, [])

  useEffect(() => {
    textareaRef.current?.focus({ preventScroll: true })
  }, [])

  const fontSizePx = useMemo(
    () => resolveEditFontSizePt(editor.doc, target) * scale,
    [editor.doc, target, scale],
  )

  const blockPath =
    target.kind === 'paragraph' ? target.path : target.tablePath

  const scope = useMemo(
    () => scopeAt(editor.doc, blockPath),
    [editor.doc, blockPath],
  )

  const handleToggleMode = useCallback(() => {
    const nextMode = modeRef.current === 'data' ? 'template' : 'data'
    modeRef.current = nextMode
    setMode(nextMode)
    const nextText =
      nextMode === 'template' ? target.text : String(initialDataValue ?? '')
    updateDraft(nextText)
    textareaRef.current?.focus({ preventScroll: true })
  }, [target.text, initialDataValue, updateDraft])

  const commit = useCallback(() => {
    if (closedRef.current) return
    closedRef.current = true
    const text = draftRef.current
    if (
      modeRef.current === 'data' &&
      canEditData &&
      dataSource &&
      'dataPath' in dataSource
    ) {
      let newValue: string | number = text
      if (typeof initialDataValue === 'number') {
        const trimmed = text.trim()
        if (trimmed !== '') {
          const parsed = Number(trimmed)
          if (Number.isFinite(parsed)) {
            newValue = parsed
          }
        }
      }
      editor.setData(setIn(editor.data, dataSource.dataPath, newValue))
    } else {
      commitEditTarget(editor, target, text)
    }
    onCommit?.(text)
  }, [canEditData, dataSource, initialDataValue, editor, target, onCommit])

  const cancel = useCallback(() => {
    if (closedRef.current) return
    closedRef.current = true
    onCancel?.()
  }, [onCancel])

  const captureCaret = useCallback(() => {
    const el = textareaRef.current
    const currentText = draftRef.current
    const start =
      el && typeof el.selectionStart === 'number'
        ? el.selectionStart
        : currentText.length
    const end =
      el && typeof el.selectionEnd === 'number'
        ? el.selectionEnd
        : currentText.length
    caretRangeRef.current = {
      before: currentText.slice(0, start),
      after: currentText.slice(end),
    }
  }, [])

  const handleInsert = useCallback(
    (token: string) => {
      if (!caretRangeRef.current) {
        captureCaret()
      }
      const range = caretRangeRef.current ?? {
        before: draftRef.current,
        after: '',
      }
      updateDraft(`${range.before}${token}${range.after}`)
    },
    [captureCaret, updateDraft],
  )

  const handleUpgradeFilter = useCallback(
    (token: string) => {
      const range = caretRangeRef.current ?? { before: '', after: '' }
      updateDraft(`${range.before}${token}${range.after}`)
    },
    [updateDraft],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      commit()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      cancel()
      return
    }
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      e.stopPropagation()
      const el = e.currentTarget
      const currentText = draftRef.current
      const start =
        typeof el.selectionStart === 'number'
          ? el.selectionStart
          : currentText.length
      const end =
        typeof el.selectionEnd === 'number'
          ? el.selectionEnd
          : currentText.length
      const next = `${currentText.slice(0, start)}\n${currentText.slice(end)}`
      updateDraft(next)
      return
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (closedRef.current) return
    const nextFocused = e.relatedTarget as Node | null
    if (nextFocused && containerRef.current?.contains(nextFocused)) {
      return
    }
    commit()
  }

  let headerText: string | null = null
  if (canEditData && dataSource && 'dataPath' in dataSource) {
    headerText =
      mode === 'data'
        ? `ข้อความจากข้อมูล ${dataSource.label}`
        : `แม่แบบ (มีผลทุกรายการใน ${loopOf ?? ''})`
  } else if (dataSource !== null) {
    if ('repeatOf' in dataSource) {
      headerText = `ซ้ำตาม ${dataSource.repeatOf} · รายการที่ ${dataSource.itemIndex + 1}`
    } else if (loopOf) {
      const itemIdx =
        effectiveInst && effectiveInst.length > 0
          ? effectiveInst[effectiveInst.length - 1]!
          : 0
      headerText = `ซ้ำตาม ${loopOf} · รายการที่ ${itemIdx + 1}`
    }
  }

  return (
    <div
      ref={containerRef}
      className="stage-inline-editor"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {headerText && (
        <div
          className="stage-inline-editor__header"
          style={{
            left: `${box.x}px`,
            top: `${box.y}px`,
          }}
        >
          <span className="stage-inline-editor__header-label">{headerText}</span>
          {canEditData && (
            <button
              type="button"
              className="stage-inline-editor__toggle"
              aria-pressed={mode === 'template'}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleToggleMode}
            >
              แก้แม่แบบ
            </button>
          )}
        </div>
      )}
      <textarea
        ref={textareaRef}
        aria-label="แก้ไขข้อความ"
        className="stage-inline-editor__textarea"
        value={draft}
        style={{
          left: `${box.x}px`,
          top: `${box.y}px`,
          width: `${box.w}px`,
          minHeight: `${box.h}px`,
          fontSize: `${fontSizePx}px`,
        }}
        onChange={(e) => updateDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
      <div
        className="stage-inline-editor__picker"
        style={{
          left: `${box.x + box.w}px`,
          top: `${box.y}px`,
        }}
      >
        <VariablePicker
          data={editor.data}
          scope={scope}
          onOpen={captureCaret}
          onInsert={handleInsert}
          onUpgradeFilter={handleUpgradeFilter}
        />
      </div>
    </div>
  )
}
