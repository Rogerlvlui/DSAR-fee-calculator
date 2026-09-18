---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 1
total_count: 3
last_updated: 2026-09-18T00:00:00.000Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 03 | unmet-truth | packages/schemas/src/json-schema.test.ts |  | Pre-existing CRLF/LF drift test failure (committed assessment.schema.json has CRLF, regenerated output is LF) - confirmed pre-existing via git stash, unrelated to plan 03-01 | fixed |  | 2026-09-16T04:40:04.058Z | 2026-09-18T00:00:00.000Z |
| 2 | 03.1 | unrun-verify | packages/rulepacks/src/loader.ts | 24 | `pnpm --filter @dsar/web exec next build` fails: Turbopack's "collect page data" step throws `TypeError: The "paths[0]" argument must be of type string. Received undefined` from RULEPACKS_ROOT's top-level `path.resolve(import.meta.dirname, "..")` — `import.meta.dirname` is undefined in that execution context. This constant is never actually consumed by apps/web (engine-invocation.ts always passes its own resolveRulepacksRoot()), but the throw happens at module evaluation regardless of use. Out of 03.1-01's declared file scope (packages/rulepacks is a frozen Phase 3 package); needs a product-owner decision on whether to patch loader.ts (Rule 4 territory — touches a different phase's frozen file) before pnpm dev/next build can run. | open |  | 2026-09-18T00:00:00.000Z |  |
| 3 | 03.1 | unrun-verify | apps/web/app/globals.css |  | `pnpm --filter @dsar/web exec next build` warns "Unknown at rule: @theme" — Tailwind v4's CSS-first `@theme` block is never actually processed because no `@tailwindcss/postcss` plugin is registered (no postcss.config exists anywhere in the repo, and `@tailwindcss/postcss` is not installed). Every custom design token declared in globals.css is currently inert in a real build; components render with zero custom styling. Fixing this needs a new npm package install (`@tailwindcss/postcss`), which the package-legitimacy protocol requires a blocking-human checkpoint for before installing — not auto-fixed here. | open |  | 2026-09-18T00:00:00.000Z |  |

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
  }
]
````
