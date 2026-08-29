import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { ALLOW, type Guard } from './guard.ts'
import type { Candidate } from '../types.ts'

const NUL = String.fromCharCode(0)

/** Nearest ancestor containing .git, or null when the path is not in a repo. */
async function repoRoot(p: string): Promise<string | null> {
  let dir = path.dirname(path.resolve(p))
  const root = path.parse(dir).root
  for (;;) {
    try {
      await fs.lstat(path.join(dir, '.git'))
      return dir
    } catch { /* keep climbing */ }
    if (dir === root) return null
    dir = path.dirname(dir)
  }
}

/**
 * Run `git check-ignore` once for a whole repository's worth of paths.
 * Exit code 0 means at least one path was ignored, 1 means none were, and
 * anything else is a real failure. Paths are NUL-separated in both directions
 * so that spaces and newlines in filenames are handled.
 *
 * On any failure the result is an empty set, which reads as "nothing is
 * ignored" and therefore downgrades every candidate in that repo. Failing
 * toward caution is deliberate.
 */
function checkIgnore(cwd: string, paths: string[]): Promise<Set<string>> {
  return new Promise((resolve) => {
    const child = execFile(
      'git', ['-C', cwd, 'check-ignore', '--stdin', '-z'],
      // A timeout matters: a git that stalls on a credential prompt or a
      // wedged network filesystem would otherwise hang the whole run.
      { maxBuffer: 32 * 1024 * 1024, timeout: 10_000 },
      (err, stdout) => {
        const code = (err as (NodeJS.ErrnoException & { code?: number }) | null)?.code
        if (err && code !== 1) return resolve(new Set())
        const ignored = stdout.split(NUL).filter(Boolean).map((p) => path.resolve(cwd, p))
        resolve(new Set(ignored))
      },
    )
    child.stdin?.end(paths.join(NUL))
  })
}

/**
 * Map of absolute path to "git ignores this".
 * A path in no repository maps to true: the guard simply does not apply.
 */
export async function annotateGitStatus(cands: Candidate[]): Promise<Map<string, boolean>> {
  const byRepo = new Map<string, string[]>()
  const result = new Map<string, boolean>()

  for (const c of cands) {
    const abs = path.resolve(c.path)
    const root = await repoRoot(abs)
    if (root === null) {
      result.set(abs, true)
      continue
    }
    const list = byRepo.get(root) ?? []
    list.push(abs)
    byRepo.set(root, list)
  }

  for (const [root, paths] of byRepo) {
    const ignored = await checkIgnore(root, paths)
    for (const p of paths) result.set(p, ignored.has(p))
  }

  return result
}

/**
 * Guard form. Requires ctx.gitIgnored to have been filled in by
 * annotateGitStatus during the batch pass — see src/guard/index.ts.
 */
export const gitGuard: Guard = {
  name: 'git',
  check(c, ctx) {
    const ignored = ctx.gitIgnored?.get(path.resolve(c.path))
    if (ignored === false) {
      return { action: 'downgrade', warning: 'tracked in git' }
    }
    return ALLOW
  },
}
