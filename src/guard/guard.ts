import type { Candidate, Verdict } from '../types.ts'

export type GuardContext = {
  home: string
  /** st_dev of the home directory. A candidate on a different device is on another volume. */
  homeDev: number
  /** Glob patterns from ~/.gigabyerc that must never be touched. Already ~-expanded. */
  keepGlobs: string[]
  /**
   * True when macOS "Desktop & Documents Folders" iCloud sync is on. Those
   * folders then present as ordinary directories under home while actually
   * syncing, so ~/Documents and ~/Desktop must be treated as sync roots.
   * Detected in cli.ts by probing
   * ~/Library/Mobile Documents/com~apple~CloudDocs/Desktop.
   */
  desktopDocsSynced: boolean
  /** Filled in by annotateGitStatus before guards run. Absolute path to "git ignores it". */
  gitIgnored?: Map<string, boolean>
}

export type Guard = {
  name: string
  check(c: Candidate, ctx: GuardContext): Verdict | Promise<Verdict>
}

export const ALLOW: Verdict = { action: 'allow' }
