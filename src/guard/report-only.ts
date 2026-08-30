import type { Group } from '../types.ts'
import { ALLOW, type Guard } from './guard.ts'

/**
 * Whole groups that are informational: shown so the user learns where the
 * space went, never deletable by this tool.
 *
 * 'report' rather than 'block': blocking would drop the candidate from the
 * pipeline entirely, so the group could never print anything at all and the
 * feature would be advertised in --help while doing nothing. 'report' keeps
 * the row visible while making it unselectable, and the reaper refuses any
 * item whose fresh verdict is report-only.
 */
const REPORT_ONLY: ReadonlySet<Group> = new Set(['orphans', 'heavy'])

export const reportOnlyGuard: Guard = {
  name: 'report-only',
  check(c) {
    if (REPORT_ONLY.has(c.group)) {
      return { action: 'report', warning: 'review manually — never deleted' }
    }
    return ALLOW
  },
}
