import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { diskUsageBytes } from '../../src/util/du.ts'

async function fixture(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'purge-du-'))
}

test('measures allocated blocks, not logical size', async () => {
  const dir = await fixture()
  await fs.writeFile(path.join(dir, 'tiny.txt'), 'x')
  const bytes = await diskUsageBytes(dir)
  // A 1-byte file occupies at least one allocation unit on APFS.
  // If this returns 1, the implementation is wrongly using stat.size.
  assert.ok(bytes >= 4096, `expected >= 4096 allocated bytes, got ${bytes}`)
})

test('sums nested directories', async () => {
  const dir = await fixture()
  await fs.mkdir(path.join(dir, 'a', 'b'), { recursive: true })
  await fs.writeFile(path.join(dir, 'a', 'one.bin'), Buffer.alloc(100_000))
  await fs.writeFile(path.join(dir, 'a', 'b', 'two.bin'), Buffer.alloc(100_000))
  const bytes = await diskUsageBytes(dir)
  assert.ok(bytes >= 200_000, `expected >= 200000, got ${bytes}`)
})

test('does not follow symlinks out of the tree', async () => {
  const dir = await fixture()
  const outside = await fixture()
  await fs.writeFile(path.join(outside, 'big.bin'), Buffer.alloc(5_000_000))
  await fs.symlink(outside, path.join(dir, 'link'))
  const bytes = await diskUsageBytes(dir)
  assert.ok(bytes < 1_000_000, `symlink target was counted: ${bytes}`)
})

test('returns 0 for a missing path rather than throwing', async () => {
  assert.equal(await diskUsageBytes('/nonexistent/purge/path'), 0)
})
