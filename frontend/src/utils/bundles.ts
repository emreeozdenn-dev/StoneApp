export function buildBundleLabels(batchCode: string, bundleCount: number): string[] {
  const count = Math.max(0, Math.floor(bundleCount) || 0)
  return Array.from({ length: count }, (_, i) => `${batchCode} Bundle ${i + 1}`)
}

// Resizes an editable bundle-label list to match a new count, keeping already-typed
// values at their index and only adding/removing entries at the tail.
export function resizeBundleLabels(
  current: string[],
  count: number,
  makeDefault: (index: number) => string,
): string[] {
  const safeCount = Math.max(0, Math.floor(count) || 0)
  return Array.from({ length: safeCount }, (_, i) => current[i] ?? makeDefault(i))
}
