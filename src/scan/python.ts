import type { WalkScanner } from './scanner.ts'

const VENV_NAMES = new Set(['.venv', 'venv', 'env'])

export const pythonScanner: WalkScanner = {
  name: 'python-venv',
  group: 'builds',
  async inspect(v) {
    if (!VENV_NAMES.has(v.name)) return null
    // pyvenv.cfg is the only reliable marker. Without it, `env/` is just a directory.
    if (!v.entries.includes('pyvenv.cfg')) return null
    return { path: v.path, label: `${v.name} (python)`, group: 'builds' }
  },
}
