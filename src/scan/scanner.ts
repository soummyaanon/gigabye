import type { Candidate, Group } from '../types.ts'
import type { DirVisit } from './walker.ts'

export type ScanContext = {
  /** The user's home directory. Injected so tests can use a fixture root. */
  home: string
  /** node_modules idle threshold in days. */
  staleDays: number
  /** Milliseconds since epoch. Injected so staleness tests are deterministic. */
  now: number
  /** Where to look for installed .app bundles. Injected so the orphans scanner is testable. */
  applicationDirs: string[]
  /**
   * Claude Code's per-user sandbox scratchpad root, /private/tmp/claude-<uid>.
   * The one path outside home purge may touch. Optional and injected so the
   * claude scanner is testable; cli.ts fills in the real path.
   */
  claudeTmpDir?: string
}

/** A candidate before the sizing pass has run. */
export type RawCandidate = Omit<Candidate, 'bytes'>

/** Offered every directory during the single walk. */
export type WalkScanner = {
  name: string
  group: Group
  /**
   * Return a candidate to claim this directory, or null to pass.
   * A claimed directory is never descended into.
   *
   * Async even for scanners that need no I/O, so that every caller and every
   * test awaits uniformly. nodeModulesScanner (Task 5) genuinely needs the
   * filesystem; widening the contract later would break Task 4's tests.
   */
  inspect(v: DirVisit, ctx: ScanContext): Promise<RawCandidate | null>
}

/** Probes a fixed set of known paths. Does not participate in the walk. */
export type PathScanner = {
  name: string
  group: Group
  probe(ctx: ScanContext): Promise<RawCandidate[]>
}
