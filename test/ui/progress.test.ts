import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spinnerFrame, barLine, scanLine, banner } from '../../src/ui/progress.ts'

test('spinner cycles through distinct frames and wraps around', () => {
  const a = spinnerFrame(0)
  const b = spinnerFrame(1)
  assert.notEqual(a, b)
  assert.equal(spinnerFrame(0), spinnerFrame(10)) // 10 frames, wraps
})

test('bar fills proportionally and clamps at the ends', () => {
  assert.equal(barLine(0, 100, 10), '░'.repeat(10))
  assert.equal(barLine(50, 100, 10), '█'.repeat(5) + '░'.repeat(5))
  assert.equal(barLine(100, 100, 10), '█'.repeat(10))
  assert.equal(barLine(150, 100, 10), '█'.repeat(10), 'over-total must clamp')
  assert.equal(barLine(5, 0, 10), '░'.repeat(10), 'zero total must not divide by zero')
})

test('scan line reports count and cumulative size', () => {
  const line = scanLine(3, 17, 3.2 * 1024 ** 3)
  assert.match(line, /17 sized/)
  assert.match(line, /3\.2 GB/)
  assert.equal(line.startsWith(spinnerFrame(3)), true)
})

test('banner is two rows of block letters plus the version', () => {
  const lines = banner('0.2.0').split('\n')
  assert.equal(lines.length, 2)
  assert.match(banner('0.2.0'), /v0\.2\.0/)
})
