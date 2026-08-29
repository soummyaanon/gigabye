import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * On-disk bytes for a file or directory tree.
 *
 * Uses stat.blocks * 512 (allocated blocks), never stat.size. macOS
 * "Optimize Storage" leaves dataless iCloud placeholders whose logical
 * size is large and whose allocated size is zero; measuring by size
 * would make gigabye report freeing space that was never on disk.
 *
 * Never follows symlinks. Unreadable entries contribute 0.
 */
export async function diskUsageBytes(target: string): Promise<number> {
  let st
  try {
    st = await fs.lstat(target)
  } catch {
    return 0
  }

  if (st.isSymbolicLink()) return st.blocks * 512
  if (!st.isDirectory()) return st.blocks * 512

  let total = st.blocks * 512
  let entries
  try {
    entries = await fs.readdir(target, { withFileTypes: true })
  } catch {
    return total
  }

  for (const entry of entries) {
    total += await diskUsageBytes(path.join(target, entry.name))
  }
  return total
}
