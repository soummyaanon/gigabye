import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
const CLI = path.resolve(import.meta.dirname, '..', 'src', 'cli.ts')

async function sandboxHome(): Promise<string> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'gigabye-e2e-'))
  const junk = path.join(home, 'proj', '.next')
  await fs.mkdir(junk, { recursive: true })
  await fs.writeFile(path.join(junk, 'chunk.js'), Buffer.alloc(2_000_000))
  return home
}

function invoke(args: string[], home: string) {
  return run('node', [CLI, ...args], { env: { ...process.env, HOME: home }, cwd: home })
}

test('--json reports the junk it found without deleting it', async () => {
  const home = await sandboxHome()
  const { stdout } = await invoke(['--json', 'builds', '--min-size', '0'], home)
  const parsed = JSON.parse(stdout) as { reclaimableBytes: number; items: Array<{ path: string }> }

  assert.ok(parsed.reclaimableBytes >= 2_000_000, `found nothing: ${stdout}`)
  assert.ok(parsed.items.some((i) => i.path.endsWith('.next')))
  assert.equal(
    await fs.access(path.join(home, 'proj', '.next')).then(() => true, () => false), true,
    '--json deleted something',
  )
})

test('--dry-run prints a report and deletes nothing', async () => {
  const home = await sandboxHome()
  const { stdout } = await invoke(['--dry-run', 'builds', '--min-size', '0'], home)
  assert.match(stdout, /BUILD ARTIFACTS/)
  assert.equal(
    await fs.access(path.join(home, 'proj', '.next')).then(() => true, () => false), true,
    '--dry-run deleted something',
  )
})

test('--yes deletes and writes a manifest', async () => {
  const home = await sandboxHome()
  await invoke(['--yes', 'builds', '--min-size', '0'], home)

  assert.equal(
    await fs.access(path.join(home, 'proj', '.next')).then(() => true, () => false), false,
    '--yes did not delete',
  )
  const runs = await fs.readdir(path.join(home, '.gigabye', 'runs'))
  assert.equal(runs.length, 1, 'no manifest written')
})

test('history reads back the run that just happened', async () => {
  const home = await sandboxHome()
  await invoke(['--yes', 'builds', '--min-size', '0'], home)
  const { stdout } = await invoke(['history'], home)
  assert.match(stdout, /lifetime reclaimed/)
  assert.match(stdout, /builds/)
})

test('--help exits 0 and names every group', async () => {
  const { stdout } = await invoke(['--help'], await sandboxHome())
  for (const g of ['builds', 'pkg', 'xcode', 'browsers', 'editors', 'orphans']) {
    assert.match(stdout, new RegExp(g))
  }
})

test('an unknown option exits non-zero with a useful message', async () => {
  const home = await sandboxHome()
  await assert.rejects(
    () => invoke(['--nonsense'], home),
    (e: { code?: number; stderr?: string }) => {
      assert.equal(e.code, 1)
      assert.match(e.stderr ?? '', /unknown option/)
      return true
    },
  )
})
