# HANDOFF — Phase 7 complete, preparing to demo

## Branch state

- Branch: `claude/gsd-execute-phase-3-8d8826`, pushed to `origin`, no PR open.
- Worktree: `.claude/worktrees/gsd-execute-phase-3-96530d`.
- HEAD: `de23bb6` — `docs(quick-260922-jr4): Fix broken Tailwind v4 CSS pipeline, apply the mockup's visual design system to the HR/legal review screens, and rename the demo Legal reviewer identity from Marcus Tan to Roger Lui`.
- Working tree: clean except `.planning/state.json` (a stale copy of phase status the newer `.planning/STATE.md` has superseded — harmless, not yet reconciled) and `apps/web/next-env.d.ts` (Next's own regenerated file).
- Full suite: 1072 tests passing; `typecheck`/`lint`/`depcruise` clean.

## What's built vs. not, by phase

| Phase | Name | Status |
|---|---|---|
| 1 | Schemas Freeze and Walking Skeleton | ✅ complete |
| 2 | Deterministic Fee Engine | ✅ complete |
| 3 | Rule Packs and Pack Admin | ✅ complete |
| 3.1 | Demo Slice — In-Memory Determination Pipeline | ✅ complete |
| 3.2 | Database Boundary and Audit Immutability | ❌ not started |
| 4 | Workflow and Audit Backbone | ✅ complete |
| 5 | HR Intake and Disclosure Shell | ✅ complete |
| 6 | Convergence and Legal Review | ✅ complete |
| 7 | Sign-off, Outputs and Edge States | ✅ complete |
| 8 | LLM Job 1 — Category Suggestion | ❌ not started |

Phases 4–7 mean `apps/web` now delivers the full PRD §10 screen set — HR intake, legal
review, sign-off, the internal-record PDF, HR/requestor outputs, and every §10.7 edge
state (stale pack, no pack, currency mismatch, zero-fee outcome) — end to end. All of it
runs against the in-memory repository built in Phase 3.1; nothing in Phases 4–7 touched
persistence. Phase 3.2 (Postgres, the `dsar_migrator`/`dsar_runtime` GRANT/REVOKE
boundary, real audit immutability) is the one architectural piece genuinely still
outstanding, followed by Phase 8 (the LLM boundary, `packages/agent`).

Full detail on every phase's requirements, decisions, and deviations lives in
`.planning/STATE.md` (Decisions log, per-phase) and `.planning/phases/<NN>/`
(PLAN/SUMMARY/REVIEW/VERIFICATION per plan). This file is a landing point, not a
duplicate of that record.

## What just happened (2026-09-22, quick task 260922-jr4)

A request to apply `docs/dsar-fee-agent-mockup-simplified.html`'s visual style to the real
app surfaced that `apps/web/app/globals.css`'s Tailwind v4 `@theme` block had **never
actually compiled** — no `@tailwindcss/postcss` package and no `postcss.config` existed
anywhere in the repo, so every screen had rendered in unstyled browser defaults since the
token system was first authored (Phase 3.1). This had passed every prior phase's tests and
reviews because nothing exercised the built CSS output; only opening the app in a real
browser surfaced it.

Fixed: `apps/web/postcss.config.mjs` added, `@tailwindcss/postcss@4.3.3` +
`postcss@8.5.28` exact-pinned, and a permanent regression gate
(`tests/toolchain/css-pipeline.test.ts`) added so this class of failure cannot recur
silently. Once the plugin was registered, this build machine's documented Turbopack
segfault (`.planning/WINDOWS.md` entry 4) also started affecting `next build`/`dev` —
worked around with `--webpack`, consistent with the product owner's prior decision to
proceed rather than block on that machine-specific issue.

Also in this pass: a new `@layer components` block in `globals.css` (19 previously
orphaned class names already used throughout the markup, plus the mockup's
card/eyebrow/callout/summary-row/button patterns, all built from tokens already in the
file — zero new colours, zero webfonts, zero network references), applied to the app
chrome, legal review screen, HR intake, and HR result screen; and the demo
`LEGAL_REVIEWER_USER` identity renamed from Marcus Tan to Roger Lui across source and
tests. An independent review (`260922-jr4-REVIEW.md` /
`260922-jr4-REVIEW-ADDENDUM.md`) found and fixed 2 Critical issues (a CSS selector
that tinted PENDING line cards the same as already-decided ones; a sub-row indentation a
code comment called "load-bearing" per PRD §10.3 but no CSS rule actually implemented)
plus 4 Warnings (dead CSS), before this HEAD.

## Two remaining pieces, and what each actually needs

**Phase 3.2 — Database Boundary and Audit Immutability.** Separately planned already (not
discussed against this HEAD). Needs: `prisma migrate dev`'s first migration, the two
Postgres roles (`dsar_migrator` / `dsar_runtime`) with GRANT/REVOKE separating who can
write the audit table from who can merely append to it, a real Testcontainers-backed
integration test proving the boundary (AC-34), and a Prisma-backed implementation of
`apps/web/src/server/repositories/interface.ts` dropped in behind the existing in-memory
one — the interface itself was authored in Phase 3.1 specifically so this swap touches no
call site.

**Phase 8 — LLM Job 1 (Category Suggestion).** Not yet discussed or planned. Builds
`packages/agent`: the LLM suggests a category for an unclassified expense line only: no
arithmetic, no rationale text the engine didn't already produce, no citation the engine
didn't already cite. Per PRD §8.2 and this repo's own Non-negotiables, evals
(`/evals`) gate any deploy of this package and nothing else.

Neither phase depends on the other; either can be planned next. `.planning/STATE.md`'s
frontmatter (`current_phase: 08`) reflects the last planning session's intent, not a
requirement that 3.2 wait.

## Assumptions a fresh session would get wrong

- **`apps/web` is not a demo-only slice waiting to be replaced.** Phase 3.1 built an
  in-memory demo shape; Phases 4–7 built the actual PRD §10 product on top of the *same*
  routes and repository interface — there is no separate "real" `apps/web` to build later.
  Only the persistence layer underneath it is provisional.
- **Both reference rule packs (`SG-PDPA`, `HK-PDPO`) are still `status: "DRAFT"`.** This is
  not a bug or an oversight — full 21-category authoring and a named lawyer's sign-off are
  legal work, tracked separately (see `docs/sg-pack-authoring-worksheet.md`), and a pack
  cannot reach `ACTIVE` while any `UNAUTHORED_TOKEN`-marked rule remains. The engine
  coerces an in-memory copy to `ACTIVE` for local running only; the committed file is never
  edited.
- **The CSS pipeline bug (above) hid behind a fully green test suite for six phases.** If a
  future visual change looks unstyled in the browser despite passing tests, check
  `tests/toolchain/css-pipeline.test.ts` is actually running and actually compiling —
  don't assume the test suite alone proves the UI renders as designed.
- **A known, pre-existing test failure is expected and is not yours to fix:**
  `packages/schemas/src/json-schema.test.ts`'s byte-identical drift check fails on this
  Windows checkout (CRLF-committed artifact vs. LF-regenerated output). Logged in
  `.planning/WINDOWS.md` (id 1, open).
- **`workflow.use_worktrees` is `false` project-wide.** Plans execute sequentially on the
  main tree regardless of whether their `files_modified` lists overlap.
