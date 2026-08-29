import { ALLOW, type Guard } from './guard.ts'

/**
 * The orphans group is informational. diskdiet printed it with the note
 * "review these yourself — never deleted automatically"; this enforces it in
 * code rather than in a comment.
 */
export const orphanGuard: Guard = {
  name: 'orphan',
  check(c) {
    if (c.group === 'orphans') return { action: 'block', warning: 'review manually' }
    return ALLOW
  },
}
