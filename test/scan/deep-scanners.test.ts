import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { sysCachesScanner } from '../../src/scan/sys-caches.ts'
import { logsScanner } from '../../src/scan/logs.ts'
import { heavyScanner } from '../../src/scan/heavy.ts'
import { claudeScanner } from '../../src/scan/claude.ts'
import type { ScanContext } from '../../src/scan/scanner.ts'

async function fakeHome(dirs: string[]): Promise<ScanContext> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'purge-home-'))
  for (const d of dirs) await fs.mkdir(path.join(home, d), { recursive: true })
  return { home, staleDays: 60, now: Date.now(), applicationDirs: [] }
}

test('enumerates per-app cache dirs under Library/Caches and .cache', async () => {
  const ctx = await fakeHome([
    'Library/Caches/com.apple.Safari',
    'Library/Caches/JetBrains',
    '.cache/uv',
  ])
  const got = await sysCachesScanner.probe(ctx)
  const labels = got.map((c) => c.label).sort()
  assert.deepEqual(labels, ['.cache/uv', 'JetBrains', 'com.apple.Safari'])
  assert.ok(got.every((c) => c.group === 'caches'))
})

test('skips cache entries the pkg scanner already claims', async () => {
  const ctx = await fakeHome([
    'Library/Caches/Homebrew',
    'Library/Caches/ms-playwright',
    'Library/Caches/SomeApp',
  ])
  const got = await sysCachesScanner.probe(ctx)
  assert.deepEqual(got.map((c) => c.label), ['SomeApp'])
})

test('ignores plain files in the cache roots', async () => {
  const ctx = await fakeHome(['Library/Caches/RealApp'])
  await fs.writeFile(path.join(ctx.home, 'Library/Caches/.DS_Store'), 'junk')
  const got = await sysCachesScanner.probe(ctx)
  assert.deepEqual(got.map((c) => c.label), ['RealApp'])
})

test('survives a home with no cache roots at all', async () => {
  const ctx = await fakeHome([])
  const got = await sysCachesScanner.probe(ctx)
  assert.deepEqual(got, [])
})

test('reports each iOS backup, the Trash and Docker.raw as heavy items', async () => {
  const ctx = await fakeHome([
    'Library/Application Support/MobileSync/Backup/00008110-000A1',
    'Library/Application Support/MobileSync/Backup/00008120-000B2',
    '.Trash',
    'Library/Containers/com.docker.docker/Data/vms/0/data',
  ])
  await fs.writeFile(
    path.join(ctx.home, 'Library/Containers/com.docker.docker/Data/vms/0/data/Docker.raw'),
    'vm',
  )
  const got = await heavyScanner.probe(ctx)
  const labels = got.map((c) => c.label).sort()
  assert.deepEqual(labels, [
    '.Trash', 'Docker.raw', 'iOS backup 00008110-000A1', 'iOS backup 00008120-000B2',
  ])
  assert.ok(got.every((c) => c.group === 'heavy'))
})

test('claims Claude Desktop caches but never its settings or storage', async () => {
  const ctx = await fakeHome([
    'Library/Application Support/Claude/Cache',
    'Library/Application Support/Claude/GPUCache',
    'Library/Application Support/Claude/Local Storage',
    'Library/Application Support/Claude/IndexedDB',
  ])
  const got = await claudeScanner.probe(ctx)
  const labels = got.map((c) => c.label).sort()
  assert.deepEqual(labels, ['Claude Desktop Cache', 'Claude Desktop GPUCache'])
  assert.ok(got.every((c) => c.group === 'claude'))
})

test('claims Claude Code caches, transcripts and file history', async () => {
  const ctx = await fakeHome([
    '.claude/plugins/cache',
    '.claude/plugins/repos',
    '.claude/cache',
    '.claude/paste-cache',
    '.claude/projects',
    '.claude/file-history',
    '.claude/skills',
    '.claude/agents',
  ])
  const got = await claudeScanner.probe(ctx)
  const labels = got.map((c) => c.label).sort()
  assert.deepEqual(labels, [
    'Claude Code file history',
    'Claude Code paste cache',
    'Claude Code plugin cache',
    'Claude Code session transcripts',
    'Claude Code shared cache',
  ])
})

test('claims the sandbox scratchpad root when it exists', async () => {
  const ctx = await fakeHome([])
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'purge-claude-tmp-'))
  const got = await claudeScanner.probe({ ...ctx, claudeTmpDir: tmp })
  assert.deepEqual(got.map((c) => c.label), ['Claude Code session scratchpads'])
  assert.equal(got[0]?.path, tmp)
})

test('heavy scanner finds nothing on a lean home', async () => {
  const ctx = await fakeHome([])
  assert.deepEqual(await heavyScanner.probe(ctx), [])
})

test('enumerates per-app log dirs under Library/Logs', async () => {
  const ctx = await fakeHome(['Library/Logs/Claude', 'Library/Logs/JetBrains'])
  await fs.writeFile(path.join(ctx.home, 'Library/Logs/stray.log'), 'x')
  const got = await logsScanner.probe(ctx)
  const labels = got.map((c) => c.label).sort()
  assert.deepEqual(labels, ['Claude', 'JetBrains'])
  assert.ok(got.every((c) => c.group === 'logs'))
})
