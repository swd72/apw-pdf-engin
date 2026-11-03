import React, { useState, useEffect, useRef } from 'react'
import type { Block } from '@apw-pdf/core'
import { PlusIcon } from '../../ui/icons.js'
import { BlockPicker } from './BlockPicker.js'

export interface InsertLineProps {
  onPick(type: Block['type']): void
}

export function InsertLine({ onPick }: InsertLineProps) {
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
      className={`insert-line ${open ? 'insert-line--open' : ''}`}
    >
      <button
        type="button"
        className="insert-line__btn"
        aria-label="เพิ่มบล็อก"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <PlusIcon size={14} />
        <span>เพิ่มบล็อก</span>
      </button>

      {open && (
        <div className="insert-line__popover">
          <BlockPicker
            onPick={(type) => {
              setOpen(false)
              onPick(type)
            }}
          />
        </div>
      )}
    </div>
  )
}
