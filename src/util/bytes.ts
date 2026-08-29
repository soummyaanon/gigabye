const KB = 1024
const MB = KB * 1024
const GB = MB * 1024

/** Human-readable on-disk size. Mirrors the `human()` helper from diskdiet. */
export function formatBytes(n: number): string {
  if (n >= GB) return `${(n / GB).toFixed(1)} GB`
  if (n >= MB) return `${Math.round(n / MB)} MB`
  if (n >= KB) return `${Math.round(n / KB)} KB`
  return `${n} B`
}
