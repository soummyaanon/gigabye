import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initState, reduce, selectedBytes } from '../../src/ui/tui-state.ts'
import type { Reviewed } from '../../src/types.ts'

function items(): Reviewed[] {
  return [
    { path: '/h/a/.next', label: '.next', group: 'builds', bytes: 1000, selected: true, selectable: true, warnings: [] },
    { path: '/h/b/dist', label: 'dist', group: 'builds', bytes: 500, selected: false, selectable: true, warnings: ['tracked in git'] },
    { path: '/h/.npm/_cacache', label: 'npm cache', group: 'pkg', bytes: 300, selected: true, selectable: true, warnings: [] },
  ]
}

test('builds a row list with a header per group', () => {
  const s = initState(items())
  const headers = s.rows.filter((r) => r.kind === 'header')
  assert.equal(headers.length, 2)
  assert.equal(s.rows.length, 5)
})

test('the cursor starts on the first selectable item, not a header', () => {
  const s = initState(items())
  assert.equal(s.rows[s.cursor]?.kind, 'item')
})

test('the cursor skips headers when moving', () => {
  let s = initState(items())
  for (let i = 0; i < 4; i++) s = reduce(s, 'down')
  assert.equal(s.rows[s.cursor]?.kind, 'item', 'cursor landed on a header')
})

test('the cursor stops at the ends rather than wrapping', () => {
  let s = initState(items())
  for (let i = 0; i < 20; i++) s = reduce(s, 'up')
  assert.equal(s.rows[s.cursor]?.kind, 'item')
  for (let i = 0; i < 20; i++) s = reduce(s, 'down')
  assert.equal(s.rows[s.cursor]?.kind, 'item')
})

test('space toggles the item under the cursor', () => {
  const s0 = initState(items())
  const before = s0.items[0]?.selected
  const s1 = reduce(s0, 'space')
  assert.equal(s1.items[0]?.selected, !before)
})

test('space does not mutate the previous state', () => {
  const s0 = initState(items())
  reduce(s0, 'space')
  assert.equal(s0.items[0]?.selected, true, 'reducer mutated its input')
})

test('a selects everything and a second a clears everything', () => {
  let s = reduce(initState(items()), 'a')
  assert.ok(s.items.every((i) => i.selected))
  s = reduce(s, 'a')
  assert.ok(s.items.every((i) => !i.selected))
})

test('selectedBytes sums only checked items', () => {
  const s = initState(items())
  assert.equal(selectedBytes(s), 1300)
  assert.equal(selectedBytes(reduce(s, 'a')), 1800)
})

test('enter confirms and q quits', () => {
  assert.equal(reduce(initState(items()), 'enter').done, 'confirm')
  assert.equal(reduce(initState(items()), 'q').done, 'quit')
})

test('an unknown key changes nothing', () => {
  const s0 = initState(items())
  const s1 = reduce(s0, 'z')
  assert.deepEqual(s1.items, s0.items)
  assert.equal(s1.cursor, s0.cursor)
})

function withOrphan(): Reviewed[] {
  return [
    ...items(),
    { path: '/h/Library/Application Support/Slack', label: 'Slack', group: 'orphans', bytes: 900, selected: false, selectable: false, warnings: ['review manually'] },
  ]
}

test('space never toggles a report-only row', () => {
  let s = initState(withOrphan())
  // walk the cursor onto the orphan row (last item row)
  for (let i = 0; i < 10; i++) s = reduce(s, 'down')
  const orphan = s.items.findIndex((i) => i.group === 'orphans')
  s = reduce(s, 'space')
  assert.equal(s.items[orphan]?.selected, false, 'a report-only item was toggled on')
})

test('select-all never selects a report-only row', () => {
  const s = reduce(initState(withOrphan()), 'a')
  const orphan = s.items.find((i) => i.group === 'orphans')
  assert.equal(orphan?.selected, false, 'select-all checked a report-only item')
  assert.ok(s.items.filter((i) => i.selectable).every((i) => i.selected), 'select-all missed selectable items')
})

test('selectedBytes never counts a report-only row', () => {
  const s = reduce(initState(withOrphan()), 'a')
  assert.equal(selectedBytes(s), 1800, 'report-only bytes leaked into the selected total')
})
