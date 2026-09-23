---
quick_id: "260923-w1p"
status: complete
---

# Summary: default `pnpm dev` to `--webpack` on this build machine

**Task 1 — done.** `apps/web/scripts/dev.mjs` now spawns `next dev --webpack` instead of
plain `next dev` (Turbopack), with a header comment explaining why (this machine's
documented Turbopack segfault, `.planning/WINDOWS.md` entry 4).

**Verified:**
- Before the fix: `pnpm --filter @dsar/web dev` crashed (Turbopack, exit code 3221225622,
  no HTTP response) — reproduced live before making the change.
- After the fix: same command starts cleanly on webpack, serves `HTTP 200` on
  `http://localhost:3000` in under 2 seconds.
- Full suite: 1095/1095 passing, unchanged — this is a dev-script args change only, no
  application code touched.
- Also cross-checked against a real `next build --webpack && next start` (production mode)
  while investigating this — both render correctly; this fix only affects `next dev`,
  which previously had no working path on this machine at all via the documented command.

**Not touched:** `apps/web/package.json`'s `"build": "next build"` script — a production
build already succeeds without `--webpack` on this machine per this session's own testing
(`next build --webpack` was used deliberately during Phase 7.1's verification, but plain
`next build` was not re-tested here to confirm whether it also needs the flag). If a future
build crashes the same way, apply the identical fix there.

Commit: (recorded by the quick-task closing commit)
