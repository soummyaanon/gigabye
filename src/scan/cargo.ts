import type { WalkScanner } from './scanner.ts'

export const cargoScanner: WalkScanner = {
  name: 'cargo',
  group: 'builds',
  async inspect(v) {
    if (v.name !== 'target') return null
    if (!v.parentEntries.includes('Cargo.toml')) return null
    return { path: v.path, label: 'target (cargo)', group: 'builds' }
  },
}
