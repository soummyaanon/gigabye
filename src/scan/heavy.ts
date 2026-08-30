import path from 'node:path'
import { exists } from '../util/exists.ts'
import type { PathScanner, RawCandidate } from './scanner.ts'
import { subdirNames } from './enumerate.ts'

/**
 * Things that are huge but NOT regenerable junk: device backups, the Trash,
 * Docker's VM disk. The whole group is report-only (the report-only guard
 * enforces it) — these rows exist so the user learns where the space went,
 * with a note saying which tool actually reclaims it.
 */
export const heavyScanner: PathScanner = {
  name: 'heavy',
  group: 'heavy',
  async probe(ctx) {
    const out: RawCandidate[] = []

    const backups = path.join(ctx.home, 'Library', 'Application Support', 'MobileSync', 'Backup')
    for (const name of await subdirNames(backups)) {
      out.push({
        path: path.join(backups, name),
        label: `iOS backup ${name}`,
        group: 'heavy',
        note: 'delete via Finder → manage backups',
      })
    }

    const trash = path.join(ctx.home, '.Trash')
    if (await exists(trash)) {
      out.push({ path: trash, label: '.Trash', group: 'heavy', note: 'empty via Finder' })
    }

    const dockerRaw = path.join(
      ctx.home, 'Library', 'Containers', 'com.docker.docker', 'Data', 'vms', '0', 'data', 'Docker.raw',
    )
    if (await exists(dockerRaw)) {
      out.push({
        path: dockerRaw,
        label: 'Docker.raw',
        group: 'heavy',
        note: 'shrink via Docker Desktop → disk size',
      })
    }

    return out
  },
}
