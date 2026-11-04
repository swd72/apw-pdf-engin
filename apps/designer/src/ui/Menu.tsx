import React, { useState, useEffect, useRef, type ReactNode } from 'react'
import { MoreIcon } from './icons.js'

export interface MenuItem {
  label: string
  onSelect(): void
  disabled?: boolean
  danger?: boolean
  title?: string
}

export interface MenuProps {
  label: string
  items: Array<MenuItem>
  icon?: ReactNode
}

export function Menu({ label, items, icon }: MenuProps) {
  const [open, setOpen] = useState(false)
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

  return (
    <div
      ref={containerRef}
      className="ui-menu"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={`ui-icon-btn ${open ? 'ui-icon-btn--active' : ''}`}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {icon ?? <MoreIcon />}
      </button>

      {open && (
        <div role="menu" aria-label={label} className="ui-menu__panel">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              aria-label={item.label}
              title={item.title}
              disabled={item.disabled}
              className={`ui-menu__item ${item.danger ? 'ui-menu__item--danger' : ''}`}
              onClick={() => {
                if (item.disabled) return
                item.onSelect()
                setOpen(false)
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
