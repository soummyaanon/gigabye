import fs from 'node:fs/promises'
import path from 'node:path'
import { exists } from '../util/exists.ts'
import type { PathScanner, RawCandidate } from './scanner.ts'

/**
 * Caches, logs and scratch data of every coding agent found on the machine.
 * Config, credentials, installed extensions and plugins are never claimed.
 * Session-state paths (.claude/projects, .claude/file-history,
 * .codex/sessions, .codex/history.jsonl, .gemini/tmp, and the Claude
 * scratchpad) ARE claimed but the fragile guard downgrades them, so they
 * arrive unchecked with a warning.
 */

/**
 * Claude Desktop is Electron; the same cache subdirs as the editors scanner
 * apply. 'Local Storage', 'IndexedDB' and 'Session Storage' hold login state
 * and app data and are deliberately absent.
 */
const CLAUDE_DESKTOP_CACHES = [
  'Cache', 'Code Cache', 'GPUCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'Crashpad',
]

/** Fixed home-relative probes: path → label. */
const AGENT_DIRS: Array<[string, string]> = [
  // Claude Code — projects and file-history are session history (downgraded).
  ['.claude/plugins/cache', 'Claude Code plugin cache'],
  ['.claude/cache', 'Claude Code shared cache'],
  ['.claude/paste-cache', 'Claude Code paste cache'],
  ['.claude/projects', 'Claude Code session transcripts'],
  ['.claude/file-history', 'Claude Code file history'],
  // Codex — sessions and history.jsonl are session history (downgraded).
  ['.codex/cache', 'Codex cache'],
  ['.codex/sessions', 'Codex sessions'],
  ['.codex/history.jsonl', 'Codex history'],
  // Cursor's agent-side data. Extensions and plugins are installed software.
  ['.cursor/ai-tracking', 'Cursor AI tracking'],
  // The rest, probed only where present.
  ['.gemini/tmp', 'Gemini CLI tmp'],
  ['.copilot/logs', 'Copilot CLI logs'],
  ['.aider/caches', 'aider cache'],
  ['.local/share/opencode/log', 'opencode logs'],
]

export const agentsScanner: PathScanner = {
  name: 'agents',
  group: 'agents',
  async probe(ctx) {
    const out: RawCandidate[] = []

    const desktop = path.join(ctx.home, 'Library', 'Application Support', 'Claude')
    for (const sub of CLAUDE_DESKTOP_CACHES) {
      const full = path.join(desktop, sub)
      if (await exists(full)) out.push({ path: full, label: `Claude Desktop ${sub}`, group: 'agents' })
    }

    for (const [rel, label] of AGENT_DIRS) {
      const full = path.join(ctx.home, rel)
      if (await exists(full)) out.push({ path: full, label, group: 'agents' })
    }

    // Codex writes rotating sqlite log databases at the root of ~/.codex.
    // A -wal or -shm sidecar means the database is open (or was not cleanly
    // checkpointed); deleting the main file then would tear a live database,
    // so such a db is skipped entirely rather than offered in pieces.
    const codex = path.join(ctx.home, '.codex')
    try {
      const names = (await fs.readdir(codex, { withFileTypes: true }))
        .filter((e) => e.isFile())
        .map((e) => e.name)
      for (const name of names) {
        if (!/^logs.*\.sqlite$/.test(name)) continue
        if (names.includes(`${name}-wal`) || names.includes(`${name}-shm`)) continue
        out.push({ path: path.join(codex, name), label: `Codex log db (${name})`, group: 'agents' })
      }
    } catch { /* no codex on this machine */ }

    if (ctx.claudeTmpDir !== undefined && (await exists(ctx.claudeTmpDir))) {
      out.push({ path: ctx.claudeTmpDir, label: 'Claude Code session scratchpads', group: 'agents' })
    }

    return out
  },
}
