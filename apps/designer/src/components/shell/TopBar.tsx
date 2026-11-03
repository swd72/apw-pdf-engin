import React from 'react'
import {
  SegmentedControl,
  type SegmentedOption,
} from '../../ui/SegmentedControl.js'
import { Menu, type MenuItem } from '../../ui/Menu.js'
import { Chip } from '../../ui/Chip.js'

export interface TopBarProps {
  name: string
  dirty: boolean
  mode: 'visual' | 'json'
  onMode(m: 'visual' | 'json'): void
  onSave(): void
  saveLabel: string
  saveDisabled?: boolean
  statusMessage?: string
  statusTone?: 'idle' | 'saving' | 'success' | 'error'
  jsonIssueCount?: number
  menu: Array<{
    label: string
    onSelect(): void
    danger?: boolean
    disabled?: boolean
  }>
}

const MODE_OPTIONS: Array<SegmentedOption<'visual' | 'json'>> = [
  { value: 'visual', label: 'Visual' },
  { value: 'json', label: 'JSON' },
]

export function TopBar({
  name,
  dirty,
  mode,
  onMode,
  onSave,
  saveLabel,
  saveDisabled = false,
  statusMessage,
  statusTone = 'idle',
  jsonIssueCount = 0,
  menu,
}: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="top-bar__brand">
        <span className="top-bar__logo" aria-hidden="true">
          APW
        </span>
        <span className="top-bar__title">Designer</span>
        <span className="top-bar__divider" aria-hidden="true">
          /
        </span>
        <span className="top-bar__template-name" title={name}>
          {name}
        </span>
        {dirty && (
          <span
            className="top-bar__dirty-dot"
            title="มีการแก้ไขที่ยังไม่ได้บันทึก"
            aria-label="มีการแก้ไขที่ยังไม่ได้บันทึก"
          />
        )}
      </div>

      <div className="top-bar__center">
        <SegmentedControl
          options={MODE_OPTIONS}
          value={mode}
          onChange={onMode}
        />
        {jsonIssueCount > 0 && (
          <Chip tone="danger">{String(jsonIssueCount)}</Chip>
        )}
      </div>

      <div className="top-bar__actions">
        {statusMessage && (
          <span
            className={`top-bar__status top-bar__status--${statusTone}`}
            role="status"
          >
            {statusMessage}
          </span>
        )}
        <button
          type="button"
          className="ui-btn ui-btn--primary"
          onClick={onSave}
          disabled={saveDisabled}
        >
          {saveLabel}
        </button>
        <Menu label="เมนูเพิ่มเติม" items={menu as MenuItem[]} />
      </div>
    </header>
  )
}
