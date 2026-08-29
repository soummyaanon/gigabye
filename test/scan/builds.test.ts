import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildsScanner } from '../../src/scan/builds.ts'
import type { DirVisit } from '../../src/scan/walker.ts'
import type { ScanContext } from '../../src/scan/scanner.ts'

const ctx: ScanContext = { home: '/Users/x', staleDays: 60, now: Date.now(), applicationDirs: [] }

function visit(p: string, over: Partial<DirVisit> = {}): DirVisit {
  const parts = p.split('/')
  return {
    path: p, name: parts[parts.length - 1] as string,
    parent: parts.slice(0, -1).join('/'), entries: [], parentEntries: [], ...over,
  }
}

test('claims unambiguous framework output directories', async () => {
  for (const name of ['.next', '.turbo', '.parcel-cache', '.svelte-kit', '.astro']) {
    const got = await buildsScanner.inspect(visit(`/Users/x/proj/${name}`), ctx)
    assert.ok(got, `${name} was not claimed`)
    assert.equal(got.label, name)
    assert.equal(got.group, 'builds')
  }
})

test('claims dist when the parent has a package.json', async () => {
  const got = await buildsScanner.inspect(
    visit('/Users/x/proj/dist', { parentEntries: ['package.json', 'dist'] }),
    ctx,
  )
  assert.ok(got)
  assert.equal(got.label, 'dist')
})

test('ignores build directories with no manifest beside them', async () => {
  const got = await buildsScanner.inspect(
    visit('/Users/x/docs/build', { parentEntries: ['index.md'] }),
    ctx,
  )
  assert.equal(got, null)
})

test('ignores directories it does not recognise', async () => {
  assert.equal(await buildsScanner.inspect(visit('/Users/x/proj/src'), ctx), null)
})
