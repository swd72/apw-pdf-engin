import React, { useEffect, useRef, useState } from 'react'
import { buildSnippets } from '../../lib/snippet.js'

export interface UsePopoverProps {
  templateName: string
  open?: boolean
  onClose?(): void
}

async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }
  return false
}

export function UsePopover({
  templateName,
  open = true,
  onClose,
}: UsePopoverProps) {
  const [copiedTarget, setCopiedTarget] = useState<'cli' | 'react' | null>(null)
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

  const { cli, react } = buildSnippets(templateName)

  async function handleCopy(target: 'cli' | 'react', value: string) {
    const ok = await copyText(value)
    if (ok) {
      setCopiedTarget(target)
      window.setTimeout(() => {
        setCopiedTarget((curr) => (curr === target ? null : curr))
      }, 1500)
    }
  }

  return (
    <div
      ref={containerRef}
      className="shell-popover"
      role="dialog"
      aria-label="ใช้ในโปรเจกต์"
    >
      <div className="shell-popover__header">
        <span className="shell-popover__title">
          ใช้ในโปรเจกต์ ({templateName})
        </span>
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
        <div className="shell-popover__section">
          <div className="shell-popover__section-header">
            <span className="prop-field__label">CLI</span>
            <button
              type="button"
              className="ui-btn ui-btn--ghost"
              onClick={() => {
                void handleCopy('cli', cli)
              }}
            >
              {copiedTarget === 'cli' ? 'คัดลอกแล้ว' : 'Copy CLI'}
            </button>
          </div>
          <pre className="shell-popover__code">
            <code>{cli}</code>
          </pre>
        </div>

        <div className="shell-popover__section">
          <div className="shell-popover__section-header">
            <span className="prop-field__label">React</span>
            <button
              type="button"
              className="ui-btn ui-btn--ghost"
              onClick={() => {
                void handleCopy('react', react)
              }}
            >
              {copiedTarget === 'react' ? 'คัดลอกแล้ว' : 'Copy React'}
            </button>
          </div>
          <pre className="shell-popover__code">
            <code>{react}</code>
          </pre>
        </div>
      </div>
    </div>
  )
}
