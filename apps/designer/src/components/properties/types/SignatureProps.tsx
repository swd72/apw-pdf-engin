import React, { useState, useMemo, useEffect, useRef } from 'react'
import type { SignatureBlock } from '@apw-pdf/core'
import type { EditorState } from '../../../editor/useEditorState.js'
import type { BlockPath } from '../../../editor/docModel.js'
import { scopeAt } from '../../../editor/bindings.js'
import { Section } from '../Section.js'
import { Field } from '../Field.js'
import { AddProperty, type AddPropertyOption } from '../AddProperty.js'
import { BindableInput } from '../VariablePicker.js'
import { commitBlockPatch, isPropertySet } from '../shared.js'

export interface SignaturePropsProps {
  block: SignatureBlock
  path: BlockPath
  state: EditorState
}

const OPTIONAL_SIGNATURE_PROPS: Array<{ key: string; label: string }> = [
  { key: 'prefix', label: 'คำนำหน้าลายเซ็น' },
  { key: 'startAt', label: 'ตำแหน่งเริ่มต้นแนวนอน' },
  { key: 'linesBefore', label: 'จำนวนบรรทัดเว้นก่อนชื่อ' },
  { key: 'minLinesBefore', label: 'บรรทัดขั้นต่ำก่อนชื่อ' },
  { key: 'image', label: 'รูปภาพลายเซ็น' },
  { key: 'imageHeight', label: 'ความสูงรูปภาพลายเซ็น' },
]

export function SignatureProps({ block, path, state }: SignaturePropsProps) {
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

  const isShown = (key: string): boolean =>
    isPropertySet(block, key) || revealed.includes(key)

  const resetKey = (key: string) => {
    setRevealed((prev) => prev.filter((k) => k !== key))
    commitBlockPatch(state, path, block, { [key]: undefined })
  }

  const addOptions = useMemo<AddPropertyOption[]>(() => {
    return OPTIONAL_SIGNATURE_PROPS.filter(
      (p) => !isPropertySet(block, p.key) && !revealed.includes(p.key),
    ).map((p) => ({
      key: p.key,
      label: p.label,
      add: () => setRevealed((prev) => [...prev, p.key]),
    }))
  }, [block, revealed])

  const hasLayoutSection =
    isShown('startAt') ||
    isShown('linesBefore') ||
    isShown('minLinesBefore') ||
    isShown('image') ||
    isShown('imageHeight')

  return (
    <div className="properties-panel__body">
      <Section title="เนื้อหา (Content)">
        <Field label="ชื่อผู้ลงนาม (name)" htmlFor="sig-name">
          <BindableInput
            id="sig-name"
            aria-label="Signature name"
            value={block.name ?? ''}
            onChange={(next) =>
              commitBlockPatch(state, path, block, { name: next })
            }
            data={data}
            scope={scope}
          />
        </Field>

        <Field
          label="ตำแหน่ง (positions — บรรทัดละ 1 ตำแหน่ง)"
          htmlFor="sig-positions"
          onReset={
            isPropertySet(block, 'positions')
              ? () => resetKey('positions')
              : undefined
          }
        >
          <textarea
            id="sig-positions"
            aria-label="Signature positions"
            className="ui-textarea"
            rows={3}
            value={block.positions ? block.positions.join('\n') : ''}
            onChange={(e) => {
              const lines = e.target.value
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean)
              commitBlockPatch(state, path, block, {
                positions: lines.length > 0 ? lines : undefined,
              })
            }}
            placeholder="เช่น ผู้อำนวยการ&#10;สำนักยุทธศาสตร์"
          />
        </Field>

        {isShown('prefix') && (
          <Field
            label="คำนำหน้า (prefix)"
            htmlFor="sig-prefix"
            onReset={() => resetKey('prefix')}
          >
            <BindableInput
              id="sig-prefix"
              aria-label="Signature prefix"
              value={block.prefix ?? ''}
              onChange={(next) =>
                commitBlockPatch(state, path, block, {
                  prefix: next === '' ? undefined : next,
                })
              }
              data={data}
              scope={scope}
            />
          </Field>
        )}
      </Section>

      {hasLayoutSection && (
        <Section title="การจัดวาง (Layout)">
          {isShown('startAt') && (
            <Field
              label="ตำแหน่งเริ่มต้น (startAt)"
              htmlFor="sig-start-at"
              onReset={() => resetKey('startAt')}
            >
              <input
                id="sig-start-at"
                type="text"
                aria-label="Start at"
                className="ui-input"
                value={String(block.startAt ?? '')}
                onChange={(e) =>
                  commitBlockPatch(state, path, block, {
                    startAt: e.target.value === '' ? undefined : e.target.value,
                  })
                }
                placeholder="center หรือ 8cm"
              />
            </Field>
          )}

          {isShown('linesBefore') && (
            <Field
              label="บรรทัดเว้นก่อนชื่อ (linesBefore)"
              htmlFor="sig-lines-before"
              onReset={() => resetKey('linesBefore')}
            >
              <input
                id="sig-lines-before"
                type="number"
                aria-label="Lines before"
                className="ui-input"
                value={block.linesBefore ?? ''}
                onChange={(e) => {
                  const n = e.target.value
                    ? parseInt(e.target.value, 10)
                    : undefined
                  commitBlockPatch(state, path, block, {
                    linesBefore: n && !Number.isNaN(n) ? n : undefined,
                  })
                }}
              />
            </Field>
          )}

          {isShown('minLinesBefore') && (
            <Field
              label="บรรทัดขั้นต่ำก่อนชื่อ (minLinesBefore)"
              htmlFor="sig-min-lines"
              onReset={() => resetKey('minLinesBefore')}
            >
              <input
                id="sig-min-lines"
                type="number"
                aria-label="Min lines before"
                className="ui-input"
                value={block.minLinesBefore ?? ''}
                onChange={(e) => {
                  const n =
                    e.target.value !== ''
                      ? parseInt(e.target.value, 10)
                      : undefined
                  commitBlockPatch(state, path, block, {
                    minLinesBefore:
                      n !== undefined && !Number.isNaN(n) ? n : undefined,
                  })
                }}
              />
            </Field>
          )}

          {isShown('image') && (
            <Field
              label="รูปภาพลายเซ็น (image)"
              htmlFor="sig-image"
              onReset={() => resetKey('image')}
            >
              <BindableInput
                id="sig-image"
                aria-label="Signature image"
                value={block.image ?? ''}
                onChange={(next) =>
                  commitBlockPatch(state, path, block, {
                    image: next === '' ? undefined : next,
                  })
                }
                data={data}
                scope={scope}
              />
            </Field>
          )}

          {isShown('imageHeight') && (
            <Field
              label="ความสูงรูปภาพ (imageHeight)"
              htmlFor="sig-image-height"
              onReset={() => resetKey('imageHeight')}
            >
              <input
                id="sig-image-height"
                type="text"
                aria-label="Signature image height"
                className="ui-input"
                value={(block.imageHeight as string) ?? ''}
                onChange={(e) =>
                  commitBlockPatch(state, path, block, {
                    imageHeight:
                      e.target.value === '' ? undefined : e.target.value,
                  })
                }
                placeholder="เช่น 1.5cm"
              />
            </Field>
          )}
        </Section>
      )}

      <AddProperty options={addOptions} />
    </div>
  )
}
