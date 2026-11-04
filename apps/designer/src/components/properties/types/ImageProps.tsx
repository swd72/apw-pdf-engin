import React, { useState, useMemo, useEffect, useRef } from 'react'
import type { ImageBlock } from '@apw-pdf/core'
import type { EditorState } from '../../../editor/useEditorState.js'
import type { BlockPath } from '../../../editor/docModel.js'
import { scopeAt } from '../../../editor/bindings.js'
import { Section } from '../Section.js'
import { Field } from '../Field.js'
import { AddProperty, type AddPropertyOption } from '../AddProperty.js'
import { BindableInput } from '../VariablePicker.js'
import { LengthInput } from '../../../ui/LengthInput.js'
import { commitBlockPatch, isPropertySet } from '../shared.js'

export interface ImagePropsProps {
  block: ImageBlock
  path: BlockPath
  state: EditorState
}

const OPTIONAL_IMAGE_PROPS: Array<{ key: string; label: string }> = [
  { key: 'width', label: 'ความกว้างรูปภาพ' },
  { key: 'height', label: 'ความสูงรูปภาพ' },
  { key: 'align', label: 'การจัดวางรูปภาพ' },
  { key: 'spaceAfter', label: 'ระยะหลังรูปภาพ' },
  { key: 'anchor', label: 'ตำแหน่งยึดแบบอิสระ' },
]

export function ImageProps({ block, path, state }: ImagePropsProps) {
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
    return OPTIONAL_IMAGE_PROPS.filter(
      (p) => !isPropertySet(block, p.key) && !revealed.includes(p.key),
    ).map((p) => ({
      key: p.key,
      label: p.label,
      add: () => {
        setRevealed((prev) => [...prev, p.key])
        if (p.key === 'anchor' && !block.anchor) {
          commitBlockPatch(state, path, block, {
            anchor: { relativeTo: 'margin', x: 'center', y: '0cm' },
          })
        }
      },
    }))
  }, [block, path, revealed, state])

  const hasLayout =
    isShown('width') ||
    isShown('height') ||
    isShown('align') ||
    isShown('spaceAfter') ||
    isShown('anchor')

  return (
    <div className="properties-panel__body">
      <Section title="เนื้อหา (Content)">
        <Field label="แหล่งรูปภาพ (src)" htmlFor="img-src">
          <BindableInput
            id="img-src"
            aria-label="Image source"
            value={block.src ?? ''}
            onChange={(next) =>
              commitBlockPatch(state, path, block, { src: next })
            }
            data={data}
            scope={scope}
            placeholder="เช่น asset:garuda"
          />
        </Field>
      </Section>

      {hasLayout && (
        <Section title="การจัดวาง (Layout)">
          {isShown('width') && (
            <Field
              label="ความกว้าง (width)"
              htmlFor="img-width"
              onReset={() => resetKey('width')}
            >
              <LengthInput
                id="img-width"
                aria-label="Image width"
                defaultUnit="cm"
                value={block.width}
                onChange={(next) =>
                  commitBlockPatch(state, path, block, {
                    width: next,
                  })
                }
              />
            </Field>
          )}

          {isShown('height') && (
            <Field
              label="ความสูง (height)"
              htmlFor="img-height"
              onReset={() => resetKey('height')}
            >
              <LengthInput
                id="img-height"
                aria-label="Image height"
                defaultUnit="cm"
                value={block.height}
                onChange={(next) =>
                  commitBlockPatch(state, path, block, {
                    height: next,
                  })
                }
              />
            </Field>
          )}

          {isShown('align') && (
            <Field
              label="การจัดตำแหน่ง (align)"
              htmlFor="img-align"
              onReset={() => resetKey('align')}
            >
              <select
                id="img-align"
                aria-label="Image align"
                className="ui-select"
                value={block.align ?? 'center'}
                onChange={(e) =>
                  commitBlockPatch(state, path, block, {
                    align: e.target.value as ImageBlock['align'],
                  })
                }
              >
                <option value="left">ชิดซ้าย (left)</option>
                <option value="center">กึ่งกลาง (center)</option>
                <option value="right">ชิดขวา (right)</option>
              </select>
            </Field>
          )}

          {isShown('spaceAfter') && (
            <Field
              label="ระยะหลัง (spaceAfter)"
              htmlFor="img-space-after"
              onReset={() => resetKey('spaceAfter')}
            >
              <input
                id="img-space-after"
                type="text"
                aria-label="Space after"
                className="ui-input"
                value={(block.spaceAfter as string) ?? ''}
                onChange={(e) =>
                  commitBlockPatch(state, path, block, {
                    spaceAfter:
                      e.target.value === '' ? undefined : e.target.value,
                  })
                }
                placeholder="เช่น 12pt"
              />
            </Field>
          )}

          {isShown('anchor') && (
            <Field
              label="ตำแหน่งยึด (anchor)"
              onReset={() => resetKey('anchor')}
            >
              <select
                aria-label="Anchor relative to"
                className="ui-select"
                value={block.anchor?.relativeTo ?? 'margin'}
                onChange={(e) =>
                  commitBlockPatch(state, path, block, {
                    anchor: {
                      relativeTo: e.target.value as 'page' | 'margin',
                      x: block.anchor?.x ?? 'center',
                      y: block.anchor?.y ?? '0cm',
                    },
                  })
                }
              >
                <option value="margin">เทียบขอบเนื้อหา (margin)</option>
                <option value="page">เทียบขอบกระดาษ (page)</option>
              </select>
              <div className="prop-row-2">
                <input
                  type="text"
                  aria-label="Anchor X"
                  className="ui-input"
                  value={String(block.anchor?.x ?? 'center')}
                  onChange={(e) =>
                    commitBlockPatch(state, path, block, {
                      anchor: {
                        relativeTo: block.anchor?.relativeTo ?? 'margin',
                        x: e.target.value as any,
                        y: block.anchor?.y ?? '0cm',
                      },
                    })
                  }
                  placeholder="X (เช่น center, 2cm)"
                />
                <input
                  type="text"
                  aria-label="Anchor Y"
                  className="ui-input"
                  value={String(block.anchor?.y ?? '0cm')}
                  onChange={(e) =>
                    commitBlockPatch(state, path, block, {
                      anchor: {
                        relativeTo: block.anchor?.relativeTo ?? 'margin',
                        x: block.anchor?.x ?? 'center',
                        y: e.target.value as any,
                      },
                    })
                  }
                  placeholder="Y (เช่น 1.5cm)"
                />
              </div>
            </Field>
          )}
        </Section>
      )}

      <AddProperty options={addOptions} />
    </div>
  )
}
