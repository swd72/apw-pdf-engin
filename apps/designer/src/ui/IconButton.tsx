import React, { type ReactNode } from 'react'

export interface IconButtonProps {
  label: string
  icon: ReactNode
  onClick(): void
  disabled?: boolean
  active?: boolean
  danger?: boolean
  className?: string
}

export function IconButton({
  label,
  icon,
  onClick,
  disabled = false,
  active = false,
  danger = false,
  className = '',
}: IconButtonProps) {
  const classes = [
    'ui-icon-btn',
    active ? 'ui-icon-btn--active' : '',
    danger ? 'ui-icon-btn--danger' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={classes}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        if (!disabled) {
          onClick()
        }
      }}
    >
      {icon}
    </button>
  )
}
