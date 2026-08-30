import path from 'node:path'
import { ALLOW, type Guard } from './guard.ts'

/**
 * Paths under a cloud sync root. Deleting here does not just free local space
 * — it propagates the delete to every other machine on the account. purge
 * shows these but never pre-checks them.
 *
 * Each entry is relative to home.
 */
const SYNC_ROOTS = [
  'Library/Mobile Documents',   // iCloud Drive
  'Library/CloudStorage',       // Dropbox, Google Drive, OneDrive, Box (macOS 12+)
  'Google Drive',
  'OneDrive',
]

/**
 * Only when "Desktop & Documents Folders" iCloud sync is on. These present as
 * ordinary folders under home, so nothing else would catch them, and a delete
 * here reaches every other Mac on the account.
 */
const SYNCED_WHEN_ICLOUD_DESKTOP = ['Documents', 'Desktop']

/** Business installs use "Dropbox (Company)" / "Dropbox (Personal)". */
const SYNC_ROOT_PREFIXES = ['Dropbox']

export const syncRootsGuard: Guard = {
  name: 'sync-roots',
  check(c, ctx) {
    const home = path.resolve(ctx.home)
    const resolved = path.resolve(c.path)
    if (!resolved.startsWith(home + path.sep)) return ALLOW

    const under = (root: string) => resolved === root || resolved.startsWith(root + path.sep)
    const warn = { action: 'downgrade', warning: 'syncs to your other machines' } as const

    for (const rel of SYNC_ROOTS) {
      if (under(path.join(home, rel))) return warn
    }
    if (ctx.desktopDocsSynced) {
      for (const rel of SYNCED_WHEN_ICLOUD_DESKTOP) {
        if (under(path.join(home, rel))) return warn
      }
    }
    // First path segment below home, e.g. "Dropbox (Company)".
    const top = resolved.slice(home.length + 1).split(path.sep)[0] ?? ''
    if (SYNC_ROOT_PREFIXES.some((prefix) => top.startsWith(prefix))) return warn

    return ALLOW
  },
}
