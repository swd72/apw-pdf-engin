import React, { useState } from 'react'
import type { Block } from '@apw-pdf/core'
import { BLOCK_PICKER_ORDER, blockMeta } from './blockMeta.js'

export interface BlockPickerProps {
  onPick(type: Block['type']): void
}

const BASIC_TYPES = BLOCK_PICKER_ORDER.filter(
  (t) => blockMeta(t).group === 'basic',
)
const ADVANCED_TYPES = BLOCK_PICKER_ORDER.filter(
  (t) => blockMeta(t).group === 'advanced',
)

export function BlockPicker({ onPick }: BlockPickerProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
    <div className="block-picker" role="region" aria-label="เลือกบล็อก">
      <div className="block-picker__grid">
        {BASIC_TYPES.map((type) => {
          const meta = blockMeta(type)
          return (
            <button
              key={type}
              type="button"
              className="block-picker__item"
              onClick={() => onPick(type)}
            >
              <span className="block-card__icon">{meta.icon}</span>
              <span>{meta.label}</span>
            </button>
          )
        })}
      </div>

      <div>
        <button
          type="button"
          className="block-picker__toggle"
          aria-expanded={showAdvanced}
          onClick={() => setShowAdvanced((v) => !v)}
        >
          <span>ขั้นสูง</span>
          <span>{showAdvanced ? '▾' : '▸'}</span>
        </button>

        {showAdvanced && (
          <div className="block-picker__grid block-picker__advanced">
            {ADVANCED_TYPES.map((type) => {
              const meta = blockMeta(type)
              return (
                <button
                  key={type}
                  type="button"
                  className="block-picker__item"
                  onClick={() => onPick(type)}
                >
                  <span className="block-card__icon">{meta.icon}</span>
                  <span>{meta.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
