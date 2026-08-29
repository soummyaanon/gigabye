import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { scan } from '../../src/scan/index.ts'
import type { ScanContext } from '../../src/scan/scanner.ts'

async function home(): Promise<ScanContext> {
  const h = await fs.mkdtemp(path.join(os.tmpdir(), 'gigabye-scan-'))
  return { home: h, staleDays: 60, now: Date.now(), applicationDirs: [] }
}

async function fill(dir: string, bytes: number) {
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, 'blob.bin'), Buffer.alloc(bytes))
}

test('finds build output and sizes it', async () => {
  const ctx = await home()
  await fill(path.join(ctx.home, 'proj', '.next'), 200_000)
  const got = await scan(ctx, { groups: ['builds'], minSizeBytes: 0 })
  const next = got.find((c) => c.label === '.next')
  assert.ok(next, '.next was not found')
  assert.ok(next.bytes >= 200_000, `size looks wrong: ${next.bytes}`)
})

test('respects the group filter', async () => {
  const ctx = await home()
  await fill(path.join(ctx.home, 'proj', '.next'), 200_000)
  await fill(path.join(ctx.home, '.npm', '_cacache'), 200_000)
  const got = await scan(ctx, { groups: ['pkg'], minSizeBytes: 0 })
  assert.ok(got.every((c) => c.group === 'pkg'), 'group filter leaked other groups')
})

test('drops candidates below the size floor', async () => {
  const ctx = await home()
  await fill(path.join(ctx.home, 'proj', '.next'), 100)
  const got = await scan(ctx, { groups: ['builds'], minSizeBytes: 10 * 1024 * 1024 })
  assert.deepEqual(got, [])
})

test('does not descend into a directory it already claimed', async () => {
  const ctx = await home()
  await fill(path.join(ctx.home, 'proj', '.next', 'cache', 'dist'), 100_000)
  await fs.writeFile(path.join(ctx.home, 'proj', '.next', 'cache', 'package.json'), '{}')
  const got = await scan(ctx, { groups: ['builds'], minSizeBytes: 0 })
  assert.equal(got.length, 1, 'claimed a nested candidate inside an already-claimed directory')
  assert.equal(got[0]?.label, '.next')
})

test('reports progress while scanning', async () => {
  const ctx = await home()
  await fill(path.join(ctx.home, 'proj', '.next'), 50_000)
  let calls = 0
  await scan(ctx, { groups: ['builds'], minSizeBytes: 0, onProgress: () => { calls++ } })
  assert.ok(calls > 0, 'onProgress was never called')
})
