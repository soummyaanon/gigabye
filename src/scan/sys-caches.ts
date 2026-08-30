import fs from 'node:fs/promises'
import path from 'node:path'
import type { PathScanner, RawCandidate } from './scanner.ts'
import { PKG_CACHE_PATHS } from './pkg-cache.ts'

/**
 * The deep-scan half of cache cleaning: instead of a curated list, enumerate
 * one level of the two cache roots and offer every app's folder. Apps must
 * tolerate ~/Library/Caches deletion by platform convention; the few known
 * exceptions (CloudKit, model caches) are downgraded by the fragile guard,
 * not excluded here.
 */
const ROOTS: Array<[string, (name: string) => string]> = [
  ['Library/Caches', (n) => n],
  ['.cache', (n) => `.cache/${n}`],
]

export const sysCachesScanner: PathScanner = {
  name: 'sys-caches',
  group: 'caches',
  async probe(ctx) {
    const claimed = new Set(PKG_CACHE_PATHS.map(([rel]) => path.join(ctx.home, rel)))
    const out: RawCandidate[] = []

    for (const [rootRel, labelOf] of ROOTS) {
      const root = path.join(ctx.home, rootRel)
      let entries
      try {
        entries = await fs.readdir(root, { withFileTypes: true })
      } catch {
        continue // root absent — nothing to claim
      }
      for (const e of entries) {
        if (!e.isDirectory()) continue // files and symlinks are never claimed
        const full = path.join(root, e.name)
        if (claimed.has(full)) continue
        out.push({ path: full, label: labelOf(e.name), group: 'caches' })
      }
    }
    return out
  },
}
