---
phase: 02-deterministic-fee-engine
reviewed: 2026-09-15T11:42:45Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - packages/engine/src/assess.ts
  - packages/engine/src/apply-cap.ts
  - packages/engine/src/conditions.ts
  - packages/engine/src/posture-gate.ts
  - packages/engine/src/evaluate-line.ts
  - packages/engine/src/cross-line-checks.ts
  - packages/engine/src/aggregate-cap.ts
  - packages/engine/src/matter-flags.ts
  - packages/engine/src/flat-fee.ts
  - packages/engine/src/totals.ts
  - packages/engine/src/preconditions.ts
  - packages/engine/src/calendar-math.ts
  - packages/engine/src/errors.ts
  - packages/engine/src/messages.ts
  - packages/engine/src/index.ts
  - packages/schemas/src/primitives.ts
  - packages/schemas/src/assessment.ts
  - packages/schemas/src/expense-line.ts
  - packages/schemas/src/rule-pack.ts
  - packages/schemas/src/json-schema.test.ts
  - eslint.config.js
  - .dependency-cruiser.cjs
  - tests/toolchain/purity-gate.test.ts
  - tests/toolchain/lint-engine-determinism.test.ts
  - tests/fixtures/engine-determinism-violation.fixture.ts
  - packages/engine/src/reference-fixture.golden.test.ts
  - packages/engine/src/purity.tz.test.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues
---

# Phase 2: Code Review Report

**Reviewed:** 2026-09-15T11:42:45Z
**Depth:** standard
**Files Reviewed:** 27 (of the phase's listed scope; see "Not examined" below)
**Status:** issues_found

## Summary

This is a well-disciplined phase. The golden reference fixture
(`reference-fixture.golden.test.ts`, `__fixtures__/reference-lines.ts`,
`__fixtures__/reference-pack.ts`) reproduces PRD §14's published numbers
literally — I independently re-derived `draftBaseline` 266.40,
`disallowedTotal` 126.60, `flaggedTotal` 495.00, `restingOnUnverifiedRules`
106.40 from the six line items and confirmed `totals.ts` computes them
correctly, including the non-obvious inclusion of the `ALLOW_CAPPED`
remainder in `disallowedTotal`. The banned-word test
(`engine-language.test.ts`) genuinely proves its own matcher (positive and
negative controls), the determinism ESLint rules are proven to fire against
a real fixture, and `applyCap`/`applyAggregateCap` round down correctly with
literal (not derived) expected values that would catch a `Math.round`
regression.

No Critical-severity defects were found — nothing here silently lets a
flagged line into a total, silently decides where the PRD requires a flag,
or leaks a float into the money path under any input the engine's own
tests, property tests, or realistic pack data would produce. The findings
below are Warnings: real gaps against the PRD or against the review's own
domain checks, none of which fire under the fixtures currently in the
repository, but none of which are guarded against either.

## Warnings

### WR-01: Aggregate-cap pro-rata multiplication can lose precision at the top of the Minor range

**File:** `packages/engine/src/aggregate-cap.ts:68`
**Issue:** `applyAggregateCap` computes each line's share as
`Math.floor((capAmount * amount) / sum)`. `capAmount` and `amount` are both
`Minor`, individually bounded only to ±2,147,483,647 (`MINOR_MIN`/`MINOR_MAX`,
`packages/schemas/src/primitives.ts:51-52`). Their product can reach
~4.6 × 10¹⁸, which exceeds `Number.MAX_SAFE_INTEGER` (9.007 × 10¹⁵) by three
orders of magnitude — JavaScript's 53-bit float mantissa cannot represent
that product exactly, so `Math.floor` runs on an already-rounded value. This
is exactly the "multiply before divide" pattern the module's own comment
(lines 14, 61-67) calls out as deliberate for correctness, but the comment
never addresses the magnitude at which that same pattern loses exactness.
Concretely: a matter with an aggregate cap near `MINOR_MAX` and a line
`engineAmount` also near `MINOR_MAX` (both are individually schema-legal
32-bit `Minor` values) produces a `capAmount * amount` product that is not
bit-exact, so the pro-rata share and the residue this module computes as
"the remainder left unallocated" can be off by a small amount — silently,
with no test catching it. None of the existing tests exercise this: the
hand-written `aggregate-cap.test.ts` cases use amounts in the low hundreds,
and `assess.property.test.ts`'s fast-check arbitrary bounds `unitRate` to
`[0, 100_000]` and `quantity` to `[1, 1_000]`
(`packages/schemas/src/__fixtures__/arbitraries.ts:41-43`), so generated
`claimedAmount`/`engineAmount` values never approach the range where this
matters. Real DSAR fees are small, but the schema (and this function's own
type signature) permits the values that break it.
**Fix:** Either use `BigInt` for the `capAmount * amount` intermediate (cast
back to `Minor` after the floor-divide), or add an explicit guard that
throws a typed `EngineComputationFailure` when `capAmount * amount` would
exceed `Number.MAX_SAFE_INTEGER`, so an out-of-safe-range input fails loudly
rather than silently drifting. Add a property/unit test at
`MINOR_MAX`-adjacent values to lock in whichever fix is chosen.

### WR-02: `PERMITTED_NARROW_EXCEPTION` posture never raises the PRD's mandated matter-level flag

**File:** `packages/engine/src/posture-gate.ts:22-34`, `packages/engine/src/matter-flags.ts:147-204`
**Issue:** PRD §6.0 (docs/PRD-dsar-fee-agent.md:415) states:
"`PERMITTED_NARROW_EXCEPTION` behaves as `PROHIBITED` in the engine — every
line `DISALLOW` — but **carries a mandatory matter-level flag naming the
exception**, so the lawyer can allow lines via `ALLOWED_BY_LAWYER` where one
applies." `posture-gate.ts` correctly forces every line to `DISALLOW` for
this posture (matching AC-14's line-verdict requirement), but nothing in
`matter-flags.ts`'s `DERIVED_MATTER_FLAG_SPECS` (lines 168-204) fires a
matter-level flag for it — the only posture-derived matter flag is
`NO_FEE_AUTHORITY_POSTURE`, gated on `NO_EXPRESS_AUTHORITY` specifically
(line 201). A matter under a `PERMITTED_NARROW_EXCEPTION` pack today
produces every line `DISALLOW` with **no accompanying matter-level notice**
at all — the lawyer sees a zero-fee outcome indistinguishable from a plain
`PROHIBITED` posture, with nothing surfaced naming the narrow exception the
PRD says must be named. Unlike D-13's implausible-magnitude gap, this
omission was not raised to the product owner or recorded as a decision in
02-CONTEXT.md; 02-04-SUMMARY.md documents only that
`PERMITTED_NARROW_EXCEPTION` "is treated identically to PROHIBITED (forces
DISALLOW)" without addressing the mandatory-flag half of the same PRD
sentence. Low practical impact today (no jurisdiction pack in the current
nine uses this posture; PRD reserves it for a future, explicitly
out-of-scope EU/GDPR pack per NS-10), but it is a real, silent spec gap in
code that otherwise treats every other posture-gate behavior exhaustively.
**Fix:** Either add a fifth derived matter-flag code (e.g.
`NARROW_EXCEPTION_POSTURE`) analogous to `NO_FEE_AUTHORITY_POSTURE`, or
explicitly raise this as a decision (like D-11/D-12/D-13) that a
pack-authored `matterFlagRule` is the intended mechanism instead, and record
that the current schema/engine relies entirely on pack authors to supply it.

### WR-03: The TZ-invariance proof only tests whole-hour offsets

**File:** `packages/engine/src/purity.tz.test.ts:35-36`
**Issue:** `TZ_A = "UTC"` and `TZ_B = "Pacific/Kiritimati"` (UTC+14) are both
whole-hour offsets. `calendar-math.ts` never reads `Date` or any TZ-aware
API, so in the engine's *current* form the choice of offset doesn't matter —
but the property this test exists to guard is "no future regression
reintroduces a `Date`-based day computation that happens to work for
whole-hour offsets but breaks for a fractional one." Two of this project's
own nine target jurisdictions (India, `+5:30`) and a plausible future one
(Nepal, `+5:45`) use non-hour offsets; a `Date`-based day-boundary
computation that correctly floors to a calendar date under a whole-hour
offset can still mis-derive the calendar date under a `:30`/`:45` offset if
it naively truncates minutes or uses a different rounding rule for the
fractional part. This is exactly the "assess whether a non-hour offset is
needed" question the module's own module comment (lines 1-17) does not
address — it discusses only Pattern 6's LANG/locale finding, not the
whole-hour-vs-fractional-hour distinction in TZ choice.
**Fix:** Add a third TZ leg (e.g. `Asia/Kolkata`, UTC+5:30) to the existing
three fixtures in this file. This is a cheap addition (three more
`vi.stubEnv` calls) that closes the one gap in an otherwise well-constructed
proof.

### WR-04: A per-line cap's identity is silently discarded when the aggregate cap also reduces the line

**File:** `packages/engine/src/aggregate-cap.ts:130-138`
**Issue:** `applyAggregateCapStep` overwrites `appliedCap` unconditionally
with the aggregate `cap` object for every eligible line
(`updatedLines[lineIndex] = { ...original, verdict: "ALLOW_CAPPED",
engineAmount: allocated[position]!, appliedCap: cap }`). If a line already
carried a per-line `ALLOW_WITH_CAP` reduction (its `appliedCap` set to, say,
a `PER_UNIT` cap in `evaluate-line.ts`), and the aggregate cap subsequently
also binds on that same line, the line's final `appliedCap` shows only the
aggregate cap — the fact that a per-line cap *also* reduced this line
before the aggregate cap ran is lost from the `Assessment` output entirely.
`aggregate-cap.test.ts:83-109`'s own test for this path (`l2` starts as
`ALLOW_CAPPED`) never sets `l2`'s initial `appliedCap`, so this overwrite
is not exercised by any test with a non-null starting value. This works
against the product's core defensibility claim ("the engine applied rule X,
version Y... and struck the line") — a lawyer reviewing this line sees only
the aggregate cap's basis, not the compounding per-line cap that also fired.
**Fix:** At minimum, document this as a known, accepted limitation of the
current `AssessmentLine.appliedCap: Cap | null` (singular) schema field
(itself a Phase 1 freeze). If it needs fixing, it requires a schema change
(e.g. `appliedCaps: Cap[]`) — out of this phase's additive-only latitude,
so record it as a follow-up decision rather than leaving it un-mentioned.

## Info

### IN-01: Inconsistent error taxonomy for "should never happen" invariant violations

**File:** `packages/engine/src/assess.ts:117-121, 142-150`
**Issue:** Every user-input-facing refusal in the engine is a typed
`AssessPreconditionFailure` or `EngineComputationFailure` (`errors.ts`), each
with a `code` and structured `detail`. But `assess.ts` itself throws three
plain `new Error(...)` for internal-consistency violations (no
`CategoryRule` for a category, an assessment line referencing an unknown
expense line, no applied rule recorded) — these have no `code` field and are
unreachable by a caller's exhaustive `switch`. These are true "should never
happen" invariant checks (a pack failing PACK-02 exhaustiveness would be
Phase 3's job to prevent), so this is not user-facing severity, but it
breaks the "every typed refusal is a named, structured error" pattern the
rest of the module establishes, and a caller doing `error instanceof
EngineComputationFailure` will not catch these.
**Fix:** Either add a third narrow error class (e.g.
`EngineInvariantViolation`) for these three sites, or fold them into
`EngineComputationError`'s existing discriminated union.

### IN-02: `ruleAuthoredFlagMessage`'s FlagReasonCode reuse is self-documented as untested

**File:** `packages/engine/src/messages.ts:84-99`, `packages/engine/src/evaluate-line.ts:156-163`
**Issue:** A `CategoryRule` authored with `treatment: "FLAG"` directly (not
via the `OTHER_UNCLASSIFIED` override) reuses `FlagReasonCode.UNCATEGORISED`
even though the line's category is known and classified — the message text
is different from `uncategorisedMessage()`, but the machine-readable `code`
field is identical to a genuinely-uncategorised line's. `messages.ts`'s own
comment (lines 84-96) discloses this is a known gap ("Untested by this
plan's golden fixture... flagged here for a future FlagReasonCode addition")
rather than an oversight. Recorded here only because a downstream consumer
(e.g. Phase 6's review screen, grouping/filtering by `flagReasons.code`)
could conflate the two cases without realizing it, since nothing currently
distinguishes them at the `code` level.
**Fix:** No action required in this phase — the code already flags this
honestly for a future `FlagReasonCode` addition when a real pack needs to
distinguish the two. Carry it forward as a tracked follow-up rather than
losing it.

### IN-03: `MatterFlagCode.AGGREGATE_CAP_APPLIED` duplicates a line-level `FlagReasonCode` name across two different enums

**File:** `packages/schemas/src/primitives.ts:170, 202`
**Issue:** `AGGREGATE_CAP_APPLIED` now exists as both a `FlagReasonCode`
(line-level, PRD §6.0's original placement) and a `MatterFlagCode`
(matter-level, D-11's additive sibling). Both are well-documented in the
module comment (lines 187-201) as a deliberate, reasoned choice, and no
code path actually emits the line-level `FlagReasonCode.AGGREGATE_CAP_APPLIED`
today (aggregate-cap.ts uses only the matter-level code) — so this is not a
live bug. It is recorded here only because a future author skimming
`FlagReasonCodeSchema`'s member list could reasonably assume a capped line
carries this reason on `flagReasons`, when in fact no code path ever sets
it (capped lines carry no reason at all, per D-11 — see `aggregate-cap.ts`
lines 28-34).
**Fix:** No action required; the existing module comment already explains
the split. Consider a one-line note directly on the `FlagReasonCode` member
itself (not only on the `MatterFlagCode` one) cross-referencing D-11, so a
reader who finds the line-level enum member first also sees the context.

## Not examined

Given the interruption, the following items from the assigned scope were
**not** read in this pass, or were only sampled rather than read end to end.
Treat conclusions above as sound for the files actually reviewed, but do not
read this report as full coverage of the listed scope:

- `packages/engine/package.json`, `packages/engine/tsconfig.json` — not read.
- `packages/schemas/FREEZE.md` — not read directly; additivity was verified
  indirectly via `primitives.ts`/`assessment.ts` diffs and the
  `json-schema.test.ts` byte-identical drift check, not by reading FREEZE.md's
  own prose.
- `packages/schemas/schema/assessment.schema.json` — not diffed by hand;
  relied on `json-schema.test.ts`'s own byte-identical assertion.
- `packages/engine/src/evaluate-line.test.ts`,
  `cross-line-checks.test.ts`, `matter-flags.test.ts`,
  `preconditions.test.ts`, `calendar-math.test.ts`, `posture-gate.test.ts`,
  `conditions.test.ts`, `assess.tracer.test.ts` — not read in full; only
  grepped/spot-checked for specific claims (e.g. `PERMITTED_NARROW_EXCEPTION`
  coverage).
- `packages/schemas/src/primitives.test.ts`, `assessment.test.ts`,
  `assessment.property.test.ts` — not read in full.
- `packages/engine/src/__fixtures__/aggregate-cap-pack.ts`,
  `flat-fee-pack.ts`, `reference-matter.ts` — not read in full; referenced
  only through the test files that import them.
- `tests/fixtures/engine-money-format-violation/formats-money.ts` — read
  only via grep/summary, not the full file.
- `tests/fixtures/denylist-canary.fixture.tsx`,
  `tests/fixtures/money-brand-violation.fixture.ts` — not read.

Of the seven domain-specific checks in the review brief, all seven were
examined at least once (money integrity, purity, flag-not-decide, language,
exhaustiveness, test honesty, schema freeze) — see Summary and WR-01/WR-02/
WR-03 for where each surfaced a finding. Exhaustiveness (posture-gate.ts,
evaluate-line.ts's treatment switch, apply-cap.ts's Cap switch) and
flag-not-decide (assess.ts's `applyCrossLineReasons`, aggregate-cap.ts,
totals.ts) were checked most thoroughly and produced no findings — every
switch is closed with no default branch, and every total-accumulation path
correctly excludes `FLAG` lines from `draftBaseline`.

---

_Reviewed: 2026-09-15T11:42:45Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
