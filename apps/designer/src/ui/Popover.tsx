import React, { useState, useEffect, useRef, type ReactNode } from 'react'

export interface PopoverProps {
  label: string
  children: ReactNode
}

export function Popover({ label, children }: PopoverProps) {
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
    <div ref={containerRef} className="ui-popover">
      <button
        type="button"
        className="ui-btn"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {label}
      </button>

      {open && (
        <div role="dialog" aria-label={label} className="ui-popover__panel">
          {children}
        </div>
      )}
    </div>
  )
}
