import path from 'node:path'
import { ALLOW, type Guard } from './guard.ts'

/**
 * The oldest rule purge has, inherited from diskdiet: never touch anything
 * outside the user's home directory. Resolves the path first so that `..`
 * segments cannot walk out of home and back in.
 */
export const homeGuard: Guard = {
  name: 'home',
  check(c, ctx) {
    const resolved = path.resolve(c.path)
    const home = path.resolve(ctx.home)
    if (resolved === home) return { action: 'block', warning: 'is your home directory' }
    if (!resolved.startsWith(home + path.sep)) {
      // The resolved path must equal an allowlisted entry exactly; children
      // and lookalike siblings stay blocked.
      if (ctx.allowOutsideHome?.some((p) => path.resolve(p) === resolved) === true) return ALLOW
      return { action: 'block', warning: 'outside your home directory' }
    }
    return ALLOW
  },
}
