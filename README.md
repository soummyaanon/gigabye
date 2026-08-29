# gigabye

**Say gigabye to the 40 GB of build junk on your Mac.**

```
npx gigabye
```

Finds the `node_modules` you forgot about, the `.next` directories from
projects you abandoned in 2023, and the Xcode DerivedData quietly eating
60 GB. Shows you everything it found, with sizes. Deletes only what you
leave checked.

<!-- demo GIF goes here: record `npx gigabye` on a real machine -->

## What it looks for

| Group | What |
|---|---|
| `builds` | `.next`, `.turbo`, `dist`, `build`, cargo `target`, python venvs, idle `node_modules` |
| `pkg` | npm, bun, playwright, electron, homebrew, gradle caches |
| `xcode` | DerivedData, device support, simulator caches |
| `browsers` | GPU and service worker caches, on-device AI models |
| `editors` | Cursor, VS Code, Windsurf, Zed caches |
| `orphans` | app data whose app is gone — reported, never deleted |

Narrow it: `gigabye builds xcode`

## Safety

gigabye will **never**:

- touch anything outside your home directory
- follow or delete a symlink
- touch a file on an external or network volume
- delete anything in the `orphans` group
- delete your editor settings, extensions, browser profiles, passwords,
  bookmarks, history, or Xcode Archives

gigabye leaves **unchecked**, with a visible warning, anything that is:

- tracked in git (the committed-`dist/` case)
- inside iCloud Drive, Dropbox, Google Drive or OneDrive — deleting there
  propagates to your other machines
- a browser Service Worker directory, which can hold real offline app data

Every path is re-checked immediately before deletion, in case anything
changed while you were reading the list.

**No telemetry. No network calls. Ever.**

## Keeping things

`~/.gigabyerc`:

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
gigabye history
gigabye history --last --json
gigabye --json
```

Every run writes a manifest to `~/.gigabye/runs/` recording every path,
its size, and when it went. There is no undo — there is a precise record.

## Requirements

macOS, Node 22.18+.

## License

MIT © soummyaanon
