# Security Policy

purge deletes files. Anything that makes it delete the *wrong* files is a
security issue, not a bug: report it privately.

## What counts

- A way to make a candidate **escape the guard pipeline** (path traversal,
  symlink races, `..` tricks, unicode normalization games)
- A way to delete **outside the user's home directory** beyond the single
  documented Claude-scratchpad exception
- A **TOCTOU** window between the review screen and deletion that the
  re-validation in `src/reap/reaper.ts` does not close
- Anything that makes a **report-only row deletable** (`orphans`, `heavy`)
- Supply-chain concerns with the published npm package

## Reporting

Use [GitHub private vulnerability reporting](https://github.com/soummyaanon/purge/security/advisories/new).
Please include a reproduction — a failing test in the style of
`test/guard/` is the fastest path to a fix.

You'll get an acknowledgment within a week. Fixes ship as a patch release
with credit (unless you'd rather stay anonymous).

## Supported versions

Only the latest release line receives security fixes.
