import React, { useState, useMemo, useEffect, useRef } from 'react'

export interface AddPropertyOption {
  key: string
  label: string
  add(): void
}

export interface AddPropertyProps {
  options: Array<AddPropertyOption>
}

export function AddProperty({ options }: AddPropertyProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    const handlePointerDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        e.target instanceof Node &&
        !containerRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.key.toLowerCase().includes(q),
    )
  }, [options, query])

  if (options.length === 0) return null

  return (
    <div ref={containerRef} className="add-property">
      <button
        type="button"
        className="ui-btn ui-btn--ghost add-property__trigger"
        aria-label="+ เพิ่มคุณสมบัติ"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        + เพิ่มคุณสมบัติ
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="เพิ่มคุณสมบัติ"
          className="add-property__popover"
        >
          <input
            type="text"
            aria-label="ค้นหาคุณสมบัติ"
            placeholder="ค้นหาคุณสมบัติ..."
            className="ui-input add-property__search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filtered.length > 0) {
                e.preventDefault()
                filtered[0]!.add()
                setOpen(false)
                setQuery('')
              }
            }}
          />

          <div role="listbox" aria-label="รายการคุณสมบัติ" className="add-property__list">
            {filtered.map((opt) => (
              <button
                key={opt.key}
                type="button"
                role="option"
                aria-selected={false}
                aria-label={`${opt.label} (${opt.key})`}
                className="ui-menu__item"
                onClick={() => {
                  opt.add()
                  setOpen(false)
                  setQuery('')
                }}
              >
                <span>{opt.label}</span>
                <span className="add-property__key">{opt.key}</span>
              </button>
            ))}

            {filtered.length === 0 && (
              <div className="quick-add__empty">ไม่พบคุณสมบัติ</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
