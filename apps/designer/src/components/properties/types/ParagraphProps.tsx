import React, { useState, useMemo, useEffect, useRef } from 'react'
import type { ParagraphBlock, LineSpacing } from '@apw-pdf/core'
import type { EditorState } from '../../../editor/useEditorState.js'
import type { BlockPath } from '../../../editor/docModel.js'
import { scopeAt } from '../../../editor/bindings.js'
import { Section } from '../Section.js'
import { Field } from '../Field.js'
import { AddProperty, type AddPropertyOption } from '../AddProperty.js'
import { BindableInput } from '../VariablePicker.js'
import { LengthInput } from '../../../ui/LengthInput.js'
import { commitBlockPatch, isPropertySet } from '../shared.js'

export interface ParagraphPropsProps {
  block: ParagraphBlock
  path: BlockPath
  state: EditorState
}

const OPTIONAL_PARAGRAPH_PROPS: Array<{ key: string; label: string }> = [
  { key: 'indentLeft', label: 'เยื้องซ้าย' },
  { key: 'indentRight', label: 'เยื้องขวา' },
  { key: 'firstLineIndent', label: 'เยื้องบรรทัดแรก' },
  { key: 'spaceBefore', label: 'ระยะก่อนหน้า' },
  { key: 'spaceAfter', label: 'ระยะหลัง' },
  { key: 'lineSpacing', label: 'ระยะบรรทัด' },
  { key: 'style', label: 'สไตล์ที่ตั้งชื่อ' },
  { key: 'font', label: 'ฟอนต์เฉพาะบล็อก' },
  { key: 'keepWithNext', label: 'ติดกับบล็อกถัดไป' },
  { key: 'keepLinesTogether', label: 'ห้ามแยกบรรทัด' },
  { key: 'widowControl', label: 'ป้องกันบรรทัดเดี่ยว' },
  { key: 'tabs', label: 'ตำแหน่งแท็บ' },
  { key: 'id', label: 'รหัสอ้างอิง' },
]

export function ParagraphProps({ block, path, state }: ParagraphPropsProps) {
  const { doc, data } = state
  const [revealed, setRevealed] = useState<string[]>([])
  const pathKey = path.join('.')
  const prevPathKeyRef = useRef(pathKey)

  useEffect(() => {
    if (prevPathKeyRef.current !== pathKey) {
      prevPathKeyRef.current = pathKey
      setRevealed([])
    }
  }, [pathKey])

  const stablePath = useMemo(() => path, [pathKey])
  const scope = useMemo(() => scopeAt(doc, stablePath), [doc, stablePath])
  const styles = useMemo(
    () => (doc.styles ? Object.keys(doc.styles) : []),
    [doc.styles],
  )

  const isShown = (key: string): boolean =>
    isPropertySet(block, key) || revealed.includes(key)

  const resetKey = (key: string) => {
    setRevealed((prev) => prev.filter((k) => k !== key))
    commitBlockPatch(state, path, block, { [key]: undefined })
  }

  const setOptionalString = (key: string, val: string) => {
    commitBlockPatch(state, path, block, {
      [key]: val === '' ? undefined : val,
    })
  }

  const updateFontField = (
    field: 'family' | 'size' | 'color' | 'bold' | 'italic',
    val: string | boolean | undefined,
  ) => {
    const nextFont: Record<string, unknown> = { ...(block.font ?? {}) }
    if (val === undefined || val === '' || val === false) {
      delete nextFont[field]
    } else {
      nextFont[field] = val
    }
    if (Object.keys(nextFont).length === 0) {
      commitBlockPatch(state, path, block, { font: undefined })
    } else {
      commitBlockPatch(state, path, block, { font: nextFont })
    }
  }

  const addOptions = useMemo<AddPropertyOption[]>(() => {
    return OPTIONAL_PARAGRAPH_PROPS.filter(
      (p) => !isPropertySet(block, p.key) && !revealed.includes(p.key),
    ).map((p) => ({
      key: p.key,
      label: p.label,
      add: () => setRevealed((prev) => [...prev, p.key]),
    }))
  }, [block, revealed])

  const hasTextStyleSection = isShown('style') || isShown('font')
  const hasAdvancedSection =
    isShown('keepWithNext') ||
    isShown('keepLinesTogether') ||
    isShown('widowControl') ||
    isShown('tabs') ||
    isShown('id')

  const lineSpacingStr = useMemo(() => {
    const ls = block.lineSpacing
    if (!ls || ls === 'single') return ls === 'single' ? 'single' : ''
    if (typeof ls === 'object' && 'multiple' in ls) return String(ls.multiple)
    if (typeof ls === 'object' && 'exactly' in ls) return String(ls.exactly)
    if (typeof ls === 'object' && 'atLeast' in ls) return String(ls.atLeast)
    return ''
  }, [block.lineSpacing])

  const handleLineSpacingChange = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) {
      commitBlockPatch(state, path, block, { lineSpacing: undefined })
      return
    }
    if (trimmed === 'single') {
      commitBlockPatch(state, path, block, { lineSpacing: 'single' })
      return
    }
    const num = Number(trimmed)
    if (!Number.isNaN(num) && num > 0) {
      const ls: LineSpacing = { multiple: num }
      commitBlockPatch(state, path, block, { lineSpacing: ls })
      return
    }
    commitBlockPatch(state, path, block, {
      lineSpacing: { exactly: trimmed },
    })
  }

  return (
    <div className="properties-panel__body">
      <Section title="เนื้อหา (Content)">
        <Field label="ข้อความ (text)" htmlFor="p-text">
          <BindableInput
            id="p-text"
            aria-label="Paragraph text"
            multiline
            rows={3}
            value={block.text ?? ''}
            onChange={(next) => commitBlockPatch(state, path, block, { text: next })}
            data={data}
            scope={scope}
          />
        </Field>
      </Section>

      <Section title="การจัดวาง (Layout)">
        <Field
          label="การจัดตำแหน่ง (align)"
          htmlFor="p-align"
          onReset={isPropertySet(block, 'align') ? () => resetKey('align') : undefined}
        >
          <select
            id="p-align"
            aria-label="Align"
            className="ui-select"
            value={block.align ?? 'left'}
            onChange={(e) =>
              commitBlockPatch(state, path, block, { align: e.target.value })
            }
          >
            <option value="left">ชิดซ้าย (left)</option>
            <option value="center">กึ่งกลาง (center)</option>
            <option value="right">ชิดขวา (right)</option>
            <option value="justify">เต็มบรรทัด (justify)</option>
            <option value="thaiDistributed">กระจายแบบไทย (thaiDistributed)</option>
          </select>
        </Field>

        {isShown('indentLeft') && (
          <Field
            label="เยื้องซ้าย (indentLeft)"
            htmlFor="p-indent-left"
            onReset={() => resetKey('indentLeft')}
          >
            <LengthInput
              id="p-indent-left"
              aria-label="Left indent"
              defaultUnit="cm"
              value={block.indentLeft}
              onChange={(next) => setOptionalString('indentLeft', next ?? '')}
            />
          </Field>
        )}

        {isShown('indentRight') && (
          <Field
            label="เยื้องขวา (indentRight)"
            htmlFor="p-indent-right"
            onReset={() => resetKey('indentRight')}
          >
            <LengthInput
              id="p-indent-right"
              aria-label="Right indent"
              defaultUnit="cm"
              value={block.indentRight}
              onChange={(next) => setOptionalString('indentRight', next ?? '')}
            />
          </Field>
        )}

        {isShown('firstLineIndent') && (
          <Field
            label="เยื้องบรรทัดแรก (firstLineIndent)"
            htmlFor="p-first-indent"
            onReset={() => resetKey('firstLineIndent')}
          >
            <LengthInput
              id="p-first-indent"
              aria-label="First line indent"
              defaultUnit="cm"
              allowNegative
              value={block.firstLineIndent}
              onChange={(next) =>
                setOptionalString('firstLineIndent', next ?? '')
              }
            />
          </Field>
        )}

        {isShown('spaceBefore') && (
          <Field
            label="ระยะก่อนหน้า (spaceBefore)"
            htmlFor="p-space-before"
            onReset={() => resetKey('spaceBefore')}
          >
            <LengthInput
              id="p-space-before"
              aria-label="Space before"
              defaultUnit="pt"
              value={block.spaceBefore}
              onChange={(next) => setOptionalString('spaceBefore', next ?? '')}
            />
          </Field>
        )}

        {isShown('spaceAfter') && (
          <Field
            label="ระยะหลัง (spaceAfter)"
            htmlFor="p-space-after"
            onReset={() => resetKey('spaceAfter')}
          >
            <LengthInput
              id="p-space-after"
              aria-label="Space after"
              defaultUnit="pt"
              value={block.spaceAfter}
              onChange={(next) => setOptionalString('spaceAfter', next ?? '')}
            />
          </Field>
        )}

        {isShown('lineSpacing') && (
          <Field
            label="ระยะบรรทัด (lineSpacing)"
            htmlFor="p-line-spacing"
            onReset={() => resetKey('lineSpacing')}
          >
            <input
              id="p-line-spacing"
              type="text"
              aria-label="Line spacing"
              className="ui-input"
              value={lineSpacingStr}
              onChange={(e) => handleLineSpacingChange(e.target.value)}
              placeholder="single หรือ 1.15"
            />
          </Field>
        )}
      </Section>

      {hasTextStyleSection && (
        <Section title="รูปแบบข้อความ (Text style)">
          {isShown('style') && (
            <Field
              label="สไตล์ที่ตั้งชื่อ (style)"
              htmlFor="p-style"
              onReset={() => resetKey('style')}
            >
              {styles.length > 0 ? (
                <select
                  id="p-style"
                  aria-label="Named style"
                  className="ui-select"
                  value={block.style ?? ''}
                  onChange={(e) => setOptionalString('style', e.target.value)}
                >
                  <option value="">(ไม่ระบุ)</option>
                  {styles.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="p-style"
                  type="text"
                  aria-label="Named style"
                  className="ui-input"
                  value={block.style ?? ''}
                  onChange={(e) => setOptionalString('style', e.target.value)}
                />
              )}
            </Field>
          )}

          {isShown('font') && (
            <Field
              label="ฟอนต์เฉพาะบล็อก (font)"
              onReset={() => resetKey('font')}
            >
              <div className="prop-row-2">
                <input
                  type="text"
                  aria-label="Font family"
                  className="ui-input"
                  placeholder="ชื่อฟอนต์"
                  value={block.font?.family ?? ''}
                  onChange={(e) => updateFontField('family', e.target.value)}
                />
                <input
                  type="text"
                  aria-label="Font size"
                  className="ui-input"
                  placeholder="ขนาด เช่น 16pt"
                  value={(block.font?.size as string) ?? ''}
                  onChange={(e) => updateFontField('size', e.target.value)}
                />
              </div>
              <div className="prop-row-2">
                <label className="prop-checkbox">
                  <input
                    type="checkbox"
                    aria-label="Bold"
                    checked={Boolean(block.font?.bold)}
                    onChange={(e) => updateFontField('bold', e.target.checked)}
                  />
                  ตัวหนา (bold)
                </label>
                <label className="prop-checkbox">
                  <input
                    type="checkbox"
                    aria-label="Italic"
                    checked={Boolean(block.font?.italic)}
                    onChange={(e) =>
                      updateFontField('italic', e.target.checked)
                    }
                  />
                  ตัวเอียง (italic)
                </label>
              </div>
              <input
                type="text"
                aria-label="Font color"
                className="ui-input"
                placeholder="สี เช่น #000000"
                value={block.font?.color ?? ''}
                onChange={(e) => updateFontField('color', e.target.value)}
              />
            </Field>
          )}
        </Section>
      )}

      {hasAdvancedSection && (
        <Section title="ขั้นสูง (Advanced)">
          {isShown('keepWithNext') && (
            <Field
              label="ติดกับบล็อกถัดไป (keepWithNext)"
              onReset={() => resetKey('keepWithNext')}
            >
              <label className="prop-checkbox">
                <input
                  type="checkbox"
                  aria-label="Keep with next"
                  checked={Boolean(block.keepWithNext)}
                  onChange={(e) =>
                    commitBlockPatch(state, path, block, {
                      keepWithNext: e.target.checked || undefined,
                    })
                  }
                />
                ห้ามแยกจากบล็อกถัดไป
              </label>
            </Field>
          )}

          {isShown('keepLinesTogether') && (
            <Field
              label="ห้ามแยกบรรทัด (keepLinesTogether)"
              onReset={() => resetKey('keepLinesTogether')}
            >
              <label className="prop-checkbox">
                <input
                  type="checkbox"
                  aria-label="Keep lines together"
                  checked={Boolean(block.keepLinesTogether)}
                  onChange={(e) =>
                    commitBlockPatch(state, path, block, {
                      keepLinesTogether: e.target.checked || undefined,
                    })
                  }
                />
                รวมทุกบรรทัดในหน้าเดียวกัน
              </label>
            </Field>
          )}

          {isShown('widowControl') && (
            <Field
              label="ป้องกันบรรทัดเดี่ยว (widowControl)"
              onReset={() => resetKey('widowControl')}
            >
              <label className="prop-checkbox">
                <input
                  type="checkbox"
                  aria-label="Widow control"
                  checked={Boolean(block.widowControl)}
                  onChange={(e) =>
                    commitBlockPatch(state, path, block, {
                      widowControl: e.target.checked || undefined,
                    })
                  }
                />
                เปิดใช้การป้องกันบรรทัดเดี่ยวท้ายหน้า
              </label>
            </Field>
          )}

          {isShown('tabs') && (
            <Field
              label="ตำแหน่งแท็บ (tabs)"
              onReset={() => resetKey('tabs')}
            >
              <div className="prop-col-list">
                {(block.tabs ?? []).map((tab, tIdx) => (
                  <div key={tIdx} className="prop-col-row">
                    <input
                      type="text"
                      aria-label={`Tab ${tIdx + 1} at`}
                      className="ui-input"
                      value={String(tab.at)}
                      onChange={(e) => {
                        const nextTabs = [...(block.tabs ?? [])]
                        nextTabs[tIdx] = {
                          ...nextTabs[tIdx]!,
                          at: e.target.value as any,
                        }
                        commitBlockPatch(state, path, block, { tabs: nextTabs })
                      }}
                    />
                    <select
                      aria-label={`Tab ${tIdx + 1} align`}
                      className="ui-select"
                      value={tab.align ?? 'left'}
                      onChange={(e) => {
                        const nextTabs = [...(block.tabs ?? [])]
                        nextTabs[tIdx] = {
                          ...nextTabs[tIdx]!,
                          align: e.target.value as any,
                        }
                        commitBlockPatch(state, path, block, { tabs: nextTabs })
                      }}
                    >
                      <option value="left">left</option>
                      <option value="center">center</option>
                      <option value="right">right</option>
                      <option value="decimal">decimal</option>
                    </select>
                    <button
                      type="button"
                      className="ui-btn ui-btn--ghost"
                      aria-label={`Remove tab ${tIdx + 1}`}
                      onClick={() => {
                        const nextTabs = (block.tabs ?? []).filter(
                          (_, i) => i !== tIdx,
                        )
                        commitBlockPatch(state, path, block, {
                          tabs: nextTabs.length > 0 ? nextTabs : undefined,
                        })
                      }}
                    >
                      ลบ
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="ui-btn ui-btn--ghost"
                  aria-label="Add tab stop"
                  onClick={() => {
                    const nextTabs = [
                      ...(block.tabs ?? []),
                      { at: '2cm' as const, align: 'left' as const },
                    ]
                    commitBlockPatch(state, path, block, { tabs: nextTabs })
                  }}
                >
                  + เพิ่มแท็บ
                </button>
              </div>
            </Field>
          )}

          {isShown('id') && (
            <Field
              label="รหัสอ้างอิง (id)"
              htmlFor="p-id"
              onReset={() => resetKey('id')}
            >
              <input
                id="p-id"
                type="text"
                aria-label="Block ID"
                className="ui-input"
                value={block.id ?? ''}
                onChange={(e) => setOptionalString('id', e.target.value)}
              />
            </Field>
          )}
        </Section>
      )}

      <AddProperty options={addOptions} />
    </div>
  )
}
