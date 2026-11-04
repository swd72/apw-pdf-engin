import React, { useState, useMemo } from 'react'
import type { Block, DocumentDef, LineSpacing } from '@apw-pdf/core'
import type { EditorState } from '../../editor/useEditorState.js'
import {
  readPageSettings,
  applyPageSettings,
  type PageSettings,
} from '../../editor/pageSettings.js'
import { Section } from './Section.js'
import { Field } from './Field.js'
import { AddProperty, type AddPropertyOption } from './AddProperty.js'
import { LengthInput } from '../../ui/LengthInput.js'

export interface DocumentSettingsProps {
  state?: EditorState
  doc?: DocumentDef
  onChange?(next: DocumentDef): void
}

export function DocumentSettings({
  state,
  doc: docProp,
  onChange,
}: DocumentSettingsProps) {
  const currentDoc = docProp ?? state?.doc
  const [revealed, setRevealed] = useState<string[]>([])

  const hasLineSpacing =
    currentDoc?.font.lineSpacing !== undefined ||
    revealed.includes('lineSpacing')
  const hasPageNumber =
    currentDoc?.pageNumber !== undefined || revealed.includes('pageNumber')

  const lineSpacingValue = useMemo(() => {
    const ls = currentDoc?.font.lineSpacing
    if (!ls || ls === 'single') return 'single'
    if (typeof ls === 'object' && 'multiple' in ls) {
      return String(ls.multiple)
    }
    return 'single'
  }, [currentDoc?.font.lineSpacing])

  const commitDoc = (nextDoc: DocumentDef) => {
    onChange?.(nextDoc)
    state?.replaceBlock([], nextDoc as unknown as Block)
  }

  const updatePageNumber = (
    patch: Partial<NonNullable<DocumentDef['pageNumber']>> | undefined,
  ) => {
    if (!currentDoc) return
    const nextDoc: DocumentDef = { ...currentDoc }
    if (patch === undefined) {
      delete nextDoc.pageNumber
      commitDoc(nextDoc)
      return
    }
    const merged: NonNullable<DocumentDef['pageNumber']> = {
      ...(currentDoc.pageNumber ?? {}),
      ...patch,
    }
    for (const [k, v] of Object.entries(merged)) {
      if (v === undefined || v === '') {
        delete (merged as Record<string, unknown>)[k]
      }
    }
    nextDoc.pageNumber = merged
    commitDoc(nextDoc)
  }

  const addOptions = useMemo<AddPropertyOption[]>(() => {
    if (!currentDoc) return []
    const opts: AddPropertyOption[] = []
    if (!hasLineSpacing) {
      opts.push({
        key: 'lineSpacing',
        label: 'ระยะบรรทัดหลัก',
        add: () => setRevealed((prev) => [...prev, 'lineSpacing']),
      })
    }
    if (!hasPageNumber) {
      opts.push({
        key: 'pageNumber',
        label: 'เลขหน้าอัตโนมัติ',
        add: () => {
          setRevealed((prev) => [...prev, 'pageNumber'])
          updatePageNumber({ position: 'top-center' })
        },
      })
    }
    return opts
  }, [hasLineSpacing, hasPageNumber, currentDoc])

  if (!currentDoc) return null

  const settings = readPageSettings(currentDoc)

  const updateSettings = (patch: Partial<PageSettings>) => {
    const nextDoc = applyPageSettings(currentDoc, patch)
    commitDoc(nextDoc)
  }

  const handleLineSpacingChange = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) {
      updateSettings({ lineSpacing: undefined })
      return
    }
    if (trimmed === 'single') {
      updateSettings({ lineSpacing: 'single' })
      return
    }
    const num = Number(trimmed)
    if (!Number.isNaN(num) && num > 0) {
      const nextLs: LineSpacing = { multiple: num }
      updateSettings({ lineSpacing: nextLs })
    }
  }

  return (
    <div className="properties-panel__body">
      <Section title="หน้ากระดาษ (Layout)">
        <div className="prop-row-2">
          <Field label="ขนาดหน้า (size)" htmlFor="doc-page-size">
            <select
              id="doc-page-size"
              aria-label="Page size"
              className="ui-select"
              value={settings.size}
              onChange={(e) =>
                updateSettings({
                  size: e.target.value as PageSettings['size'],
                })
              }
            >
              <option value="A4">A4</option>
              <option value="A5">A5</option>
              <option value="Letter">Letter</option>
              <option value="Legal">Legal</option>
            </select>
          </Field>

          <Field label="แนวกระดาษ (orientation)" htmlFor="doc-orientation">
            <select
              id="doc-orientation"
              aria-label="Orientation"
              className="ui-select"
              value={settings.orientation}
              onChange={(e) =>
                updateSettings({
                  orientation: e.target.value as PageSettings['orientation'],
                })
              }
            >
              <option value="portrait">แนวตั้ง (portrait)</option>
              <option value="landscape">แนวนอน (landscape)</option>
            </select>
          </Field>
        </div>

        <div className="prop-row-2">
          <Field label="ขอบบน (top)" htmlFor="doc-margin-top">
            <LengthInput
              id="doc-margin-top"
              aria-label="Margin top"
              defaultUnit="cm"
              value={settings.margin.top}
              onChange={(next) =>
                updateSettings({
                  margin: { ...settings.margin, top: next ?? '' },
                })
              }
            />
          </Field>
          <Field label="ขอบล่าง (bottom)" htmlFor="doc-margin-bottom">
            <LengthInput
              id="doc-margin-bottom"
              aria-label="Margin bottom"
              defaultUnit="cm"
              value={settings.margin.bottom}
              onChange={(next) =>
                updateSettings({
                  margin: { ...settings.margin, bottom: next ?? '' },
                })
              }
            />
          </Field>
        </div>

        <div className="prop-row-2">
          <Field label="ขอบซ้าย (left)" htmlFor="doc-margin-left">
            <LengthInput
              id="doc-margin-left"
              aria-label="Margin left"
              defaultUnit="cm"
              value={settings.margin.left}
              onChange={(next) =>
                updateSettings({
                  margin: { ...settings.margin, left: next ?? '' },
                })
              }
            />
          </Field>
          <Field label="ขอบขวา (right)" htmlFor="doc-margin-right">
            <LengthInput
              id="doc-margin-right"
              aria-label="Margin right"
              defaultUnit="cm"
              value={settings.margin.right}
              onChange={(next) =>
                updateSettings({
                  margin: { ...settings.margin, right: next ?? '' },
                })
              }
            />
          </Field>
        </div>
      </Section>

      <Section title="ฟอนต์และตัวเลข (Text style)">
        <div className="prop-row-2">
          <Field label="ฟอนต์ (family)" htmlFor="doc-font-family">
            <input
              id="doc-font-family"
              type="text"
              aria-label="Font family"
              className="ui-input"
              value={settings.fontFamily}
              onChange={(e) => updateSettings({ fontFamily: e.target.value })}
            />
          </Field>

          <Field label="ขนาดฟอนต์ (size)" htmlFor="doc-font-size">
            <input
              id="doc-font-size"
              type="text"
              aria-label="Font size"
              className="ui-input"
              value={settings.fontSize}
              onChange={(e) => updateSettings({ fontSize: e.target.value })}
            />
          </Field>
        </div>

        <Field label="รูปแบบตัวเลข (numerals)" htmlFor="doc-numerals">
          <select
            id="doc-numerals"
            aria-label="Numerals"
            className="ui-select"
            value={settings.numerals}
            onChange={(e) =>
              updateSettings({
                numerals: e.target.value as PageSettings['numerals'],
              })
            }
          >
            <option value="arabic">เลขอารบิก (0-9)</option>
            <option value="thai">เลขไทย (๐-๙)</option>
          </select>
        </Field>

        {hasLineSpacing && (
          <Field
            label="ระยะบรรทัด (lineSpacing)"
            htmlFor="doc-line-spacing"
            onReset={() => {
              setRevealed((prev) => prev.filter((k) => k !== 'lineSpacing'))
              updateSettings({ lineSpacing: undefined })
            }}
          >
            <input
              id="doc-line-spacing"
              type="text"
              aria-label="Line spacing"
              className="ui-input"
              value={lineSpacingValue}
              onChange={(e) => handleLineSpacingChange(e.target.value)}
              placeholder="single หรือ 1.15"
            />
          </Field>
        )}
      </Section>

      {hasPageNumber && (
        <Section title="เลขหน้า (Advanced)">
          <Field
            label="ตำแหน่งเลขหน้า (position)"
            htmlFor="doc-pagenum-pos"
            onReset={() => {
              setRevealed((prev) => prev.filter((k) => k !== 'pageNumber'))
              updatePageNumber(undefined)
            }}
          >
            <select
              id="doc-pagenum-pos"
              aria-label="Page number position"
              className="ui-select"
              value={currentDoc.pageNumber?.position ?? 'top-center'}
              onChange={(e) =>
                updatePageNumber({
                  position: e.target.value as NonNullable<
                    DocumentDef['pageNumber']
                  >['position'],
                })
              }
            >
              <option value="top-center">บนกึ่งกลาง (top-center)</option>
              <option value="top-right">บนขวา (top-right)</option>
              <option value="bottom-center">ล่างกึ่งกลาง (bottom-center)</option>
              <option value="bottom-right">ล่างขวา (bottom-right)</option>
            </select>
          </Field>

          <div className="prop-row-2">
            <Field label="เริ่มหน้า (from)" htmlFor="doc-pagenum-from">
              <input
                id="doc-pagenum-from"
                type="number"
                aria-label="Page number from"
                className="ui-input"
                value={currentDoc.pageNumber?.from ?? ''}
                onChange={(e) => {
                  const n = e.target.value
                    ? parseInt(e.target.value, 10)
                    : undefined
                  updatePageNumber({ from: n })
                }}
              />
            </Field>

            <Field label="รูปแบบ (format)" htmlFor="doc-pagenum-format">
              <input
                id="doc-pagenum-format"
                type="text"
                aria-label="Page number format"
                className="ui-input"
                value={currentDoc.pageNumber?.format ?? ''}
                onChange={(e) =>
                  updatePageNumber({ format: e.target.value || undefined })
                }
                placeholder="เช่น - {page} -"
              />
            </Field>
          </div>
        </Section>
      )}

      <AddProperty options={addOptions} />
    </div>
  )
}
