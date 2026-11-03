import React, { useState, type ReactNode } from 'react'
import { ChevronDownIcon, ChevronRightIcon } from '../../ui/icons.js'

export interface SectionProps {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}

export function Section({
  title,
  defaultOpen = true,
  children,
}: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="prop-section">
      <button
        type="button"
        className="prop-section__header"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="prop-section__caret">
          {open ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
        </span>
        <span className="prop-section__title">{title}</span>
      </button>
      {open && <div className="prop-section__body">{children}</div>}
    </section>
  )
}
