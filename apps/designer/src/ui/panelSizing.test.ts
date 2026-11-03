// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  clampPanels,
  defaultPanels,
  loadPanels,
  savePanels,
  type PanelState,
} from './panelSizing.js'

describe('panelSizing', () => {
  let store: Map<string, string>
  let shouldThrow = false

  beforeEach(() => {
    store = new Map<string, string>()
    shouldThrow = false
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => {
        if (shouldThrow) throw new Error('Storage getItem error')
        return store.get(key) ?? null
      },
      setItem: (key: string, value: string) => {
        if (shouldThrow) throw new Error('Storage setItem error')
        store.set(key, value)
      },
      removeItem: (key: string) => {
        if (shouldThrow) throw new Error('Storage removeItem error')
        store.delete(key)
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('clampPanels keeps the centre at least 360px', () => {
    const state: PanelState = {
      left: 420,
      right: 420,
      leftCollapsed: false,
      rightCollapsed: false,
    }
    const clamped = clampPanels(state, 1000)
    const centre = 1000 - clamped.left - clamped.right
    expect(centre).toBeGreaterThanOrEqual(360)
    expect(clamped.left).toBeGreaterThanOrEqual(220)
    expect(clamped.right).toBeGreaterThanOrEqual(220)
  })

  it('clampPanels shrinks a side that exceeds the container', () => {
    const state: PanelState = {
      left: 620,
      right: 260,
      leftCollapsed: false,
      rightCollapsed: false,
    }
    const clamped = clampPanels(state, 1000)
    expect(clamped.right).toBe(260)
    expect(clamped.left).toBe(380)
    expect(1000 - clamped.left - clamped.right).toBe(360)
  })

  it('clampPanels leaves valid state untouched', () => {
    const state: PanelState = {
      left: 260,
      right: 300,
      leftCollapsed: false,
      rightCollapsed: false,
    }
    const clamped = clampPanels(state, 1280)
    expect(clamped).toEqual(state)
  })

  it('defaultPanels collapses sides below 1100px', () => {
    const narrow = defaultPanels(900)
    expect(narrow.leftCollapsed).toBe(true)
    expect(narrow.rightCollapsed).toBe(true)
    expect(narrow.left).toBeGreaterThanOrEqual(220)
    expect(narrow.right).toBeGreaterThanOrEqual(220)

    const at1024 = defaultPanels(1024)
    expect(at1024.leftCollapsed).toBe(true)
    expect(at1024.rightCollapsed).toBe(true)

    const wide = defaultPanels(1280)
    expect(wide.leftCollapsed).toBe(false)
    expect(wide.rightCollapsed).toBe(false)
  })

  it('loadPanels returns null for corrupt data and survives storage errors', () => {
    expect(loadPanels('missing-key')).toBeNull()

    store.set('bad-json', '{not valid json')
    expect(loadPanels('bad-json')).toBeNull()

    store.set(
      'bad-shape',
      JSON.stringify({ left: 'wide', right: null, leftCollapsed: 'no' }),
    )
    expect(loadPanels('bad-shape')).toBeNull()

    const valid: PanelState = {
      left: 280,
      right: 320,
      leftCollapsed: false,
      rightCollapsed: true,
    }
    savePanels('good-key', valid)
    expect(loadPanels('good-key')).toEqual(valid)

    shouldThrow = true
    expect(loadPanels('good-key')).toBeNull()

    vi.stubGlobal('localStorage', undefined)
    expect(loadPanels('good-key')).toBeNull()
  })

  it('savePanels survives storage errors', () => {
    shouldThrow = true
    const state: PanelState = {
      left: 260,
      right: 300,
      leftCollapsed: false,
      rightCollapsed: false,
    }
    expect(() => savePanels('any-key', state)).not.toThrow()

    vi.stubGlobal('localStorage', undefined)
    expect(() => savePanels('any-key', state)).not.toThrow()
  })
})
