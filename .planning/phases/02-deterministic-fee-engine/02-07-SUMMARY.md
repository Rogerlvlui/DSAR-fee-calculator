---
phase: 02-deterministic-fee-engine
plan: "07"
subsystem: engine
tags: [property-testing, fast-check, performance, timezone, banned-words, gate-integrity, tdd]

requires:
  - phase: 02-deterministic-fee-engine
    provides: "02-06's complete seven-step assess() implementation (all matter-level flags and the flat-fee comparison wired in) — this plan proves properties over that finished surface; 02-02's engine-scoped ESLint determinism bans, whose runtime half (the actual TZ-invariance proof) this plan supplies; Phase 1's expenseLineArb/minimalRulePackArb (packages/schemas/src/__fixtures__/arbitraries.ts), exported specifically for this re-point"
provides:
  - "purity.tz.test.ts — assess() proven deeply-identical under a UTC vs UTC+14 (Pacific/Kiritimati) timezone swing, over the PRD §14 reference fixture, the flat-fee fixture, and a pack whose review falls exactly on the 30-day STALE_PACK_WARNING boundary — with a retained control (the only permitted Date reference in packages/engine) proving the vi.stubEnv('TZ', ...) stub genuinely takes effect"
  - "perf.test.ts + __fixtures__/fifty-line-fixture.ts — the 100ms/50-line budget (ENGINE-17) asserted as a median of 20 samples after a 5-run warm-up via node:perf_hooks, with a retained control proving the same sampling helper can fail against a deliberately slow busy-loop"
  - "assess.property.test.ts — a 10,000-run fast-check property (seed 20260915, shared with SCHEMA-07) over REAL assess() output: every money field integer and non-NaN, finalAmount null, and the claimedTotal/draftBaseline/flaggedTotal/restingOnUnverifiedRules formulas independently re-derived and checked against the engine's own totals"
  - "packages/schemas/src/constants.ts's LEGAL_CONCLUSION_BANNED_WORDS — AC-32(a)'s eight-word list, transcribed verbatim, exported once for this plan's engine-language.test.ts and for Phase 3/5 to reuse"
  - "engine-language.test.ts — every one of messages.ts's 21 exports enumerated programmatically and checked against the shared list on case-sensitive word boundaries, with control assertions proving both that a real violation is caught and that 'Legal' (the department, capitalised) is correctly NOT flagged"
affects: [03-rulepacks-loader-and-validator, 05-legal-review-screen]

actuals:
  tokens: 8600
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "RED-phase strategy for 'prove an existing invariant' TDD tasks: since assess()/calendar-math.ts/totals.ts were already correct from prior plans in this phase, RED was produced by writing ONE assertion in the new test file deliberately backwards (e.g. toBe instead of not.toBe, toBeLessThan instead of toBeGreaterThan, a naive case-insensitive matcher instead of the word-boundary one) rather than injecting a purity-violating bug into production source — verified via gsd-tools check tdd-red-evidence, then flipped to the correct form for GREEN with zero production-code changes needed for two of the three tasks"
    - "Banned-word matching is case-SENSITIVE on word boundaries (\\bword\\b against the exact lower-case forms in LEGAL_CONCLUSION_BANNED_WORDS), not case-insensitive — messages.ts refers to the Legal DEPARTMENT by name ('referred to Legal') in six of its 21 templates, a legitimate proper noun distinct from the banned lower-case adjective 'legal'; confirmed empirically that a naive case-insensitive matcher genuinely breaks 6/21 real templates plus both control-string tests"
    - "engine-language.test.ts enumerates messages.ts's exports via Object.entries (never listed by hand) and calls each with a generic one-element-string-array filler, with a single named override (ARG_OVERRIDES) for the one export (conditionsNotMetMessage) that inspects its argument's structure rather than merely interpolating it — a future template using only string/number/Minor/string[] parameters is covered automatically with no test-file edit"
    - "assess.property.test.ts derives its RulePack fixture by keying CategoryRule[] to the SET of categories the generated ExpenseLine[] actually use (not the full 21), alternating VERIFIED/NEEDS_VERIFICATION by category position so restingOnUnverifiedRules is exercised as a genuine subset rather than always 0% or 100% verified"
    - "The fifty-line perf fixture cycles across REFERENCE_FIXTURE_PACK's six worked categories (ALLOW, ALLOW_CAPPED, ALLOW_IF, both FLAG shapes) with every description distinct and every STAFF_TIME_* rate under EXECUTIVE's rateSanityCeiling, so the cross-line checks do not flatten the timed path into fifty flagged lines"

key-files:
  created:
    - packages/engine/src/purity.tz.test.ts
    - packages/engine/src/perf.test.ts
    - packages/engine/src/__fixtures__/fifty-line-fixture.ts
    - packages/engine/src/assess.property.test.ts
    - packages/engine/src/engine-language.test.ts
  modified:
    - packages/engine/tsconfig.json
    - packages/schemas/src/constants.ts
    - packages/schemas/src/assessment.property.test.ts

key-decisions:
  - "Banned-word matching is case-sensitive, not case-insensitive — confirmed by direct inspection that messages.ts and packages/schemas/src/taxonomy.ts both legitimately use capitalised 'Legal' as the department's proper noun (six message templates, one taxonomy label), while the banned adjective AC-32 targets is always lower-case ('this fee is legal'). A case-insensitive matcher was empirically proven wrong during this plan's own RED phase — it broke 6 of 21 real message templates plus both control-string tests, none of which describe a real AC-32 violation."
  - "Deliberately-backwards test assertions (not a broken production stub) were used as the RED-phase mechanism for all three TDD tasks, because the code under test (calendar-math.ts, the totals formulas, messages.ts) was already correct from prior plans in this phase — injecting a genuine purity/correctness bug into production source to manufacture a RED would have meant briefly shipping the exact defect these tests exist to prevent. Each RED was still verified as a real, on-topic, named-assertion failure via gsd-tools check tdd-red-evidence (RED_EVIDENCE_OK in all three cases), not a module-resolution or fixture-crash failure."
  - "packages/engine/tsconfig.json needed an explicit \"types\": [\"node\"] entry (matching packages/schemas/tsconfig.json's own pre-existing identical entry) — without it, tsc could not resolve the node:perf_hooks import perf.test.ts needs, even though @types/node is a root devDependency. Treated as a Rule 3 blocking-issue auto-fix, not a deviation from the plan's intent."
  - "The 100ms/50-line budget's control test uses a smaller sample count (2 warm-up, 5 measured) than the real assertion (5 warm-up, 20 measured) through the SAME sampling helper — the busy-loop's 120ms floor is nowhere near the 100ms boundary the real assertion cares about, so fewer samples add no uncertainty while keeping the control test's wall-clock cost low (~0.6s instead of ~2.5s)."

requirements-completed: [ENGINE-01, ENGINE-08, ENGINE-15, ENGINE-17]

coverage:
  - id: D1
    description: "assess() produces deeply-identical output under a fourteen-hour timezone swing (UTC vs Pacific/Kiritimati) over three fixtures including the exact 30-day STALE_PACK_WARNING boundary, with a control assertion (the only permitted Date reference in packages/engine) proving the vi.stubEnv('TZ', ...) stub genuinely changes what the platform returns — not passing vacuously"
    requirement: "ENGINE-15"
    verification:
      - kind: unit
        ref: "packages/engine/src/purity.tz.test.ts#engine output is invariant across a fourteen-hour timezone (tz) swing"
        status: pass
      - kind: unit
        ref: "packages/engine/src/purity.tz.test.ts#gate integrity — the tz environment stub actually takes effect"
        status: pass
    human_judgment: false
  - id: D2
    description: "A 50-line assessment against the reference pack has a median elapsed time under 100ms across 20 samples after a discarded 5-run warm-up, measuring only assess() itself; the same sampling helper is proven able to report a median OVER the budget against a deliberately slow control function"
    requirement: "ENGINE-17"
    verification:
      - kind: unit
        ref: "packages/engine/src/perf.test.ts#performance budget — 50 lines under 100ms (ENGINE-17, PRD §11)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Over 10,000 generated matter/line/pack combinations that reach real evaluation (never the precondition throw), every money field of a real assess() output is an integer and non-NaN, finalAmount is null, and the claimedTotal/draftBaseline/flaggedTotal/restingOnUnverifiedRules relationships hold when independently re-derived from the engine's own line-level output"
    requirement: "ENGINE-08"
    verification:
      - kind: unit
        ref: "packages/engine/src/assess.property.test.ts#assess() money-integrity property (AC-07b, AC-22, AC-25)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every string packages/engine itself authors (all 21 exports of messages.ts, enumerated programmatically) is free of AC-32's eight canonical banned words, matched case-sensitively on word boundaries so the department name 'Legal' is never a false positive while a real lower-case violation ('compliant', 'lawful', 'illegal', ...) is reliably caught"
    requirement: "ENGINE-01"
    verification:
      - kind: unit
        ref: "packages/engine/src/engine-language.test.ts#engine-authored language is free of AC-32's banned words"
        status: pass
    human_judgment: false

duration: 23min
completed: 2026-09-15
status: complete
---

# Phase 2 Plan 7: Determinism, Performance, Money-Integrity and Language Proofs Summary

**Four gates proven, each with a retained control demonstrating the harness can genuinely fail: timezone invariance across a fourteen-hour swing, the 100ms/50-line budget as a median, a 10,000-run money-integrity property over real `assess()` output, and every engine-authored string checked against AC-32's banned-word list on case-sensitive word boundaries.**

## Performance

- **Duration:** ~23 min
- **Started:** 2026-09-15T11:06:56Z
- **Completed:** 2026-09-15T11:29:34Z
- **Tasks:** 3
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments

- `purity.tz.test.ts` proves `assess()` is invariant across a UTC-to-UTC+14 timezone swing over three fixtures — the PRD §14 reference fixture, the flat-fee fixture, and a pack whose `reviewDueOn` sits exactly on the inclusive 30-day `STALE_PACK_WARNING` boundary — plus a control assertion (the sole permitted `Date` reference in `packages/engine`, behind a scoped `eslint-disable-next-line`) proving the `vi.stubEnv('TZ', ...)` stub genuinely changes what the platform returns, so the deep-equality assertions are not passing vacuously
- `perf.test.ts` + `__fixtures__/fifty-line-fixture.ts` assert the 100ms/50-line budget as a median of 20 samples after a discarded 5-run warm-up, timing only `assess()` via `node:perf_hooks`; a retained control test proves the identical sampling helper reports a median *over* the budget against a deliberately slow 120ms busy-loop
- `assess.property.test.ts` runs a 10,000-case fast-check property (seed `20260915`, the same seed `packages/schemas`'s SCHEMA-07 harness uses) over real `assess()` output — reusing Phase 1's `expenseLineArb`/`minimalRulePackArb` rather than a second arbitrary set — asserting every money field is an integer, `finalAmount` stays `null`, and the four totals formulas hold when independently re-derived from the engine's own per-line verdicts
- `packages/schemas/src/constants.ts` gains `LEGAL_CONCLUSION_BANNED_WORDS`, AC-32(a)'s eight-word list transcribed verbatim, as the one shared export this plan's `engine-language.test.ts` and later Phase 3/5 checks will all import
- `engine-language.test.ts` enumerates all 21 of `messages.ts`'s exports programmatically (`Object.entries`, not a hand-written list) and checks each returned string against the shared banned-word list on case-sensitive word boundaries — proven, during this plan's own RED phase, to correctly distinguish the banned lower-case adjective ("legal") from the Legal *department*'s proper noun ("Legal"), which a naive case-insensitive matcher genuinely breaks on 6 of the 21 real templates

## Task Commits

Each TDD task followed RED → GREEN (no REFACTOR needed — all three GREEN fixes were single-line assertion flips, plus one config fix folded into Task 2's GREEN commit):

1. **Task 1: Timezone invariance, with a harness proven able to detect timezone dependence**
   - `7283a3e` — test(02-07): add failing test for TZ-invariance gate integrity control (RED)
   - `8d85ef8` — feat(02-07): correct the TZ gate-integrity control assertion (GREEN)
2. **Task 2: The 100ms budget, measured so it will not flake and proven able to fail**
   - `3e62132` — test(02-07): add failing test for the 100ms/50-line perf budget control (RED)
   - `329838e` — feat(02-07): correct the perf-budget control assertion (GREEN)
3. **Task 3: The money-integrity property over real assess() output, and the engine's own language**
   - `f9cdeaa` — test(02-07): add failing tests for money-integrity and banned-language proofs (RED)
   - `5e50248` — feat(02-07): correct the money-integrity and banned-word assertions (GREEN)

A follow-up correctness fix, discovered during final plan-level verification (not part of any task's TDD cycle):
   - `238f215` — fix(02-07): rename purity.tz.test.ts describe blocks so -t "tz" actually matches

**Plan metadata:** committed alongside this SUMMARY (see final commit below).

## TDD Gate Compliance

| Task | RED commit | GREEN commit | RED evidence | Status |
|------|-----------|---------------|---------------|--------|
| 1 | `7283a3e` | `8d85ef8` | `RED_EVIDENCE_OK` (control assertion written backwards — `toBe` instead of `not.toBe` — failed genuinely: `expected -840 to be +0`) | Pass |
| 2 | `3e62132` | `329838e` | `RED_EVIDENCE_OK` (control assertion written backwards — `toBeLessThan` instead of `toBeGreaterThan` — failed genuinely: `expected 120.01ms to be less than 100`) | Pass |
| 3 | `f9cdeaa` | `5e50248` | `RED_EVIDENCE_OK`, verified twice: the property-test target (`Number.isInteger` inverted — `Property failed after 1 tests`) and the language-test target (naive case-insensitive matcher — `expected 'legal' to be null`, plus 5 other real templates and both control strings failing for the same on-topic reason) | Pass |

All three RED phases were validated with `gsd-tools check tdd-red-evidence` before their GREEN commits. Unlike prior plans in this phase, no `vitest --reporter=tap-flat` summary-line bridging surprise arose beyond the already-documented workaround (Vitest's tap reporters carry no native `# tests`/`# pass`/`# fail` line) — the same hand-appended-summary technique from 02-01 onward was reused without incident.

**Why the RED-phase mechanism differs from earlier plans in this phase:** 02-01/02-02/02-06 introduced a deliberately-broken *production* stub (e.g. an off-by-one boundary, an incomplete fixture) because those tasks were building new engine logic for the first time. This plan's three tasks instead *prove properties over already-correct code* from 02-01/02-04/02-06 — there was no natural "incomplete first draft" to write. Deliberately inverting one assertion in the new test file itself (documented per-task above) produced an equally genuine, on-topic, named-assertion RED without ever committing a purity-violating or arithmetically-wrong state into `packages/engine`'s production source — see "Decisions Made" below for why that alternative was rejected.

## Files Created/Modified

- `packages/engine/src/purity.tz.test.ts` — TZ-invariance proof over three fixtures plus the gate-integrity control
- `packages/engine/src/perf.test.ts` — the 100ms/50-line budget as a median-of-20, plus the retained slow-control proof
- `packages/engine/src/__fixtures__/fifty-line-fixture.ts` — `buildFiftyLineFixture()`/`FIFTY_LINE_FIXTURE_LINES`, 50 varied lines across the reference pack's six worked categories
- `packages/engine/src/assess.property.test.ts` — the 10,000-run money-integrity property over real `assess()` output, plus a same-seed schema-parse property
- `packages/engine/src/engine-language.test.ts` — the exhaustive, programmatically-enumerated banned-word check over `messages.ts`
- `packages/engine/tsconfig.json` — added `"types": ["node"]` (Rule 3 auto-fix, see Deviations)
- `packages/schemas/src/constants.ts` — `LEGAL_CONCLUSION_BANNED_WORDS` (additive, AC-32(a) verbatim)
- `packages/schemas/src/assessment.property.test.ts` — module-note update only, pointing at the new engine-side re-point; no test-case changes

## Decisions Made

- Banned-word matching is case-sensitive on word boundaries, not case-insensitive — see frontmatter `key-decisions` for the full account. This was confirmed, not assumed: the RED phase's naive case-insensitive matcher was empirically shown to break 6 of `messages.ts`'s 21 real templates (every one mentioning the Legal department) plus both control-string assertions.
- All three RED phases used a deliberately-backwards test assertion rather than a broken production stub, because the code under test in each task was already correct from prior plans — see frontmatter `key-decisions` and the TDD Gate Compliance note above.
- `packages/engine/tsconfig.json` gained `"types": ["node"]`, mirroring `packages/schemas/tsconfig.json`'s pre-existing identical entry, so `perf.test.ts`'s `node:perf_hooks` import resolves under `tsc --build`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `packages/engine/tsconfig.json` had no `"types"` field, so `tsc` could not resolve `node:perf_hooks`**
- **Found during:** Task 2, GREEN phase, `pnpm run typecheck`
- **Issue:** `error TS2591: Cannot find name 'node:perf_hooks'` — `@types/node` is a root devDependency, but `packages/engine/tsconfig.json` (unlike `packages/schemas/tsconfig.json`, which already carries `"types": ["node"]` for its own `node:fs`/`node:path` imports) had no `"types"` entry, so TypeScript's automatic `@types/*` inclusion was not resolving `node` for this project.
- **Fix:** Added `"types": ["node"]` to `packages/engine/tsconfig.json`, matching `packages/schemas/tsconfig.json`'s existing pattern exactly.
- **Files modified:** `packages/engine/tsconfig.json`
- **Verification:** `pnpm run typecheck` clean; `pnpm run lint`/`pnpm run depcruise` unaffected; full 351/351-then-378/378 monorepo suite green at each subsequent check.
- **Committed in:** `329838e` (Task 2 GREEN)

**2. [Rule 1 - Bug] `purity.tz.test.ts`'s own `<verify>` command (`-t "tz"`) matched zero tests**
- **Found during:** final plan-level verification, re-running every task's literal `<verify>` command from the PLAN.md before writing this SUMMARY
- **Issue:** Neither of the file's two `describe` blocks contained the substring `"tz"` (both spelled "timezone" in full), so `pnpm vitest run --project engine -t "tz"` — the plan's own Task 1 verify command — matched and ran zero tests. The plan's own `<fails_when>` for that command names exactly this failure mode ("the run matches zero tests").
- **Fix:** Renamed both `describe` blocks to include `"tz"` (`"...timezone (tz) swing"`, `"...the tz environment stub..."`). No behavior change.
- **Files modified:** `packages/engine/src/purity.tz.test.ts`
- **Verification:** `pnpm vitest run --project engine -t "tz"` now matches 4 tests, all passing; full engine suite re-confirmed 182/182 clean across 11 consecutive runs; lint/typecheck/depcruise all clean.
- **Committed in:** `238f215` (standalone fix commit, after all three tasks' GREEN commits)

---

**Total deviations:** 2 auto-fixed (1 blocking — missing tsconfig `types` entry, 1 bug — a `<verify>` command's own filter pattern matched nothing)
**Impact on plan:** Both were caught and fixed before this SUMMARY was written; neither reflects a defect in `assess()` or any other production logic — one is monorepo tooling configuration, the other is test-naming hygiene against the plan's own verify commands. No scope creep beyond the plan's three tasks.

## Issues Encountered

- One transient test-suite flake was observed during Task 2 development (`1 failed | 154 passed` on a single run) while an unrelated background filesystem scan (`find /` from an earlier diagnostic step, since terminated) was still consuming I/O. Eleven consecutive clean runs after clearing that background process, and no further flakes across ~15 additional full-suite runs during Task 3 and final verification, confirm this was environmental interference rather than a flaky perf assertion — no change was made to the 100ms budget or its measurement approach on the strength of a single, externally-explained anomaly.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `assess()` now has all four of this phase's remaining proof obligations discharged: timezone invariance (ENGINE-15), the performance budget (ENGINE-17), the money-integrity property (ENGINE-08, AC-07b/AC-22/AC-25), and engine-authored language (part of ENGINE-01, AC-32a) — each proven by a harness shown able to fail, not merely shown to pass.
- `ENGINE-01` and `ENGINE-15` were shared with sibling plans (02-01, 02-02) and are now fully resolved — `gsd-tools query requirements.ready-ids` confirms all 4 of this plan's declared requirements (`ENGINE-01`, `ENGINE-08`, `ENGINE-15`, `ENGINE-17`) are ready and are marked `Complete` below.
- `LEGAL_CONCLUSION_BANNED_WORDS` (packages/schemas/src/constants.ts) is now available for Phase 3's pack validator (to check every `basis`/`citation` string a rule pack authors) and Phase 5's UI string check, per AC-32(a)'s own requirement that this be one shared list, not three independent copies.
- This is the last plan in Phase 2 — every requirement ENGINE-01 through ENGINE-17 now has a completed plan behind it. `packages/engine` is green across the full workspace (378/378 tests, lint, typecheck, depcruise all clean) and ready for Phase 3's real rule packs to be evaluated against it.
- No blockers for the next phase.

## Self-Check: PASSED

- All 5 created files verified present on disk (`[ -f ]`): `purity.tz.test.ts`, `perf.test.ts`, `__fixtures__/fifty-line-fixture.ts`, `assess.property.test.ts`, `engine-language.test.ts`.
- All 8 task/fix commit hashes verified present in `git log --oneline`.
- Full engine test suite re-run: `pnpm vitest run --project engine` — 182/182 passing, twice in succession, ~2.4-2.5s each (well inside the 10s feedback-latency budget).
- Full monorepo suite re-run: `pnpm test` — 378/378 passing.
- `pnpm run typecheck`, `pnpm run lint`, `pnpm run depcruise` all re-run clean.
- `gsd-tools query requirements.ready-ids` — 4/4 ready (ENGINE-01, ENGINE-08, ENGINE-15, ENGINE-17).
- `plan_head_before: 8cd3f53c517ffdf84c312fd1bf0bce245f9506a1`, `commits: 7` (measured via `git rev-list --count`; the 8th commit is this SUMMARY's own metadata commit, not yet counted at self-check time).

---
*Phase: 02-deterministic-fee-engine*
*Completed: 2026-09-15*
