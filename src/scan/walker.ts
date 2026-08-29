import fs from 'node:fs/promises'
import path from 'node:path'

export type DirVisit = {
  /** Absolute path of the directory being visited. */
  path: string
  /** Basename, e.g. '.next'. */
  name: string
  /** Absolute path of the containing directory. */
  parent: string
  /** Names of the directory's immediate children, files and dirs alike. */
  entries: string[]
  /** Names of the *parent* directory's children. Lets a scanner check for a sibling manifest. */
  parentEntries: string[]
}

export type VisitResult = {
  /** When true, the walker does not descend into this directory. */
  prune: boolean
}

export type WalkOptions = {
  /**
   * Absolute paths that are never visited and never descended into.
   * The caller supplies this to keep ~/Library and editor dot-directories
   * out of the walk entirely — diskdiet excluded them with -not -path and
   * dropping that was a real regression.
   */
  skip?: (absPath: string, name: string) => boolean
}

/**
 * Never visited and never descended into. Nothing inside them is ever a
 * deletion candidate, and walking them is slow.
 */
const NEVER_VISIT = new Set(['.git', '.Trash', '.trash'])

/**
 * Visited — so a scanner can claim the directory itself — but NEVER descended
 * into. This is the fix for the worst regression against diskdiet, which
 * carried a `-not -path` exclusion for node_modules contents. Without it, an
 * ACTIVE project's node_modules is (correctly) not claimed by
 * nodeModulesScanner, therefore not pruned, therefore walked — and
 * buildsScanner then claims
 * node_modules/next/dist, node_modules/esbuild/dist and every other
 * dependency shipping a dist/ beside its package.json, corrupting the install.
 */
const NEVER_DESCEND = new Set(['node_modules'])

/**
 * Depth-first walk of `root`, calling `onDir` for every directory found.
 * Symlinked directories are visited neither as entries nor as descents,
 * so a symlink loop cannot hang the walk.
 */
export async function walk(
  root: string,
  onDir: (v: DirVisit) => VisitResult | Promise<VisitResult>,
  opts: WalkOptions = {},
): Promise<void> {
  const queue: Array<{ dir: string; parentEntries: string[] }> = [{ dir: root, parentEntries: [] }]

  while (queue.length > 0) {
    const { dir, parentEntries } = queue.pop() as { dir: string; parentEntries: string[] }

    let dirents
    try {
      dirents = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      continue // unreadable — skip, never fatal
    }

    const entries = dirents.map((d) => d.name)
    const name = path.basename(dir)

    if (dir !== root) {
      const result = await onDir({ path: dir, name, parent: path.dirname(dir), entries, parentEntries })
      if (result.prune) continue
      // Visited so a scanner could claim it, but its contents are off-limits.
      if (NEVER_DESCEND.has(name)) continue
    }

    for (const d of dirents) {
      // isDirectory() is false for symlinks, so this never follows one.
      if (!d.isDirectory()) continue
      if (d.name.endsWith('.photoslibrary')) continue
      if (NEVER_VISIT.has(d.name)) continue
      const full = path.join(dir, d.name)
      if (opts.skip?.(full, d.name) === true) continue
      queue.push({ dir: full, parentEntries: entries })
    }
  }
}
