import React, { useState } from 'react'
import {
  isUsableKey,
  renameKey,
  setAtPath,
  removeAtPath,
  addArrayItem,
  convertType,
  type DataPath,
  type PathInfo,
} from '../editor/dataModel.js'

export interface DataPanelProps {
  data: unknown
  onChange(next: unknown): void
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

export function DataPanel({ data, onChange }: DataPanelProps) {
  const [renameErrors, setRenameErrors] = useState<Record<string, string>>({})
  const [convertErrors, setConvertErrors] = useState<Record<string, string>>({})
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({})

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
      const msg = res.reason === 'duplicate' ? 'Duplicate key' : 'Invalid key name'
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

  const handleTypeChange = (path: DataPath, val: unknown, newType: PathInfo['type']) => {
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

  const renderValueEditor = (val: unknown, path: DataPath, type: PathInfo['type']) => {
    switch (type) {
      case 'string':
        return (
          <input
            aria-label="Value"
            type="text"
            value={val as string}
            onChange={(e) => onChange(setAtPath(data, path, e.target.value))}
            style={{
              padding: '4px 6px',
              fontSize: '12px',
              border: '1px solid #ccc',
              borderRadius: '3px',
              flex: 1,
            }}
          />
        )
      case 'number':
        return (
          <input
            aria-label="Value"
            type="number"
            value={val as number}
            onChange={(e) => {
              const num = Number(e.target.value)
              onChange(setAtPath(data, path, isNaN(num) ? e.target.value : num))
            }}
            style={{
              padding: '4px 6px',
              fontSize: '12px',
              border: '1px solid #ccc',
              borderRadius: '3px',
              flex: 1,
            }}
          />
        )
      case 'boolean':
        return (
          <select
            aria-label="Value"
            value={String(val)}
            onChange={(e) => onChange(setAtPath(data, path, e.target.value === 'true'))}
            style={{
              padding: '4px 6px',
              fontSize: '12px',
              border: '1px solid #ccc',
              borderRadius: '3px',
              flex: 1,
            }}
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        )
      case 'null':
        return <span style={{ color: '#888', fontSize: '12px' }}>null</span>
      case 'object':
        return renderObject(val as Record<string, unknown>, path)
      case 'array':
        return renderArray(val as unknown[], path)
      default:
        return null
    }
  }

  const renderObject = (obj: Record<string, unknown>, path: DataPath) => {
    const keys = Object.keys(obj)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
        {keys.map((k) => {
          const itemPath = [...path, k]
          const itemPathKey = itemPath.join('.')
          const itemVal = obj[k]
          const itemType = getType(itemVal)
          const usable = isUsableKey(k)
          const renameErr = renameErrors[itemPathKey]
          const convertErr = convertErrors[itemPathKey]
          const draftKey = keyDrafts[itemPathKey] ?? k

          return (
            <div
              key={k}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                padding: '6px 8px',
                borderLeft: '2px solid #e0e0e0',
                marginLeft: path.length > 0 ? '12px' : '0',
                backgroundColor: '#fafafa',
                borderRadius: '3px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  aria-label="Key"
                  type="text"
                  value={draftKey}
                  onChange={(e) => {
                    const nextKey = e.target.value
                    setKeyDrafts((prev) => ({ ...prev, [itemPathKey]: nextKey }))
                    handleKeyChange(itemPath, k, nextKey)
                  }}
                  onBlur={(e) => handleKeyChange(itemPath, k, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleKeyChange(itemPath, k, (e.target as HTMLInputElement).value)
                    }
                  }}
                  style={{
                    padding: '4px 6px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    width: '120px',
                    border: '1px solid #ccc',
                    borderRadius: '3px',
                  }}
                />

                {!usable && (
                  <span
                    style={{
                      fontSize: '10px',
                      color: '#d9534f',
                      backgroundColor: '#fdf2f2',
                      padding: '2px 4px',
                      borderRadius: '3px',
                      border: '1px solid #f5c6cb',
                    }}
                  >
                    not usable in {'{{ }}'}
                  </span>
                )}

                <select
                  aria-label="Type"
                  value={itemType}
                  onChange={(e) =>
                    handleTypeChange(itemPath, itemVal, e.target.value as PathInfo['type'])
                  }
                  style={{
                    padding: '4px 6px',
                    fontSize: '12px',
                    border: '1px solid #ccc',
                    borderRadius: '3px',
                  }}
                >
                  <option value="string">string</option>
                  <option value="number">number</option>
                  <option value="boolean">boolean</option>
                  <option value="null">null</option>
                  <option value="object">object</option>
                  <option value="array">array</option>
                </select>

                {itemType !== 'object' && itemType !== 'array' && (
                  renderValueEditor(itemVal, itemPath, itemType)
                )}

                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => handleRemove(itemPath)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    border: '1px solid #dc3545',
                    borderRadius: '3px',
                    backgroundColor: '#fff',
                    color: '#dc3545',
                    cursor: 'pointer',
                  }}
                >
                  Remove
                </button>
              </div>

              {renameErr && (
                <div role="alert" style={{ fontSize: '11px', color: '#dc3545', marginLeft: '2px' }}>
                  {renameErr}
                </div>
              )}

              {convertErr && (
                <div role="alert" style={{ fontSize: '11px', color: '#dc3545', marginLeft: '2px' }}>
                  {convertErr}
                </div>
              )}

              {(itemType === 'object' || itemType === 'array') && (
                <div style={{ marginTop: '4px', width: '100%' }}>
                  {renderValueEditor(itemVal, itemPath, itemType)}
                </div>
              )}
            </div>
          )
        })}

        <div>
          <button
            type="button"
            aria-label="Add key"
            onClick={() => handleAddKey(path, obj)}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              border: '1px dashed #0066cc',
              borderRadius: '3px',
              backgroundColor: '#f0f7ff',
              color: '#0066cc',
              cursor: 'pointer',
              marginTop: '4px',
            }}
          >
            Add key
          </button>
        </div>
      </div>
    )
  }

  const renderArray = (arr: unknown[], path: DataPath) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
        {arr.map((item, idx) => {
          const itemPath = [...path, idx]
          const itemPathKey = itemPath.join('.')
          const itemType = getType(item)
          const convertErr = convertErrors[itemPathKey]

          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                padding: '6px 8px',
                borderLeft: '2px solid #4a90e2',
                marginLeft: '12px',
                backgroundColor: '#f5f8fc',
                borderRadius: '3px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    color: '#555',
                    minWidth: '30px',
                  }}
                >
                  [{idx}]
                </span>

                <select
                  aria-label="Type"
                  value={itemType}
                  onChange={(e) =>
                    handleTypeChange(itemPath, item, e.target.value as PathInfo['type'])
                  }
                  style={{
                    padding: '4px 6px',
                    fontSize: '12px',
                    border: '1px solid #ccc',
                    borderRadius: '3px',
                  }}
                >
                  <option value="string">string</option>
                  <option value="number">number</option>
                  <option value="boolean">boolean</option>
                  <option value="null">null</option>
                  <option value="object">object</option>
                  <option value="array">array</option>
                </select>

                {itemType !== 'object' && itemType !== 'array' && (
                  renderValueEditor(item, itemPath, itemType)
                )}

                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => handleRemove(itemPath)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    border: '1px solid #dc3545',
                    borderRadius: '3px',
                    backgroundColor: '#fff',
                    color: '#dc3545',
                    cursor: 'pointer',
                  }}
                >
                  Remove
                </button>
              </div>

              {convertErr && (
                <div role="alert" style={{ fontSize: '11px', color: '#dc3545', marginLeft: '2px' }}>
                  {convertErr}
                </div>
              )}

              {(itemType === 'object' || itemType === 'array') && (
                <div style={{ marginTop: '4px', width: '100%' }}>
                  {renderValueEditor(item, itemPath, itemType)}
                </div>
              )}
            </div>
          )
        })}

        <div>
          <button
            type="button"
            aria-label="Add item"
            onClick={() => handleAddItem(path)}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              border: '1px dashed #28a745',
              borderRadius: '3px',
              backgroundColor: '#f2f9f3',
              color: '#28a745',
              cursor: 'pointer',
              marginTop: '4px',
            }}
          >
            Add item
          </button>
        </div>
      </div>
    )
  }

  if (data === null || typeof data !== 'object') {
    return (
      <div style={{ padding: '12px', fontSize: '13px' }}>
        <p>Data is scalar or empty</p>
        <button
          type="button"
          onClick={() => onChange({})}
          style={{
            padding: '4px 10px',
            fontSize: '12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        >
          Initialize object
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '12px',
        fontSize: '13px',
      }}
    >
      <div
        style={{
          fontWeight: 600,
          fontSize: '14px',
          borderBottom: '1px solid #eee',
          paddingBottom: '6px',
        }}
      >
        Data Panel
      </div>
      {Array.isArray(data) ? renderArray(data, []) : renderObject(data as Record<string, unknown>, [])}
    </div>
  )
}
