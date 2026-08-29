import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { reap } from '../../src/reap/reaper.ts'
import { readManifests } from '../../src/reap/manifest.ts'
import type { Reviewed } from '../../src/types.ts'

const run = promisify(execFile)

async function sandbox() {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'gigabye-reap-'))
  const st = await fs.lstat(home)
  const runsDir = path.join(home, '.gigabye', 'runs')
  return { home, homeDev: st.dev, runsDir, ctx: { home, homeDev: st.dev, keepGlobs: [], desktopDocsSynced: false } }
}

function reviewed(p: string, bytes: number): Reviewed {
  return { path: p, label: '.next', group: 'builds', bytes, selected: true, warnings: [] }
}

const OPTS = (runsDir: string) => ({ version: '0.1.0', runsDir })

test('deletes selected paths and reports what was freed', async () => {
  const { home, ctx, runsDir } = await sandbox()
  const target = path.join(home, 'proj', '.next')
  await fs.mkdir(target, { recursive: true })
  await fs.writeFile(path.join(target, 'chunk.js'), Buffer.alloc(50_000))

  const m = await reap([reviewed(target, 50_000)], ctx, OPTS(runsDir))

  assert.equal(await fs.access(target).then(() => true, () => false), false, 'path still exists')
  assert.equal(m.items.length, 1)
  assert.equal(m.freedBytes, 50_000)
  assert.deepEqual(m.groups, ['builds'])
})

test('never deletes an unselected item', async () => {
  const { home, ctx, runsDir } = await sandbox()
  const target = path.join(home, 'proj', 'dist')
  await fs.mkdir(target, { recursive: true })

  const item: Reviewed = { ...reviewed(target, 100), selected: false }
  const m = await reap([item], ctx, OPTS(runsDir))

  assert.equal(await fs.access(target).then(() => true, () => false), true, 'unselected path was deleted')
  assert.equal(m.items.length, 0)
})

test('re-validates: refuses a path that became a symlink after the scan', async () => {
  const { home, ctx, runsDir } = await sandbox()
  const real = path.join(home, 'precious')
  const link = path.join(home, 'proj', '.next')
  await fs.mkdir(real, { recursive: true })
  await fs.writeFile(path.join(real, 'keep.txt'), 'do not lose me')
  await fs.mkdir(path.join(home, 'proj'), { recursive: true })
  await fs.symlink(real, link)

  const m = await reap([reviewed(link, 4096)], ctx, OPTS(runsDir))

  assert.equal(m.items.length, 0, 'reaper deleted a path that became a symlink')
  assert.equal(await fs.access(path.join(real, 'keep.txt')).then(() => true, () => false), true)
})

test('re-validates: refuses a path outside home even if handed one directly', async () => {
  const { ctx, runsDir } = await sandbox()
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'gigabye-outside-'))
  await fs.writeFile(path.join(outside, 'keep.txt'), 'x')

  const m = await reap([reviewed(outside, 4096)], ctx, OPTS(runsDir))

  assert.equal(m.items.length, 0, 'reaper deleted outside home')
  assert.equal(await fs.access(path.join(outside, 'keep.txt')).then(() => true, () => false), true)
})

test('skips an item that acquired a NEW warning during the review window', async () => {
  const { home, ctx, runsDir } = await sandbox()
  const repo = path.join(home, 'proj')
  const target = path.join(repo, 'dist')
  await fs.mkdir(target, { recursive: true })
  await fs.writeFile(path.join(target, 'out.js'), 'x')
  await run('git', ['init', '-q'], { cwd: repo })
  await run('git', ['config', 'user.email', 't@t.t'], { cwd: repo })
  await run('git', ['config', 'user.name', 't'], { cwd: repo })
  await run('git', ['add', '-A'], { cwd: repo })
  await run('git', ['commit', '-qm', 'committed while the user was reading'], { cwd: repo })

  // The user saw NO warnings when they checked this box.
  const m = await reap([reviewed(target, 4096)], ctx, OPTS(runsDir))

  assert.equal(m.items.length, 0, 'deleted a path that became git-tracked mid-review')
  assert.equal(await fs.access(target).then(() => true, () => false), true)
})

test('still deletes an item whose warning the user already saw and accepted', async () => {
  const { home, ctx, runsDir } = await sandbox()
  const target = path.join(home, 'Dropbox', 'proj', 'dist')
  await fs.mkdir(target, { recursive: true })

  const item = { ...reviewed(target, 4096), warnings: ['syncs to your other machines'] }
  const m = await reap([item], ctx, OPTS(runsDir))

  assert.equal(m.items.length, 1, 'ignored a choice the user made with full information')
})

test('writes a manifest that readManifests can read back', async () => {
  const { home, ctx, runsDir } = await sandbox()
  const target = path.join(home, 'proj', '.turbo')
  await fs.mkdir(target, { recursive: true })

  await reap([{ ...reviewed(target, 1234), label: '.turbo' }], ctx, OPTS(runsDir))
  const runs = await readManifests(runsDir)

  assert.equal(runs.length, 1)
  assert.equal(runs[0]?.freedBytes, 1234)
  assert.equal(runs[0]?.items[0]?.path, target)
  assert.equal(runs[0]?.version, '0.1.0')
})

test('readManifests returns an empty list when no runs exist', async () => {
  const { runsDir } = await sandbox()
  assert.deepEqual(await readManifests(runsDir), [])
})
