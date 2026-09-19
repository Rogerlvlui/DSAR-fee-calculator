---
phase: "04"
slug: "workflow-and-audit-backbone"
status: executed
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-19"
populated: "2026-09-19"
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.x |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `pnpm vitest run --project workflow --project audit` (two new `test.projects` entries added in plan 04-01, node environment, each including its own package's `src/**/*.test.ts`); `pnpm vitest run --project routes -t "<TAG>"` for the integration tags |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~10s (current baseline, 612 tests) |

---

## Sampling Rate

- **After every task commit:** Run the relevant project filter, scoped by `-t` to the feature name
- **After every plan wave:** Run `pnpm test` (full monorepo suite — this phase specifically retrofits Phase 3.1's call sites, so a full-suite regression check after each swap is load-bearing, not optional)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-T1 | 04-01 | 1 | STATE-02, AUDIT-01, BOUND-05 | T-04-01, T-04-02, T-04-04, T-04-06 | Status written is the executor's returned destination; audit write is server-stamped and awaited; payload parsed through the frozen strict-object schema | unit + integration | `pnpm vitest run --project workflow` · `pnpm vitest run --project routes -t "WORKFLOW-TRACER"` | ✅ | ✅ green |
| 04-01-T2 | 04-01 | 1 | AUDIT-03, BOUND-05 | T-04-03, T-04-04 | Deep-copy isolation on read and write; disposition and sign-off events refused without an elapsed figure | unit | `pnpm vitest run --project audit -t "AUDIT-WRITER"` · `pnpm vitest run --project audit -t "REVIEW-SESSION"` | ✅ | ✅ green |
| 04-01-T3 | 04-01 | 1 | — | T-04-07 | Deliberate incompleteness recorded in module headers so a stub is not mistaken for finished | regression | `pnpm test` · `pnpm run lint` | ✅ | ✅ green |
| 04-02-T1 | 04-02 | 2 | STATE-02 | T-04-08, T-04-09, T-04-12 | Every PRD §5 precondition evaluated by a named predicate; whole-array completeness comparison | unit | `pnpm vitest run --project workflow -t "GUARD-TABLE"` | ✅ | ✅ green |
| 04-02-T2 | 04-02 | 2 | STATE-02 | T-04-10, T-04-11 | Guard package cannot import I/O, infrastructure or siblings; cannot read a clock or format by locale — each gate shipping with a violating fixture | toolchain | `pnpm run depcruise` · `pnpm vitest run --project toolchain` | ✅ | ✅ green |
| 04-03-T1 | 04-03 | 2 | AUDIT-01, BOUND-05 | T-04-16, T-04-17, T-04-18 | Pack-lifecycle stream kept separate from the matter-scoped one, validating against the same frozen payload schema | unit | `pnpm vitest run --project audit -t "PACK-LIFECYCLE"` | ✅ | ✅ green |
| 04-03-T2 | 04-03 | 2 | AUDIT-04 | T-04-13, T-04-14, T-04-15 | Officer role check is the export function's first statement; unrecognised cookie still falls back to least privilege | integration | `pnpm vitest run --project routes -t "AUDIT-EXPORT"` | ✅ | ✅ green |
| 04-04-T1 | 04-04 | 3 | STATE-02, STATE-03, AUDIT-01, AUDIT-03 | T-04-19, T-04-21, T-04-22, T-04-23, T-04-24 | In-place recompute keeps the assessment identity and clears every disposition; the first-opened origin is reset in the same operation | integration | `pnpm vitest run --project routes -t "RECOMPUTE"` · `pnpm vitest run --project routes -t "AUDIT-TRAIL"` | ✅ | ✅ green |
| 04-04-T2 | 04-04 | 3 | STATE-02, AUDIT-01, AUDIT-03 | T-04-20, T-04-25 | One provenance-complete record per decision; refusal paths write neither state nor record; existing sign-off refusals unchanged | integration | `pnpm vitest run --project routes -t "AUDIT-TRAIL"` · `pnpm vitest run --project routes -t "SIGNOFF"` | ✅ | ✅ green |
| 04-04-T3 | 04-04 | 3 | STATE-02 | T-04-19 | A literal matter status written in server or route code is a lint failure; the stand-in edge-table module is deleted | toolchain | `pnpm vitest run --project toolchain -t "STATUS-WRITE-GATE"` · `pnpm run lint` · `pnpm run typecheck` | ✅ | ✅ green |
| 04-05-CP | 04-05 | 4 | STATE-05 | T-04-26 | Representation of a correction after sign-off decided by the product owner, never assumed | checkpoint (blocking-human) | N/A — `checkpoint:decision`, never auto-approved | N/A | ✅ resolved (Option A, pre-resolved by product owner before execution) |
| 04-05-T1 | 04-05 | 4 | STATE-05, STATE-02, AUDIT-01 | T-04-26, T-04-27, T-04-28 | Signed record deep-equal to a pre-correction snapshot; correction stored under a freshly generated identifier | integration | `pnpm vitest run --project routes -t "CORRECTION"` | ✅ | ✅ green (11 tests) |
| 04-05-T2 | 04-05 | 4 | STATE-02, AUDIT-01 | T-04-29, T-04-30 | Closing transition through the executor; the figure stays readable to the preparer after closure; intake acts recorded | integration | `pnpm vitest run --project routes -t "LIFECYCLE"` · `pnpm vitest run --project routes -t "HR-RESULT"` | ✅ | ✅ green (9 + 5 tests) |
| 04-05-T3 | 04-05 | 4 | AUDIT-01 | T-04-31, T-04-32 | Every audit event type accounted for as written or deferred-with-an-owner; the database-immutability row left unmarked | integration + docs | `pnpm vitest run --project routes -t "LIFECYCLE"` · `pnpm test` · `pnpm run lint` · `pnpm run typecheck` · `pnpm run depcruise` | ✅ | ✅ green (725/725 full suite; lint/typecheck/depcruise all exit 0) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Phase closed 2026-09-19.** All fourteen task rows (across plans 04-01 through 04-05) and the one decision checkpoint are green. Full suite: 725/725 (up from the 705/705 baseline recorded at the start of this plan — 11 CORRECTION tests + 9 LIFECYCLE tests, net of 2 pre-existing WORKFLOW-TRACER assertions updated for the new MATTER_CREATED/LINE_ADDED event types, an expected consequence per the same precedent 04-04 already established for that file). `pnpm run lint`, `pnpm run typecheck` and `pnpm run depcruise` all exit 0.

**Sampling continuity:** no three consecutive tasks lack an automated verify — the only task without one is the plan 04-05 decision checkpoint, and both its neighbours carry automated commands.

**Baseline caveat:** plan 04-01's first task carries a precondition requiring `pnpm test` to be run and its failure set recorded before any source change. Two pre-existing failures are known — a CPU-load-sensitive property-test timeout in `packages/engine/src/assess.property.test.ts` and a line-ending drift failure in the schemas JSON-schema test (WINDOWS.md entry 1). Neither belongs to this phase, and every `pnpm test` gate below is judged against that recorded set rather than against zero.

---

## Wave 0 Requirements

All Wave 0 gaps are owned by plan 04-01 (wave 1), which is the phase's tracer and must land before any other plan starts.

- [ ] `packages/workflow/` scaffold — package manifest, tsconfig, root project reference, workspace dependency on `apps/web` and on the repository root (04-01 Task 1)
- [ ] `packages/audit/` scaffold — same, plus both writer interfaces declared up front so no later plan reopens that file (04-01 Task 1)
- [ ] Two new `test.projects` entries named `workflow` and `audit` in `vitest.config.ts` (04-01 Task 1)
- [ ] `packages/workflow/src/evaluate-transition.test.ts` — one block per guard-table row, permitted and refused (04-01 Task 1 for the first row, 04-02 Task 1 for the rest)
- [ ] `packages/workflow/src/transitions.test.ts` — whole-array completeness comparison against the PRD table (04-02 Task 1)
- [ ] `packages/audit/src/memory/audit-event-writer.test.ts` — append, list, export, deep-copy isolation, undeclared-key refusal, elapsed-figure refusal (04-01 Tasks 1 and 2)
- [ ] `packages/audit/src/review-session.test.ts` — first-opened idempotence, elapsed reading, clear (04-01 Task 2)
- [ ] `packages/audit/src/memory/pack-lifecycle-event-writer.test.ts` — the D-21 separate-stream proof (04-03 Task 1)
- [ ] `.dependency-cruiser.cjs` — `no-io-in-workflow` and `no-infra-in-workflow`, each with a violating fixture under `tests/fixtures/` proving the rule fires, plus the by-name rule-count assertion widened from six to eight (04-02 Task 2)
- [ ] ESLint determinism block scoped to `packages/workflow`, with `tests/fixtures/workflow-determinism-violation.fixture.ts` and its gate test (04-02 Task 2)
- [ ] ESLint literal-status-write rule scoped to `apps/web`'s server and route code, with `tests/fixtures/status-write-violation.fixture.ts` carrying both a violating and a compliant case (04-04 Task 3)
- Framework install: none — Vitest, zod and TypeScript are all already present, and this phase adds no external dependency

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| STATE-04 (DB-level immutability of a SIGNED_OFF write) | STATE-04 | Requires a live Postgres constraint/trigger; this build machine has no Docker installed. Explicitly deferred to Phase 3.2, not in this phase's scope at all. | N/A this phase — tracked in Phase 3.2 instead. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — every task in all five plans carries at least one runnable command with a `<fails_when>` sibling; the sole exception is plan 04-05's decision checkpoint, which is a human gate by design
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references — each gap above names the plan and task that closes it
- [x] No watch-mode flags — every command is `vitest run`, never `vitest` bare
- [x] Feedback latency < 30s — the two new package projects are node-environment and pure, well inside the current ~10s full-suite baseline
- [x] `nyquist_compliant: true` set in frontmatter — set by the executor of plan 04-05 Task 3; every row above reads green
- [x] Every task in every plan has an automated verify, and no three consecutive tasks lack one (the sole exception, 04-05's decision checkpoint, has an automated-verify neighbour on both sides)
- [x] The database-immutability row (STATE-04) is unchanged, still manual-only, and still points at Phase 3.2 — no in-memory test anywhere in this phase claims to prove it

**Approval:** executed and verified — plan 04-05, 2026-09-19. Full suite 725/725; `pnpm run lint`, `pnpm run typecheck`, `pnpm run depcruise` all exit 0.
