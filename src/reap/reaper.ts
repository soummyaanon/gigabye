import fs from 'node:fs/promises'
import type { Reviewed, RunManifest, ReapedItem, Group } from '../types.ts'
import { applyGuards, type GuardContext } from '../guard/index.ts'
import { writeManifest } from './manifest.ts'

/**
 * THE ONLY MODULE IN gigabye THAT DELETES ANYTHING.
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
  opts: { version: string; runsDir: string },
): Promise<RunManifest> {
  const wanted = items.filter((i) => i.selected)

  // What each item was already warned about when the user chose it.
  const known = new Map(wanted.map((i) => [i.path, new Set(i.warnings)]))

  // Re-run the guards. Anything now blocked disappears from this list.
  const revalidated = await applyGuards(wanted, ctx)
  const fresh = new Map(revalidated.map((r) => [r.path, r.warnings]))

  const reaped: ReapedItem[] = []
  for (const item of wanted) {
    const nowWarns = fresh.get(item.path)
    if (nowWarns === undefined) continue // a guard blocks it now

    // A warning that appeared AFTER the user chose is an objection they never
    // saw — for instance they ran `git add dist && commit` while reading the
    // review screen. Skip it. A warning they already saw and checked anyway
    // is their decision and is honoured.
    if (nowWarns.some((w) => !(known.get(item.path)?.has(w) ?? false))) continue
    try {
      await fs.rm(item.path, { recursive: true, force: true })
      reaped.push({ path: item.path, bytes: item.bytes, group: item.group })
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
