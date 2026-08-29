import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { walk } from '../../src/scan/walker.ts'

async function tree(spec: string[]): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gigabye-walk-'))
  for (const rel of spec) await fs.mkdir(path.join(root, rel), { recursive: true })
  return root
}

test('visits every directory', async () => {
  const root = await tree(['a/b', 'c'])
  const seen: string[] = []
  await walk(root, (v) => { seen.push(path.relative(root, v.path)); return { prune: false } })
  assert.deepEqual(seen.sort(), ['a', 'a/b', 'c'])
})

test('prune stops descent into that directory', async () => {
  const root = await tree(['a/b/c'])
  const seen: string[] = []
  await walk(root, (v) => {
    seen.push(path.relative(root, v.path))
    return { prune: v.name === 'b' }
  })
  assert.deepEqual(seen.sort(), ['a', 'a/b'])
  assert.ok(!seen.includes('a/b/c'), 'descended past a pruned directory')
})

test('never descends into .git or .Trash', async () => {
  const root = await tree(['.git/objects', '.Trash/old', 'keep'])
  const seen: string[] = []
  await walk(root, (v) => { seen.push(path.relative(root, v.path)); return { prune: false } })
  assert.ok(!seen.some((p) => p.startsWith('.git')), '.git was walked')
  assert.ok(!seen.some((p) => p.startsWith('.Trash')), '.Trash was walked')
  assert.ok(seen.includes('keep'))
})

test('visits node_modules but never descends into it', async () => {
  const root = await tree(['proj/node_modules/next/dist'])
  const seen: string[] = []
  await walk(root, (v) => { seen.push(path.relative(root, v.path)); return { prune: false } })
  assert.ok(seen.includes('proj/node_modules'), 'node_modules was not visited')
  assert.ok(
    !seen.some((p) => p.includes('node_modules/next')),
    'walker descended into node_modules — dependency dist/ dirs would be claimed',
  )
})

test('honours the skip predicate', async () => {
  const root = await tree(['Library/Caches/thing', 'Developer/p'])
  const seen: string[] = []
  await walk(
    root,
    (v) => { seen.push(path.relative(root, v.path)); return { prune: false } },
    { skip: (_abs, name) => name === 'Library' },
  )
  assert.ok(!seen.some((p) => p.startsWith('Library')), 'skip predicate was ignored')
  assert.ok(seen.includes('Developer'))
})

test('does not follow directory symlinks', async () => {
  const root = await tree(['real/deep'])
  await fs.symlink(path.join(root, 'real'), path.join(root, 'link'))
  const seen: string[] = []
  await walk(root, (v) => { seen.push(path.relative(root, v.path)); return { prune: false } })
  assert.ok(!seen.includes('link'), 'followed a symlink')
})

test('exposes entry names of each directory', async () => {
  const root = await tree(['proj/dist'])
  await fs.writeFile(path.join(root, 'proj', 'package.json'), '{}')
  let entries: string[] = []
  await walk(root, (v) => {
    if (v.name === 'proj') entries = [...v.entries].sort()
    return { prune: false }
  })
  assert.deepEqual(entries, ['dist', 'package.json'])
})

test('survives an unreadable directory', async () => {
  const root = await tree(['locked', 'fine'])
  await fs.chmod(path.join(root, 'locked'), 0o000)
  const seen: string[] = []
  await walk(root, (v) => { seen.push(path.relative(root, v.path)); return { prune: false } })
  await fs.chmod(path.join(root, 'locked'), 0o755)
  assert.ok(seen.includes('fine'))
})
