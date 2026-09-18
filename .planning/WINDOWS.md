---
schema_version: 1
open_count: 3
waived_count: 0
fixed_count: 3
total_count: 6
last_updated: 2026-09-18T18:00:00.000Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 03 | unmet-truth | packages/schemas/src/json-schema.test.ts |  | Pre-existing CRLF/LF drift test failure (committed assessment.schema.json has CRLF, regenerated output is LF) - confirmed pre-existing via git stash, unrelated to plan 03-01 | fixed |  | 2026-09-16T04:40:04.058Z | 2026-09-18T00:00:00.000Z |
| 2 | 03.1 | unrun-verify | packages/rulepacks/src/loader.ts | 24 | next build fails: Turbopack's page-data collection throws on RULEPACKS_ROOT's top-level import.meta.dirname computation (undefined in that context). Never consumed by apps/web, but throws at module evaluation regardless. Frozen Phase 3 file, out of 03.1-01 scope; needs a product-owner decision before pnpm dev/next build can run. | open |  | 2026-09-18T00:00:00.000Z |  |
| 3 | 03.1 | unrun-verify | apps/web/app/globals.css |  | next build warns 'Unknown at rule: @theme' — no @tailwindcss/postcss plugin registered (not installed, no postcss.config exists), so every custom design token in globals.css is inert in a real build. Fix needs a new package install, blocked pending a package-legitimacy checkpoint. | open |  | 2026-09-18T00:00:00.000Z |  |
| 4 | 03.1 | unrun-verify | apps/web/app/globals.css |  | Registering @tailwindcss/postcss (the fix attempted for ledger entry 3) segfaults 'pnpm dev' on this build machine with STATUS_ACCESS_VIOLATION (exit 3221225477) on the first CSS compile. Reproduced and isolated: crash with the plugin registered, no crash with it absent; also crashes with optimize:false (Lightning CSS disabled), so the fault is in Tailwind v4's core native compiler (@tailwindcss/oxide), not just its minifier. Same class of native-binary/build-machine incompatibility as the pnpm 12.x SIGILL issue in .claude/CLAUDE.md's Key Decisions. Product owner decision: proceed with remaining plans, tracked here rather than blocking. Change reverted cleanly (package.json/lockfile back to b573f74); entry 3 stays open. | open |  | 2026-09-18T05:45:30.131Z |  |
| 5 | 03.1 | deviation | apps/web/src/ui/review/disposition-controls.tsx |  | Ask HR button remains permanently disabled — the backend (askHr(), the info-request route) is built and tested in Plan 04, but wiring the lawyer-facing control to call it is out of Plan 04's declared file scope; deferred to Plan 05's integration pass. | fixed |  | 2026-09-18T07:45:15.230Z | 2026-09-18T18:00:00.000Z |
| 6 | 03.1 | deviation | apps/web/app/(legal)/assessments/[id]/page.tsx |  | SignOffPanel is built and tested (signoff-panel.tsx/test.tsx) but not yet rendered on the actual legal review page — Plan 04's file list deliberately excludes this page and assessment-view.tsx; wiring is Plan 05's integration pass, which owns the phase's end-to-end WALKTHROUGH test. | fixed |  | 2026-09-18T07:45:15.842Z | 2026-09-18T18:00:00.000Z |

````json
[
  {
    "id": 1,
    "kind": "unmet-truth",
    "phase": "03",
    "file": "packages/schemas/src/json-schema.test.ts",
    "line": null,
    "description": "Pre-existing CRLF/LF drift test failure (committed assessment.schema.json has CRLF, regenerated output is LF) - confirmed pre-existing via git stash, unrelated to plan 03-01",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-16T04:40:04.058Z",
    "resolved_at": "2026-09-18T00:00:00.000Z"
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "03.1",
    "file": "packages/rulepacks/src/loader.ts",
    "line": 24,
    "description": "next build fails: Turbopack's page-data collection throws on RULEPACKS_ROOT's top-level import.meta.dirname computation (undefined in that context). Never consumed by apps/web, but throws at module evaluation regardless. Frozen Phase 3 file, out of 03.1-01 scope; needs a product-owner decision before pnpm dev/next build can run.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-18T00:00:00.000Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "03.1",
    "file": "apps/web/app/globals.css",
    "line": null,
    "description": "next build warns 'Unknown at rule: @theme' — no @tailwindcss/postcss plugin registered (not installed, no postcss.config exists), so every custom design token in globals.css is inert in a real build. Fix needs a new package install, blocked pending a package-legitimacy checkpoint.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-18T00:00:00.000Z",
    "resolved_at": null
  },
  {
    "id": 4,
    "kind": "unrun-verify",
    "phase": "03.1",
    "file": "apps/web/app/globals.css",
    "line": null,
    "description": "Registering @tailwindcss/postcss (the fix attempted for ledger entry 3) segfaults 'pnpm dev' on this build machine with STATUS_ACCESS_VIOLATION (exit 3221225477) on the first CSS compile. Reproduced and isolated: crash with the plugin registered, no crash with it absent; also crashes with optimize:false (Lightning CSS disabled), so the fault is in Tailwind v4's core native compiler (@tailwindcss/oxide), not just its minifier. Same class of native-binary/build-machine incompatibility as the pnpm 12.x SIGILL issue in .claude/CLAUDE.md's Key Decisions. Product owner decision: proceed with remaining plans, tracked here rather than blocking. Change reverted cleanly (package.json/lockfile back to b573f74); entry 3 stays open.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-18T05:45:30.131Z",
    "resolved_at": null
  },
  {
    "id": 5,
    "kind": "deviation",
    "phase": "03.1",
    "file": "apps/web/src/ui/review/disposition-controls.tsx",
    "line": null,
    "description": "Ask HR button remains permanently disabled — the backend (askHr(), the info-request route) is built and tested in Plan 04, but wiring the lawyer-facing control to call it is out of Plan 04's declared file scope; deferred to Plan 05's integration pass.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-18T07:45:15.230Z",
    "resolved_at": "2026-09-18T18:00:00.000Z"
  },
  {
    "id": 6,
    "kind": "deviation",
    "phase": "03.1",
    "file": "apps/web/app/(legal)/assessments/[id]/page.tsx",
    "line": null,
    "description": "SignOffPanel is built and tested (signoff-panel.tsx/test.tsx) but not yet rendered on the actual legal review page — Plan 04's file list deliberately excludes this page and assessment-view.tsx; wiring is Plan 05's integration pass, which owns the phase's end-to-end WALKTHROUGH test.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-18T07:45:15.842Z",
    "resolved_at": "2026-09-18T18:00:00.000Z"
  }
]
````
