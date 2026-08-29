import fs from 'node:fs/promises'
import { ALLOW, type Guard } from './guard.ts'

/**
 * A different st_dev means a different volume — an external drive, a network
 * mount, or a disk image. Comparing device ids catches all three without
 * needing to parse mount tables.
 */
export const volumeGuard: Guard = {
  name: 'volume',
  async check(c, ctx) {
    try {
      const st = await fs.lstat(c.path)
      if (st.dev !== ctx.homeDev) {
        return { action: 'block', warning: 'on another volume' }
      }
    } catch {
      return { action: 'block', warning: 'no longer exists' }
    }
    return ALLOW
  },
}
