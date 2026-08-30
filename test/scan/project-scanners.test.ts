import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { nodeModulesScanner } from '../../src/scan/node-modules.ts'
import { cargoScanner } from '../../src/scan/cargo.ts'
import { pythonScanner } from '../../src/scan/python.ts'
import type { ScanContext } from '../../src/scan/scanner.ts'
import type { DirVisit } from '../../src/scan/walker.ts'

const NOW = Date.UTC(2026, 7, 29)
const DAY = 86_400_000
const ctx: ScanContext = { home: '/Users/x', staleDays: 60, now: NOW, applicationDirs: [] }

function visit(p: string, over: Partial<DirVisit> = {}): DirVisit {
  const parts = p.split('/')
  return {
    path: p, name: parts[parts.length - 1] as string,
    parent: parts.slice(0, -1).join('/'), entries: [], parentEntries: [], ...over,
  }
}

async function project(files: Record<string, string>, mtimeDaysAgo: number): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'purge-proj-'))
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel)
    await fs.mkdir(path.dirname(full), { recursive: true })
    await fs.writeFile(full, body)
    const t = new Date(NOW - mtimeDaysAgo * DAY)
    await fs.utimes(full, t, t)
  }
  return root
}

test('claims node_modules in a project idle past the threshold', async () => {
  const root = await project({ 'index.js': 'x', 'node_modules/dep/i.js': 'y' }, 200)
  const got = await nodeModulesScanner.inspect(
    visit(path.join(root, 'node_modules'), { parent: root }), ctx,
  )
  assert.ok(got, 'stale node_modules was not claimed')
  assert.match(got.note ?? '', /idle \d+d/)
})

test('spares node_modules in an actively edited project', async () => {
  const root = await project({ 'index.js': 'x', 'node_modules/dep/i.js': 'y' }, 3)
  const got = await nodeModulesScanner.inspect(
    visit(path.join(root, 'node_modules'), { parent: root }), ctx,
  )
  assert.equal(got, null, 'claimed node_modules from an active project')
})

test('spares a monorepo whose only recent files are deep in packages/', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'purge-mono-'))
  // Root files are ancient; the real work is four levels down.
  for (const [rel, days] of [['README.md', 400], ['package.json', 400], ['packages/app/src/index.ts', 2]] as const) {
    const full = path.join(root, rel)
    await fs.mkdir(path.dirname(full), { recursive: true })
    await fs.writeFile(full, 'x')
    const t = new Date(NOW - days * DAY)
    await fs.utimes(full, t, t)
  }
  await fs.mkdir(path.join(root, 'node_modules'), { recursive: true })

  const got = await nodeModulesScanner.inspect(
    visit(path.join(root, 'node_modules'), { parent: root }), ctx,
  )
  assert.equal(got, null, 'claimed node_modules from an actively developed monorepo')
})

test('never claims nested node_modules', async () => {
  const got = await nodeModulesScanner.inspect(
    visit('/Users/x/p/node_modules/dep/node_modules', { parent: '/Users/x/p/node_modules/dep' }), ctx,
  )
  assert.equal(got, null)
})

test('claims cargo target only beside a Cargo.toml', async () => {
  const yes = await cargoScanner.inspect(visit('/Users/x/rs/target', { parentEntries: ['Cargo.toml', 'src'] }), ctx)
  assert.ok(yes)
  assert.equal(yes.label, 'target (cargo)')
  const no = await cargoScanner.inspect(visit('/Users/x/misc/target', { parentEntries: ['notes.md'] }), ctx)
  assert.equal(no, null)
})

test('claims a python venv only when it contains pyvenv.cfg', async () => {
  const yes = await pythonScanner.inspect(visit('/Users/x/py/.venv', { entries: ['pyvenv.cfg', 'bin'] }), ctx)
  assert.ok(yes)
  const no = await pythonScanner.inspect(visit('/Users/x/py/env', { entries: ['main.py'] }), ctx)
  assert.equal(no, null)
})
