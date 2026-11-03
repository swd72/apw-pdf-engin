import React, { useEffect, useState, useRef, useCallback } from 'react'
import type { TemplateSummary, TemplateRecord } from '../server/templateStore.js'
import {
  listTemplates,
  getTemplate,
  saveTemplate,
  deleteTemplate,
  ApiError,
} from './lib/api.js'
import { validateDocumentText, validateJsonText, type Issue } from './lib/validate.js'
import { newTemplateRecord } from './lib/starter.js'
import { TemplateList } from './components/TemplateList.js'
import { JsonEditorPane } from './components/JsonEditorPane.js'
import { PreviewPane } from './components/PreviewPane.js'
import { UsageSnippet } from './components/UsageSnippet.js'

export function App() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'document' | 'example'>('document')

  const [docText, setDocText] = useState('')
  const [exampleText, setExampleText] = useState('')
  const [docIssues, setDocIssues] = useState<Issue[]>([])
  const [exampleIssues, setExampleIssues] = useState<Issue[]>([])

  const [validDoc, setValidDoc] = useState<unknown | null>(null)
  const [validData, setValidData] = useState<unknown | null>(null)

  const [isBuiltin, setIsBuiltin] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [description, setDescription] = useState('')
  const [dataSchema, setDataSchema] = useState<object>({})

  const [saveStatus, setSaveStatus] = useState<{
    type: 'idle' | 'saving' | 'success' | 'error'
    message?: string
  }>({ type: 'idle' })

  // Refresh template list
  const refreshList = useCallback(async (selectTarget?: string) => {
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
      setSaveStatus({ type: 'error', message: err?.message ?? 'Failed to load list' })
    }
  }, [selectedName])

  useEffect(() => {
    void refreshList()
  }, [])

  // Load selected template
  useEffect(() => {
    if (!selectedName || isNew) return

    let cancelled = false
    void (async () => {
      try {
        const record = await getTemplate(selectedName)
        if (cancelled) return
        const dText = JSON.stringify(record.document, null, 2)
        const eText = JSON.stringify(record.example, null, 2)
        setDocText(dText)
        setExampleText(eText)
        setValidDoc(record.document)
        setValidData(record.example)
        setIsBuiltin(record.source === 'builtin')
        setDescription(record.description)
        setDataSchema(record.dataSchema)
        setDocIssues([])
        setExampleIssues([])
        setSaveStatus({ type: 'idle' })
      } catch (err: any) {
        if (!cancelled) {
          setSaveStatus({ type: 'error', message: err?.message ?? 'Failed to load template' })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [selectedName, isNew])

  // Debounced validate docText (400ms)
  const docTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleDocChange = (text: string) => {
    setDocText(text)
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
  }

  // Debounced validate exampleText (400ms)
  const exampleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleExampleChange = (text: string) => {
    setExampleText(text)
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
  }

  // Actions
  const handleNew = () => {
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
      setDocText(JSON.stringify(starter.document, null, 2))
      setExampleText(JSON.stringify(starter.example, null, 2))
      setValidDoc(starter.document)
      setValidData(starter.example)
      setDocIssues([])
      setExampleIssues([])
      setSaveStatus({ type: 'idle' })
    } catch (err: any) {
      alert(`Invalid template name: ${err?.message ?? 'unknown'}`)
    }
  }

  const handleDuplicate = (baseName: string) => {
    const raw = window.prompt('Enter duplicate template name:', `${baseName}-copy`)
    if (!raw) return
    const name = raw.trim().toLowerCase()

    let docObj: unknown
    let exampleObj: unknown
    try {
      docObj = JSON.parse(docText)
      exampleObj = JSON.parse(exampleText)
    } catch {
      alert('Cannot duplicate: template JSON is invalid')
      return
    }

    setSelectedName(name)
    setIsNew(true)
    setIsBuiltin(false)
    setDescription(`Copy of ${baseName}`)
    setDocText(JSON.stringify(docObj, null, 2))
    setExampleText(JSON.stringify(exampleObj, null, 2))
    setValidDoc(docObj)
    setValidData(exampleObj)
    setDocIssues([])
    setExampleIssues([])
    setSaveStatus({ type: 'idle' })
  }

  const handleDelete = async (name: string) => {
    try {
      await deleteTemplate(name)
      setIsNew(false)
      setSelectedName(null)
      await refreshList()
    } catch (err: any) {
      alert(`Failed to delete: ${err?.message ?? 'unknown error'}`)
    }
  }

  const handleSave = async () => {
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

    let parsedDoc: unknown
    let parsedExample: unknown
    try {
      parsedDoc = JSON.parse(docText)
      parsedExample = JSON.parse(exampleText)
    } catch (err: any) {
      setSaveStatus({ type: 'error', message: 'Cannot save: JSON syntax error' })
      return
    }

    const docVal = validateDocumentText(docText)
    if (!docVal.ok) {
      setDocIssues(docVal.issues)
      setSaveStatus({
        type: 'error',
        message: `Schema invalid: ${docVal.issues[0]?.message ?? 'see issues'}`,
      })
      return
    }

    const record: TemplateRecord = {
      name: targetName,
      description: description || `Template ${targetName}`,
      document: parsedDoc,
      dataSchema,
      example: parsedExample,
    }

    setSaveStatus({ type: 'saving' })
    try {
      await saveTemplate(record, targetOverwrite)
      setIsNew(false)
      setIsBuiltin(false)
      setSelectedName(targetName)
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
  }

  const currentIssues = activeTab === 'document' ? docIssues : exampleIssues

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr 1fr',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Column 1: Template List */}
      <TemplateList
        templates={templates}
        selectedName={selectedName}
        onSelect={(name) => {
          setIsNew(false)
          setSelectedName(name)
        }}
        onNew={handleNew}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
      />

      {/* Column 2: Editor Pane */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          borderRight: '1px solid #dee2e6',
          background: '#fff',
          overflow: 'hidden',
        }}
      >
        {/* Editor Toolbar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 12px',
            background: '#f8f9fa',
            borderBottom: '1px solid #dee2e6',
          }}
        >
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('document')}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: activeTab === 'document' ? 600 : 400,
                background: activeTab === 'document' ? '#fff' : 'transparent',
                border:
                  activeTab === 'document'
                    ? '1px solid #dee2e6'
                    : '1px solid transparent',
                borderBottom: activeTab === 'document' ? 'none' : undefined,
                borderRadius: '4px 4px 0 0',
                cursor: 'pointer',
              }}
            >
              document
              {docIssues.length > 0 && (
                <span
                  style={{
                    marginLeft: '6px',
                    color: '#dc3545',
                    fontWeight: 700,
                  }}
                >
                  ({docIssues.length})
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('example')}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: activeTab === 'example' ? 600 : 400,
                background: activeTab === 'example' ? '#fff' : 'transparent',
                border:
                  activeTab === 'example'
                    ? '1px solid #dee2e6'
                    : '1px solid transparent',
                borderBottom: activeTab === 'example' ? 'none' : undefined,
                borderRadius: '4px 4px 0 0',
                cursor: 'pointer',
              }}
            >
              example data
              {exampleIssues.length > 0 && (
                <span
                  style={{
                    marginLeft: '6px',
                    color: '#dc3545',
                    fontWeight: 700,
                  }}
                >
                  ({exampleIssues.length})
                </span>
              )}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {saveStatus.message && (
              <span
                style={{
                  fontSize: '12px',
                  color:
                    saveStatus.type === 'error'
                      ? '#dc3545'
                      : saveStatus.type === 'success'
                        ? '#198754'
                        : '#6c757d',
                }}
              >
                {saveStatus.message}
              </span>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saveStatus.type === 'saving'}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 600,
                background: isBuiltin ? '#6c757d' : '#0d6efd',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {isBuiltin ? 'Save as copy' : 'Save'}
            </button>
          </div>
        </div>

        {/* Editor Body */}
        <div style={{ flex: 1, overflow: 'hidden', padding: '8px' }}>
          {activeTab === 'document' ? (
            <JsonEditorPane
              value={docText}
              onChange={handleDocChange}
              issues={docIssues}
              readOnly={isBuiltin}
            />
          ) : (
            <JsonEditorPane
              value={exampleText}
              onChange={handleExampleChange}
              issues={exampleIssues}
              readOnly={isBuiltin}
            />
          )}
        </div>

        {/* Issues Tray */}
        {currentIssues.length > 0 && (
          <div
            style={{
              maxHeight: '140px',
              overflowY: 'auto',
              padding: '8px 12px',
              background: '#fff5f5',
              borderTop: '1px solid #f5c2c7',
              fontSize: '12px',
            }}
          >
            <div
              style={{
                fontWeight: 600,
                color: '#dc3545',
                marginBottom: '4px',
              }}
            >
              Validation Issues ({currentIssues.length})
            </div>
            {currentIssues.map((issue, idx) => (
              <div
                key={idx}
                style={{
                  color: '#842029',
                  marginBottom: '2px',
                  fontFamily: 'monospace',
                }}
              >
                {issue.line ? `Line ${issue.line}: ` : ''}
                {issue.path ? `[${issue.path}] ` : ''}
                {issue.message}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Column 3: Live Preview & Usage */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <PreviewPane
            doc={validDoc}
            data={validData}
            templateName={selectedName ?? 'template'}
          />
        </div>
        {selectedName && <UsageSnippet templateName={selectedName} />}
      </div>
    </div>
  )
}
