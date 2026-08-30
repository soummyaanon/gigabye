# purge

**Purge the 40 GB of regenerable junk on your Mac.**

```
npm i -g purge-cli
purge
```

Finds the `node_modules` you forgot about, the `.next` directories from
projects you abandoned in 2023, the Xcode DerivedData quietly eating 60 GB,
and every app cache folder that regrows itself. Shows you everything it
found, with sizes. Deletes only what you leave checked.

<!-- demo GIF goes here: record `purge` on a real machine -->

## What it looks for

| Group | What |
|---|---|
| `builds` | `.next`, `.turbo`, `dist`, `build`, cargo `target`, python venvs, idle `node_modules` |
| `pkg` | npm, bun, playwright, electron, homebrew, gradle caches |
| `xcode` | DerivedData, device support, simulator caches |
| `caches` | every app's folder in `~/Library/Caches` and `~/.cache`, one row each |
| `browsers` | GPU and service worker caches, on-device AI models |
| `editors` | Cursor, VS Code, Windsurf, Zed caches |
| `claude` | Claude Desktop/Code caches, plugin cache, session scratchpads |
| `logs` | per-app folders in `~/Library/Logs` |
| `orphans` | app data whose app is gone — reported, never deleted |
| `heavy` | old iOS backups, `~/.Trash`, `Docker.raw` — reported, never deleted |

Narrow it: `purge builds xcode`

## Safety

purge will **never**:

- touch anything outside your home directory — with one visible exception:
  Claude Code's own scratchpad under `/private/tmp/claude-<uid>`, which is
  always shown unchecked with a warning
- follow or delete a symlink
- touch a file on an external or network volume
- delete anything in the `orphans` or `heavy` groups
- delete your editor settings, extensions, browser profiles, passwords,
  bookmarks, history, or Xcode Archives

purge leaves **unchecked**, with a visible warning, anything that is:

- tracked in git (the committed-`dist/` case)
- inside iCloud Drive, Dropbox, Google Drive or OneDrive — deleting there
  propagates to your other machines
- a browser Service Worker directory, which can hold real offline app data
- an iCloud-backed cache (`CloudKit`, `com.apple.bird`) — deleting forces a re-sync
- an ML model cache (`~/.cache/huggingface`, `~/.cache/torch`) — regenerable,
  but the re-download is tens of GB
- Claude Code session history (`~/.claude/projects`, `~/.claude/file-history`)
  — `--resume` and rewind stop working without it

Every path is re-checked immediately before deletion, in case anything
changed while you were reading the list.

**No telemetry. No network calls. Ever.**

## Keeping things

`~/.purgerc`:

```json
{
  "keep": ["**/work/**", "~/Developer/client-project/**"],
  "staleDays": 90,
  "minSize": 25
}
```

Anything matching `keep` is never shown and never deleted.

## Reports

```
purge history
purge history --last --json
purge --json
```

Every run writes a manifest to `~/.purge/runs/` recording every path,
its size, and when it went. There is no undo — there is a precise record.

## Requirements

macOS, Node 22.18+.

## License

MIT © soummyaanon
