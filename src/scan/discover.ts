import path from 'node:path'
import type { PathScanner, RawCandidate } from './scanner.ts'
import { subdirNames } from './enumerate.ts'

/**
 * The safety net under the curated lists: enumerate every hidden `~/.tool`
 * directory and claim the subdirectories that are junk by naming convention
 * (`cache`, `tmp`, `logs`, ...). This is how a tool nobody has heard of still
 * gets its cache found — the same platform-convention argument the sys-caches
 * scanner makes for ~/Library/Caches, applied to dotfolders in home.
 */

/**
 * Dot dirs this scanner must never look inside. Two reasons, kept separate
 * below: dirs other scanners own (their group decides what is claimable —
 * discovery claiming `.gemini/tmp` would bypass a user's group filter), and
 * identity/credential dirs that must never even be probed.
 */
const SKIP_DOT_DIRS: ReadonlySet<string> = new Set([
  // owned by other scanners or the walker skip list
  '.cache', '.npm', '.bun', '.cargo', '.gradle', '.Trash',
  '.claude', '.codex', '.cursor', '.gemini', '.copilot', '.aider',
  '.vscode', '.windsurf', '.local', '.rustup',
  // identity and credentials
  '.ssh', '.gnupg', '.aws', '.kube', '.docker', '.config',
])

/**
 * Lower-cased, so `.tool/Cache` on a case-sensitive Mac matches the same way
 * it would on the default case-insensitive APFS.
 */
const JUNK_NAMES: ReadonlySet<string> = new Set([
  'cache', 'caches', '.cache', 'tmp', '.tmp', 'temp', 'log', 'logs',
])

export const discoverScanner: PathScanner = {
  name: 'discover',
  group: 'caches',
  async probe(ctx, claimed) {
    const out: RawCandidate[] = []
    for (const dot of await subdirNames(ctx.home)) {
      if (!dot.startsWith('.') || SKIP_DOT_DIRS.has(dot)) continue
      const root = path.join(ctx.home, dot)
      for (const name of await subdirNames(root)) {
        if (!JUNK_NAMES.has(name.toLowerCase())) continue
        const full = path.join(root, name)
        if (claimed?.has(full)) continue
        out.push({ path: full, label: `${dot}/${name}`, group: 'caches', note: 'auto-discovered' })
      }
    }
    return out
  },
}
