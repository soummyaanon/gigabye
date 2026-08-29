import path from 'node:path'
import { exists } from '../util/exists.ts'
import type { PathScanner, RawCandidate } from './scanner.ts'

const EDITORS = ['Cursor', 'Code', 'Code - Insiders', 'Windsurf', 'VSCodium', 'Zed']

/**
 * Cache subdirectories only. 'User' (settings, keybindings, snippets) and
 * 'extensions' are deliberately absent — losing those is a bad afternoon.
 */
const SUBDIRS = [
  'CachedData', 'CachedExtensionVSIXs', 'Cache', 'GPUCache', 'Code Cache',
  'DawnGraphiteCache', 'DawnWebGPUCache', 'logs', 'CachedProfilesData',
]

export const editorsScanner: PathScanner = {
  name: 'editors',
  group: 'editors',
  async probe(ctx) {
    const out: RawCandidate[] = []
    const base = path.join(ctx.home, 'Library', 'Application Support')
    for (const editor of EDITORS) {
      for (const sub of SUBDIRS) {
        const full = path.join(base, editor, sub)
        if (await exists(full)) out.push({ path: full, label: `${editor} ${sub}`, group: 'editors' })
      }
    }
    return out
  },
}
