import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import type { DocumentDef } from '@apw-pdf/core'
import { parseDocument } from '@apw-pdf/core'
import { memo } from '@apw-pdf/templates'
import type { TemplateSummary } from '../server/templateStore.js'
import {
  listTemplates,
  getTemplate,
  saveTemplate,
  deleteTemplate,
  ApiError,
} from './lib/api.js'
import {
  validateDocumentText,
  validateJsonText,
  type Issue,
} from './lib/validate.js'
import { docToText, textToDoc, buildSaveRecord } from './lib/editorSync.js'
import { newTemplateRecord } from './lib/starter.js'
import { JsonEditorPane } from './components/JsonEditorPane.js'
import { VisualEditor } from './components/VisualEditor.js'
import { TopBar } from './components/shell/TopBar.js'
import { UsePopover } from './components/shell/UsePopover.js'
import { PagePopover } from './components/shell/PagePopover.js'

export function App() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [topTab, setTopTab] = useState<'visual' | 'json'>('visual')
  const [activeTab, setActiveTab] = useState<'document' | 'example'>('document')

  const [currentDoc, setCurrentDoc] = useState<DocumentDef>(memo.document)
  const [currentData, setCurrentData] = useState<unknown>(memo.example ?? {})
  const [dirty, setDirty] = useState(false)

  const [docText, setDocText] = useState('')
  const [exampleText, setExampleText] = useState('')
  const [docIssues, setDocIssues] = useState<Issue[]>([])
  const [exampleIssues, setExampleIssues] = useState<Issue[]>([])

  const [validDoc, setValidDoc] = useState<unknown | null>(memo.document)
  const [validData, setValidData] = useState<unknown | null>(memo.example ?? {})

  const [isBuiltin, setIsBuiltin] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [description, setDescription] = useState('')
  const [, setDataSchema] = useState<object>({})

  const [saveStatus, setSaveStatus] = useState<{
    type: 'idle' | 'saving' | 'success' | 'error'
    message?: string
  }>({ type: 'idle' })

  const [usePopoverOpen, setUsePopoverOpen] = useState(false)
  const [pagePopoverOpen, setPagePopoverOpen] = useState(false)

  const refreshList = useCallback(
    async (selectTarget?: string) => {
      try {
        const list = await listTemplates()
        setTemplates(list)
        if (selectTarget) {
          setSelectedName(selectTarget)
        } else if (!selectedName && list.length > 0) {
          const defaultTpl = list.find((t) => t.name === 'memo') ?? list[0]!
          setSelectedName(defaultTpl.name)
        }
      } catch (err: any) {
        setSaveStatus({
          type: 'error',
          message: err?.message ?? 'Failed to load list',
        })
      }
    },
    [selectedName],
  )

  useEffect(() => {
    void refreshList()
  }, [])

  useEffect(() => {
    if (!selectedName || isNew) return

    let cancelled = false
    void (async () => {
      try {
        const record = await getTemplate(selectedName)
        if (cancelled) return
        const dText = docToText(record.document as DocumentDef)
        const eText = JSON.stringify(record.example, null, 2)
        setCurrentDoc(record.document as DocumentDef)
        setCurrentData(record.example)
        setDocText(dText)
        setExampleText(eText)
        setValidDoc(record.document)
        setValidData(record.example)
        setIsBuiltin(record.source === 'builtin')
        setDescription(record.description)
        setDataSchema(record.dataSchema)
        setDocIssues([])
        setExampleIssues([])
        setDirty(false)
        setSaveStatus({ type: 'idle' })
      } catch (err: any) {
        if (!cancelled) {
          setSaveStatus({
            type: 'error',
            message: err?.message ?? 'Failed to load template',
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [selectedName, isNew])

  const handleVisualChange = useCallback(
    (next: { doc: DocumentDef; data: unknown }) => {
      setCurrentDoc(next.doc)
      setCurrentData(next.data)
      setDirty(true)
      try {
        const parsed = parseDocument(next.doc)
        setValidDoc(parsed)
        setDocIssues([])
      } catch {
        setValidDoc(null)
      }
      setValidData(next.data)
    },
    [],
  )

  const handlePageDocChange = useCallback(
    (nextDoc: DocumentDef) => {
      handleVisualChange({ doc: nextDoc, data: currentData })
    },
    [handleVisualChange, currentData],
  )

  const docTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleDocTextChange = useCallback((text: string) => {
    setDocText(text)
    setDirty(true)
    if (docTimerRef.current) clearTimeout(docTimerRef.current)
    docTimerRef.current = setTimeout(() => {
      const res = validateDocumentText(text)
      if (res.ok) {
        setDocIssues([])
        setValidDoc(res.value)
      } else {
        setDocIssues(res.issues)
        setValidDoc(null)
      }
    }, 400)
  }, [])

  const exampleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleExampleTextChange = useCallback((text: string) => {
    setExampleText(text)
    setDirty(true)
    if (exampleTimerRef.current) clearTimeout(exampleTimerRef.current)
    exampleTimerRef.current = setTimeout(() => {
      const res = validateJsonText(text)
      if (res.ok) {
        setExampleIssues([])
        setValidData(res.value)
      } else {
        setExampleIssues(res.issues)
        setValidData(null)
      }
    }, 400)
  }, [])

  const handleSwitchTopTab = useCallback(
    (mode: 'visual' | 'json') => {
      if (mode === topTab) return

      if (mode === 'json') {
        const text = docToText(currentDoc)
        const exText = JSON.stringify(currentData, null, 2)
        setDocText(text)
        setExampleText(exText)

        const docRes = textToDoc(text)
        setDocIssues(docRes.ok ? [] : docRes.issues)

        const exRes = validateJsonText(exText)
        setExampleIssues(exRes.ok ? [] : exRes.issues)

        setTopTab('json')
      } else {
        const docRes = textToDoc(docText)
        const exRes = validateJsonText(exampleText)

        let hasError = false
        if (!docRes.ok) {
          setDocIssues(docRes.issues)
          setActiveTab('document')
          hasError = true
        } else {
          setDocIssues([])
        }

        if (!exRes.ok) {
          setExampleIssues(exRes.issues)
          if (!hasError) {
            setActiveTab('example')
          }
          hasError = true
        } else {
          setExampleIssues([])
        }

        if (hasError) {
          return
        }

        setCurrentDoc(docRes.doc)
        setCurrentData(exRes.value)
        setValidDoc(docRes.doc)
        setValidData(exRes.value)
        setDocIssues([])
        setExampleIssues([])
        setTopTab('visual')
      }
    },
    [topTab, currentDoc, currentData, docText, exampleText],
  )

  const handleNew = useCallback(() => {
    const raw = window.prompt('Enter new template name (a-z, 0-9, dashes):')
    if (!raw) return
    const name = raw.trim().toLowerCase()
    try {
      const starter = newTemplateRecord(name)
      setSelectedName(name)
      setIsNew(true)
      setIsBuiltin(false)
      setDescription(starter.description)
      setDataSchema(starter.dataSchema)
      setCurrentDoc(starter.document as DocumentDef)
      setCurrentData(starter.example)
      setDocText(docToText(starter.document as DocumentDef))
      setExampleText(JSON.stringify(starter.example, null, 2))
      setValidDoc(starter.document)
      setValidData(starter.example)
      setDocIssues([])
      setExampleIssues([])
      setDirty(true)
      setSaveStatus({ type: 'idle' })
    } catch (err: any) {
      alert(`Invalid template name: ${err?.message ?? 'unknown'}`)
    }
  }, [])

  const handleDuplicate = useCallback(() => {
    const baseName = selectedName ?? 'template'
    const raw = window.prompt(
      'Enter duplicate template name:',
      `${baseName}-copy`,
    )
    if (!raw) return
    const name = raw.trim().toLowerCase()

    let docObj: unknown
    let exampleObj: unknown
    if (topTab === 'visual') {
      docObj = JSON.parse(JSON.stringify(currentDoc))
      exampleObj = JSON.parse(JSON.stringify(currentData))
    } else {
      try {
        docObj = JSON.parse(docText)
        exampleObj = JSON.parse(exampleText)
      } catch {
        alert('Cannot duplicate: template JSON is invalid')
        return
      }
    }

    setSelectedName(name)
    setIsNew(true)
    setIsBuiltin(false)
    setDescription(`Copy of ${baseName}`)
    setCurrentDoc(docObj as DocumentDef)
    setCurrentData(exampleObj)
    setDocText(docToText(docObj as DocumentDef))
    setExampleText(JSON.stringify(exampleObj, null, 2))
    setValidDoc(docObj)
    setValidData(exampleObj)
    setDocIssues([])
    setExampleIssues([])
    setDirty(true)
    setSaveStatus({ type: 'idle' })
  }, [selectedName, topTab, currentDoc, currentData, docText, exampleText])

  const handleDelete = useCallback(async () => {
    if (!selectedName || isBuiltin) return
    if (
      !window.confirm(
        `Are you sure you want to delete template "${selectedName}"?`,
      )
    ) {
      return
    }
    try {
      await deleteTemplate(selectedName)
      setIsNew(false)
      setSelectedName(null)
      setDirty(false)
      await refreshList()
    } catch (err: any) {
      alert(`Failed to delete: ${err?.message ?? 'unknown error'}`)
    }
  }, [selectedName, isBuiltin, refreshList])

  const handleSave = useCallback(async () => {
    if (!selectedName) return

    let targetName = selectedName
    let targetOverwrite = !isNew

    if (isBuiltin) {
      const raw = window.prompt(
        'Builtin templates are read-only. Enter a new name to save as a copy:',
        `${selectedName}-custom`,
      )
      if (!raw) return
      targetName = raw.trim().toLowerCase()
      targetOverwrite = false
    }

    let docToSave: unknown
    let dataToSave: unknown
    let docTextToValidate: string

    if (topTab === 'visual') {
      docToSave = currentDoc
      dataToSave = currentData
      docTextToValidate = docToText(currentDoc)
      setDocText(docTextToValidate)
      setExampleText(JSON.stringify(currentData, null, 2))
    } else {
      try {
        docToSave = JSON.parse(docText)
        dataToSave = JSON.parse(exampleText)
        docTextToValidate = docText
      } catch {
        setSaveStatus({
          type: 'error',
          message: 'Cannot save: JSON syntax error',
        })
        return
      }
    }

    const docVal = validateDocumentText(docTextToValidate)
    if (!docVal.ok) {
      setDocIssues(docVal.issues)
      setSaveStatus({
        type: 'error',
        message: `Schema invalid: ${docVal.issues[0]?.message ?? 'see issues'}`,
      })
      return
    }

    const record = buildSaveRecord({
      name: targetName,
      description: description || `Template ${targetName}`,
      doc: docToSave,
      data: dataToSave,
    })

    setSaveStatus({ type: 'saving' })
    try {
      await saveTemplate(record, targetOverwrite)
      setIsNew(false)
      setIsBuiltin(false)
      setSelectedName(targetName)
      setDirty(false)
      setSaveStatus({ type: 'success', message: 'Saved successfully!' })
      await refreshList(targetName)
      setTimeout(() => setSaveStatus({ type: 'idle' }), 3000)
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : String(err)
      if (err.issues && Array.isArray(err.issues)) {
        setDocIssues(err.issues)
      }
      setSaveStatus({ type: 'error', message: msg })
    }
  }, [
    selectedName,
    isNew,
    isBuiltin,
    topTab,
    currentDoc,
    currentData,
    docText,
    exampleText,
    description,
    refreshList,
  ])

  const handleSelectFromList = useCallback((name: string) => {
    setIsNew(false)
    setSelectedName(name)
  }, [])

  const handleToggleUsePopover = useCallback(() => {
    setPagePopoverOpen(false)
    setUsePopoverOpen((v) => !v)
  }, [])

  const handleTogglePagePopover = useCallback(() => {
    setUsePopoverOpen(false)
    setPagePopoverOpen((v) => !v)
  }, [])

  const handleCloseUsePopover = useCallback(() => {
    setUsePopoverOpen(false)
  }, [])

  const handleClosePagePopover = useCallback(() => {
    setPagePopoverOpen(false)
  }, [])

  const menuItems = useMemo(
    () => [
      { label: 'สร้างใหม่', onSelect: handleNew },
      {
        label: 'ทำซ้ำ',
        disabled: !selectedName,
        onSelect: handleDuplicate,
      },
      {
        label: 'ลบ',
        danger: true,
        disabled: !selectedName || isBuiltin,
        onSelect: () => {
          void handleDelete()
        },
      },
      { label: 'ใช้ในโปรเจกต์', onSelect: handleToggleUsePopover },
      { label: 'หน้ากระดาษ', onSelect: handleTogglePagePopover },
    ],
    [
      handleNew,
      handleDuplicate,
      handleDelete,
      handleToggleUsePopover,
      handleTogglePagePopover,
      selectedName,
      isBuiltin,
    ],
  )

  const totalJsonIssues = docIssues.length + exampleIssues.length
  const currentIssues = activeTab === 'document' ? docIssues : exampleIssues
  const saveLabel =
    saveStatus.type === 'saving'
      ? 'Saving...'
      : isBuiltin
        ? 'Save as copy'
        : 'Save'

  const jsonLeftPane =
    topTab === 'json' ? (
      <div className="json-pane-wrapper">
        <div className="panel-header">
          <div className="ui-segmented" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'document'}
              className={`ui-segmented__tab ${activeTab === 'document' ? 'ui-segmented__tab--active' : ''}`}
              onClick={() => setActiveTab('document')}
            >
              document {docIssues.length > 0 ? `(${docIssues.length})` : ''}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'example'}
              className={`ui-segmented__tab ${activeTab === 'example' ? 'ui-segmented__tab--active' : ''}`}
              onClick={() => setActiveTab('example')}
            >
              example{' '}
              {exampleIssues.length > 0 ? `(${exampleIssues.length})` : ''}
            </button>
          </div>
        </div>
        <div className="json-pane-wrapper__body">
          {activeTab === 'document' ? (
            <JsonEditorPane
              value={docText}
              onChange={handleDocTextChange}
              issues={docIssues}
              readOnly={isBuiltin}
            />
          ) : (
            <JsonEditorPane
              value={exampleText}
              onChange={handleExampleTextChange}
              issues={exampleIssues}
              readOnly={isBuiltin}
            />
          )}
        </div>
      </div>
    ) : undefined

  const jsonRightPane =
    topTab === 'json' ? (
      <div className="json-pane-wrapper">
        <div className="panel-header">
          <h2 className="panel-header__title">
            Validation Issues ({currentIssues.length})
          </h2>
        </div>
        <div className="panel-body" style={{ padding: 'var(--sp-3)' }}>
          {currentIssues.length === 0 ? (
            <span className="prop-field__label">JSON ถูกต้องพร้อมใช้งาน</span>
          ) : (
            <ul className="warnings-strip__list">
              {currentIssues.map((issue, idx) => (
                <li key={idx}>
                  {issue.line ? `Line ${issue.line}: ` : ''}
                  {issue.path ? `[${issue.path}] ` : ''}
                  {issue.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    ) : undefined

  return (
    <div className="app-shell">
      <TopBar
        name={selectedName ?? 'untitled'}
        dirty={dirty}
        mode={topTab}
        onMode={handleSwitchTopTab}
        onSave={() => {
          void handleSave()
        }}
        saveLabel={saveLabel}
        saveDisabled={saveStatus.type === 'saving'}
        statusMessage={saveStatus.message}
        statusTone={saveStatus.type}
        jsonIssueCount={topTab === 'json' ? totalJsonIssues : 0}
        menu={menuItems}
      />

      <div className="app-shell__popover-layer">
        <UsePopover
          templateName={selectedName ?? 'template'}
          open={usePopoverOpen}
          onClose={handleCloseUsePopover}
        />
        <PagePopover
          doc={currentDoc}
          onChange={handlePageDocChange}
          open={pagePopoverOpen}
          onClose={handleClosePagePopover}
        />
      </div>

      <VisualEditor
        doc={currentDoc}
        data={currentData}
        onChange={handleVisualChange}
        templates={templates}
        selectedTemplate={selectedName}
        onSelectTemplate={handleSelectFromList}
        onNewTemplate={handleNew}
        leftOverride={jsonLeftPane}
        rightOverride={jsonRightPane}
        stageDoc={validDoc}
        stageData={validData}
      />
    </div>
  )
}
