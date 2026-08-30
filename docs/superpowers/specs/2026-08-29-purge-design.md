# purge — design

**Status:** approved architecture, pending implementation plan
**Date:** 2026-08-29
**Origin:** rewrite of the personal bash script `diskdiet` v1.1.0
(`~/.local/bin/diskdiet`, 327 lines) into a distributable open-source tool.

## 1. What this is

A macOS command-line tool that finds regenerable disk junk on a developer's
machine — build output, package caches, Xcode derived data, editor and browser
caches — shows it grouped and sized, lets the user uncheck anything they want
to keep, and deletes only what remains checked.

    npx purge

Distributed on npm. Written in TypeScript. MIT licensed.
Published as `github.com/soummyaanon/purge` → npm `purge`.

### Why it is being rewritten rather than shipped as-is

`diskdiet` is safe because it runs on one known machine. Three of its
behaviours become unsafe on a stranger's Mac:

1. `find $HOME -name dist|build` matches `dist/` directories that some people
   commit to git (published packages, GitHub Pages, Actions bundles). On an
   unknown machine that is data loss.
2. Deleting browser `Service Worker` directories destroys real offline user
   data for PWAs that store content there, not just cache.
3. A full `$HOME` walk touches iCloud Drive, Dropbox and network mounts, where
   a delete propagates to the user's *other* machines.

The rewrite exists to introduce a guard layer that handles these, and to make
the scanners unit-testable. Speed is a secondary win.

## 2. Architecture

Three layers. One hard invariant: **exactly one module may delete anything.**

    scan/      →   guard/       →   ui/         →   reap/
    read-only      veto layer       user picks      deletes
    pure fns       block/downgrade  checkbox TUI    only fs.rm in codebase
                                                    + writes run manifest

### 2.1 `scan/` — one walk, many scanners

`diskdiet` runs `find $HOME` roughly ten times, once per directory name. This
performs **a single walk** with prune rules, offering each directory to every
registered scanner. Each scanner is a pure function
`(dirent, ctx) => Candidate | null`, which is what makes them testable.

    src/scan/
      walker.ts        the single filesystem walk, prune rules, concurrency
      types.ts         Candidate, Scanner, Group, Warning
      index.ts         scanner registry
      builds.ts        .next .turbo dist build .parcel-cache .svelte-kit .astro
      node-modules.ts  node_modules idle >= staleDays
      cargo.ts         target/ beside a Cargo.toml
      python.ts        venv dirs containing pyvenv.cfg
      pkg-cache.ts     npm/bun/playwright/electron/node-gyp/homebrew caches
      pkg-prune.ts     delegated commands (pnpm store prune, brew cleanup)
      xcode.ts         DerivedData, iOS DeviceSupport, unavailable simulators
      browsers.ts      service workers, GPUCache, on-device AI models
      editors.ts       Cursor / VS Code / Windsurf / VSCodium caches
      orphans.ts       app data whose .app is gone — report-only

`dist/` and `build/` are only candidates when a sibling manifest exists
(`package.json`, `tsconfig.json`, `vite.config.{js,ts}`), carried over from
`diskdiet`.

### 2.2 `guard/` — a veto layer, not a filter

Every candidate passes through the guards. A guard may **block** (never shown
as selectable) or **downgrade** (shown, unchecked, with a visible warning).

| Guard | Action | Reason |
|---|---|---|
| Path outside `$HOME` | block | inherited from diskdiet |
| Tracked in git | downgrade + `! tracked in git` | committed `dist/` data loss |
| Inside a cloud sync root | downgrade + warn | delete propagates to other machines |
| External or network volume | block | not the user's boot disk |
| Symlink | block | never follow, never delete the target |
| Browser `Service Worker` | downgrade + warn | real PWA offline data |
| `*/{iOS,watchOS,tvOS,visionOS} DeviceSupport` | downgrade + warn | needs the original device on the original OS build |
| Matches `keep:` glob in `~/.purgerc` | block | user escape hatch (globs are `~`-expanded at load) |
| Below `--min-size` (default 10 MB) | hidden | noise |

Git status is resolved by grouping candidates per repository root and batching
them through `git check-ignore --stdin -z` and `git ls-files`, never one
subprocess per path.

### 2.3 Two correctness requirements

- **Sizes come from `stat.blocks * 512`, never `stat.size`.** macOS "Optimize
  Storage" leaves dataless iCloud placeholders whose logical size is large and
  whose on-disk size is zero. Using `size` would make purge claim to free
  tens of GB that were never on disk.
- **`reap/` re-validates every path against the guards immediately before
  deleting.** Minutes may pass while the user reads the TUI; the path may have
  changed, become a symlink, or been git-committed in that window.

## 3. Scope of v1

Six groups. Five are ported from `diskdiet`; `xcode` is new, and on a typical
Mac dev machine it is the single largest reclaim.

1. `builds` — framework output, cargo `target/`, python venvs, stale `node_modules`
2. `pkg` — download caches
3. `xcode` — DerivedData, device support, simulator caches
   (Xcode **Archives are never touched** — they are shipping artifacts)
4. `browsers` — GPUCache, on-device AI models, service workers (downgraded)
5. `editors` — Cursor / VS Code / Windsurf / VSCodium caches
6. `orphans` — report-only, never selectable, never deleted

macOS only in v1. On other platforms the CLI exits with a clear message.

Explicitly **not** in v1: Docker/OrbStack disk images, generic
`~/Library/Caches` sweeps, Time Machine local snapshots, anything requiring
`sudo`, telemetry of any kind.

**Delegated shell commands are deferred to v1.1** — `pnpm store prune`,
`brew cleanup --prune=all` and `xcrun simctl delete unavailable`. They cannot
be sized before running and cannot be shown as reviewable paths, so they do
not fit the "review a list of sized paths, then delete" model. Keeping them
out means the reaper stays the only thing in the codebase with destructive
power.

**The walk excludes `~/Library`, `~/Applications`, `~/Pictures`, `~/Music`,
`~/Movies` and editor dot-directories, and never descends into
`node_modules`.** `diskdiet` carried these as `-not -path` exclusions. They are
load-bearing: without the `node_modules` rule, an *active* project's
`node_modules` is correctly not claimed, therefore not pruned, therefore
walked — and the `builds` scanner then claims `node_modules/next/dist` and
every other dependency shipping a `dist/` beside its `package.json`.

## 4. CLI surface

    purge                     scan, interactive review, confirm, delete
    purge --yes               non-interactive; deletes default-selected items
    purge --dry-run           scan and print; never prompts, never deletes
    purge builds pkg xcode    limit to named groups (positional)
    purge --json              machine-readable scan output; implies --dry-run
    purge history             past runs and lifetime total
    purge history --last --json
    purge --stale-days N      node_modules idle threshold (default 60)
    purge --min-size N        ignore candidates under N MB (default 10)
    purge --help, --version

Config file `~/.purgerc` (JSON) supports `keep` globs, `staleDays`,
`minSize`, and default groups.

Exit codes: `0` success, `1` error, `2` nothing reclaimable found.

### 4.1 Zero runtime dependencies

The TUI is hand-rolled on `node:readline` raw mode plus ANSI escapes — a
scrolling grouped checkbox list with a live selected-total footer, roughly 200
lines. Ink and Clack were both considered and rejected: shipping a large
`node_modules` inside a tool whose headline feature is deleting `node_modules`
is poor optics, and zero dependencies makes `npx purge` start instantly.
`esbuild` and `typescript` are devDependencies only; the published package is a
single bundled file.

## 5. Reporting and history

Deletion is a real delete, so reclaimed space is free immediately. There is no
undo; there is a precise record instead.

Every run appends a manifest to `~/.purge/runs/<iso-timestamp>.json`
containing every path, its size in bytes, its group, and the run timestamp.

    purge history

      Aug 29   6.1 GB   builds, pkg
      Aug 12   2.4 GB   pkg
      Jul 30  18.9 GB   builds, browsers

      lifetime reclaimed: 41.3 GB

`purge history --last --json` emits the most recent manifest for scripting.

## 6. Testing

Uses the built-in `node:test` runner — no test framework dependency.

- **Scanner tests** — each scanner against a fixture directory tree.
- **Guard tests** — the critical suite: git-tracked paths, symlinks, paths
  outside `$HOME`, sync roots, external volumes. Each guard gets a test that
  asserts the candidate is blocked or downgraded.
- **Reaper tests** — run against temp directories; assert the written manifest
  exactly matches what was removed, and that re-validation rejects a path that
  changed between scan and reap.
- **The invariant test** — purge never deletes anything outside `$HOME`.
  This test must never be weakened.

CI on GitHub Actions, `macos-latest`, Node 22.18 / 24 / 26. Node 20 cannot
run the test suite: it has no native TypeScript type stripping.

CI additionally enforces three invariants by grep: only `src/reap/reaper.ts`
may call `fs.rm`, `dependencies` must stay empty, and `du.ts` must measure
`stat.blocks`, never `stat.size`.

## 7. Release

- Bundled to a single file with `esbuild`; `bin: { purge: dist/purge.js }`.
- Publish on git tag via GitHub Actions with npm provenance enabled.
- `LICENSE` — MIT.
- `README.md` — the pitch, one demo GIF, and a prominent safety section stating
  exactly what purge will and will not touch, plus a "no telemetry" line.
- A `gigabyte` typo-redirect package is **not** available: the name was
  unpublished in 2016, and npm restricts republishing unpublished names
  without support intervention.

## 8. Open questions

None blocking. Deferred until after launch: Homebrew tap, Linux support,
delegated shell commands (see §3), a shareable PNG receipt of a run.
