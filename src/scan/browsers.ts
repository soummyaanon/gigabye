import fs from 'node:fs/promises'
import path from 'node:path'
import { exists } from '../util/exists.ts'
import type { PathScanner, RawCandidate } from './scanner.ts'

const BROWSERS = ['Google/Chrome', 'Comet', 'BraveSoftware/Brave-Browser', 'Microsoft Edge', 'Arc']

/** On-device AI models, re-downloaded on demand. Live at the browser root. */
const MODEL_DIRS = [
  'OptGuideOnDeviceModel', 'OptGuideOnDeviceClassifierModel', 'optimization_guide_model_store',
]

/** Per-profile. 'Service Worker' is real offline data, so it carries a note. */
const PROFILE_DIRS: Array<[string, string | undefined]> = [
  ['GPUCache', undefined],
  ['Code Cache', undefined],
  ['Service Worker', 'may hold offline app data'],
]

async function profileNames(root: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true })
    return entries
      .filter((e) => e.isDirectory() && (e.name === 'Default' || e.name.startsWith('Profile ')))
      .map((e) => e.name)
  } catch {
    return []
  }
}

export const browsersScanner: PathScanner = {
  name: 'browsers',
  group: 'browsers',
  async probe(ctx) {
    const out: RawCandidate[] = []
    const base = path.join(ctx.home, 'Library', 'Application Support')
    for (const browser of BROWSERS) {
      const root = path.join(base, browser)
      if (!(await exists(root))) continue

      for (const m of MODEL_DIRS) {
        const full = path.join(root, m)
        if (await exists(full)) out.push({ path: full, label: `${browser} AI model`, group: 'browsers' })
      }

      for (const profile of await profileNames(root)) {
        for (const [sub, note] of PROFILE_DIRS) {
          const full = path.join(root, profile, sub)
          if (!(await exists(full))) continue
          out.push({
            path: full, label: `${browser} ${profile} ${sub}`, group: 'browsers',
            ...(note ? { note } : {}),
          })
        }
      }
    }
    return out
  },
}
