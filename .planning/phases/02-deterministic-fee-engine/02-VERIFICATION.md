---
phase: 02-deterministic-fee-engine
verified: 2026-09-16T08:00:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .dependency-cruiser.cjs
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/phases/02-deterministic-fee-engine/02-01-PLAN.md
  - .planning/phases/02-deterministic-fee-engine/02-01-SUMMARY.md
  - .planning/phases/02-deterministic-fee-engine/02-02-PLAN.md
  - .planning/phases/02-deterministic-fee-engine/02-02-SUMMARY.md
  - .planning/phases/02-deterministic-fee-engine/02-03-PLAN.md
  - .planning/phases/02-deterministic-fee-engine/02-03-SUMMARY.md
  - .planning/phases/02-deterministic-fee-engine/02-04-PLAN.md
  - .planning/phases/02-deterministic-fee-engine/02-04-SUMMARY.md
  - .planning/phases/02-deterministic-fee-engine/02-05-PLAN.md
  - .planning/phases/02-deterministic-fee-engine/02-05-SUMMARY.md
  - .planning/phases/02-deterministic-fee-engine/02-06-PLAN.md
  - .planning/phases/02-deterministic-fee-engine/02-06-SUMMARY.md
  - .planning/phases/02-deterministic-fee-engine/02-07-PLAN.md
  - .planning/phases/02-deterministic-fee-engine/02-07-SUMMARY.md
  - .planning/phases/02-deterministic-fee-engine/02-CONTEXT.md
  - .planning/phases/02-deterministic-fee-engine/02-REVIEW.md
  - .planning/phases/02-deterministic-fee-engine/02-SECURITY.md
  - .planning/phases/02-deterministic-fee-engine/02-UAT.md
  - .planning/phases/02-deterministic-fee-engine/02-VALIDATION.md
  - eslint.config.js
  - packages/engine/src/aggregate-cap.ts
  - packages/engine/src/apply-cap.ts
  - packages/engine/src/assess.ts
  - packages/engine/src/calendar-math.test.ts
  - packages/engine/src/calendar-math.ts
  - packages/engine/src/conditions.ts
  - packages/engine/src/cross-line-checks.ts
  - packages/engine/src/errors.ts
  - packages/engine/src/evaluate-line.ts
  - packages/engine/src/flat-fee.ts
  - packages/engine/src/index.ts
  - packages/engine/src/matter-flags.ts
  - packages/engine/src/messages.ts
  - packages/engine/src/posture-gate.ts
  - packages/engine/src/preconditions.ts
  - packages/engine/src/totals.ts
  - packages/schemas/src/assessment.ts
  - packages/schemas/src/constants.ts
  - packages/schemas/src/primitives.ts
  - vitest.config.ts
covered_digest: "v1:sha256:8e27be7dfb0085e854d1efea231fb84c9ad1965ec2223778b6c344ce0cdb0587"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: "5/5 (2 with noted warnings; 2 items routed to human_verification)"
  gaps_closed:
    - "Legal-correctness sign-off on the PRD §14 reference fixture — confirmed via 02-UAT.md item 1 (result: pass, 2026-09-15T15:28:17Z)"
    - "WR-02 scope decision (PERMITTED_NARROW_EXCEPTION's missing matter-level flag) — confirmed via 02-UAT.md item 2 (result: pass); the human reviewer accepted the deferral reasoning (low current impact, no jurisdiction pack in the Phase 3 roadmap uses this posture) as the recorded decision, matching the D-11/D-12/D-13 pattern. WR-02 itself remains open in code (no follow-up plan filed) — this is a decision to defer, not a fix, and is still listed below as a non-blocking Warning."
  gaps_remaining: []
  regressions: []
---

# Phase 2: Deterministic Fee Engine Verification Report

**Phase Goal:** `assess()` computes a defensible fee from a rule pack, proven correct against hand-built fixtures before any real pack exists
**Verified:** 2026-09-16T08:00:00Z
**Status:** passed
**Re-verification:** Yes — refresh after 02-UAT.md closed both previously-open human_verification items; also re-confirmed against 4 commits since the prior verification (543d499, d0d79dd, 83d2f57, 38afcf1), of which only `d0d79dd` touches code and it changes no engine production source (a test-assertion fix and a CI timeout bump only — see Behavioral Spot-Checks)

## Staleness Re-Verification

The prior report (`verified: 2026-09-15T12:30:00Z`) went stale because `covered_files` predated four later commits. Checked each directly rather than trusting the refresh prompt's characterization:

- `543d499` (`test(02): complete UAT`) — added `02-UAT.md` only, recording both previously-open human_verification items as `result: pass`. Confirmed by reading the file directly (see `gaps_closed` above).
- `d0d79dd` (`test(02): de-flake calendar-math antisymmetry and the toolchain gate timeout`) — `git show d0d79dd --stat` confirms exactly two files touched: `packages/engine/src/calendar-math.test.ts` (13 lines: `.toBe(-(numA-numB))` → an explicit `===` comparison, because `-(numA-numB)` is signed `-0` when fast-check draws two equal dates and `.toBe` is `Object.is`) and `vitest.config.ts` (adds `testTimeout: 30000` to the `toolchain` project, which runs a real ESLint and a real dependency-cruiser and was timing out under the 5s default when all seven Vitest projects contend for CPU). Neither change touches `assess.ts`, `totals.ts`, `apply-cap.ts`, `aggregate-cap.ts`, `posture-gate.ts`, `evaluate-line.ts`, `cross-line-checks.ts`, `matter-flags.ts`, `flat-fee.ts`, `preconditions.ts`, `calendar-math.ts` (production), or any `packages/schemas` source. `git diff --stat 00b3b3b..HEAD -- packages/engine/src packages/schemas/src` (the commit the prior 02-REVIEW.md was written against) confirms zero production-source diff across the whole window.
- `83d2f57` (`docs(02): update validation strategy`) — `02-VALIDATION.md` frontmatter reads `status: validated`, `nyquist_compliant: true`. Read directly; no gaps left open in the file.
- `38afcf1` (`docs(02): add security threat verification`) — `02-SECURITY.md` frontmatter reads `status: verified`, `threats_open: 0`. Read directly; all 24 threats in the register show `Status: closed`.

Conclusion: the prior report's evidence for all five Success Criteria still holds unchanged against HEAD, because the engine's production source is byte-identical to what it verified. The only thing that changed is that both outstanding human_verification items are now closed, and the test suite is measurably more robust (an intermittent false-red is now fixed, not glossed over).

## Goal Achievement

### Observable Truths

| # | Truth (from Success Criteria) | Status | Evidence |
|---|---|---|---|
| 1 | `assess()` produces correct verdicts/amounts for all five treatments; `ALLOW_IF`→`CONDITIONS_NOT_MET` names failed conditions; `applyCap` rounds down across all four `Cap` types (AC-07c); aggregate cap applies pro-rata with residue unallocated and flagged | ✓ VERIFIED | `evaluate-line.ts:102-164` dispatches all five treatments exhaustively (no default branch — a missing case is a compile error). `apply-cap.ts:30-53` computes PER_UNIT/PER_LINE/PERCENT_OF_CLAIM with `Math.floor`, never `Math.round`, and refuses PER_MATTER with a typed error. `aggregate-cap.ts:51-73` applies PER_MATTER (and PERCENT_OF_CLAIM) aggregate caps pro-rata, `Math.floor` once per line, residue left unallocated (`aggregate-cap.ts:68-70`) and flagged via `AGGREGATE_CAP_APPLIED` (`aggregate-cap.ts:140-145`). Golden test (`reference-fixture.golden.test.ts:66-73,89-92`) reproduces PRD §14's exact verdicts/amounts including line 5's `CONDITIONS_NOT_MET`. `apply-cap.test.ts`/`aggregate-cap.test.ts` assert AC-07c's literal 84/33 examples and the residue policy directly. Re-confirmed unchanged this round: production source identical to prior verification (see Staleness Re-Verification). |
| 2 | Purity enforced by CI, not convention: no `fs`/`fetch`/Prisma/LLM import reaches `packages/engine`; no bare `Date`/`Date.now()`/`Math.random()` in source; suite passes identically under two TZ/locale combinations | ✓ VERIFIED (with a noted proof-coverage gap, WR-03) | `.dependency-cruiser.cjs` + `eslint.config.js` ban the relevant imports/globals, each proven to fire against a deliberately violating fixture (`tests/toolchain/lint-engine-determinism.test.ts`, `tests/toolchain/purity-gate.test.ts`). `purity.tz.test.ts` runs `assess()` under UTC and UTC+14 over three fixtures and asserts deep equality, with a retained control proving the TZ stub genuinely takes effect. This round's `d0d79dd` commit strengthens rather than weakens this truth: the calendar-math antisymmetry property test now compares with `===` instead of `.toBe` (`Object.is`), removing a spurious intermittent failure on the very date-arithmetic module this truth's TZ-invariance proof depends on, and the toolchain gate's timeout was raised so the gates that enforce this truth stop failing under CI contention on their own passing assertions. `pnpm run depcruise` re-run this round: "no dependency violations found (81 modules, 188 dependencies cruised)". `pnpm run lint` re-run this round: clean. **Caveat (REVIEW.md WR-03, unchanged):** both TZ legs tested are whole-hour offsets (UTC, UTC+14); no fractional-hour offset is exercised. `calendar-math.ts` is pure integer arithmetic reading no `Date`, so this is a proof-coverage gap, not a live defect. |
| 3 | Engine flags rather than decides: `NO_EXPRESS_AUTHORITY`→every line FLAG/`NO_FEE_AUTHORITY`, `draftBaseline` 0 (AC-14); `PROHIBITED`→every line DISALLOW (AC-13); `OTHER_UNCLASSIFIED`→always FLAG (AC-19); every cross-line check raises a flag, never a silent adjustment | ✓ VERIFIED (with one documented, now-dispositioned PRD-spec gap, WR-02) | `posture-gate.ts:20-43` is an exhaustive switch with no default branch. `evaluate-line.ts:89-100` checks `OTHER_UNCLASSIFIED` after the posture gate and before the treatment table. `cross-line-checks.ts` computes reasons only and never rewrites `engineAmount`; `assess.ts`'s single application site flips a tripped line to FLAG with `engineAmount` 0, proven by the golden fixture's line 5 and a dedicated materiality-transition test. **WR-02, now closed as a recorded deferral:** `matter-flags.ts`'s `DERIVED_MATTER_FLAG_SPECS` (re-read this round, lines 168-204) still has no matter-level flag for `PERMITTED_NARROW_EXCEPTION` — the code is unchanged from the prior verification, so PRD §6.0's "carries a mandatory matter-level flag naming the exception" is still not implemented. What changed is disposition: `02-UAT.md` item 2 records a human reviewer accepting the deferral (low current impact, no Phase 3 jurisdiction pack uses this posture) as the answer to "fix now vs. defer with reasoning" — the same kind of explicit decision D-11/D-12/D-13 received. This is a decision to leave the gap open, not a code fix; it remains listed under Anti-Patterns below as a non-blocking Warning rather than a blocking gap, because the human checkpoint this phase's workflow provides for exactly this class of question has now run and returned "defer." |
| 4 | `finalAmount` null and unrepresentable before sign-off (AC-25); FLAG lines contribute 0 to `draftBaseline` with claimed value only in `flaggedTotal` (AC-11); `restingOnUnverifiedRules` ⊂ `draftBaseline` (AC-22) | ✓ VERIFIED | `totals.ts:94` sets `finalAmount: null` as the sole, unconditional literal. `totals.ts:75-80` only adds a FLAG line's `claimedAmount` to `flaggedTotal`. `totals.ts:60-63` computes `restingOnUnverifiedRules` strictly inside the `draftBaseline`-eligible branch. All three properties proven over 10,000 generated `assess()` outputs by `assess.property.test.ts`. Unchanged this round. |
| 5 | 50-line assessment under 100ms (§11); stored `claimedAmount ≠ quantity×unitRate` is a hard error blocking submission (AC-08); flat-fee-bearing pack returns both itemised baseline and flat figure plus whether flat exceeds itemised | ✓ VERIFIED | `perf.test.ts:65-79` measures the median of 20 samples after a discarded warm-up, timing only `assess()` via `node:perf_hooks`, asserting `< 100ms`, with a retained slow-control proving the harness can fail. `preconditions.ts` throws `CLAIMED_AMOUNT_MISMATCH` independently of the schema's own `superRefine`. `flat-fee.ts`'s `computeFlatFeeComparison()` is wired into `totals.ts:84,97`. Unchanged this round. |

**Score:** 5/5 must-haves verified (all five roadmap Success Criteria hold in the codebase, re-confirmed against HEAD). One is annotated with a real, non-blocking, now-explicitly-deferred gap (WR-02) and one with a proof-coverage caveat (WR-03); neither breaks a stated Success Criterion, and both are unchanged in the code from the prior verification. Both previously outstanding human_verification items are now closed (02-UAT.md, 2/2 passed).

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/engine/src/assess.ts` | PRD §8.1's 7-step orchestrator | ✓ VERIFIED | All seven steps present and correctly ordered; unchanged this round. |
| `packages/engine/src/preconditions.ts` | 6 typed precondition refusals | ✓ VERIFIED | `PACK_NOT_ACTIVE`, `PACK_PAST_REVIEW_DUE`, `CONTROLLER_TYPE_NOT_IN_SCOPE`, `CURRENCY_MISMATCH`, `CLAIMED_AMOUNT_MISMATCH`, `NEGATIVE_UNIT_RATE` — all six confirmed present. |
| `packages/engine/src/totals.ts` | 6 `Totals` formulas (incl. flat-fee) | ✓ VERIFIED | Direct read confirms all formulas. |
| `packages/engine/src/apply-cap.ts` | 3 single-line cap types + 1 refused | ✓ VERIFIED | `PER_MATTER` throws `EngineComputationFailure`. |
| `packages/engine/src/aggregate-cap.ts` | Pro-rata aggregate cap, residue unallocated | ✓ VERIFIED | Direct read confirms the algorithm and D-11's matter-flag wiring. WR-01/WR-04 (float-precision-at-extreme-magnitude; per-line cap identity overwrite) still present, still Warnings, still not exercised at the affected magnitude for realistic DSAR fees. |
| `packages/engine/src/posture-gate.ts` | Exhaustive 7-posture switch | ✓ VERIFIED | No default branch. |
| `packages/engine/src/evaluate-line.ts` | 5-treatment dispatch + AC-19 override | ✓ VERIFIED | Ordering unchanged. |
| `packages/engine/src/cross-line-checks.ts` | 4 checks, no 5th | ✓ VERIFIED | D-13's absence remains recorded in-source. |
| `packages/engine/src/matter-flags.ts` | Pack rules (3 `when` arms) + 4 derived codes | ✓ VERIFIED | `PERMITTED_NARROW_EXCEPTION`'s missing flag (WR-02) remains the one gap, now a recorded deferral rather than an open question. |
| `packages/engine/src/flat-fee.ts` | D-12/ENGINE-16 comparison | ✓ VERIFIED | Strict `>` comparison confirmed. |
| `packages/engine/src/calendar-math.ts` + `calendar-math.test.ts` | Date-free calendar arithmetic, property-tested | ✓ VERIFIED | Antisymmetry property now asserts with `===` rather than `.toBe`, correctly treating `-0`/`+0` as equal per the mathematical claim; `civilToDayNumber` itself unchanged. |
| `eslint.config.js`, `.dependency-cruiser.cjs` | Determinism/purity gates | ✓ VERIFIED | Both re-run clean this round (`pnpm run lint`, `pnpm run depcruise`) and both previously proven to fire against violating fixtures. |
| `vitest.config.ts` | Toolchain project timeout sized to its real cold-start cost | ✓ VERIFIED | `testTimeout: 30000` on the `toolchain` project (line 61), documented in-file as fixing an intermittent false-red under CI contention, not masking a real failure — its own violating fixtures still fire per the commit message. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `assess.ts` | `AssessmentSchema` | Tracer/golden tests parse every produced `Assessment` | ✓ WIRED | Unchanged. |
| `posture-gate.ts` | `evaluate-line.ts` | Step-2-before-step-3 ordering | ✓ WIRED | Unchanged. |
| `cross-line-checks.ts` | `AssessmentLineSchema`'s bidirectional refinement | Verdict flip at single application site in `assess.ts` | ✓ WIRED | Unchanged. |
| `aggregate-cap.ts` | `MatterFlagCodeSchema.AGGREGATE_CAP_APPLIED` | D-11 schema amendment (02-03) | ✓ WIRED | Unchanged. |
| `flat-fee.ts` | `TotalsSchema.flatFeeComparison` | D-12 schema amendment (02-03) | ✓ WIRED | Unchanged. |
| `matter-flags.ts` | `calendar-math.ts` | 30-day staleness window shares `daysUntil` with preconditions | ✓ WIRED | Unchanged. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full test suite passes | `pnpm test` (re-run live this round, not taken from the prompt) | 36 files / 378 tests passed | ✓ PASS |
| Engine project alone | `pnpm vitest run --project engine` (re-run live) | 17 files / 182 tests passed | ✓ PASS |
| Lint clean | `pnpm run lint` (re-run live) | Exit clean, no output | ✓ PASS |
| Dependency-cruiser clean | `pnpm run depcruise` (re-run live) | "no dependency violations found (81 modules, 188 dependencies cruised)" | ✓ PASS |
| Typecheck clean | `pnpm run typecheck` (re-run live) | Exit clean, no output | ✓ PASS |
| `d0d79dd`'s calendar-math fix is real, not cosmetic | `git show d0d79dd -- packages/engine/src/calendar-math.test.ts` (read directly) | Confirmed: `.toBe(-(numA-numB))` (Object.is, fails on `-0`≠`+0`) replaced with an explicit `===` comparison plus a descriptive message | ✓ PASS |
| `d0d79dd`'s timeout fix targets the claimed project only | `grep -n testTimeout vitest.config.ts` | Line 61: `testTimeout: 30000` inside the `toolchain` project block only; the pre-existing `engine` project's `testTimeout: 120000` (line 44) is untouched | ✓ PASS |
| No debt markers in files this round's commits touched | `grep -nE "TBD\|FIXME\|XXX" packages/engine/src/calendar-math.test.ts vitest.config.ts` | No matches | ✓ PASS |
| Golden fixture reproduces PRD §14 exactly | Direct read of `reference-fixture.golden.test.ts` | All totals/verdicts/matter flags match §14 literally | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Status | Evidence |
|---|---|---|---|
| ENGINE-01 | 02-01, 02-02, 02-07 | ✓ SATISFIED | Purity statically gated and fixture-proven; re-confirmed clean this round. |
| ENGINE-02 | 02-01 | ✓ SATISFIED | 6 typed preconditions, tested. |
| ENGINE-03 | 02-04 | ✓ SATISFIED (WR-02 noted, now a recorded deferral) | Exhaustive posture switch. |
| ENGINE-04 | 02-04 | ✓ SATISFIED | 5 treatments dispatch correctly. |
| ENGINE-05 | 02-04 | ✓ SATISFIED | All 4 `Cap` types handled, all rounding down. |
| ENGINE-06 | 02-05 | ✓ SATISFIED | 4 of 5 PRD-listed checks built; the 5th deliberately dropped under D-13. |
| ENGINE-07 | 02-03, 02-05 | ✓ SATISFIED | Pro-rata aggregate cap, residue unallocated, matter flag. WR-01/WR-04 noted as edge-case gaps. |
| ENGINE-08 | 02-01, 02-07 | ✓ SATISFIED | `finalAmount` null; 10,000-run property. |
| ENGINE-09 | 02-01, 02-04 | ✓ SATISFIED | FLAG lines contribute 0 to draftBaseline. |
| ENGINE-10 | 02-01, 02-04 | ✓ SATISFIED | Subset property structural + property-tested. |
| ENGINE-11 | 02-06 | ✓ SATISFIED (WR-02 gap adjacent, now dispositioned) | Pack rules + 3 named derived codes (+1) all implemented. |
| ENGINE-12 | 02-04 | ✓ SATISFIED | AC-19 exception ordering correct. |
| ENGINE-13 | 02-01 | ✓ SATISFIED | Independent engine-level re-check of claimedAmount. |
| ENGINE-15 | 02-02, 02-07 | ✓ SATISFIED (WR-03 proof-coverage gap noted) | TZ invariance proven for 2 whole-hour offsets; the antisymmetry proof this rests on is now de-flaked (`d0d79dd`). |
| ENGINE-16 | 02-03, 02-06 | ✓ SATISFIED | Flat-fee comparison strict, reports without choosing. |
| ENGINE-17 | 02-07 | ✓ SATISFIED | Median-of-20 under 100ms, harness proven to fail. |
| ENGINE-14 | *(Phase 6, not this phase's scope)* | N/A — correctly out of scope | Confirmed absent from Phase 2's requirement IDs; REQUIREMENTS.md maps it to Phase 6. Not an orphan. |

No orphaned requirements: every ID in REQUIREMENTS.md mapped to Phase 2 (ENGINE-01 through ENGINE-13, ENGINE-15 through ENGINE-17) appears in at least one plan's `requirements:` frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `packages/engine/src/aggregate-cap.ts` | 68 | `Math.floor((capAmount * amount) / sum)` — float precision loss possible at extreme `Minor` magnitudes (WR-01) | ⚠️ Warning | Unchanged from prior round. Not exercised by any test at the affected magnitude; real DSAR fees never approach it. |
| `packages/engine/src/aggregate-cap.ts` | 130-138 | Per-line `appliedCap` silently overwritten when aggregate cap also binds (WR-04) | ⚠️ Warning | Unchanged. Schema change needed for a full fix, correctly out of this phase's additive-only latitude. |
| `packages/engine/src/posture-gate.ts`, `matter-flags.ts` | 22-34 / 168-204 | `PERMITTED_NARROW_EXCEPTION` never raises the PRD §6.0-mandated matter-level flag (WR-02) | ⚠️ Warning | Code unchanged; disposition changed — 02-UAT.md item 2 records the human decision to defer (no Phase 3 pack uses this posture). No longer an open question, still an open code gap tracked as a documented Warning. |
| `packages/engine/src/purity.tz.test.ts` | 35-36 | Only whole-hour TZ offsets tested (WR-03) | ⚠️ Warning | Proof-coverage gap, not a live defect. |
| `packages/engine/src/assess.ts` | 117-121, 142-150 | Three internal-consistency violations thrown as plain `Error`, not the typed error family (IN-01) | ℹ️ Info | Not user-facing. |
| `packages/engine/src/messages.ts` | 84-99 | `ruleAuthoredFlagMessage`'s FlagReasonCode reuse self-documented as untested for a real-pack case (IN-02) | ℹ️ Info | Explicitly flagged in source. |
| `packages/schemas/src/primitives.ts` | 170, 202 | `AGGREGATE_CAP_APPLIED` exists in two enums by design (IN-03) | ℹ️ Info | Documented deliberate choice (D-11). |

No debt markers (TBD/FIXME/XXX) found in the two files this round's commit modified (`calendar-math.test.ts`, `vitest.config.ts`), re-checked live. No unreferenced TODO/HACK/PLACEHOLDER found.

### Gaps Summary

No must-have truth failed. All five roadmap Success Criteria are observably true against HEAD, re-confirmed by a live re-run of the full suite (378/378), the engine project alone (182/182), lint, dependency-cruiser (81 modules / 188 dependencies, zero violations) and typecheck — all clean.

Both items previously routed to human_verification are now closed:

1. **Legal-correctness sign-off on the reference fixture** — `02-UAT.md` item 1: `result: pass`.
2. **WR-02 scope decision** — `02-UAT.md` item 2: `result: pass`. The recorded decision is to defer (not to fix): no jurisdiction pack in the Phase 3 roadmap uses `PERMITTED_NARROW_EXCEPTION`, so the missing matter-level flag stays an open, documented code gap (Warning severity) rather than a blocking one. This should be tracked before any future pack activates that posture — it is not re-litigated here because the phase's own human-verification checkpoint has now run and returned an answer, matching the D-11/D-12/D-13 pattern this phase established for exactly this kind of scope question.

WR-01 and WR-04 (both in `aggregate-cap.ts`) remain real, low-practical-impact edge cases at the boundary of the schema's legal range, unchanged from the prior verification and still candidates for a follow-up plan rather than blockers.

**Net effect of this refresh:** status moves from `human_needed` to `passed`. The phase goal — `assess()` computes a defensible fee from a rule pack, proven correct against hand-built fixtures — holds against the current tree, and the two items that had kept it at `human_needed` are now closed by recorded human decisions rather than by silently dropping them.

---

_Verified: 2026-09-16T08:00:00Z_
_Verifier: Claude (gsd-verifier)_
