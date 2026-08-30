import fs from 'node:fs/promises'
import type { Reviewed, RunManifest, ReapedItem, Group } from '../types.ts'
import { applyGuards, type GuardContext } from '../guard/index.ts'
import { writeManifest } from './manifest.ts'

/**
 * THE ONLY MODULE IN purge THAT DELETES ANYTHING.
 *
 * Do not add fs.rm, fs.unlink or fs.rmdir anywhere else in src/. CI enforces
 * this by grep — see .github/workflows/ci.yml.
 *
 * Every path is re-validated through the full guard pipeline immediately
 * before removal. The user may have spent minutes in the review screen, and
 * in that window a directory can be replaced by a symlink, moved onto another
 * volume, or committed to git. Trusting the scan-time verdict would be a
 * time-of-check-to-time-of-use bug with rm -rf on the other end.
 */
export async function reap(
  items: Reviewed[],
  ctx: GuardContext,
  opts: {
    version: string
    runsDir: string
    /** Called after each successful removal with cumulative freed bytes. */
    onProgress?: (freedBytes: number, totalBytes: number) => void
  },
): Promise<RunManifest> {
  // selectable:false means a guard returned 'report' — the orphans group.
  // Filtered here AND re-checked against the fresh verdict below, so a
  // caller that forged selected:true still cannot delete one.
  const wanted = items.filter((i) => i.selected && i.selectable)

  // What each item was already warned about when the user chose it.
  const known = new Map(wanted.map((i) => [i.path, new Set(i.warnings)]))

  // Re-run the guards. Anything now blocked disappears from this list.
  const revalidated = await applyGuards(wanted, ctx)
  const fresh = new Map(revalidated.map((r) => [r.path, r]))

  const reaped: ReapedItem[] = []
  for (const item of wanted) {
    const now = fresh.get(item.path)
    if (now === undefined) continue // a guard blocks it now
    // A guard now says report-only. Never delete, whatever the caller asked.
    if (!now.selectable) continue
    const nowWarns = now.warnings

    // A warning that appeared AFTER the user chose is an objection they never
    // saw — for instance they ran `git add dist && commit` while reading the
    // review screen. Skip it. A warning they already saw and checked anyway
    // is their decision and is honoured.
    if (nowWarns.some((w) => !(known.get(item.path)?.has(w) ?? false))) continue
    try {
      await fs.rm(item.path, { recursive: true, force: true })
      reaped.push({ path: item.path, bytes: item.bytes, group: item.group })
      opts.onProgress?.(
        reaped.reduce((n, r) => n + r.bytes, 0),
        wanted.reduce((n, w) => n + w.bytes, 0),
      )
    } catch { /* permission denied and friends — skip, never fatal */ }
  }

  const groups = [...new Set(reaped.map((r) => r.group))] as Group[]
  const manifest: RunManifest = {
    ts: new Date().toISOString(),
    version: opts.version,
    freedBytes: reaped.reduce((n, r) => n + r.bytes, 0),
    groups,
    items: reaped,
  }

  await writeManifest(opts.runsDir, manifest)
  return manifest
}
