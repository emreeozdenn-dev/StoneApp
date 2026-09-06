export function buildBundleLabels(batchCode: string, bundleCount: number): string[] {
  const count = Math.max(0, Math.floor(bundleCount) || 0)
  return Array.from({ length: count }, (_, i) => `${batchCode} Bundle ${i + 1}`)
}
