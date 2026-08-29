import type { Group, Reviewed } from '../types.ts'
import { formatBytes } from '../util/bytes.ts'
import { tildify } from './render.ts'

export type Row =
  | { kind: 'header'; group: Group; bytes: number }
  | { kind: 'item'; index: number }

export type TuiState = {
  items: Reviewed[]
  rows: Row[]
  cursor: number
  done: 'pending' | 'confirm' | 'quit'
}

const HEADERS: Record<Group, string> = {
  builds: 'BUILD ARTIFACTS', pkg: 'PACKAGE CACHES', xcode: 'XCODE',
  browsers: 'BROWSER CACHES', editors: 'EDITOR CACHES', orphans: 'ORPHANED APP DATA',
}

const ORDER: Group[] = ['builds', 'pkg', 'xcode', 'browsers', 'editors', 'orphans']

export function initState(items: Reviewed[]): TuiState {
  const rows: Row[] = []
  for (const group of ORDER) {
    const indices = items.map((it, i) => [it, i] as const).filter(([it]) => it.group === group)
    if (indices.length === 0) continue
    rows.push({ kind: 'header', group, bytes: indices.reduce((n, [it]) => n + it.bytes, 0) })
    for (const [, i] of indices) rows.push({ kind: 'item', index: i })
  }
  const cursor = rows.findIndex((r) => r.kind === 'item')
  return { items, rows, cursor: cursor === -1 ? 0 : cursor, done: 'pending' }
}

/** Next row of kind 'item' in `dir`, or the current one if there is none. */
function step(s: TuiState, dir: 1 | -1): number {
  for (let i = s.cursor + dir; i >= 0 && i < s.rows.length; i += dir) {
    if (s.rows[i]?.kind === 'item') return i
  }
  return s.cursor
}

export function selectedBytes(s: TuiState): number {
  return s.items.filter((i) => i.selected).reduce((n, i) => n + i.bytes, 0)
}

/** Pure. Never mutates `s` — the tests depend on this. */
export function reduce(s: TuiState, key: string): TuiState {
  switch (key) {
    case 'up': return { ...s, cursor: step(s, -1) }
    case 'down': return { ...s, cursor: step(s, 1) }
    case 'space': {
      const row = s.rows[s.cursor]
      if (row?.kind !== 'item') return s
      const items = s.items.map((it, i) => (i === row.index ? { ...it, selected: !it.selected } : it))
      return { ...s, items }
    }
    case 'a': {
      const allOn = s.items.every((i) => i.selected)
      return { ...s, items: s.items.map((i) => ({ ...i, selected: !allOn })) }
    }
    case 'enter': return { ...s, done: 'confirm' }
    case 'q': return { ...s, done: 'quit' }
    default: return s
  }
}

/** One full screen of output. `height` is the terminal row count. */
export function renderFrame(
  s: TuiState, height: number, opts: { color: boolean; home: string },
): string {
  const paint = opts.color
    ? (code: string, str: string) => `\x1b[${code}m${str}\x1b[0m`
    : (_code: string, str: string) => str

  const body = Math.max(3, height - 4)
  const start = Math.max(0, Math.min(s.cursor - Math.floor(body / 2), s.rows.length - body))
  const lines: string[] = []

  for (let i = start; i < Math.min(start + body, s.rows.length); i++) {
    const row = s.rows[i]
    if (row === undefined) break
    if (row.kind === 'header') {
      lines.push(`${paint('1', HEADERS[row.group])}  ${paint('2', formatBytes(row.bytes))}`)
      continue
    }
    const it = s.items[row.index]
    if (it === undefined) continue
    const here = i === s.cursor
    const box = it.selected ? '[x]' : '[ ]'
    // Same de-duplication as renderReport: a warning that repeats the note
    // verbatim must not print the text twice.
    const note = it.note && !it.warnings.includes(it.note) ? paint('2', `  ${it.note}`) : ''
    const warn = it.warnings.length > 0 ? paint('33', `  ! ${it.warnings.join(', ')}`) : ''
    const text = ` ${box} ${formatBytes(it.bytes).padStart(9)}  ${tildify(it.path, opts.home)}${note}${warn}`
    lines.push(here ? paint('7', text) : text)
  }

  lines.push('')
  lines.push(paint('2', '  space toggle   a all   enter continue   q quit'))
  lines.push(paint('1', `  selected: ${formatBytes(selectedBytes(s))}`))
  return lines.join('\n')
}
