import React, { useState, useMemo } from 'react'
import { IconButton } from '../../ui/IconButton.js'
import { Chip } from '../../ui/Chip.js'
import { PlusIcon } from '../../ui/icons.js'

export interface TemplateItem {
  name: string
  description: string
  source: 'builtin' | 'saved'
}

export interface TemplatesViewProps {
  items: Array<TemplateItem>
  selected: string | null
  onSelect(name: string): void
  onNew(): void
  filter?: string
}

export function TemplatesView({
  items,
  selected,
  onSelect,
  onNew,
  filter,
}: TemplatesViewProps) {
  const [query, setQuery] = useState(filter ?? '')
  const [lastPropFilter, setLastPropFilter] = useState(filter)

  if (filter !== lastPropFilter) {
    setLastPropFilter(filter)
    if (filter !== undefined) {
      setQuery(filter)
    }
  }

  const normalizedQuery = query.trim().toLowerCase()

  const filteredItems = useMemo(() => {
    if (!normalizedQuery) return items
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.description.toLowerCase().includes(normalizedQuery),
    )
  }, [items, normalizedQuery])

  return (
    <div className="templates-panel">
      <div className="panel-header">
        <h2 className="panel-header__title">เทมเพลต</h2>
        <IconButton
          label="สร้างเทมเพลตใหม่"
          icon={<PlusIcon size={18} />}
          onClick={onNew}
        />
      </div>

      <div className="templates-view__toolbar">
        <input
          type="search"
          className="ui-input templates-view__search"
          placeholder="ค้นหาเทมเพลต..."
          aria-label="ค้นหาเทมเพลต"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="panel-body templates-view__list">
        {filteredItems.map((item) => {
          const isSelected = item.name === selected
          return (
            <button
              key={item.name}
              type="button"
              aria-pressed={isSelected}
              className={`templates-view__row ${isSelected ? 'templates-view__row--selected' : ''}`}
              onClick={() => onSelect(item.name)}
            >
              <div className="templates-view__row-head">
                <span className="templates-view__name">{item.name}</span>
                {item.source === 'builtin' && (
                  <Chip tone="neutral">builtin</Chip>
                )}
              </div>
              {item.description && (
                <div className="templates-view__desc">{item.description}</div>
              )}
            </button>
          )
        })}

        {filteredItems.length === 0 && (
          <div className="templates-view__empty">ไม่พบเทมเพลตที่ค้นหา</div>
        )}
      </div>
    </div>
  )
}
