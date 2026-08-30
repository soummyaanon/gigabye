import fs from 'node:fs/promises'
import path from 'node:path'
import type { RunManifest } from '../types.ts'

/** Writes one run manifest and returns the file path. */
export async function writeManifest(runsDir: string, m: RunManifest): Promise<string> {
  await fs.mkdir(runsDir, { recursive: true })
  const safeTs = m.ts.replace(/[:.]/g, '-')
  const file = path.join(runsDir, `${safeTs}.json`)
  await fs.writeFile(file, JSON.stringify(m, null, 2))
  return file
}

/** Every past run, newest first. Unreadable or malformed files are skipped. */
export async function readManifests(runsDir: string): Promise<RunManifest[]> {
  let names: string[]
  try {
    names = await fs.readdir(runsDir)
  } catch {
    return []
  }

  const out: RunManifest[] = []
  for (const name of names.filter((n) => n.endsWith('.json'))) {
    try {
      const raw = await fs.readFile(path.join(runsDir, name), 'utf8')
      const parsed = JSON.parse(raw) as RunManifest
      if (typeof parsed.ts === 'string' && Array.isArray(parsed.items)) out.push(parsed)
    } catch { /* a corrupt manifest must never break `purge history` */ }
  }

  return out.sort((a, b) => b.ts.localeCompare(a.ts))
}
