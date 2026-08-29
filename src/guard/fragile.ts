import path from 'node:path'
import { ALLOW, type Guard } from './guard.ts'

/**
 * Paths that a scanner legitimately finds but that hold data the user cannot
 * simply regenerate. Shown, never pre-checked, always warned about.
 */
const FRAGILE: Array<[RegExp, string]> = [
  // Chrome/Chromium CacheStorage — offline PWA assets and locally cached,
  // possibly unsynced, app content.
  [/(^|\/)Service Worker$/, 'may hold offline app data'],
  // Rebuilt only by reattaching that exact device on that exact OS build.
  // Lose it and you cannot symbolicate crash logs for that OS version again.
  [/(^|\/)(iOS|watchOS|tvOS|visionOS) DeviceSupport$/, 'needs the original device to rebuild'],
]

export const fragileGuard: Guard = {
  name: 'fragile',
  check(c) {
    const resolved = path.resolve(c.path)
    for (const [rx, warning] of FRAGILE) {
      if (rx.test(resolved)) return { action: 'downgrade', warning }
    }
    return ALLOW
  },
}
