import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { applyGuards } from '../../src/guard/index.ts'
import type { Candidate } from '../../src/types.ts'

async function realHome(): Promise<{ home: string; homeDev: number }> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'purge-pipe-'))
  const st = await fs.lstat(home)
  return { home, homeDev: st.dev }
}

function cand(p: string, over: Partial<Candidate> = {}): Candidate {
  return { path: p, label: 'x', group: 'builds', bytes: 4096, ...over }
}

test('INVARIANT: nothing outside home ever survives the guard pipeline', async () => {
  const { home, homeDev } = await realHome()
  const outside = [
    '/etc/passwd', '/usr/local/lib', '/System/Library', '/Applications/Safari.app',
    '/Users/someone-else/project/.next', `${home}/../escape`, '/',
  ].map((p) => cand(p))

  const survivors = await applyGuards(outside, { home, homeDev, keepGlobs: [], desktopDocsSynced: false })
  assert.deepEqual(survivors, [], `guard pipeline let something out of home: ${JSON.stringify(survivors)}`)
})

test('allows an ordinary candidate inside home', async () => {
  const { home, homeDev } = await realHome()
  const target = path.join(home, 'proj', '.next')
  await fs.mkdir(target, { recursive: true })

  const [got] = await applyGuards([cand(target)], { home, homeDev, keepGlobs: [], desktopDocsSynced: false })
  assert.ok(got)
  assert.equal(got.selected, true)
  assert.deepEqual(got.warnings, [])
})

test('downgrades rather than drops when a guard objects', async () => {
  const { home, homeDev } = await realHome()
  const target = path.join(home, 'Dropbox', 'proj', 'dist')
  await fs.mkdir(target, { recursive: true })

  const [got] = await applyGuards([cand(target)], { home, homeDev, keepGlobs: [], desktopDocsSynced: false })
  assert.ok(got, 'downgraded candidate was dropped instead of shown')
  assert.equal(got.selected, false)
  assert.ok(got.warnings.some((w) => /syncs to your other machines/.test(w)))
})

test('block wins over downgrade', async () => {
  const { home, homeDev } = await realHome()
  const target = path.join(home, 'Dropbox', 'keepme', 'dist')
  await fs.mkdir(target, { recursive: true })

  const survivors = await applyGuards([cand(target)], { home, homeDev, keepGlobs: ['**/keepme/**'], desktopDocsSynced: false })
  assert.deepEqual(survivors, [], 'a keep-glob block was overridden by a downgrade')
})

test('REGRESSION: a Service Worker directory is never pre-selected', async () => {
  const { home, homeDev } = await realHome()
  const target = path.join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'Default', 'Service Worker')
  await fs.mkdir(target, { recursive: true })

  const [got] = await applyGuards(
    [cand(target, { group: 'browsers' })],
    { home, homeDev, keepGlobs: [], desktopDocsSynced: false },
  )
  assert.ok(got, 'service worker candidate was dropped entirely')
  assert.equal(got.selected, false, 'service worker would be deleted by --yes without interaction')
  assert.ok(got.warnings.some((w) => /offline app data/.test(w)))
})

test('reports orphans but never makes them selectable', async () => {
  const { home, homeDev } = await realHome()
  const target = path.join(home, 'Library', 'Application Support', 'Slack')
  await fs.mkdir(target, { recursive: true })

  const [got] = await applyGuards([cand(target, { group: 'orphans' })], { home, homeDev, keepGlobs: [], desktopDocsSynced: false })
  assert.ok(got, 'orphan was dropped instead of reported — the group can never print')
  assert.equal(got.selectable, false, 'orphan must never be selectable')
  assert.equal(got.selected, false, 'orphan must never be pre-checked')
  assert.ok(got.warnings.some((w) => /review manually/.test(w)))
})

test('a report-only candidate outside home is still blocked', async () => {
  const { home, homeDev } = await realHome()
  const survivors = await applyGuards(
    [cand('/Users/someone-else/Library/Application Support/Slack', { group: 'orphans' })],
    { home, homeDev, keepGlobs: [], desktopDocsSynced: false },
  )
  assert.deepEqual(survivors, [], 'report beat block for a path outside home')
})
