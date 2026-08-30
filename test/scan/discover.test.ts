import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { discoverScanner } from '../../src/scan/discover.ts'
import type { ScanContext } from '../../src/scan/scanner.ts'

async function fakeHome(dirs: string[]): Promise<ScanContext> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'purge-home-'))
  for (const d of dirs) await fs.mkdir(path.join(home, d), { recursive: true })
  return { home, staleDays: 60, now: Date.now(), applicationDirs: [] }
}

test('claims junk-named subdirs inside hidden tool dirs it has never heard of', async () => {
  const ctx = await fakeHome(['.somenewtool/cache', '.othertool/tmp', '.thirdtool/data'])
  const got = await discoverScanner.probe(ctx, new Set())
  const labels = got.map((c) => c.label).sort()
  assert.deepEqual(labels, ['.othertool/tmp', '.somenewtool/cache'])
  assert.ok(got.every((c) => c.group === 'caches'))
  assert.ok(got.every((c) => c.note === 'auto-discovered'))
})

test('matches junk names case-insensitively so every Mac filesystem behaves the same', async () => {
  const ctx = await fakeHome(['.tool/Cache', '.othertool/TMP'])
  const got = await discoverScanner.probe(ctx, new Set())
  const labels = got.map((c) => c.label).sort()
  assert.deepEqual(labels, ['.othertool/TMP', '.tool/Cache'])
})

test('never probes identity dirs or dot dirs other scanners own', async () => {
  const ctx = await fakeHome(['.ssh/tmp', '.gnupg/cache', '.npm/cache', '.claude/cache', '.cache/tmp'])
  const got = await discoverScanner.probe(ctx, new Set())
  assert.deepEqual(got, [])
})

test('skips a path another scanner already claimed this scan', async () => {
  // .sometool is NOT on the skip list, so only the claimed set can save this
  const ctx = await fakeHome(['.sometool/cache'])
  const claimed = new Set([path.join(ctx.home, '.sometool/cache')])
  const got = await discoverScanner.probe(ctx, claimed)
  assert.deepEqual(got, [])
})

test('ignores junk-named plain files and non-hidden directories', async () => {
  const ctx = await fakeHome(['visible/cache', '.tool'])
  await fs.writeFile(path.join(ctx.home, '.tool', 'cache'), 'a file, not a dir')
  const got = await discoverScanner.probe(ctx, new Set())
  assert.deepEqual(got, [])
})

test('survives an empty home and a missing claimed set', async () => {
  const ctx = await fakeHome([])
  const got = await discoverScanner.probe(ctx)
  assert.deepEqual(got, [])
})
