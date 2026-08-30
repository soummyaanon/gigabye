import fs from 'node:fs/promises'
import { ALLOW, type Guard } from './guard.ts'

/**
 * Deleting a symlink is harmless; deleting through one is not. purge takes
 * the simple route and refuses symlinks entirely.
 */
export const symlinkGuard: Guard = {
  name: 'symlink',
  async check(c) {
    try {
      const st = await fs.lstat(c.path)
      if (st.isSymbolicLink()) return { action: 'block', warning: 'is a symlink' }
    } catch {
      return { action: 'block', warning: 'no longer exists' }
    }
    return ALLOW
  },
}
