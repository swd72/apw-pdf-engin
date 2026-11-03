import React, { useState, useMemo, useEffect, useRef } from 'react'
import { FILTER_NAMES } from '../../editor/bindings.js'
import { BindingInput } from '../BindingInput.js'
import { collectCandidatePaths } from './shared.js'

export interface VariablePickerProps {
  data: unknown
  scope?: Array<{ name: string; arrayPath: string }>
  onInsert(token: string): void
  onUpgradeFilter?(token: string): void
  onOpen?(): void
}

export function VariablePicker({
  data,
  scope,
  onInsert,
  onUpgradeFilter,
  onOpen,
}: VariablePickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setSelectedPath(null)
      }
    }

    const handlePointerDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        e.target instanceof Node &&
        !containerRef.current.contains(e.target)
      ) {
        setOpen(false)
        setSelectedPath(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [open])

  const candidates = useMemo(
    () => collectCandidatePaths(data, scope),
    [data, scope],
  )

  const filteredPaths = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter((c) => c.toLowerCase().includes(q))
  }, [candidates, query])

  const filteredFilters = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return FILTER_NAMES
    return FILTER_NAMES.filter((f) => f.toLowerCase().includes(q))
  }, [query])

  const handleToggle = () => {
    if (!open) {
      onOpen?.()
      setSelectedPath(null)
      setQuery('')
      setOpen(true)
    } else {
      setOpen(false)
      setSelectedPath(null)
    }
  }

  const handlePickPath = (path: string) => {
    onInsert(`{{${path}}}`)
    setSelectedPath(path)
    setQuery('')
  }

  const handlePickFilter = (filterName: string | null) => {
    if (!selectedPath) return
    if (filterName) {
      const upgraded = `{{${selectedPath} | ${filterName}}}`
      if (onUpgradeFilter) {
        onUpgradeFilter(upgraded)
      } else {
        onInsert(upgraded)
      }
    }
    setOpen(false)
    setSelectedPath(null)
    setQuery('')
  }

  return (
    <div ref={containerRef} className="variable-picker">
      <button
        type="button"
        className="variable-picker__trigger"
        aria-label="{ } ตัวแปร"
        title="แทรกตัวแปร"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={handleToggle}
      >
        {'{ } ตัวแปร'}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="เลือกตัวแปร"
          className="variable-picker__popover"
        >
          {selectedPath === null ? (
            <>
              <input
                type="text"
                aria-label="ค้นหาตัวแปร"
                placeholder="ค้นหาตัวแปร..."
                className="ui-input variable-picker__search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredPaths.length > 0) {
                    e.preventDefault()
                    handlePickPath(filteredPaths[0]!)
                  }
                }}
              />
              <div
                role="listbox"
                aria-label="รายการตัวแปร"
                className="variable-picker__list"
              >
                {filteredPaths.map((cand) => (
                  <button
                    key={cand}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="ui-menu__item"
                    onClick={() => handlePickPath(cand)}
                  >
                    <span className="add-property__key">{cand}</span>
                  </button>
                ))}
                {filteredPaths.length === 0 && (
                  <div className="quick-add__empty">ไม่พบตัวแปร</div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="variable-picker__step-header">
                <span>ตัวกรอง: {selectedPath}</span>
                <button
                  type="button"
                  className="ui-btn ui-btn--ghost"
                  style={{ height: '22px', padding: '0 6px', fontSize: '11px' }}
                  onClick={() => handlePickFilter(null)}
                >
                  ไม่ใช้ตัวกรอง
                </button>
              </div>
              <input
                type="text"
                aria-label="ค้นหาตัวกรอง"
                placeholder="ค้นหาตัวกรอง..."
                className="ui-input variable-picker__search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div
                role="listbox"
                aria-label="รายการตัวกรอง"
                className="variable-picker__list"
              >
                {filteredFilters.map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="ui-menu__item"
                    onClick={() => handlePickFilter(f)}
                  >
                    <span className="add-property__key">{f}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export interface BindableInputProps {
  id?: string
  'aria-label'?: string
  value: string
  onChange(next: string): void
  data: unknown
  scope?: Array<{ name: string; arrayPath: string }>
  multiline?: boolean
  rows?: number
  placeholder?: string
  unresolved?: string[]
}

export function BindableInput({
  id,
  'aria-label': ariaLabel,
  value,
  onChange,
  data,
  scope,
  multiline = false,
  rows = 3,
  placeholder,
  unresolved,
}: BindableInputProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const caretRangeRef = useRef<{ before: string; after: string } | null>(null)

  const captureCaret = () => {
    const el = wrapRef.current?.querySelector('input, textarea') as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null
    const start =
      el && typeof el.selectionStart === 'number'
        ? el.selectionStart
        : value.length
    const end =
      el && typeof el.selectionEnd === 'number' ? el.selectionEnd : value.length
    caretRangeRef.current = {
      before: value.slice(0, start),
      after: value.slice(end),
    }
  }

  const handleInsert = (token: string) => {
    if (!caretRangeRef.current) {
      captureCaret()
    }
    const range = caretRangeRef.current ?? { before: value, after: '' }
    onChange(`${range.before}${token}${range.after}`)
  }

  const handleUpgradeFilter = (token: string) => {
    const range = caretRangeRef.current ?? { before: '', after: '' }
    onChange(`${range.before}${token}${range.after}`)
  }

  return (
    <div ref={wrapRef} className="prop-binding">
      <BindingInput
        id={id}
        aria-label={ariaLabel}
        value={value}
        onChange={onChange}
        data={data}
        scope={scope}
        multiline={multiline}
        rows={rows}
        placeholder={placeholder}
        unresolved={unresolved}
      />
      <div className="prop-binding__picker-wrap">
        <VariablePicker
          data={data}
          scope={scope}
          onOpen={captureCaret}
          onInsert={handleInsert}
          onUpgradeFilter={handleUpgradeFilter}
        />
      </div>
    </div>
  )
}
