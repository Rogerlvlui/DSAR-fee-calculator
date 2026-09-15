---
phase: 02-deterministic-fee-engine
verified: 2026-09-15T12:30:00Z
status: human_needed
score: 5/5 must-haves verified (2 with noted warnings; 1 behavior-unverified item routed to human)
covered_files:
  - .dependency-cruiser.cjs
  - .planning/REQUIREMENTS.md
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
  - .planning/phases/02-deterministic-fee-engine/02-VALIDATION.md
  - eslint.config.js
  - packages/engine/src/aggregate-cap.ts
  - packages/engine/src/apply-cap.ts
  - packages/engine/src/assess.ts
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
covered_digest: "v1:sha256:c9d92b5939f3871b4bb79af331811d0929d04465a70ce8294a19d052d97c0278"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Confirm with the authoring counsel (docs/sg-pack-authoring-worksheet.md) that PRD §14's reference fixture treatments are a defensible legal reading — in particular that STAFF_TIME_ASSESS_EXEMPTIONS is DISALLOW and that the 40% materiality / rateSanityCeiling figures are the right policy thresholds."
    expected: "Counsel confirms or corrects the fixture's proposed treatments; this phase's own plans (02-04, 02-05, 02-06) already flag this as `human_judgment: true` and explicitly out of engineering scope."
    why_human: "The arithmetic is machine-verified by the golden test; whether the underlying legal position is defensible is a legal judgment, not a code property. Explicitly deferred by the plan authors themselves (02-04-PLAN.md's own `<verify><human-check>` block)."
  - test: "Decide whether WR-02 (PERMITTED_NARROW_EXCEPTION never raises the PRD-mandated matter-level flag naming the exception) needs a follow-up plan before Phase 3 activates a pack that could use this posture, or is safe to defer since no current jurisdiction pack uses it."
    expected: "A decision recorded (either a follow-up fix or an explicit deferral with reasoning), matching the pattern D-11/D-12/D-13 already established in this phase for exactly this kind of gap."
    why_human: "This is a real, specific PRD §6.0 requirement ('carries a mandatory matter-level flag naming the exception') with no corresponding code path — not a judgment call about correctness, but a scope decision about whether an omission the code reviewer found needs remediation now or can be tracked as a follow-up. Low current impact (reserved for a future EU/GDPR-shaped pack, NS-10 out of scope) but it is a silent, undocumented gap against the PRD's literal text, unlike D-13 which was explicitly escalated and decided."
---

# Phase 2: Deterministic Fee Engine Verification Report

**Phase Goal:** `assess()` computes a defensible fee from a rule pack, proven correct against hand-built fixtures before any real pack exists
**Verified:** 2026-09-15T12:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (from Success Criteria) | Status | Evidence |
|---|---|---|---|
| 1 | `assess()` produces correct verdicts/amounts for all five treatments; `ALLOW_IF`→`CONDITIONS_NOT_MET` names failed conditions; `applyCap` rounds down across all four `Cap` types (AC-07c); aggregate cap applies pro-rata with residue unallocated and flagged | ✓ VERIFIED | `evaluate-line.ts:102-164` dispatches all five treatments exhaustively (no default branch — a missing case is a compile error). `apply-cap.ts:30-53` computes PER_UNIT/PER_LINE/PERCENT_OF_CLAIM with `Math.floor`, never `Math.round`, and refuses PER_MATTER with a typed error since a single-line function cannot evaluate a matter-wide cap correctly. `aggregate-cap.ts:51-73` is where PER_MATTER (and PERCENT_OF_CLAIM) aggregate caps are actually applied — pro-rata, `Math.floor` once per line, residue left unallocated (`aggregate-cap.ts:68-70`) and flagged via `AGGREGATE_CAP_APPLIED` (`aggregate-cap.ts:140-145`). Together `apply-cap.ts` + `aggregate-cap.ts` cover all four `CapSchema` variants with rounding-down proven at each. Golden test (`reference-fixture.golden.test.ts:66-73,89-92`) reproduces PRD §14's exact verdicts/amounts including line 5's `CONDITIONS_NOT_MET`. `apply-cap.test.ts`/`aggregate-cap.test.ts` assert AC-07c's literal 84/33 examples and PROJECT.md's residue policy directly. |
| 2 | Purity enforced by CI, not convention: no `fs`/`fetch`/Prisma/LLM import reaches `packages/engine`; no bare `Date`/`Date.now()`/`Math.random()` in source; suite passes identically under two TZ/locale combinations | ✓ VERIFIED (with a noted proof-coverage gap, WR-03) | `.dependency-cruiser.cjs` + `eslint.config.js` ban the relevant imports/globals, each proven to fire against a deliberately violating fixture (`tests/toolchain/lint-engine-determinism.test.ts`, `tests/toolchain/purity-gate.test.ts` — both assert the ban catches something, not just that the tree is clean). `purity.tz.test.ts` runs `assess()` under UTC and UTC+14 (`Pacific/Kiritimati`) over three fixtures (incl. the exact 30-day staleness boundary) and asserts deep equality, with a retained control (`readPlatformTzOffsetMinutes`) proving the `vi.stubEnv` TZ flip genuinely takes effect (lines 87-131) — so the invariance assertions are not passing vacuously. The locale leg is enforced statically (ESLint bans `Intl`/`toLocale*`) rather than by an env flip, because research verified `LANG` does not move Node's default locale on this machine — documented in the file's own header comment and in 02-CONTEXT.md's "Claude's Discretion". **Caveat (REVIEW.md WR-03):** both TZ legs tested are whole-hour offsets (UTC, UTC+14); no fractional-hour offset (e.g. India's +5:30) is exercised, so the proof does not cover a future `Date`-based regression that happens to work at whole-hour boundaries but breaks at a fractional one. Today's code has no such path (`calendar-math.ts` is pure integer arithmetic reading no `Date`), so this is a coverage gap in the *proof*, not a live defect. |
| 3 | Engine flags rather than decides: `NO_EXPRESS_AUTHORITY`→every line FLAG/`NO_FEE_AUTHORITY`, `draftBaseline` 0 (AC-14); `PROHIBITED`→every line DISALLOW (AC-13); `OTHER_UNCLASSIFIED`→always FLAG (AC-19); every cross-line check raises a flag, never a silent adjustment | ✓ VERIFIED (with one documented PRD-spec gap, WR-02 — see human_verification) | `posture-gate.ts:20-43` is an exhaustive switch with no default branch: `NO_EXPRESS_AUTHORITY`→forced FLAG/`NO_FEE_AUTHORITY`; `PROHIBITED` and `PERMITTED_NARROW_EXCEPTION`→forced DISALLOW. `evaluate-line.ts:89-100` checks `OTHER_UNCLASSIFIED` after the (non-forcing) posture gate and before the treatment table, matching AC-19's own stated exception (gate wins when it fires). `cross-line-checks.ts` computes reasons only and never rewrites `engineAmount`; `assess.ts`'s single application site (per 02-05-SUMMARY) flips a tripped ALLOW/ALLOW_CAPPED line to FLAG with `engineAmount` 0 — proven by the golden fixture's line 5 (`CONDITIONS_NOT_MET`+`MATERIALITY`) and a dedicated materiality-transition test (`reference-fixture.golden.test.ts:227-259`). **Gap (REVIEW.md WR-02, independently confirmed against PRD text):** PRD §6.0 (docs/PRD-dsar-fee-agent.md:415) states `PERMITTED_NARROW_EXCEPTION` "carries a mandatory matter-level flag naming the exception" — no such flag exists anywhere in `matter-flags.ts`'s `DERIVED_MATTER_FLAG_SPECS` (only `NO_EXPRESS_AUTHORITY` gets a matter-level code, `NO_FEE_AUTHORITY_POSTURE`). A matter under `PERMITTED_NARROW_EXCEPTION` today produces every line DISALLOW with no accompanying notice, indistinguishable from plain `PROHIBITED` — the opposite of what the PRD sentence asks for. Unlike D-13 (which was explicitly escalated to the product owner and recorded in 02-CONTEXT.md), this gap was found by the code reviewer, not raised as a decision. Low current impact — no jurisdiction pack in the phase 3 roadmap uses this posture (reserved for a hypothetical future EU/GDPR pack, NS-10 explicitly out of scope) — but it is a literal, unaddressed PRD requirement, not a judgment call. Routed to human_verification below rather than treated as a blocking gap, matching the code review's own Warning (not Critical) severity. |
| 4 | `finalAmount` null and unrepresentable before sign-off (AC-25); FLAG lines contribute 0 to `draftBaseline` with claimed value only in `flaggedTotal` (AC-11); `restingOnUnverifiedRules` ⊂ `draftBaseline` (AC-22) | ✓ VERIFIED | `totals.ts:94` sets `finalAmount: null` as the sole, unconditional literal — no parameter, no branch, no path to `draftBaseline` (confirmed by direct code read; also grepped in 02-01-SUMMARY's self-check). `totals.ts:75-80` only adds a FLAG line's `claimedAmount` to `flaggedTotal`, never to `draftBaseline` (which is only accumulated at lines 56-57 for ALLOW/ALLOW_CAPPED). `totals.ts:60-63` computes `restingOnUnverifiedRules` strictly inside the `draftBaseline`-eligible branch, making the subset property structural rather than incidental. All three properties are additionally proven over 10,000 generated `assess()` outputs by `assess.property.test.ts` (ENGINE-08/AC-07b/AC-22/AC-25), not just the one golden fixture — with a control proving the property harness itself can fail (deliberately-inverted `Number.isInteger` assertion caught in RED, per 02-07-SUMMARY). |
| 5 | 50-line assessment under 100ms (§11); stored `claimedAmount ≠ quantity×unitRate` is a hard error blocking submission (AC-08); flat-fee-bearing pack returns both itemised baseline and flat figure plus whether flat exceeds itemised | ✓ VERIFIED | `perf.test.ts:65-79` measures the median of 20 samples after a 5-run discarded warm-up, timing only `assess()` via `node:perf_hooks` (not `Date`), asserting `< 100ms`; a retained control (`slowControl`, lines 81-96) proves the identical sampling helper reports a median *over* budget against a deliberate 120ms busy-loop — so the measurement harness is proven capable of failing, not just passing. Median-of-N is an appropriate anti-flake choice per §11's intent, though it is worth noting the criterion's literal wording ("completes in under 100ms") is satisfied via a median rather than a worst-case guarantee — a reasonable interpretation given 02-CONTEXT.md's explicit instruction that "a flaky performance test gets deleted, which is worse than none," and consistent with the phase's Validation Strategy. `preconditions.ts` (per 02-01-PLAN/SUMMARY) throws `CLAIMED_AMOUNT_MISMATCH` recomputing `quantity*unitRate` independently of the schema's own `superRefine`, with a documented rationale (a second check at the trust boundary since `assess()` does not `.parse()` its inputs). `flat-fee.ts`'s `computeFlatFeeComparison()` is wired into `totals.ts:84,97` and computed last, from the finalised `draftBaseline`, reporting the flat figure, itemised direct cost, and whether it strictly exceeds (never inclusive) — proven by `flat-fee.test.ts` including the exact-equality boundary and the post-aggregate-cap case. |

**Score:** 5/5 must-haves verified (all five roadmap Success Criteria hold in the codebase). Two are annotated with real but non-blocking gaps (WR-03: TZ proof coverage; WR-02: a PRD §6.0 requirement with no code path), routed to human_verification rather than counted as failures, consistent with the code review's own Warning classification (0 Critical, 4 Warning, 3 Info).

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/engine/src/assess.ts` | PRD §8.1's 7-step orchestrator | ✓ VERIFIED | All seven steps present and correctly ordered (preconditions → posture gate/treatments → cross-line checks → aggregate cap → totals → matter flags), confirmed by direct read and by 02-06-SUMMARY's own "all seven steps now run" claim cross-checked against source. |
| `packages/engine/src/preconditions.ts` | 6 typed precondition refusals | ✓ VERIFIED | `PACK_NOT_ACTIVE`, `PACK_PAST_REVIEW_DUE`, `CONTROLLER_TYPE_NOT_IN_SCOPE`, `CURRENCY_MISMATCH`, `CLAIMED_AMOUNT_MISMATCH`, `NEGATIVE_UNIT_RATE` — all six confirmed present via 02-01 plan/summary and errors.ts's error-code union. |
| `packages/engine/src/totals.ts` | 5 (now 6, with flat-fee) `Totals` formulas | ✓ VERIFIED | Direct read confirms all formulas, including the non-obvious ALLOW_CAPPED-remainder term in `disallowedTotal` and the conditionally-spread `flatFeeComparison`. |
| `packages/engine/src/apply-cap.ts` | 3 single-line cap types + 1 refused | ✓ VERIFIED | Direct read; `PER_MATTER` throws `EngineComputationFailure`. |
| `packages/engine/src/aggregate-cap.ts` | Pro-rata aggregate cap, residue unallocated | ✓ VERIFIED | Direct read confirms the algorithm and D-11's matter-flag wiring. Two Warnings apply (WR-01: `Math.floor((capAmount*amount)/sum)` can lose float precision at the extreme end of the schema-legal `Minor` range — not exercised by any test at that magnitude; WR-04: a per-line cap's identity is silently overwritten if the aggregate cap also binds on the same line, losing provenance information a lawyer would otherwise see) — both real, both low-practical-impact for realistic DSAR fee magnitudes, both documented in 02-REVIEW.md and not remediated in this phase. Neither breaks a stated success criterion; both are candidates for a follow-up plan. |
| `packages/engine/src/posture-gate.ts` | Exhaustive 7-posture switch | ✓ VERIFIED | Direct read; no default branch, so a future `FeePosture` addition is a compile error. |
| `packages/engine/src/evaluate-line.ts` | 5-treatment dispatch + AC-19 override | ✓ VERIFIED | Direct read; ordering (posture gate → unclassified override → treatment table) matches the documented rationale. |
| `packages/engine/src/cross-line-checks.ts` | 4 checks, no 5th | ✓ VERIFIED | D-13's absence is recorded in-source per 02-05-SUMMARY's self-check (`grep -c "D-13"` → 2). |
| `packages/engine/src/matter-flags.ts` | Pack rules (3 `when` arms) + 4 derived codes | ✓ VERIFIED | Direct read; `PERMITTED_NARROW_EXCEPTION`'s missing flag (WR-02) is the one gap, noted above. |
| `packages/engine/src/flat-fee.ts` | D-12/ENGINE-16 comparison | ✓ VERIFIED | Direct read; strict `>` comparison confirmed. |
| `packages/engine/src/__fixtures__/reference-pack.ts`, `reference-lines.ts` | PRD §14's fixture | ✓ VERIFIED | Golden test reproduces every published figure exactly (see truth #1/#4 evidence). |
| `eslint.config.js`, `.dependency-cruiser.cjs` | Determinism/purity gates | ✓ VERIFIED | Both proven to fire against violating fixtures, not merely clean on the real tree — matches the phase's own "gate integrity" requirement. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `assess.ts` | `AssessmentSchema` | Tracer/golden tests parse every produced `Assessment` | ✓ WIRED | `reference-fixture.golden.test.ts:125-128` and `assess.tracer.test.ts` both call `.parse()` on real output. |
| `posture-gate.ts` | `evaluate-line.ts` | Step-2-before-step-3 ordering | ✓ WIRED | Confirmed by direct read of `evaluate-line.ts:75-100`. |
| `cross-line-checks.ts` | `AssessmentLineSchema`'s bidirectional refinement | Verdict flip at single application site in `assess.ts` | ✓ WIRED | Per 02-05-SUMMARY and the golden fixture's line 5. |
| `aggregate-cap.ts` | `MatterFlagCodeSchema.AGGREGATE_CAP_APPLIED` | D-11 schema amendment (02-03) | ✓ WIRED | `aggregate-cap.ts:140-145` emits the code; `primitives.test.ts` (02-03) proves the enum member exists and the line-level refinement is unchanged. |
| `flat-fee.ts` | `TotalsSchema.flatFeeComparison` | D-12 schema amendment (02-03) | ✓ WIRED | `totals.ts:84,97` computes and conditionally spreads it. |
| `matter-flags.ts` | `calendar-math.ts` | 30-day staleness window shares `daysUntil` with preconditions | ✓ WIRED | `matter-flags.ts:21,192-193`. |

### Behavioral Spot-Checks

| Behavior | Command/Method | Result | Status |
|---|---|---|---|
| Full test suite passes | Already run by orchestrator: `pnpm test` | 378/378 passing | ✓ PASS (per verification_notes; not re-run) |
| Typecheck/lint/depcruise clean | Already run by orchestrator | All clean | ✓ PASS (per verification_notes; not re-run) |
| Golden fixture reproduces PRD §14 exactly | Direct read of `reference-fixture.golden.test.ts` | All six totals, six verdicts, five matter flags match §14 literally | ✓ PASS |
| Determinism/purity gates fire on violation, not just clean on real tree | Direct read of `tests/toolchain/lint-engine-determinism.test.ts`, `purity-gate.test.ts` | Fixture-proven per 02-02-SUMMARY | ✓ PASS |
| TZ-invariance harness proven non-vacuous | Direct read of `purity.tz.test.ts:124-132` | Control assertion asserts inequality of platform TZ offset between stub settings | ✓ PASS |
| Perf harness proven able to fail | Direct read of `perf.test.ts:81-96` | Retained slow-control test asserts median > budget | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Status | Evidence |
|---|---|---|---|
| ENGINE-01 | 02-01, 02-02, 02-07 | ✓ SATISFIED | Purity (no I/O/LLM/clock) statically gated and fixture-proven; language ban (part of ENGINE-01 per plan mapping) proven over all `messages.ts` exports. |
| ENGINE-02 | 02-01 | ✓ SATISFIED | 6 typed preconditions, tested. |
| ENGINE-03 | 02-04 | ✓ SATISFIED (with WR-02 noted against PERMITTED_NARROW_EXCEPTION's matter-flag requirement — see truth #3) | Exhaustive posture switch. |
| ENGINE-04 | 02-04 | ✓ SATISFIED | 5 treatments dispatch correctly. |
| ENGINE-05 | 02-04 | ✓ SATISFIED | All 4 `Cap` types handled (3 in `apply-cap.ts`, PER_MATTER in `aggregate-cap.ts`), all rounding down. |
| ENGINE-06 | 02-05 | ✓ SATISFIED | 4 of 5 PRD-listed checks built; the 5th (implausible magnitude) deliberately dropped under D-13, an explicit, escalated, documented decision — not an oversight. |
| ENGINE-07 | 02-03, 02-05 | ✓ SATISFIED | Pro-rata aggregate cap, residue unallocated, matter flag. WR-01/WR-04 noted as edge-case gaps. |
| ENGINE-08 | 02-01, 02-07 | ✓ SATISFIED | `finalAmount` null; 10,000-run property. |
| ENGINE-09 | 02-01, 02-04 | ✓ SATISFIED | FLAG lines contribute 0 to draftBaseline. |
| ENGINE-10 | 02-01, 02-04 | ✓ SATISFIED | Subset property structural + property-tested. |
| ENGINE-11 | 02-06 | ✓ SATISFIED (WR-02 gap noted above is adjacent but not literally within this ID's REQUIREMENTS.md wording) | Pack rules + 3 named derived codes (+ a 4th, `NO_FEE_AUTHORITY_POSTURE`) all implemented. |
| ENGINE-12 | 02-04 | ✓ SATISFIED | AC-19 exception ordering correct. |
| ENGINE-13 | 02-01 | ✓ SATISFIED | Independent engine-level re-check of claimedAmount. |
| ENGINE-15 | 02-02, 02-07 | ✓ SATISFIED (WR-03 proof-coverage gap noted) | TZ invariance proven for 2 whole-hour offsets; locale enforced statically. |
| ENGINE-16 | 02-03, 02-06 | ✓ SATISFIED | Flat-fee comparison strict, reports without choosing. |
| ENGINE-17 | 02-07 | ✓ SATISFIED | Median-of-20 under 100ms, harness proven to fail. |
| ENGINE-14 | *(Phase 6, not this phase's scope)* | N/A — correctly out of scope | Confirmed absent from this phase's requirement IDs and REQUIREMENTS.md maps it to Phase 6. Not an orphan. |

No orphaned requirements: every ID in REQUIREMENTS.md mapped to Phase 2 (ENGINE-01 through ENGINE-13, ENGINE-15 through ENGINE-17) appears in at least one plan's `requirements:` frontmatter, and every plan's declared requirements trace to a REQUIREMENTS.md entry.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `packages/engine/src/aggregate-cap.ts` | 68 | `Math.floor((capAmount * amount) / sum)` — float precision loss possible at extreme `Minor` magnitudes (WR-01) | ⚠️ Warning | Not exercised by any test at the affected magnitude; real DSAR fees never approach it. Documented, not fixed, in this phase. |
| `packages/engine/src/aggregate-cap.ts` | 130-138 | Per-line `appliedCap` silently overwritten when aggregate cap also binds (WR-04) | ⚠️ Warning | Loses provenance a lawyer would see; schema (`appliedCap: Cap | null`, singular) makes a full fix a Phase-1-freeze schema change, correctly out of this phase's additive-only latitude. |
| `packages/engine/src/posture-gate.ts`, `matter-flags.ts` | 22-34 / 147-204 | `PERMITTED_NARROW_EXCEPTION` never raises the PRD §6.0-mandated matter-level flag (WR-02) | ⚠️ Warning | See truth #3 and human_verification. |
| `packages/engine/src/purity.tz.test.ts` | 35-36 | Only whole-hour TZ offsets tested (WR-03) | ⚠️ Warning | Proof-coverage gap, not a live defect (calendar-math.ts is Date-free by construction). |
| `packages/engine/src/assess.ts` | 117-121, 142-150 | Three internal-consistency violations thrown as plain `Error`, not the typed error family (IN-01) | ℹ️ Info | Not user-facing; noted by code review, no action required. |
| `packages/engine/src/messages.ts` | 84-99 | `ruleAuthoredFlagMessage`'s FlagReasonCode reuse is self-documented as untested for a real-pack case (IN-02) | ℹ️ Info | Explicitly flagged in source as a future FlagReasonCode candidate. |
| `packages/schemas/src/primitives.ts` | 170, 202 | `AGGREGATE_CAP_APPLIED` exists in two enums (line-level and matter-level) by design (IN-03) | ℹ️ Info | Documented deliberate choice (D-11), no live bug. |

No debt markers (TBD/FIXME/XXX) found in any file this phase modified. No unreferenced TODO/HACK/PLACEHOLDER found in the reviewed engine source.

### Gaps Summary

No must-have truth failed outright. All five roadmap Success Criteria are observably true in the codebase, each backed by both unit/golden tests and, for the cross-cutting properties (money integrity, determinism, language, performance), by property/fixture-proven harnesses that were themselves shown able to fail — the specific discipline this phase's own Validation Strategy demanded after Phase 1's four "gate that inspects nothing" failures.

Two items are routed to human_verification rather than treated as blocking gaps, because they require a human decision rather than more engineering to resolve mechanically:

1. **Legal-correctness sign-off on the reference fixture** — already an explicit, planned human-check in 02-04-PLAN.md, never claimed as engineering-verified by any plan.
2. **WR-02 (PERMITTED_NARROW_EXCEPTION's missing PRD-mandated matter flag)** — a genuine, specific gap against PRD §6.0's literal text, found by the code review, not previously escalated to the product owner the way D-11/D-12/D-13 were. It needs a scope decision (fix now vs. defer with reasoning), not further verification.

Two further Warnings (WR-01, WR-04, both in `aggregate-cap.ts`) are real correctness edge cases at the boundary of the schema's legal range, but do not affect any of the phase's five success criteria under realistic DSAR fee magnitudes, and are documented in-code and in 02-REVIEW.md as candidates for a follow-up plan rather than needing to block this phase.

---

_Verified: 2026-09-15T12:30:00Z_
_Verifier: Claude (gsd-verifier)_
