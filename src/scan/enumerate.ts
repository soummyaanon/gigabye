import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Names of the subdirectories of `root`, in readdir order. Files and symlinks
 * are omitted — enumerating scanners only ever claim real directories. A
 * missing or unreadable root yields [].
 */
export async function subdirNames(root: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return []
  }
}

export function joinAll(root: string, names: string[]): string[] {
  return names.map((n) => path.join(root, n))
}
