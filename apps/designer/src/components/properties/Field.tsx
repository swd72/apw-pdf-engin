import React, { type ReactNode } from 'react'
import { ResetIcon } from '../../ui/icons.js'

export interface FieldProps {
  label: string
  htmlFor?: string
  error?: string | null
  onReset?(): void
  children: ReactNode
}

export function Field({
  label,
  htmlFor,
  error,
  onReset,
  children,
}: FieldProps) {
  return (
    <div className="prop-field">
      <div className="prop-field__head">
        <label htmlFor={htmlFor} className="prop-field__label">
          {label}
        </label>
        {onReset && (
          <button
            type="button"
            className="prop-field__reset"
            aria-label={`Reset ${label}`}
            title="รีเซ็ตค่า"
            onClick={onReset}
          >
            <ResetIcon size={14} />
          </button>
        )}
      </div>
      <div className="prop-field__control">{children}</div>
      {error && (
        <div role="alert" className="prop-field__error">
          {error}
        </div>
      )}
    </div>
  )
}
