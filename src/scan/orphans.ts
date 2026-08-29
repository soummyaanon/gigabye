import path from 'node:path'
import { exists } from '../util/exists.ts'
import type { PathScanner, RawCandidate } from './scanner.ts'

/** Application Support directory name → the .app that should exist. */
const PAIRS: Array<[string, string]> = [
  ['Code', 'Visual Studio Code'], ['Zed', 'Zed'], ['OrbStack', 'OrbStack'],
  ['Docker', 'Docker'], ['Slack', 'Slack'], ['Discord', 'Discord'],
  ['Spotify', 'Spotify'], ['Postman', 'Postman'], ['Figma', 'Figma'],
  ['Notion', 'Notion'], ['Windsurf', 'Windsurf'], ['VSCodium', 'VSCodium'],
  ['JetBrains', 'JetBrains Toolbox'], ['Insomnia', 'Insomnia'], ['Cursor', 'Cursor'],
]

export const orphansScanner: PathScanner = {
  name: 'orphans',
  group: 'orphans',
  async probe(ctx) {
    const out: RawCandidate[] = []
    const base = path.join(ctx.home, 'Library', 'Application Support')

    for (const [dir, app] of PAIRS) {
      const full = path.join(base, dir)
      if (!(await exists(full))) continue

      const installed = await Promise.all(
        ctx.applicationDirs.map((d) => exists(path.join(d, `${app}.app`))),
      )
      if (installed.some(Boolean)) continue

      out.push({ path: full, label: dir, group: 'orphans', note: `${app}.app not installed` })
    }
    return out
  },
}
