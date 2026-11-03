export interface PanelState {
  left: number
  right: number
  leftCollapsed: boolean
  rightCollapsed: boolean
}

export interface PanelLimits {
  side: number
  centre: number
  collapsed: number
}

export const DEFAULT_PANEL_LIMITS: PanelLimits = {
  side: 220,
  centre: 360,
  collapsed: 44,
}

function getStorage(): {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
} | null {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) {
      return null
    }
    if (
      typeof localStorage.getItem !== 'function' ||
      typeof localStorage.setItem !== 'function'
    ) {
      return null
    }
    return localStorage
  } catch {
    return null
  }
}

export function clampPanels(
  state: PanelState,
  containerWidth: number,
  limits?: Partial<PanelLimits>,
  draggedSide?: 'left' | 'right',
): PanelState {
  const sideMin = limits?.side ?? DEFAULT_PANEL_LIMITS.side
  const centreMin = limits?.centre ?? DEFAULT_PANEL_LIMITS.centre
  const collapsedWidth = limits?.collapsed ?? DEFAULT_PANEL_LIMITS.collapsed

  let left = Math.max(sideMin, Number.isFinite(state.left) ? state.left : 260)
  let right = Math.max(sideMin, Number.isFinite(state.right) ? state.right : 300)
  const leftCollapsed = Boolean(state.leftCollapsed)
  const rightCollapsed = Boolean(state.rightCollapsed)

  if (leftCollapsed && rightCollapsed) {
    return { left, right, leftCollapsed, rightCollapsed }
  }

  if (leftCollapsed && !rightCollapsed) {
    const maxRight = Math.max(sideMin, containerWidth - centreMin - collapsedWidth)
    right = Math.min(right, maxRight)
    return { left, right, leftCollapsed, rightCollapsed }
  }

  if (!leftCollapsed && rightCollapsed) {
    const maxLeft = Math.max(sideMin, containerWidth - centreMin - collapsedWidth)
    left = Math.min(left, maxLeft)
    return { left, right, leftCollapsed, rightCollapsed }
  }

  const availSides = Math.max(0, containerWidth - centreMin)
  let overflow = left + right - availSides

  if (overflow > 0) {
    const primary = draggedSide ?? (left >= right ? 'left' : 'right')
    if (primary === 'left') {
      const shrinkLeft = Math.min(overflow, Math.max(0, left - sideMin))
      left -= shrinkLeft
      overflow -= shrinkLeft
      if (overflow > 0) {
        const shrinkRight = Math.min(overflow, Math.max(0, right - sideMin))
        right -= shrinkRight
      }
    } else {
      const shrinkRight = Math.min(overflow, Math.max(0, right - sideMin))
      right -= shrinkRight
      overflow -= shrinkRight
      if (overflow > 0) {
        const shrinkLeft = Math.min(overflow, Math.max(0, left - sideMin))
        left -= shrinkLeft
      }
    }
  }

  return { left, right, leftCollapsed, rightCollapsed }
}

export function defaultPanels(containerWidth: number): PanelState {
  const collapsed = containerWidth < 1100
  const base: PanelState = {
    left: 260,
    right: 300,
    leftCollapsed: collapsed,
    rightCollapsed: collapsed,
  }
  return clampPanels(base, containerWidth)
}

export function loadPanels(key: string): PanelState | null {
  try {
    const storage = getStorage()
    if (!storage) return null
    const raw = storage.getItem(key)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const obj = parsed as Record<string, unknown>
    if (
      typeof obj.left !== 'number' ||
      !Number.isFinite(obj.left) ||
      obj.left <= 0 ||
      typeof obj.right !== 'number' ||
      !Number.isFinite(obj.right) ||
      obj.right <= 0 ||
      typeof obj.leftCollapsed !== 'boolean' ||
      typeof obj.rightCollapsed !== 'boolean'
    ) {
      return null
    }
    return {
      left: obj.left,
      right: obj.right,
      leftCollapsed: obj.leftCollapsed,
      rightCollapsed: obj.rightCollapsed,
    }
  } catch {
    return null
  }
}

export function savePanels(key: string, s: PanelState): void {
  try {
    const storage = getStorage()
    if (!storage) return
    storage.setItem(key, JSON.stringify(s))
  } catch {
    // ignore storage errors
  }
}
