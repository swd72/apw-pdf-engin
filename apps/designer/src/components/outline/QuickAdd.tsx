import React, { useState, useMemo } from 'react'
import type { Block } from '@apw-pdf/core'
import { BLOCK_TYPES } from '../../editor/blockCatalog.js'
import { BLOCK_PICKER_ORDER, blockMeta } from '../cards/blockMeta.js'

export interface QuickAddProps {
  onInsert(type: Block['type']): void
  onClose?(): void
}

export function QuickAdd({ onInsert, onClose }: QuickAddProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const normalizedQuery = query.trim().toLowerCase()

  const filteredTypes = useMemo(() => {
    if (!normalizedQuery) return BLOCK_PICKER_ORDER
    return BLOCK_PICKER_ORDER.filter((type) => {
      const meta = blockMeta(type)
      const catalogEntry = BLOCK_TYPES.find((b) => b.type === type)
      return (
        meta.label.toLowerCase().includes(normalizedQuery) ||
        type.toLowerCase().includes(normalizedQuery) ||
        (catalogEntry?.label.toLowerCase().includes(normalizedQuery) ?? false)
      )
    })
  }, [normalizedQuery])

  const basicTypes = useMemo(
    () => filteredTypes.filter((t) => blockMeta(t).group === 'basic'),
    [filteredTypes],
  )
  const advancedTypes = useMemo(
    () => filteredTypes.filter((t) => blockMeta(t).group === 'advanced'),
    [filteredTypes],
  )

  const handleSelect = (type: Block['type']) => {
    onInsert(type)
    onClose?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation()
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (filteredTypes.length > 0) {
        setActiveIndex((prev) => (prev + 1) % filteredTypes.length)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (filteredTypes.length > 0) {
        setActiveIndex(
          (prev) => (prev - 1 + filteredTypes.length) % filteredTypes.length,
        )
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const chosen = filteredTypes[activeIndex] ?? filteredTypes[0]
      if (chosen) {
        handleSelect(chosen)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose?.()
    }
  }

  const renderGroup = (title: string, types: Block['type'][]) => {
    if (types.length === 0) return null
    return (
      <div className="quick-add__group">
        <div className="quick-add__group-title">{title}</div>
        {types.map((type) => {
          const meta = blockMeta(type)
          const idx = filteredTypes.indexOf(type)
          const isActive = idx === activeIndex
          return (
            <button
              key={type}
              type="button"
              role="menuitem"
              aria-label={meta.label}
              className={`ui-menu__item quick-add__item ${isActive ? 'quick-add__item--active' : ''}`}
              onMouseEnter={() => {
                if (idx !== -1) setActiveIndex(idx)
              }}
              onClick={() => handleSelect(type)}
            >
              <span className="quick-add__item-main">
                <span className="outline-row__icon">{meta.icon}</span>
                <span>{meta.label}</span>
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div
      className="quick-add"
      role="menu"
      aria-label="เพิ่มบล็อก"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="text"
        className="ui-input quick-add__search"
        placeholder="ค้นหาชนิดบล็อก..."
        aria-label="ค้นหาชนิดบล็อก"
        autoFocus
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActiveIndex(0)
        }}
        onKeyDown={handleKeyDown}
      />
      <div className="quick-add__list">
        {renderGroup('พื้นฐาน', basicTypes)}
        {renderGroup('ขั้นสูง', advancedTypes)}
        {filteredTypes.length === 0 && (
          <div className="quick-add__empty">ไม่พบบล็อกที่ตรงกัน</div>
        )}
      </div>
    </div>
  )
}
