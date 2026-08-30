## What

<!-- One paragraph: what changes and why. -->

## Checklist

- [ ] Started from a failing test (`test/…`) — this repo is TDD
- [ ] `npm test` and `npm run typecheck` pass
- [ ] No `fs.rm`/`fs.unlink`/`fs.rmdir` outside `src/reap/reaper.ts`
- [ ] No new runtime dependencies
- [ ] New scanner paths answered: *can this ever hold unrecoverable data?*
      (if yes: fragile-guard downgrade or report-only group)
