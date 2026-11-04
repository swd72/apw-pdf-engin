import React, { useState, useRef } from 'react'
import { PT_PER_IN, PT_PER_CM, PT_PER_MM, type Length } from '@apw-pdf/core'

export type LengthUnit = 'pt' | 'mm' | 'cm' | 'in'

export interface LengthInputProps {
  id?: string
  value: Length | undefined // number = pt
  onChange(next: string | undefined): void // undefined = cleared
  defaultUnit: LengthUnit
  allowNegative?: boolean
  'aria-label'?: string
}

const LENGTH_RE = /^(-?\d+(?:\.\d+)?)(pt|mm|cm|in)$/
const VALID_NUM_RE = /^-?\d+(?:\.\d+)?$/

const UNIT_TO_PT: Record<LengthUnit, number> = {
  pt: 1,
  mm: PT_PER_MM,
  cm: PT_PER_CM,
  in: PT_PER_IN,
}

const BASE_STEP: Record<LengthUnit, number> = {
  pt: 1,
  mm: 1,
  cm: 0.1,
  in: 0.1,
}

function roundTo(num: number, decimals: number): number {
  const rounded = Number(num.toFixed(decimals))
  return rounded === 0 ? 0 : rounded
}

function filterNumericText(raw: string, allowNegative: boolean): string {
  let out = ''
  let hasDot = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!
    if (ch >= '0' && ch <= '9') {
      out += ch
    } else if (ch === '.' && !hasDot) {
      hasDot = true
      out += ch
    } else if (ch === '-' && out.length === 0 && allowNegative) {
      out += ch
    }
  }
  return out
}

export function parseLength(
  v: Length | undefined,
): { num: number; unit: LengthUnit } | null {
  if (v === undefined || v === null) return null
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return null
    return { num: v, unit: 'pt' }
  }
  if (typeof v === 'string') {
    const trimmed = v.trim()
    if (!trimmed) return null
    const m = LENGTH_RE.exec(trimmed)
    if (!m) return null
    const num = Number(m[1])
    const unit = m[2] as LengthUnit
    if (!Number.isFinite(num)) return null
    return { num, unit }
  }
  return null
}

export function formatLength(num: number, unit: LengthUnit): string {
  const clean = roundTo(num, 2)
  return `${clean}${unit}`
}

export function convertLength(
  num: number,
  from: LengthUnit,
  to: LengthUnit,
): number {
  if (from === to) return num
  const pt = num * UNIT_TO_PT[from]
  return roundTo(pt / UNIT_TO_PT[to], 6)
}

export function LengthInput({
  id,
  value,
  onChange,
  defaultUnit,
  allowNegative = false,
  'aria-label': ariaLabel,
}: LengthInputProps) {
  const parsed = parseLength(value)
  const isFallback = value !== undefined && value !== '' && parsed === null

  const [localText, setLocalText] = useState<string>(() =>
    parsed ? String(roundTo(parsed.num, 2)) : '',
  )
  const [localUnit, setLocalUnit] = useState<LengthUnit>(() =>
    parsed ? parsed.unit : defaultUnit,
  )
  const prevValueRef = useRef<Length | undefined>(value)

  if (prevValueRef.current !== value) {
    prevValueRef.current = value
    if (parsed) {
      setLocalUnit(parsed.unit)
      setLocalText(String(roundTo(parsed.num, 2)))
    } else if (value === undefined || value === '') {
      setLocalText('')
    }
  }

  if (isFallback) {
    return (
      <input
        id={id}
        type="text"
        aria-label={ariaLabel}
        className="ui-input"
        value={String(value)}
        onChange={(e) =>
          onChange(e.target.value === '' ? undefined : e.target.value)
        }
      />
    )
  }

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value

    if (raw === '') {
      setLocalText('')
      onChange(undefined)
      return
    }

    if (!allowNegative && raw.trim().startsWith('-')) {
      return
    }

    const filtered = filterNumericText(raw, allowNegative)
    if (filtered === '') {
      return
    }

    setLocalText(filtered)

    if (!VALID_NUM_RE.test(filtered)) {
      return
    }

    const num = Number(filtered)
    if (!Number.isFinite(num)) {
      return
    }

    if (!allowNegative && num < 0) {
      return
    }

    onChange(formatLength(num, localUnit))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()

    const step = BASE_STEP[localUnit] * (e.shiftKey ? 10 : 1)
    const delta = e.key === 'ArrowUp' ? step : -step
    const trimmed = localText.trim()
    const baseNum = parsed
      ? parsed.num
      : VALID_NUM_RE.test(trimmed)
        ? Number(trimmed)
        : 0
    const nextNum = roundTo(baseNum + delta, 2)
    if (!allowNegative && nextNum < 0) return

    setLocalText(String(nextNum))
    onChange(formatLength(nextNum, localUnit))
  }

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextUnit = e.target.value as LengthUnit
    const prevUnit = localUnit
    setLocalUnit(nextUnit)

    const trimmed = localText.trim()
    if (trimmed === '') {
      return
    }

    const baseNum = VALID_NUM_RE.test(trimmed)
      ? Number(trimmed)
      : parsed
        ? parsed.num
        : null
    if (baseNum === null || !Number.isFinite(baseNum)) {
      return
    }

    const fromUnit =
      parsed && Number(trimmed) === parsed.num ? parsed.unit : prevUnit
    const converted = convertLength(baseNum, fromUnit, nextUnit)
    const rounded = roundTo(converted, 2)
    setLocalText(String(rounded))
    onChange(formatLength(rounded, nextUnit))
  }

  return (
    <div className="ui-length-input">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        className="ui-input ui-length-input__number"
        value={localText}
        onChange={handleNumberChange}
        onKeyDown={handleKeyDown}
      />
      <select
        aria-label={ariaLabel ? `${ariaLabel} unit` : 'Length unit'}
        className="ui-select ui-length-input__unit"
        value={localUnit}
        onChange={handleUnitChange}
      >
        <option value="pt">pt</option>
        <option value="mm">mm</option>
        <option value="cm">cm</option>
        <option value="in">นิ้ว</option>
      </select>
    </div>
  )
}
