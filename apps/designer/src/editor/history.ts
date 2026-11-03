import type { DocumentDef } from '@apw-pdf/core'

export interface Snapshot {
  doc: DocumentDef
  data: unknown
}

export interface History {
  push(prev: Snapshot, mergeKey?: string, now?: number): void
  undo(current: Snapshot): Snapshot | null
  redo(current: Snapshot): Snapshot | null
  reset(): void
  canUndo(): boolean
  canRedo(): boolean
}

const MERGE_WINDOW_MS = 600

export function createHistory(limit = 100): History {
  const past: Snapshot[] = []
  const future: Snapshot[] = []
  let lastKey: string | undefined = undefined
  let lastTime = -Infinity

  return {
    push(prev: Snapshot, mergeKey?: string, now: number = Date.now()) {
      future.length = 0
      if (
        mergeKey !== undefined &&
        mergeKey === lastKey &&
        past.length > 0 &&
        now - lastTime < MERGE_WINDOW_MS
      ) {
        lastTime = now
        return
      }
      past.push(prev)
      if (past.length > limit) {
        past.shift()
      }
      lastKey = mergeKey
      lastTime = now
    },

    undo(current: Snapshot): Snapshot | null {
      if (past.length === 0) return null
      const prev = past.pop()!
      future.push(current)
      lastKey = undefined
      lastTime = -Infinity
      return prev
    },

    redo(current: Snapshot): Snapshot | null {
      if (future.length === 0) return null
      const next = future.pop()!
      past.push(current)
      if (past.length > limit) {
        past.shift()
      }
      lastKey = undefined
      lastTime = -Infinity
      return next
    },

    reset() {
      past.length = 0
      future.length = 0
      lastKey = undefined
      lastTime = -Infinity
    },

    canUndo(): boolean {
      return past.length > 0
    },

    canRedo(): boolean {
      return future.length > 0
    },
  }
}
