export type Group = 'builds' | 'pkg' | 'xcode' | 'browsers' | 'editors' | 'orphans'

export const ALL_GROUPS: Group[] = ['builds', 'pkg', 'xcode', 'browsers', 'editors', 'orphans']

/** A thing gigabye found that could be deleted. */
export type Candidate = {
  /** Absolute path. */
  path: string
  /** Short label shown in the UI, e.g. '.next' or 'npm cache'. */
  label: string
  group: Group
  /** On-disk bytes, from stat.blocks * 512. Filled in by the sizing pass. */
  bytes: number
  /** Extra context shown dim beside the label, e.g. 'idle 214d'. */
  note?: string
}

/** What a guard decided about a candidate. */
export type Verdict =
  | { action: 'allow' }
  | { action: 'downgrade'; warning: string }
  /** Shown in the report, never selectable, never deletable. */
  | { action: 'report'; warning: string }
  | { action: 'block'; warning: string }

/** A candidate after the guard layer has run. */
export type Reviewed = Candidate & {
  /** Pre-checked in the TUI. False when a guard downgraded it. */
  selected: boolean
  /**
   * False when a guard returned 'report': the row is displayed so the user
   * knows the data exists, but it can never be checked and the reaper
   * refuses it outright. This is what makes the `orphans` group visible
   * without ever being deletable.
   */
  selectable: boolean
  /** Shown beside the row. Empty when no guard objected. */
  warnings: string[]
}

/** One line in a run manifest. */
export type ReapedItem = { path: string; bytes: number; group: Group }

export type RunManifest = {
  ts: string
  version: string
  freedBytes: number
  groups: Group[]
  items: ReapedItem[]
}
