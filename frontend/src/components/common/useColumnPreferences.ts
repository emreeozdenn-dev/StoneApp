import { useEffect, useMemo, useState } from 'react'

export interface ColumnDef<Key extends string> {
  key: Key
  label: string
  align?: 'left' | 'right' | 'center'
}

export interface ColumnPreferencesOptions<Key extends string> {
  defaultHidden?: Key[]
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // localStorage kullanılamıyorsa (gizli sekme vb.) sessizce yoksay.
  }
}

export function useColumnPreferences<Key extends string>(
  storageKey: string,
  columns: ColumnDef<Key>[],
  options?: ColumnPreferencesOptions<Key>,
) {
  const defaultOrder = useMemo(() => columns.map((c) => c.key), [columns])
  const defaultHidden = options?.defaultHidden ?? []
  const orderKey = `stoneapp.columns.${storageKey}.order`
  const hiddenKey = `stoneapp.columns.${storageKey}.hidden`

  const [order, setOrder] = useState<Key[]>(() => readJson(orderKey, defaultOrder))
  const [hidden, setHidden] = useState<Key[]>(() => readJson(hiddenKey, defaultHidden))

  useEffect(() => writeJson(orderKey, order), [orderKey, order])
  useEffect(() => writeJson(hiddenKey, hidden), [hiddenKey, hidden])

  const validKeys = useMemo(() => new Set(columns.map((c) => c.key)), [columns])
  const hiddenSet = useMemo(() => new Set(hidden.filter((k) => validKeys.has(k))), [hidden, validKeys])

  const reconciledOrder = useMemo(() => {
    const filtered = order.filter((k) => validKeys.has(k))
    const missing = defaultOrder.filter((k) => !filtered.includes(k))
    return [...filtered, ...missing]
  }, [order, validKeys, defaultOrder])

  const visibleOrderedKeys = useMemo(
    () => reconciledOrder.filter((k) => !hiddenSet.has(k)),
    [reconciledOrder, hiddenSet],
  )

  function toggleVisible(key: Key) {
    setHidden((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  function move(key: Key, direction: -1 | 1) {
    setOrder((prev) => {
      const current = reconcile(prev, defaultOrder)
      const index = current.indexOf(key)
      const targetIndex = index + direction
      if (index === -1 || targetIndex < 0 || targetIndex >= current.length) return prev
      const next = [...current]
      ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
      return next
    })
  }

  function reorderTo(draggedKey: Key, targetKey: Key) {
    setOrder((prev) => {
      const current = reconcile(prev, defaultOrder)
      const from = current.indexOf(draggedKey)
      const to = current.indexOf(targetKey)
      if (from === -1 || to === -1 || from === to) return prev
      const next = [...current]
      next.splice(from, 1)
      next.splice(to, 0, draggedKey)
      return next
    })
  }

  function reset() {
    setOrder(defaultOrder)
    setHidden(defaultHidden)
  }

  return {
    order: reconciledOrder,
    hidden: hiddenSet,
    visibleOrderedKeys,
    toggleVisible,
    moveUp: (key: Key) => move(key, -1),
    moveDown: (key: Key) => move(key, 1),
    reorderTo,
    reset,
  }
}

function reconcile<Key extends string>(order: Key[], defaultOrder: Key[]): Key[] {
  const missing = defaultOrder.filter((k) => !order.includes(k))
  return [...order.filter((k) => defaultOrder.includes(k)), ...missing]
}
