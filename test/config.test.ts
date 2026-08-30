import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadConfig } from '../src/config.ts'

async function home(body?: string): Promise<string> {
  const h = await fs.mkdtemp(path.join(os.tmpdir(), 'purge-cfg-'))
  if (body !== undefined) await fs.writeFile(path.join(h, '.purgerc'), body)
  return h
}

test('returns empty defaults when no config file exists', async () => {
  assert.deepEqual(await loadConfig(await home()), { keep: [] })
})

test('reads keep globs and numeric overrides', async () => {
  const h = await home(JSON.stringify({ keep: ['**/work/**'], staleDays: 90, minSize: 25 }))
  const c = await loadConfig(h)
  assert.deepEqual(c.keep, ['**/work/**'])
  assert.equal(c.staleDays, 90)
  assert.equal(c.minSize, 25)
})

test('expands a leading ~ in keep globs', async () => {
  const h = await home(JSON.stringify({ keep: ['~/Developer/client/**', '**/work/**'] }))
  const c = await loadConfig(h)
  assert.deepEqual(c.keep, [`${h}/Developer/client/**`, '**/work/**'])
})

test('a keep glob that could never match an absolute path is still kept verbatim', async () => {
  const h = await home(JSON.stringify({ keep: ['**/work/**'] }))
  assert.deepEqual((await loadConfig(h)).keep, ['**/work/**'])
})

test('a malformed config falls back to defaults rather than crashing', async () => {
  assert.deepEqual(await loadConfig(await home('{ not json')), { keep: [] })
})

test('ignores a keep field that is not an array of strings', async () => {
  const c = await loadConfig(await home(JSON.stringify({ keep: 'nope' })))
  assert.deepEqual(c.keep, [])
})
