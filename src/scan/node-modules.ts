import fs from 'node:fs/promises'
import path from 'node:path'
import type { WalkScanner } from './scanner.ts'

const DAY = 86_400_000

/**
 * Directory names whose contents are checked more deeply. Without these, a
 * monorepo whose sources live at packages/app/src/index.ts shows only its
 * root README and package.json at depth 2, reads as idle, and has its live
 * node_modules deleted. diskdiet's flat -maxdepth 2 had the same hole; it
 * mattered less on one known machine.
 */
const SOURCE_HINTS = ['src', 'app', 'apps', 'lib', 'packages', 'source', 'components', 'test', 'tests']

/**
 * Most recent mtime among a project's own files, ignoring node_modules and
 * .git.
 */
async function lastTouched(root: string, depth = 2): Promise<number> {
  let newest = 0
  let entries
  try {
    entries = await fs.readdir(root, { withFileTypes: true })
  } catch {
    return newest
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git') continue
    const full = path.join(root, e.name)
    if (e.isDirectory()) {
      if (depth > 0) newest = Math.max(newest, await lastTouched(full, depth - 1))
      continue
    }
    if (!e.isFile()) continue
    try {
      const st = await fs.stat(full)
      newest = Math.max(newest, st.mtimeMs)
    } catch { /* unreadable — ignore */ }
  }
  return newest
}

export const nodeModulesScanner: WalkScanner = {
  name: 'node_modules',
  group: 'builds',
  async inspect(v, ctx) {
    if (v.name !== 'node_modules') return null
    // A dependency's own node_modules is part of an install, not a project.
    if (v.parent.includes(`${path.sep}node_modules${path.sep}`)) return null
    if (v.parent.endsWith(`${path.sep}node_modules`)) return null

    let touched = await lastTouched(v.parent)

    // Look deeper inside conventional source directories before concluding
    // a project is abandoned. Deleting an active project's node_modules is
    // the most disruptive non-destructive thing purge can do.
    if (touched !== 0 && ctx.now - touched >= ctx.staleDays * DAY) {
      let siblings: string[] = []
      try {
        siblings = (await fs.readdir(v.parent, { withFileTypes: true }))
          .filter((e) => e.isDirectory() && SOURCE_HINTS.includes(e.name))
          .map((e) => e.name)
      } catch { /* unreadable — fall through with what we have */ }

      for (const hint of siblings) {
        touched = Math.max(touched, await lastTouched(path.join(v.parent, hint), 3))
      }
    }

    if (touched === 0) return null // nothing readable — do not guess
    const idleDays = Math.floor((ctx.now - touched) / DAY)
    if (idleDays < ctx.staleDays) return null

    return { path: v.path, label: 'node_modules', group: 'builds', note: `idle ${idleDays}d` }
  },
}
