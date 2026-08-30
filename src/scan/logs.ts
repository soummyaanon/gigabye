import path from 'node:path'
import type { PathScanner, RawCandidate } from './scanner.ts'
import { subdirNames } from './enumerate.ts'

/**
 * Per-app log folders. Only directories are claimed: a stray file at the root
 * of ~/Library/Logs is left alone, like everywhere else in purge.
 */
export const logsScanner: PathScanner = {
  name: 'logs',
  group: 'logs',
  async probe(ctx) {
    const root = path.join(ctx.home, 'Library', 'Logs')
    const out: RawCandidate[] = []
    for (const name of await subdirNames(root)) {
      out.push({ path: path.join(root, name), label: name, group: 'logs' })
    }
    return out
  },
}
