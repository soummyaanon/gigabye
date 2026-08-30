import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { orphansScanner } from '../../src/scan/orphans.ts'
import type { ScanContext } from '../../src/scan/scanner.ts'

async function home(dirs: string[]): Promise<ScanContext> {
  const h = await fs.mkdtemp(path.join(os.tmpdir(), 'purge-orph-'))
  for (const d of dirs) await fs.mkdir(path.join(h, d), { recursive: true })
  // applicationDirs is empty so the result never depends on what the
  // developer running the tests happens to have installed.
  return { home: h, staleDays: 60, now: Date.now(), applicationDirs: [] }
}

test('reports app data whose application is not installed', async () => {
  const ctx = await home(['Library/Application Support/Slack'])
  const got = await orphansScanner.probe(ctx)
  const slack = got.find((c) => c.path.endsWith('/Slack'))
  assert.ok(slack, 'orphaned Slack data not reported')
  assert.equal(slack.group, 'orphans')
  assert.match(slack.note ?? '', /not installed/)
})

test('stays silent when the application directory is absent', async () => {
  const ctx = await home(['Library/Application Support/SomethingElse'])
  const got = await orphansScanner.probe(ctx)
  assert.equal(got.length, 0)
})
