import readline from 'node:readline'
import os from 'node:os'
import type { Reviewed } from '../types.ts'
import { initState, reduce, renderFrame, type TuiState } from './tui-state.ts'
import { wordmark } from './progress.ts'

// The escape character MUST be written as \x1b. A literal ESC byte pasted
// into source is invisible in most editors and silently lost when the file is
// copied through tooling — which produces a TUI that prints '[?1049h[2J[H'
// instead of drawing, and never restores the terminal.
const ALT_ENTER = '\x1b[?1049h'
const ALT_EXIT = '\x1b[?1049l'
const HIDE_CURSOR = '\x1b[?25l'
const SHOW_CURSOR = '\x1b[?25h'
const CLEAR = '\x1b[2J\x1b[H'

function keyName(str: string, key: { name?: string; ctrl?: boolean }): string | null {
  if (key.ctrl && key.name === 'c') return 'q'
  switch (key.name) {
    case 'up': case 'k': return 'up'
    case 'down': case 'j': return 'down'
    case 'return': return 'enter'
    case 'space': return 'space'
    case 'q': case 'escape': return 'q'
    case 'a': return 'a'
    default: return str === ' ' ? 'space' : null
  }
}

/**
 * Full-screen checkbox review. Resolves with the user's selection, or null
 * if they quit. Restores the terminal on every exit path, including SIGINT.
 */
export function review(items: Reviewed[]): Promise<Reviewed[] | null> {
  return new Promise((resolve) => {
    const out = process.stdout
    let state: TuiState = initState(items)

    const draw = () => {
      out.write(CLEAR)
      const color = out.isTTY === true
      // Wordmark takes 3 rows (2 letters + 1 blank); the frame gets the rest.
      out.write(`${color ? '\x1b[2m' : ''}${wordmark()}${color ? '\x1b[0m' : ''}\n\n`)
      out.write(renderFrame(state, Math.max((out.rows ?? 24) - 3, 8), { color, home: os.homedir() }))
    }

    const restore = () => {
      process.stdin.setRawMode?.(false)
      process.stdin.pause()
      out.write(SHOW_CURSOR)
      out.write(ALT_EXIT)
      process.off('SIGINT', onSigint)
    }

    const onSigint = () => { restore(); resolve(null) }

    readline.emitKeypressEvents(process.stdin)
    process.stdin.setRawMode?.(true)
    process.stdin.resume()
    out.write(ALT_ENTER)
    out.write(HIDE_CURSOR)
    process.on('SIGINT', onSigint)

    process.stdin.on('keypress', (str: string, key: { name?: string; ctrl?: boolean }) => {
      const name = keyName(str, key ?? {})
      if (name === null) return
      state = reduce(state, name)
      if (state.done === 'quit') { restore(); return resolve(null) }
      if (state.done === 'confirm') { restore(); return resolve(state.items) }
      draw()
    })

    draw()
  })
}
