import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatBytes } from '../../src/util/bytes.ts'

test('formats bytes below a kilobyte', () => {
  assert.equal(formatBytes(0), '0 B')
  assert.equal(formatBytes(512), '512 B')
})

test('formats megabytes with no decimal', () => {
  assert.equal(formatBytes(5 * 1024 * 1024), '5 MB')
  assert.equal(formatBytes(1024 * 1024), '1 MB')
})

test('formats gigabytes with one decimal', () => {
  assert.equal(formatBytes(2.5 * 1024 * 1024 * 1024), '2.5 GB')
  assert.equal(formatBytes(41.3 * 1024 * 1024 * 1024), '41.3 GB')
})

test('rounds kilobytes to whole numbers', () => {
  assert.equal(formatBytes(1536), '2 KB')
})
