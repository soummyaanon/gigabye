import path from 'node:path'
import { exists } from '../util/exists.ts'
import type { PathScanner, RawCandidate } from './scanner.ts'

/**
 * Relative to home → label. Every one of these is re-downloaded on demand.
 * Exported so the generic `caches` scanner can skip what is claimed here.
 */
export const PKG_CACHE_PATHS: Array<[string, string]> = [
  ['.npm/_cacache', 'npm cache'],
  ['.npm/_npx', 'npx cache'],
  // The parent of the versioned v3/v10/... store dirs, so every pnpm works.
  // Projects keep working: their node_modules hard-link the same inodes.
  ['Library/pnpm/store', 'pnpm store'],
  ['.bun/install/cache', 'bun cache'],
  ['Library/Caches/ms-playwright', 'playwright browsers'],
  ['Library/Caches/electron', 'electron downloads'],
  ['Library/Caches/node-gyp', 'node-gyp headers'],
  ['Library/Caches/Homebrew', 'homebrew cache'],
  ['Library/Caches/Yarn', 'yarn cache'],
  ['Library/Caches/deno', 'deno cache'],
  ['.cargo/registry/cache', 'cargo registry cache'],
  ['.gradle/caches', 'gradle cache'],
]

export const pkgCacheScanner: PathScanner = {
  name: 'pkg-cache',
  group: 'pkg',
  async probe(ctx) {
    const out: RawCandidate[] = []
    for (const [rel, label] of PKG_CACHE_PATHS) {
      const full = path.join(ctx.home, rel)
      if (await exists(full)) out.push({ path: full, label, group: 'pkg' })
    }
    return out
  },
}
