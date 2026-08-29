import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { annotateGitStatus } from '../../src/guard/git.ts'
import type { Candidate } from '../../src/types.ts'

const run = promisify(execFile)

async function repo(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gigabye-git-'))
  await run('git', ['init', '-q'], { cwd: dir })
  await run('git', ['config', 'user.email', 't@t.t'], { cwd: dir })
  await run('git', ['config', 'user.name', 't'], { cwd: dir })
  return dir
}

function cand(p: string): Candidate {
  return { path: p, label: 'dist', group: 'builds', bytes: 1024 }
}

test('reports an ignored directory as ignored', async () => {
  const dir = await repo()
  await fs.writeFile(path.join(dir, '.gitignore'), 'dist/\n')
  await fs.mkdir(path.join(dir, 'dist'))
  await fs.writeFile(path.join(dir, 'dist', 'out.js'), 'x')
  const map = await annotateGitStatus([cand(path.join(dir, 'dist'))])
  assert.equal(map.get(path.resolve(dir, 'dist')), true)
})

test('reports a committed directory as NOT ignored', async () => {
  const dir = await repo()
  await fs.mkdir(path.join(dir, 'dist'))
  await fs.writeFile(path.join(dir, 'dist', 'out.js'), 'x')
  await run('git', ['add', '-A'], { cwd: dir })
  await run('git', ['commit', '-qm', 'ship dist'], { cwd: dir })
  const map = await annotateGitStatus([cand(path.join(dir, 'dist'))])
  assert.equal(map.get(path.resolve(dir, 'dist')), false)
})

test('reports an untracked, unignored directory as NOT ignored', async () => {
  const dir = await repo()
  await fs.mkdir(path.join(dir, 'dist'))
  const map = await annotateGitStatus([cand(path.join(dir, 'dist'))])
  assert.equal(map.get(path.resolve(dir, 'dist')), false)
})

test('treats a path in no repository as ignored (guard does not apply)', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gigabye-nogit-'))
  await fs.mkdir(path.join(dir, 'dist'))
  const map = await annotateGitStatus([cand(path.join(dir, 'dist'))])
  assert.equal(map.get(path.resolve(dir, 'dist')), true)
})

test('batches many paths from one repo into a single result', async () => {
  const dir = await repo()
  await fs.writeFile(path.join(dir, '.gitignore'), 'a/\n')
  for (const n of ['a', 'b']) await fs.mkdir(path.join(dir, n))
  const map = await annotateGitStatus([cand(path.join(dir, 'a')), cand(path.join(dir, 'b'))])
  assert.equal(map.get(path.resolve(dir, 'a')), true)
  assert.equal(map.get(path.resolve(dir, 'b')), false)
})
