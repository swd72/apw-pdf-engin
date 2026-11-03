import React, { useEffect, useRef, type ReactNode } from 'react'
import { IconButton } from '../../ui/IconButton.js'
import { ResetIcon } from '../../ui/icons.js'

export interface DialogProps {
  open: boolean
  title: string
  onClose(): void
  children: ReactNode
}

const FOCUSABLE_SELECTOR =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

export function Dialog({ open, title, onClose, children }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return

    const dialogEl = dialogRef.current
    if (dialogEl) {
      const firstFocusable = dialogEl.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      firstFocusable?.focus()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        )
        if (focusables.length === 0) return

        const first = focusables[0]!
        const last = focusables[focusables.length - 1]!
        const active = document.activeElement as HTMLElement | null

        if (e.shiftKey) {
          if (active === first || !dialogRef.current.contains(active)) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (active === last || !dialogRef.current.contains(active)) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="ui-dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="ui-dialog"
      >
        <div className="ui-dialog__header">
          <h2 className="ui-dialog__title">{title}</h2>
          <IconButton
            label="Close"
            icon={<ResetIcon size={18} />}
            onClick={onClose}
          />
        </div>
        <div className="ui-dialog__body">{children}</div>
      </div>
    </div>
  )
}
