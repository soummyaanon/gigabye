import path from 'node:path'
import { exists } from '../util/exists.ts'
import type { PathScanner, RawCandidate } from './scanner.ts'

/**
 * Claude Desktop is Electron; the same cache subdirs as the editors scanner
 * apply. 'Local Storage', 'IndexedDB' and 'Session Storage' hold login state
 * and app data and are deliberately absent.
 */
const DESKTOP_CACHES = [
  'Cache', 'Code Cache', 'GPUCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'Crashpad',
]

/**
 * Inside ~/.claude. Everything here is rebuilt or re-fetched on demand except
 * the last two, which hold session history — the fragile guard downgrades
 * those so they arrive unchecked with a warning.
 */
const CODE_DIRS: Array<[string, string]> = [
  ['plugins/cache', 'Claude Code plugin cache'],
  ['cache', 'Claude Code shared cache'],
  ['paste-cache', 'Claude Code paste cache'],
  ['projects', 'Claude Code session transcripts'],
  ['file-history', 'Claude Code file history'],
]

export const claudeScanner: PathScanner = {
  name: 'claude',
  group: 'claude',
  async probe(ctx) {
    const out: RawCandidate[] = []

    const desktop = path.join(ctx.home, 'Library', 'Application Support', 'Claude')
    for (const sub of DESKTOP_CACHES) {
      const full = path.join(desktop, sub)
      if (await exists(full)) out.push({ path: full, label: `Claude Desktop ${sub}`, group: 'claude' })
    }

    for (const [rel, label] of CODE_DIRS) {
      const full = path.join(ctx.home, '.claude', rel)
      if (await exists(full)) out.push({ path: full, label, group: 'claude' })
    }

    if (ctx.claudeTmpDir !== undefined && (await exists(ctx.claudeTmpDir))) {
      out.push({ path: ctx.claudeTmpDir, label: 'Claude Code session scratchpads', group: 'claude' })
    }

    return out
  },
}
