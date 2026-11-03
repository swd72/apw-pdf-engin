import React, { useState, useEffect, useRef } from 'react'
import {
  isUsableKey,
  renameKey,
  setAtPath,
  removeAtPath,
  addArrayItem,
  convertType,
  type DataPath,
  type PathInfo,
} from '../../editor/dataModel.js'
import { Menu } from '../../ui/Menu.js'
import { Chip } from '../../ui/Chip.js'

export interface DataViewProps {
  data: unknown
  onChange(next: unknown): void
}

const DATA_TYPES: PathInfo['type'][] = [
  'string',
  'number',
  'boolean',
  'null',
  'object',
  'array',
]

const SHORT_TYPE_LABELS: Record<PathInfo['type'], string> = {
  string: 'str',
  number: 'num',
  boolean: 'bool',
  null: 'null',
  object: 'obj',
  array: 'arr',
}

function getType(val: unknown): PathInfo['type'] {
  if (val === null) return 'null'
  if (Array.isArray(val)) return 'array'
  const t = typeof val
  if (t === 'string') return 'string'
  if (t === 'number') return 'number'
  if (t === 'boolean') return 'boolean'
  return 'object'
}

function TypeChipMenu({
  type,
  onSelectType,
}: {
  type: PathInfo['type']
  onSelectType(next: PathInfo['type']): void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    const handlePointerDown = (e: MouseEvent) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [open])

  return (
    <div ref={ref} className="ui-menu data-view__type-menu">
      <button
        type="button"
        aria-label="Type"
        title={`Type: ${type}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="ui-chip ui-chip--neutral data-view__type-chip"
        onClick={() => setOpen((v) => !v)}
      >
        {SHORT_TYPE_LABELS[type]}
      </button>
      {open && (
        <div role="menu" aria-label="Type" className="ui-menu__panel">
          {DATA_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="menuitem"
              aria-label={t}
              className="ui-menu__item"
              onClick={() => {
                onSelectType(t)
                setOpen(false)
              }}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function DataView({ data, onChange }: DataViewProps) {
  const [renameErrors, setRenameErrors] = useState<Record<string, string>>({})
  const [convertErrors, setConvertErrors] = useState<Record<string, string>>({})
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({})
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const keyInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const toggleCollapse = (pathKey: string) => {
    setCollapsed((prev) => ({ ...prev, [pathKey]: !prev[pathKey] }))
  }

  const handleAddKey = (path: DataPath, targetObj: Record<string, unknown>) => {
    let i = 1
    while (Object.prototype.hasOwnProperty.call(targetObj, `key_${i}`)) {
      i++
    }
    const newKey = `key_${i}`
    const nextObj = { ...targetObj, [newKey]: '' }
    const nextData = path.length === 0 ? nextObj : setAtPath(data, path, nextObj)
    onChange(nextData)
  }

  const handleDuplicateKey = (
    parentPath: DataPath,
    targetObj: Record<string, unknown>,
    key: string,
    val: unknown,
  ) => {
    let candidate = `${key}_copy`
    let i = 2
    while (Object.prototype.hasOwnProperty.call(targetObj, candidate)) {
      candidate = `${key}_copy_${i}`
      i++
    }
    const nextObj: Record<string, unknown> = {}
    for (const k of Object.keys(targetObj)) {
      nextObj[k] = targetObj[k]
      if (k === key) {
        nextObj[candidate] = structuredClone(val)
      }
    }
    const nextData =
      parentPath.length === 0 ? nextObj : setAtPath(data, parentPath, nextObj)
    onChange(nextData)
  }

  const handleDuplicateArrayItem = (
    parentPath: DataPath,
    arr: unknown[],
    idx: number,
  ) => {
    const copyItem = structuredClone(arr[idx])
    const nextArr = [...arr.slice(0, idx + 1), copyItem, ...arr.slice(idx + 1)]
    const nextData =
      parentPath.length === 0 ? nextArr : setAtPath(data, parentPath, nextArr)
    onChange(nextData)
  }

  const handleAddItem = (path: DataPath) => {
    const next = addArrayItem(data, path)
    onChange(next)
  }

  const handleRemove = (path: DataPath) => {
    const next = removeAtPath(data, path)
    onChange(next)
  }

  const handleKeyChange = (path: DataPath, oldKey: string, newKey: string) => {
    const pathKey = path.join('.')
    if (newKey === oldKey) {
      if (renameErrors[pathKey]) {
        setRenameErrors((prev) => {
          const copy = { ...prev }
          delete copy[pathKey]
          return copy
        })
      }
      return
    }

    const res = renameKey(data, path, newKey)
    if (!res.ok) {
      const msg =
        res.reason === 'duplicate' ? 'Duplicate key' : 'Invalid key name'
      setRenameErrors((prev) => ({ ...prev, [pathKey]: msg }))
    } else {
      if (renameErrors[pathKey]) {
        setRenameErrors((prev) => {
          const copy = { ...prev }
          delete copy[pathKey]
          return copy
        })
      }
      setKeyDrafts((prev) => {
        const copy = { ...prev }
        delete copy[pathKey]
        return copy
      })
      onChange(res.data)
    }
  }

  const handleTypeChange = (
    path: DataPath,
    val: unknown,
    newType: PathInfo['type'],
  ) => {
    const pathKey = path.join('.')
    const res = convertType(val, newType)
    if (!res.ok) {
      setConvertErrors((prev) => ({
        ...prev,
        [pathKey]: `Cannot convert ${typeof val} to ${newType}`,
      }))
    } else {
      if (convertErrors[pathKey]) {
        setConvertErrors((prev) => {
          const copy = { ...prev }
          delete copy[pathKey]
          return copy
        })
      }
      onChange(setAtPath(data, path, res.value))
    }
  }

  const renderScalarValue = (
    val: unknown,
    path: DataPath,
    type: PathInfo['type'],
  ) => {
    switch (type) {
      case 'string':
        return (
          <input
            aria-label="Value"
            type="text"
            className="ui-input data-view__value-input"
            value={val as string}
            onChange={(e) => onChange(setAtPath(data, path, e.target.value))}
          />
        )
      case 'number':
        return (
          <input
            aria-label="Value"
            type="number"
            className="ui-input data-view__value-input"
            value={val as number}
            onChange={(e) => {
              const num = Number(e.target.value)
              onChange(
                setAtPath(data, path, Number.isNaN(num) ? e.target.value : num),
              )
            }}
          />
        )
      case 'boolean':
        return (
          <select
            aria-label="Value"
            className="ui-select data-view__value-input"
            value={String(val)}
            onChange={(e) =>
              onChange(setAtPath(data, path, e.target.value === 'true'))
            }
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        )
      case 'null':
        return <span className="data-view__null">null</span>
      case 'object': {
        const count = Object.keys((val as Record<string, unknown>) ?? {}).length
        return <span className="data-view__collection-summary">{`{${count}}`}</span>
      }
      case 'array': {
        const count = Array.isArray(val) ? val.length : 0
        return <span className="data-view__collection-summary">{`[${count}]`}</span>
      }
      default:
        return null
    }
  }

  const renderObject = (obj: Record<string, unknown>, path: DataPath) => {
    const keys = Object.keys(obj)
    return (
      <div className="data-view__group">
        {keys.map((k) => {
          const itemPath: DataPath = [...path, k]
          const itemPathKey = itemPath.join('.')
          const itemVal = obj[k]
          const itemType = getType(itemVal)
          const isCollection = itemType === 'object' || itemType === 'array'
          const isCollapsed = Boolean(collapsed[itemPathKey])
          const usable = isUsableKey(k)
          const renameErr = renameErrors[itemPathKey]
          const convertErr = convertErrors[itemPathKey]
          const draftKey = keyDrafts[itemPathKey] ?? k

          const menuItems = [
            {
              label: 'Rename',
              onSelect: () => {
                keyInputRefs.current[itemPathKey]?.focus()
              },
            },
            {
              label: 'Duplicate',
              onSelect: () => handleDuplicateKey(path, obj, k, itemVal),
            },
            {
              label: 'Remove',
              danger: true,
              onSelect: () => handleRemove(itemPath),
            },
          ]

          return (
            <div key={k} className="data-view__node">
              <div className="data-view__row">
                <div className="data-view__key-cell">
                  {isCollection ? (
                    <button
                      type="button"
                      className="data-view__caret"
                      aria-label={`Toggle ${k}`}
                      aria-expanded={!isCollapsed}
                      onClick={() => toggleCollapse(itemPathKey)}
                    >
                      {isCollapsed ? '▸' : '▾'}
                    </button>
                  ) : (
                    <span className="data-view__caret-spacer" />
                  )}

                  <input
                    ref={(el) => {
                      keyInputRefs.current[itemPathKey] = el
                    }}
                    aria-label="Key"
                    type="text"
                    className="ui-input data-view__key-input"
                    value={draftKey}
                    onChange={(e) => {
                      const nextKey = e.target.value
                      setKeyDrafts((prev) => ({
                        ...prev,
                        [itemPathKey]: nextKey,
                      }))
                      handleKeyChange(itemPath, k, nextKey)
                    }}
                    onBlur={(e) => handleKeyChange(itemPath, k, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleKeyChange(
                          itemPath,
                          k,
                          (e.target as HTMLInputElement).value,
                        )
                      }
                    }}
                  />

                  {!usable && (
                    <Chip tone="warn">not usable in {'{{ }}'}</Chip>
                  )}
                </div>

                <div className="data-view__val-cell">
                  <TypeChipMenu
                    type={itemType}
                    onSelectType={(nextType) =>
                      handleTypeChange(itemPath, itemVal, nextType)
                    }
                  />
                  {renderScalarValue(itemVal, itemPath, itemType)}
                </div>

                <div className="data-view__actions-cell">
                  <Menu label="ตัวเลือกข้อมูล" items={menuItems} />
                </div>
              </div>

              {renameErr && (
                <div role="alert" className="data-view__error">
                  {renameErr}
                </div>
              )}

              {convertErr && (
                <div role="alert" className="data-view__error">
                  {convertErr}
                </div>
              )}

              {isCollection && !isCollapsed && (
                <div className="data-view__nested">
                  {itemType === 'object'
                    ? renderObject(itemVal as Record<string, unknown>, itemPath)
                    : renderArray(itemVal as unknown[], itemPath)}
                </div>
              )}
            </div>
          )
        })}

        <div className="data-view__footer">
          <button
            type="button"
            aria-label="Add field"
            className="ui-btn ui-btn--ghost data-view__add-btn"
            onClick={() => handleAddKey(path, obj)}
          >
            + Add field
          </button>
        </div>
      </div>
    )
  }

  const renderArray = (arr: unknown[], path: DataPath) => {
    return (
      <div className="data-view__group">
        {arr.map((item, idx) => {
          const itemPath: DataPath = [...path, idx]
          const itemPathKey = itemPath.join('.')
          const itemType = getType(item)
          const isCollection = itemType === 'object' || itemType === 'array'
          const isCollapsed = Boolean(collapsed[itemPathKey])
          const convertErr = convertErrors[itemPathKey]

          const menuItems = [
            {
              label: 'Duplicate',
              onSelect: () => handleDuplicateArrayItem(path, arr, idx),
            },
            {
              label: 'Remove',
              danger: true,
              onSelect: () => handleRemove(itemPath),
            },
          ]

          return (
            <div key={idx} className="data-view__node">
              <div className="data-view__row">
                <div className="data-view__key-cell">
                  {isCollection ? (
                    <button
                      type="button"
                      className="data-view__caret"
                      aria-label={`Toggle [${idx}]`}
                      aria-expanded={!isCollapsed}
                      onClick={() => toggleCollapse(itemPathKey)}
                    >
                      {isCollapsed ? '▸' : '▾'}
                    </button>
                  ) : (
                    <span className="data-view__caret-spacer" />
                  )}
                  <span className="data-view__index-label">[{idx}]</span>
                </div>

                <div className="data-view__val-cell">
                  <TypeChipMenu
                    type={itemType}
                    onSelectType={(nextType) =>
                      handleTypeChange(itemPath, item, nextType)
                    }
                  />
                  {renderScalarValue(item, itemPath, itemType)}
                </div>

                <div className="data-view__actions-cell">
                  <Menu label="ตัวเลือกข้อมูล" items={menuItems} />
                </div>
              </div>

              {convertErr && (
                <div role="alert" className="data-view__error">
                  {convertErr}
                </div>
              )}

              {isCollection && !isCollapsed && (
                <div className="data-view__nested">
                  {itemType === 'object'
                    ? renderObject(item as Record<string, unknown>, itemPath)
                    : renderArray(item as unknown[], itemPath)}
                </div>
              )}
            </div>
          )
        })}

        <div className="data-view__footer">
          <button
            type="button"
            aria-label="Add item"
            className="ui-btn ui-btn--ghost data-view__add-btn"
            onClick={() => handleAddItem(path)}
          >
            + Add item
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="data-panel">
      <div className="panel-header">
        <h2 className="panel-header__title">ข้อมูล</h2>
      </div>

      <div className="panel-body data-view">
        {data === null || typeof data !== 'object' ? (
          <div className="data-view__empty">
            <p className="data-view__empty-text">ยังไม่มีข้อมูลตัวอย่าง</p>
            <button
              type="button"
              className="ui-btn"
              onClick={() => onChange({})}
            >
              สร้างข้อมูลเริ่มต้น
            </button>
          </div>
        ) : Array.isArray(data) ? (
          renderArray(data, [])
        ) : (
          renderObject(data as Record<string, unknown>, [])
        )}
      </div>
    </div>
  )
}
