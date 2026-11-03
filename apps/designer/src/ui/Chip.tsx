import React, { type ReactNode } from 'react'

export interface ChipProps {
  tone?: 'neutral' | 'warn' | 'accent'
  children: ReactNode
}

export function Chip({ tone = 'neutral', children }: ChipProps) {
  return <span className={`ui-chip ui-chip--${tone}`}>{children}</span>
}
