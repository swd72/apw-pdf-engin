import React from 'react'
import type { TemplateSummary } from '../../server/templateStore.js'

export interface TemplateListProps {
  templates: TemplateSummary[]
  selectedName: string | null
  onSelect: (name: string) => void
  onNew: () => void
  onDuplicate: (name: string) => void
  onDelete: (name: string) => void
}

export function TemplateList({
  templates,
  selectedName,
  onSelect,
  onNew,
  onDuplicate,
  onDelete,
}: TemplateListProps) {
  const handleDelete = (e: React.MouseEvent, name: string) => {
    e.stopPropagation()
    if (window.confirm(`Are you sure you want to delete template "${name}"?`)) {
      onDelete(name)
    }
  }

  const handleDuplicate = (e: React.MouseEvent, name: string) => {
    e.stopPropagation()
    onDuplicate(name)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        borderRight: '1px solid #dee2e6',
        background: '#f8f9fa',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px',
          borderBottom: '1px solid #dee2e6',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '15px' }}>Templates</span>
        <button
          type="button"
          onClick={onNew}
          style={{
            padding: '4px 10px',
            fontSize: '12px',
            background: '#198754',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          + New
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {templates.map((tpl) => {
          const isSelected = tpl.name === selectedName
          const isBuiltin = tpl.source === 'builtin'

          return (
            <div
              key={tpl.name}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(tpl.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onSelect(tpl.name)
                }
              }}
              style={{
                padding: '10px',
                marginBottom: '6px',
                borderRadius: '6px',
                background: isSelected ? '#e7f1ff' : '#fff',
                border: isSelected ? '1px solid #86b7fe' : '1px solid #dee2e6',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: '13px',
                    color: isSelected ? '#0a58ca' : '#212529',
                  }}
                >
                  {tpl.name}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    background: isBuiltin ? '#e2e3e5' : '#d1e7dd',
                    color: isBuiltin ? '#41464b' : '#0f5132',
                    fontWeight: 600,
                  }}
                >
                  {tpl.source}
                </span>
              </div>

              <div
                style={{
                  fontSize: '11px',
                  color: '#6c757d',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {tpl.description}
              </div>

              {isSelected && (
                <div
                  style={{
                    display: 'flex',
                    gap: '6px',
                    marginTop: '6px',
                    paddingTop: '6px',
                    borderTop: '1px solid #e9ecef',
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => handleDuplicate(e, tpl.name)}
                    style={{
                      padding: '2px 8px',
                      fontSize: '11px',
                      background: '#6c757d',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                    }}
                  >
                    Duplicate
                  </button>
                  {!isBuiltin && (
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, tpl.name)}
                      style={{
                        padding: '2px 8px',
                        fontSize: '11px',
                        background: '#dc3545',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
