import { formatBytes } from '../util/bytes.ts'

/**
 * Live-progress rendering. Everything here is a pure string function so it
 * can be unit-tested; the only thing that touches the terminal is LiveLine,
 * and it refuses to animate when stdout is not a TTY.
 */

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export function spinnerFrame(tick: number): string {
  return FRAMES[tick % FRAMES.length] as string
}

export function barLine(done: number, total: number, width: number): string {
  const ratio = total > 0 ? Math.min(done / total, 1) : 0
  const filled = Math.round(ratio * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

export function scanLine(tick: number, sized: number, bytes: number): string {
  return `${spinnerFrame(tick)} scanning  ${sized} sized · ${formatBytes(bytes)} found`
}

export function reapLine(freedBytes: number, totalBytes: number): string {
  return `[${barLine(freedBytes, totalBytes, 24)}]  ${formatBytes(freedBytes)} / ${formatBytes(totalBytes)} freed`
}

/**
 * Two rows of half-block letters. The name is short enough that this stays
 * well under 40 columns and never wraps on a sane terminal.
 */
const MARK = ['█▀█ █ █ █▀█ █▀▀ █▀▀', '█▀▀ █▄█ █▀▄ █▄█ ██▄'] as const

export function wordmark(): string {
  return MARK.join('\n')
}

export function banner(version: string): string {
  return `${MARK[0]}\n${MARK[1]}  v${version} — say purge to the junk on your Mac`
}

/** Rewrites one terminal line in place. Inert (still safe to call) off-TTY. */
export function liveLine(stream: NodeJS.WriteStream) {
  const tty = stream.isTTY === true
  return {
    update(s: string) {
      if (tty) stream.write(`\r\x1b[2K${s}`)
    },
    done(finalText?: string) {
      if (!tty) return
      stream.write('\r\x1b[2K')
      if (finalText !== undefined) stream.write(`${finalText}\n`)
    },
  }
}
