import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { DocumentDef } from '@apw-pdf/core'
import type { RenderClient } from '@apw-pdf/react'
import { useEditorState } from '../editor/useEditorState.js'
import type { BlockPath } from '../editor/docModel.js'
import { SplitWorkspace } from '../ui/SplitWorkspace.js'
import {
  SegmentedControl,
  type SegmentedOption,
} from '../ui/SegmentedControl.js'
import { IconButton } from '../ui/IconButton.js'
import {
  TextIcon,
  BracesIcon,
  TableIcon,
  SettingsIcon,
} from '../ui/icons.js'
import { OutlineTree } from './outline/OutlineTree.js'
import { DataView } from './data/DataView.js'
import {
  TemplatesView,
  type TemplateItem,
} from './templates/TemplatesView.js'
import { PropertiesPanel } from './properties/PropertiesPanel.js'
import { PdfStage } from './stage/PdfStage.js'

export type LeftTab = 'outline' | 'data' | 'templates'

export interface VisualEditorProps {
  doc: DocumentDef
  data: unknown
  onChange?(next: { doc: DocumentDef; data: unknown }): void
  onDocChange?(next: DocumentDef): void
  onDataChange?(next: unknown): void
  centre?: React.ReactNode
  templates?: TemplateItem[]
  selectedTemplate?: string | null
  onSelectTemplate?(name: string): void
  onNewTemplate?(): void
  leftOverride?: React.ReactNode
  rightOverride?: React.ReactNode
  stageDoc?: unknown | null
  stageData?: unknown | null
  stageClient?: RenderClient
}

const LEFT_TAB_OPTIONS: Array<SegmentedOption<LeftTab>> = [
  { value: 'outline', label: 'โครงสร้าง' },
  { value: 'data', label: 'ข้อมูล' },
  { value: 'templates', label: 'เทมเพลต' },
]

const EMPTY_TEMPLATES: TemplateItem[] = []

const IDLE_STAGE_CLIENT: RenderClient = {
  render: () => new Promise(() => {}),
  dispose: () => {},
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true
  }
  if (target.isContentEditable) {
    return true
  }
  if (typeof target.closest === 'function') {
    const ce = target.closest('[contenteditable]') as HTMLElement | null
    if (ce && ce.getAttribute('contenteditable') !== 'false') {
      return true
    }
  }
  return false
}

export function VisualEditor({
  doc,
  data,
  onChange,
  onDocChange,
  onDataChange,
  centre,
  templates = EMPTY_TEMPLATES,
  selectedTemplate = null,
  onSelectTemplate,
  onNewTemplate,
  leftOverride,
  rightOverride,
  stageDoc,
  stageData,
  stageClient,
}: VisualEditorProps) {
  const initial = useMemo(() => ({ doc, data }), [doc, data])

  const handleStateChange = useCallback(
    (next: { doc: DocumentDef; data: unknown }) => {
      onChange?.(next)
      onDocChange?.(next.doc)
      onDataChange?.(next.data)
    },
    [onChange, onDocChange, onDataChange],
  )

  const state = useEditorState(initial, handleStateChange)
  const [leftTab, setLeftTab] = useState<LeftTab>('outline')
  const [warningsExpanded, setWarningsExpanded] = useState(false)
  const [jsonModePathKey, setJsonModePathKey] = useState<string | null>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      if (isEditableTarget(e.target)) return

      const key = e.key.toLowerCase()
      if (key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          state.redo()
        } else {
          state.undo()
        }
      } else if (key === 'y' && !e.shiftKey) {
        e.preventDefault()
        state.redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [state.undo, state.redo])

  const selectedPathKey = state.selectedPath ? state.selectedPath.join('.') : ''
  const isBlockJsonMode =
    Boolean(selectedPathKey) && jsonModePathKey === selectedPathKey

  const handleFocusProperties = useCallback(() => {
    const body = rightPanelRef.current?.querySelector('.panel-body')
    const firstInput = body?.querySelector<HTMLElement>(
      'input, textarea, select',
    )
    firstInput?.focus()
  }, [])

  const handleEditBlockJson = useCallback(
    (path: BlockPath) => {
      state.select(path)
      setJsonModePathKey(path.join('.'))
    },
    [state],
  )

  const handleJsonModeChange = useCallback(
    (next: boolean) => {
      setJsonModePathKey(next && selectedPathKey ? selectedPathKey : null)
    },
    [selectedPathKey],
  )

  const handleSelectTemplate = useCallback(
    (name: string) => {
      onSelectTemplate?.(name)
    },
    [onSelectTemplate],
  )

  const handleNewTemplate = useCallback(() => {
    onNewTemplate?.()
  }, [onNewTemplate])

  const noop = useCallback(() => {}, [])

  const effectiveStageClient =
    stageClient ??
    (typeof Worker === 'undefined' ? IDLE_STAGE_CLIENT : undefined)

  const defaultLeft = (
    <div className="workspace-left-panel">
      <div className="workspace-left-panel__tabs">
        <SegmentedControl
          options={LEFT_TAB_OPTIONS}
          value={leftTab}
          onChange={setLeftTab}
        />
      </div>
      <div className="workspace-left-panel__content">
        {leftTab === 'outline' && (
          <OutlineTree
            state={state}
            onFocusProperties={handleFocusProperties}
            onEditJson={handleEditBlockJson}
          />
        )}
        {leftTab === 'data' && (
          <DataView
            data={state.data}
            doc={state.doc}
            onChange={state.setData}
          />
        )}
        {leftTab === 'templates' && (
          <TemplatesView
            items={templates}
            selected={selectedTemplate}
            onSelect={handleSelectTemplate}
            onNew={handleNewTemplate}
          />
        )}
      </div>
    </div>
  )

  const defaultCentre = (
    <PdfStage
      doc={stageDoc !== undefined ? stageDoc : state.doc}
      data={stageData !== undefined ? stageData : state.data}
      templateName={selectedTemplate ?? 'template'}
      client={effectiveStageClient}
      editor={state}
      onEditJson={handleEditBlockJson}
      onFocusProperties={handleFocusProperties}
    />
  )

  const defaultRight = (
    <div ref={rightPanelRef} className="workspace-right-panel">
      <PropertiesPanel
        state={state}
        onOpenTableEditor={state.select}
        jsonMode={isBlockJsonMode}
        onJsonModeChange={handleJsonModeChange}
      />
    </div>
  )

  const leftRail = (
    <div className="panel-rail">
      <IconButton
        label="โครงสร้าง"
        icon={<TextIcon size={16} />}
        active={leftTab === 'outline'}
        onClick={() => setLeftTab('outline')}
      />
      <IconButton
        label="ข้อมูล"
        icon={<BracesIcon size={16} />}
        active={leftTab === 'data'}
        onClick={() => setLeftTab('data')}
      />
      <IconButton
        label="เทมเพลต"
        icon={<TableIcon size={16} />}
        active={leftTab === 'templates'}
        onClick={() => setLeftTab('templates')}
      />
    </div>
  )

  const rightRail = (
    <div className="panel-rail">
      <IconButton
        label="คุณสมบัติ"
        icon={<SettingsIcon size={16} />}
        active
        onClick={noop}
      />
    </div>
  )

  return (
    <div className="visual-editor-shell">
      {state.warnings.length > 0 && (
        <div className="warnings-strip" role="status">
          <div className="warnings-strip__bar">
            <span>
              พบตัวแปรที่ยังไม่มีในข้อมูลตัวอย่าง ({state.warnings.length}{' '}
              รายการ)
            </span>
            <button
              type="button"
              className="ui-btn ui-btn--ghost"
              onClick={() => setWarningsExpanded((v) => !v)}
            >
              {warningsExpanded ? 'ซ่อน' : 'ดูรายการ'}
            </button>
          </div>
          {warningsExpanded && (
            <ul className="warnings-strip__list">
              {state.warnings.map((w, idx) => (
                <li key={`${w.path}-${idx}`}>
                  <code>{`{{${w.expr}}}`}</code> (บล็อก {w.blockPath.join('.')})
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <SplitWorkspace
        storageKey="apw-designer-panels"
        left={leftOverride ?? defaultLeft}
        centre={centre ?? defaultCentre}
        right={rightOverride ?? defaultRight}
        leftRail={leftRail}
        rightRail={rightRail}
      />
    </div>
  )
}
