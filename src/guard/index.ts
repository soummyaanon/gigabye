import type { Candidate, Reviewed } from '../types.ts'
import type { Guard, GuardContext } from './guard.ts'
import { homeGuard } from './home.ts'
import { symlinkGuard } from './symlink.ts'
import { volumeGuard } from './volume.ts'
import { syncRootsGuard } from './sync-roots.ts'
import { keepGuard } from './keep.ts'
import { orphanGuard } from './orphan.ts'
import { fragileGuard } from './fragile.ts'
import { gitGuard, annotateGitStatus } from './git.ts'

/** Cheap, path-only guards run first so the expensive ones see fewer candidates. */
const GUARDS: Guard[] = [
  homeGuard, keepGuard, orphanGuard, syncRootsGuard, fragileGuard, symlinkGuard, volumeGuard, gitGuard,
]

/**
 * Runs every guard over every candidate.
 *
 * Precedence is block > downgrade > allow. A blocked candidate is dropped
 * from the result entirely, so it can never be rendered, never be selected,
 * and never reach the reaper. A downgraded candidate survives but arrives
 * unchecked with its warnings attached.
 */
export async function applyGuards(cands: Candidate[], ctx: GuardContext): Promise<Reviewed[]> {
  const gitIgnored = await annotateGitStatus(cands)
  const fullCtx: GuardContext = { ...ctx, gitIgnored }
  const out: Reviewed[] = []

  for (const c of cands) {
    let blocked = false
    const warnings: string[] = []

    for (const guard of GUARDS) {
      const verdict = await guard.check(c, fullCtx)
      if (verdict.action === 'block') { blocked = true; break }
      if (verdict.action === 'downgrade') warnings.push(verdict.warning)
    }

    if (blocked) continue
    out.push({ ...c, selected: warnings.length === 0, warnings })
  }

  return out
}

export type { GuardContext } from './guard.ts'
