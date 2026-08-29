import { ALLOW, type Guard } from './guard.ts'

/**
 * The orphans group is informational. diskdiet printed it with the note
 * "review these yourself — never deleted automatically"; this enforces it in
 * code rather than in a comment.
 *
 * 'report' rather than 'block': blocking would drop the candidate from the
 * pipeline entirely, so the group could never print anything at all and the
 * feature would be advertised in --help while doing nothing. 'report' keeps
 * the row visible while making it unselectable, and the reaper refuses any
 * item whose fresh verdict is report-only.
 */
export const orphanGuard: Guard = {
  name: 'orphan',
  check(c) {
    if (c.group === 'orphans') return { action: 'report', warning: 'review manually — never deleted' }
    return ALLOW
  },
}
