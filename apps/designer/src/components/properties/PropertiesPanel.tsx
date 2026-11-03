import React, { useState, useEffect, useRef } from 'react'
import type { Block } from '@apw-pdf/core'
import type { EditorState } from '../../editor/useEditorState.js'
import { getBlock, type BlockPath } from '../../editor/docModel.js'
import { SettingsIcon } from '../../ui/icons.js'
import { blockMeta } from '../cards/blockMeta.js'
import { DocumentSettings } from './DocumentSettings.js'
import { Section } from './Section.js'
import { ParagraphProps } from './types/ParagraphProps.js'
import { SignatureProps } from './types/SignatureProps.js'
import { ImageProps } from './types/ImageProps.js'
import { LineProps } from './types/LineProps.js'
import { SpacerProps } from './types/SpacerProps.js'
import { ColumnsProps } from './types/ColumnsProps.js'
import { RepeatProps } from './types/RepeatProps.js'
import { ConditionProps } from './types/ConditionProps.js'
import { TableProps } from './types/TableProps.js'
import { JsonProps } from './types/JsonProps.js'

export interface PropertiesPanelProps {
  state: EditorState
  onOpenTableEditor(path: BlockPath): void
}

const KNOWN_BLOCK_TYPES = new Set<string>([
  'paragraph',
  'signature',
  'image',
  'line',
  'spacer',
  'columns',
  'each',
  'if',
  'table',
  'pageBreak',
])

export function PropertiesPanel({
  state,
  onOpenTableEditor,
}: PropertiesPanelProps) {
  const { doc, selectedPath } = state
  const [jsonMode, setJsonMode] = useState(false)
  const pathKey = selectedPath ? selectedPath.join('.') : ''
  const prevPathKeyRef = useRef(pathKey)

  useEffect(() => {
    if (prevPathKeyRef.current !== pathKey) {
      prevPathKeyRef.current = pathKey
      setJsonMode(false)
    }
  }, [pathKey])

  const block = selectedPath ? getBlock(doc, selectedPath) : undefined

  if (!selectedPath || !block) {
    return (
      <div className="properties-panel">
        <div className="panel-header">
          <div className="properties-panel__header-meta">
            <span className="properties-panel__icon">
              <SettingsIcon size={18} />
            </span>
            <h2 className="panel-header__title">ตั้งค่าเอกสาร</h2>
          </div>
        </div>
        <div className="panel-body">
          <DocumentSettings state={state} />
        </div>
      </div>
    )
  }

  const isKnownType = KNOWN_BLOCK_TYPES.has(block.type)
  const meta = blockMeta(block.type)

  const renderTypeEditor = (currentBlock: Block, path: BlockPath) => {
    if (jsonMode || !isKnownType) {
      return <JsonProps block={currentBlock} path={path} state={state} />
    }

    switch (currentBlock.type) {
      case 'paragraph':
        return <ParagraphProps block={currentBlock} path={path} state={state} />
      case 'signature':
        return <SignatureProps block={currentBlock} path={path} state={state} />
      case 'image':
        return <ImageProps block={currentBlock} path={path} state={state} />
      case 'line':
        return <LineProps block={currentBlock} path={path} state={state} />
      case 'spacer':
        return <SpacerProps block={currentBlock} path={path} state={state} />
      case 'columns':
        return <ColumnsProps block={currentBlock} path={path} state={state} />
      case 'each':
        return <RepeatProps block={currentBlock} path={path} state={state} />
      case 'if':
        return <ConditionProps block={currentBlock} path={path} state={state} />
      case 'table':
        return (
          <TableProps
            block={currentBlock}
            path={path}
            state={state}
            onOpenTableEditor={onOpenTableEditor}
          />
        )
      case 'pageBreak':
        return (
          <div className="properties-panel__body">
            <Section title="การจัดวาง (Layout)">
              <span className="add-property__key">
                บล็อกขึ้นหน้าใหม่ไม่มีการตั้งค่าเพิ่มเติม
              </span>
            </Section>
          </div>
        )
      default:
        return <JsonProps block={currentBlock} path={path} state={state} />
    }
  }

  return (
    <div className="properties-panel">
      <div className="panel-header">
        <div className="properties-panel__header-meta">
          <span className="properties-panel__icon">{meta.icon}</span>
          <h2 className="panel-header__title">{meta.label}</h2>
          <span className="properties-panel__crumb">
            {selectedPath.join('.')}
          </span>
        </div>

        {isKnownType && (
          <button
            type="button"
            className={`ui-btn ui-btn--ghost ${jsonMode ? 'ui-icon-btn--active' : ''}`}
            style={{ height: '26px', padding: '0 8px', fontSize: '11px' }}
            aria-label="Edit JSON"
            onClick={() => setJsonMode((v) => !v)}
          >
            {jsonMode ? 'ฟอร์ม' : 'JSON'}
          </button>
        )}
      </div>

      <div className="panel-body">
        {renderTypeEditor(block, selectedPath)}
      </div>
    </div>
  )
}
