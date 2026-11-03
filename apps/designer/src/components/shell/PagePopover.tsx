import React, { useEffect, useRef } from 'react'
import type { DocumentDef } from '@apw-pdf/core'
import { DocumentSettings } from '../properties/DocumentSettings.js'

export interface PagePopoverProps {
  doc: DocumentDef
  onChange(next: DocumentDef): void
  open?: boolean
  onClose?(): void
}

export function PagePopover({
  doc,
  onChange,
  open = true,
  onClose,
}: PagePopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !onClose) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose?.()
      }
    }
    function handleMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        e.target instanceof Node &&
        !containerRef.current.contains(e.target)
      ) {
        onClose?.()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleMouseDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={containerRef}
      className="shell-popover"
      role="dialog"
      aria-label="หน้ากระดาษ"
    >
      <div className="shell-popover__header">
        <span className="shell-popover__title">ตั้งค่าหน้ากระดาษ</span>
        {onClose && (
          <button
            type="button"
            className="ui-btn ui-btn--ghost"
            aria-label="ปิด"
            onClick={onClose}
          >
            ✕
          </button>
        )}
      </div>
      <div className="shell-popover__body">
        <DocumentSettings doc={doc} onChange={onChange} />
      </div>
    </div>
  )
}
