import { ALLOW, type Guard } from './guard.ts'

/**
 * Whole groups whose rows are real, non-regenerable data: an uninstalled
 * app's settings, a device backup, Docker's VM disk. Deleting one is a loss,
 * not a cleanup — so every row arrives unchecked with a warning saying
 * exactly what the loss is, and the TUI keeps it out of select-all and the
 * group checkbox. Checking the row itself is the only way to opt in.
 *
 * Until v0.6 these groups were report-only ('report'): visible, never
 * deletable. That protected people who did not read the row, but it also
 * meant the tool showed you 70 GB and then refused to help. 'danger' keeps
 * the friction — nothing here can be swept up in bulk — while honouring an
 * explicit, per-row decision.
 */
export const dangerGuard: Guard = {
  name: 'danger',
  check(c) {
    if (c.group === 'orphans') {
      return { action: 'danger', warning: 'settings & data for an app that is gone — not regenerable' }
    }
    if (c.group === 'heavy') {
      if (c.label.startsWith('iOS backup')) {
        return { action: 'danger', warning: 'a device backup — deleting it is permanent' }
      }
      if (c.label === 'Docker.raw') {
        return { action: 'danger', warning: 'destroys all Docker containers, images & volumes — quit Docker Desktop first' }
      }
      if (c.label === '.Trash') {
        return { action: 'danger', warning: 'empties the Trash for good' }
      }
      return { action: 'danger', warning: 'not regenerable — deletes real data' }
    }
    return ALLOW
  },
}
