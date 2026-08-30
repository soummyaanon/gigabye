import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { homeGuard } from '../../src/guard/home.ts'
import { symlinkGuard } from '../../src/guard/symlink.ts'
import { syncRootsGuard } from '../../src/guard/sync-roots.ts'
import { keepGuard, matchGlob } from '../../src/guard/keep.ts'
import { reportOnlyGuard } from '../../src/guard/report-only.ts'
import { fragileGuard } from '../../src/guard/fragile.ts'
import { volumeGuard } from '../../src/guard/volume.ts'
import type { GuardContext } from '../../src/guard/guard.ts'
import type { Candidate } from '../../src/types.ts'

const HOME = '/Users/x'
const ctx: GuardContext = { home: HOME, homeDev: 1, keepGlobs: [], desktopDocsSynced: false }

function cand(p: string, over: Partial<Candidate> = {}): Candidate {
  return { path: p, label: 'x', group: 'builds', bytes: 1024, ...over }
}

test('blocks anything outside home', async () => {
  assert.equal((await homeGuard.check(cand('/usr/local/lib'), ctx)).action, 'block')
  assert.equal((await homeGuard.check(cand('/Users/other/p/.next'), ctx)).action, 'block')
  assert.equal((await homeGuard.check(cand('/Users/x/p/.next'), ctx)).action, 'allow')
})

test('blocks a path that escapes home via ..', async () => {
  const v = await homeGuard.check(cand('/Users/x/../other/secret'), ctx)
  assert.equal(v.action, 'block')
})

test('blocks home itself', async () => {
  assert.equal((await homeGuard.check(cand(HOME), ctx)).action, 'block')
})

test('allows exactly the allowlisted outside-home path, nothing near it', async () => {
  const allowed: GuardContext = { ...ctx, allowOutsideHome: ['/private/tmp/claude-501'] }
  assert.equal((await homeGuard.check(cand('/private/tmp/claude-501'), allowed)).action, 'allow')
  assert.equal((await homeGuard.check(cand('/private/tmp/claude-501-evil'), allowed)).action, 'block')
  assert.equal((await homeGuard.check(cand('/private/tmp/claude-501/sub'), allowed)).action, 'block')
  assert.equal((await homeGuard.check(cand('/private/tmp/claude-501/../shadow'), allowed)).action, 'block')
})

test('blocks symlinks', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'purge-sym-'))
  await fs.mkdir(path.join(dir, 'real'))
  await fs.symlink(path.join(dir, 'real'), path.join(dir, 'link'))
  const local: GuardContext = { ...ctx, home: dir }
  assert.equal((await symlinkGuard.check(cand(path.join(dir, 'link')), local)).action, 'block')
  assert.equal((await symlinkGuard.check(cand(path.join(dir, 'real')), local)).action, 'allow')
})

test('downgrades paths inside cloud sync roots', async () => {
  for (const p of [
    '/Users/x/Library/Mobile Documents/com~apple~CloudDocs/proj/.next',
    '/Users/x/Dropbox/proj/dist',
    '/Users/x/Library/CloudStorage/GoogleDrive-a@b.com/proj/node_modules',
    '/Users/x/Library/CloudStorage/OneDrive-Personal/proj/dist',
  ]) {
    const v = await syncRootsGuard.check(cand(p), ctx)
    assert.equal(v.action, 'downgrade', `${p} was not downgraded`)
    assert.match(v.warning, /syncs to your other machines/)
  }
})

test('downgrades business Dropbox folders with a suffix', async () => {
  for (const p of ['/Users/x/Dropbox (Acme)/proj/dist', '/Users/x/Dropbox (Personal)/p/.next']) {
    assert.equal((await syncRootsGuard.check(cand(p), ctx)).action, 'downgrade', p)
  }
})

test('downgrades ~/Documents only when Desktop & Documents sync is on', async () => {
  const p = '/Users/x/Documents/proj/.next'
  assert.equal((await syncRootsGuard.check(cand(p), ctx)).action, 'allow')
  const synced: GuardContext = { ...ctx, desktopDocsSynced: true }
  assert.equal((await syncRootsGuard.check(cand(p), synced)).action, 'downgrade')
})

test('allows ordinary paths through the sync guard', async () => {
  assert.equal((await syncRootsGuard.check(cand('/Users/x/Developer/p/.next'), ctx)).action, 'allow')
})

test('downgrades fragile paths that hold unrecoverable data', async () => {
  const sw = await fragileGuard.check(
    cand('/Users/x/Library/Application Support/Google/Chrome/Default/Service Worker', { group: 'browsers' }), ctx,
  )
  assert.equal(sw.action, 'downgrade')
  assert.match(sw.warning, /offline app data/)

  const ds = await fragileGuard.check(
    cand('/Users/x/Library/Developer/Xcode/iOS DeviceSupport', { group: 'xcode' }), ctx,
  )
  assert.equal(ds.action, 'downgrade')
  assert.match(ds.warning, /original device/)

  assert.equal((await fragileGuard.check(cand('/Users/x/p/.next'), ctx)).action, 'allow')
})

test('blocks a path on another volume', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'purge-vol-'))
  const st = await fs.lstat(dir)
  const same: GuardContext = { ...ctx, home: dir, homeDev: st.dev }
  assert.equal((await volumeGuard.check(cand(dir), same)).action, 'allow')

  const other: GuardContext = { ...ctx, home: dir, homeDev: st.dev + 1 }
  assert.equal((await volumeGuard.check(cand(dir), other)).action, 'block')
})

test('marks the orphans group report-only, never selectable', async () => {
  const v = await reportOnlyGuard.check(cand('/Users/x/Library/Application Support/Slack', { group: 'orphans' }), ctx)
  assert.equal(v.action, 'report')
  assert.equal((await reportOnlyGuard.check(cand('/Users/x/p/.next'), ctx)).action, 'allow')
})

test('marks the heavy group report-only, never selectable', async () => {
  const v = await reportOnlyGuard.check(cand('/Users/x/.Trash', { group: 'heavy' }), ctx)
  assert.equal(v.action, 'report')
})

test('downgrades iCloud-backed caches', async () => {
  for (const p of ['/Users/x/Library/Caches/CloudKit', '/Users/x/Library/Caches/com.apple.bird']) {
    const v = await fragileGuard.check(cand(p, { group: 'caches' }), ctx)
    assert.equal(v.action, 'downgrade', p)
    assert.match(v.action === 'downgrade' ? v.warning : '', /iCloud/)
  }
})

test('downgrades ML model caches that are slow to re-download', async () => {
  for (const p of ['/Users/x/.cache/huggingface', '/Users/x/.cache/torch']) {
    const v = await fragileGuard.check(cand(p, { group: 'caches' }), ctx)
    assert.equal(v.action, 'downgrade', p)
    assert.match(v.action === 'downgrade' ? v.warning : '', /model/)
  }
})

test('downgrades Claude session history and live scratchpads', async () => {
  for (const p of ['/Users/x/.claude/projects', '/Users/x/.claude/file-history']) {
    const v = await fragileGuard.check(cand(p, { group: 'claude' }), ctx)
    assert.equal(v.action, 'downgrade', p)
    assert.match(v.action === 'downgrade' ? v.warning : '', /resume|rewind/)
  }
  const v = await fragileGuard.check(cand('/private/tmp/claude-501', { group: 'claude' }), ctx)
  assert.equal(v.action, 'downgrade')
  assert.match(v.action === 'downgrade' ? v.warning : '', /running|sessions/)
})

test('matchGlob handles the patterns the config documents', () => {
  assert.ok(matchGlob('**/work/**', '/Users/x/work/api/.next'))
  assert.ok(matchGlob('/Users/x/keep/*', '/Users/x/keep/thing'))
  assert.ok(!matchGlob('/Users/x/keep/*', '/Users/x/keep/a/b'))
  assert.ok(matchGlob('**/*.venv', '/Users/x/p/my.venv'))
  assert.ok(!matchGlob('**/work/**', '/Users/x/personal/.next'))
})

test('blocks paths matching a keep glob', async () => {
  const local: GuardContext = { ...ctx, keepGlobs: ['**/work/**'] }
  assert.equal((await keepGuard.check(cand('/Users/x/work/api/.next'), local)).action, 'block')
  assert.equal((await keepGuard.check(cand('/Users/x/fun/api/.next'), local)).action, 'allow')
})
