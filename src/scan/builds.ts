import type { WalkScanner } from './scanner.ts'

/** Framework output. Always regenerable, always gitignored in practice. */
const UNAMBIGUOUS = new Set(['.next', '.turbo', '.parcel-cache', '.svelte-kit', '.astro', '.nuxt'])

/**
 * `dist` and `build` are ambiguous — plenty of people have a hand-written
 * `build/` directory of source. Only claim them next to a build manifest.
 * Carried over from diskdiet.
 */
const AMBIGUOUS = new Set(['dist', 'build'])

const MANIFESTS = ['package.json', 'tsconfig.json', 'vite.config.js', 'vite.config.ts']

export const buildsScanner: WalkScanner = {
  name: 'builds',
  group: 'builds',
  async inspect(v) {
    if (UNAMBIGUOUS.has(v.name)) {
      return { path: v.path, label: v.name, group: 'builds' }
    }
    if (AMBIGUOUS.has(v.name) && MANIFESTS.some((m) => v.parentEntries.includes(m))) {
      return { path: v.path, label: v.name, group: 'builds' }
    }
    return null
  },
}
