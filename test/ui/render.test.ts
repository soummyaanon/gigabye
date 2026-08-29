import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderReport, renderJson, renderSummary } from '../../src/ui/render.ts'
import type { Reviewed, RunManifest } from '../../src/types.ts'

function item(over: Partial<Reviewed> = {}): Reviewed {
  return {
    path: '/Users/x/proj/.next', label: '.next', group: 'builds',
    bytes: 1_181_116_006, selected: true, warnings: [], ...over,
  }
}

const NO_COLOR = { color: false, home: '/Users/x' }

test('groups items under headers with a group total', () => {
  const out = renderReport([item(), item({ group: 'pkg', label: 'npm cache', bytes: 1024 * 1024 })], NO_COLOR)
  assert.match(out, /BUILD ARTIFACTS/)
  assert.match(out, /PACKAGE CACHES/)
  assert.match(out, /1\.1 GB/)
})

test('shows warnings beside downgraded items', () => {
  const out = renderReport([item({ selected: false, warnings: ['tracked in git'] })], NO_COLOR)
  assert.match(out, /tracked in git/)
})

test('abbreviates the home directory as a tilde', () => {
  const out = renderReport([item()], NO_COLOR)
  assert.ok(!out.includes('/Users/x/proj'), 'raw home path leaked into output')
  assert.match(out, /~\/proj\/\.next/)
})

test('emits no ANSI escapes when color is off', () => {
  const out = renderReport([item()], NO_COLOR)
  assert.ok(!/\x1b\[/.test(out), 'ANSI escapes present with color disabled')
})

test('json output is parseable and carries the fields the spec documents', () => {
  const parsed = JSON.parse(renderJson([item()])) as {
    reclaimableBytes: number
    items: Array<{ path: string; bytes: number; group: string; selected: boolean }>
  }
  assert.equal(parsed.reclaimableBytes, 1_181_116_006)
  assert.equal(parsed.items[0]?.group, 'builds')
  assert.equal(parsed.items[0]?.selected, true)
})

test('summary states what was reclaimed', () => {
  const m: RunManifest = {
    ts: '2026-08-29T11:04:22Z', version: '0.1.0', freedBytes: 6_553_600_000,
    groups: ['builds'], items: [],
  }
  assert.match(renderSummary(m, NO_COLOR), /6\.1 GB/)
})
