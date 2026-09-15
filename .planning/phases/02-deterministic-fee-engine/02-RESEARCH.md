# Phase 2: Deterministic Fee Engine - Research

**Researched:** 2026-09-15
**Domain:** Pure TypeScript computation over a versioned rule pack (no I/O, no LLM, no DB) — money arithmetic, integer pro-rata, and a purity/determinism boundary enforced by CI
**Confidence:** MEDIUM — the arithmetic and schema-boundary findings are HIGH (grounded in reading the frozen source this session); several algorithmic details are genuinely underspecified by the PRD and are flagged as open questions rather than guessed

## Summary

Phase 2 has almost no external-library risk — it consumes `@dsar/schemas` (frozen, read in full this session) and produces a `packages/engine` that has no new runtime dependencies at all. The real work is arithmetic and disposition logic: implement `assess()` per PRD §8.1's seven steps against the frozen `RulePack`/`Assessment` types, prove it against a hand-built fixture pack that reproduces PRD §14's reference table exactly, and get CI to prove — not merely assert — purity and determinism.

Three findings materially change how this phase should be planned, and none of them are visible from reading REQUIREMENTS.md or the PRD in isolation — they only surface by reading the frozen schema source against the reference-fixture numbers:

1. **`Totals.disallowedTotal` is not just the sum of `DISALLOW` lines.** Recomputing PRD §14's own published numbers (`disallowedTotal` 126.60) only balances if it is `Σ(claimedAmount for DISALLOW lines) + Σ(claimedAmount − engineAmount for ALLOW_CAPPED lines)` — i.e. it also absorbs the amount a cap trimmed off a capped line. PRD §8.1 step 6 never states this; it is forced by the fixture's arithmetic (see Pattern 1 below). Get this wrong and AC-09's golden file fails for a reason that looks like a totals bug, not a spec-reading bug.
2. **`RulePack.flatFee` and `Assessment.totals` have no field for ENGINE-16's output.** `TotalsSchema` and `AssessmentSchema` (frozen, `packages/schemas/src/assessment.ts`) carry no flat-fee comparison field at all. ENGINE-16 cannot be satisfied without an *additive* schema change this phase must make (permitted under FREEZE.md's D-09 rule — add, never rename/retype). This is a real task, not an oversight to inherit silently.
3. **The aggregate-cap "flag that it bit" (ENGINE-07) has no unambiguous home in the frozen schema.** `FlagReasonCodeSchema` (line-level) carries `AGGREGATE_CAP_APPLIED`, but `AssessmentLineSchema`'s own `superRefine` forbids a non-empty `flagReasons` unless `verdict === 'FLAG'` — so attaching that reason to a line that is supposed to *stay* `ALLOW_CAPPED` with a reduced pro-rata amount is a schema violation. `MatterFlagCodeSchema` (matter-level) has no cap-specific member at all. This is a genuine design gap, detailed in Pattern 3.

**Primary recommendation:** build the reference fixture pack first (per PRD §14's own instruction), let its arithmetic force the disallowed/resting-on-unverified formulas, resolve the two schema gaps above as small additive changes before writing `assess()`, and treat the purity/TZ/perf criteria as CI-gate design problems distinct from the algorithm itself — each is solvable without adding a single new dependency.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENGINE-01 | `assess()` is pure — no I/O, no network, no LLM import, no clock read outside injected `now` | Pattern 4 (`now` injection, Date-free calendar math), Pattern 6 (TZ/locale invariance test design), existing `.dependency-cruiser.cjs` rules (already gate imports) |
| ENGINE-02 | Typed precondition errors: stale/non-active pack, controller-type mismatch, currency mismatch | Pattern 4 (day-count comparison for staleness); frozen `RulePack.appliesTo`/`JURISDICTION_CURRENCY` give the exact lookups needed |
| ENGINE-03 | Posture gate: `PROHIBITED`/`PERMITTED_NARROW_EXCEPTION` → all `DISALLOW`; `NO_EXPRESS_AUTHORITY` → all `FLAG` with `NO_FEE_AUTHORITY`, `draftBaseline` 0 | System Architecture Diagram (step 2); frozen `FeePostureSchema` enum (7 values) read directly |
| ENGINE-04 | Five treatments incl. `ALLOW_IF` → `CONDITIONS_NOT_MET` listing failed conditions | Frozen `CategoryRuleTreatmentSchema`/`ConditionSchema` read directly; reference-fixture line 5 is a worked `ALLOW_IF`-failure example (Pattern 1) |
| ENGINE-05 | `applyCap` all four `Cap` types, always round down (AC-07c) | Pattern 2 — full per-type arithmetic and rounding analysis, including the `percent`-is-not-integer nuance |
| ENGINE-06 | Cross-line checks raise a flag, never a silent adjustment | Cross-line check predicates discussed under Open Questions (materiality threshold confirmed by fixture math; duplicate/data-quality/vendor-evidence flagged as needing product-owner confirmation) |
| ENGINE-07 | Aggregate cap pro-rata, residue unallocated, flagged (PROJECT.md decision) | Pattern 3 — full mechanics, boundary cases, and the flag-placement schema gap requiring an explicit decision |
| ENGINE-08 | Totals per §8.1 step 6; `finalAmount` null, never defaulted (AC-25) | Pattern 1 (formulas); Anti-Patterns section (construction discipline); Wave 0 gap re-pointing the existing SCHEMA-07 property harness |
| ENGINE-09 | `FLAG` lines contribute 0 to `draftBaseline`, claimed value only in `flaggedTotal` (AC-11) | Pattern 1 — verified against the reference-fixture's own numbers |
| ENGINE-10 | `restingOnUnverifiedRules` subset of `draftBaseline` (AC-22) | Pattern 1 — formula derived and verified against the fixture; also pins the fixture pack's required `verificationStatus` per category |
| ENGINE-11 | Matter-level flags: `matterFlagRules` + `LITIGATION_POSTURE` + `REPEAT_REQUEST` + `STALE_PACK_WARNING` | Pattern 1's fixture-pack table (the three SG informational flags); Pattern 4 (staleness/30-day window computation) |
| ENGINE-12 | `OTHER_UNCLASSIFIED` always `FLAG` except posture-gate override (AC-19) | System Architecture Diagram (step 2 vs step 3 ordering); frozen taxonomy.ts confirms `OTHER_UNCLASSIFIED` is the 21st, escape-hatch category |
| ENGINE-13 | Stored `claimedAmount` mismatch on load is a hard error (AC-08) | Flagged in Validation Architecture as needing clarification against Phase 1's existing `ExpenseLineSchema.superRefine` (may already partially satisfy this — confirm scope with planner) |
| ENGINE-15 | Suite passes identically under 2 TZ/locale combinations | Pattern 6 — empirically verified TZ behavior on this machine, and the locale-environment limitation with its recommended static-analysis substitute |
| ENGINE-16 | HK flat fee: itemised baseline + flat figure + exceeds-direct-cost comparison | Summary finding #2, Pattern 3's sibling gap, Open Question 3 — requires an additive schema change before this requirement has anywhere to put its output |
| ENGINE-17 | 50-line assessment under 100ms | Pattern 5 — median-of-N `performance.now()` recipe, explicitly rejecting `vitest bench` for this use |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `assess()` fee computation | API / Backend (in-process library) | — | Pure function called synchronously by a future Route Handler (Phase 4/6/7); `packages/engine` itself has no network or process boundary of its own |
| Rule pack data | Database / Storage (Phase 3 loads it) | API / Backend | Phase 2 receives a `RulePack` object already in memory (fixture-constructed); the engine never queries a database or the filesystem itself |
| Purity/determinism enforcement (no I/O, no clock, no locale dependence) | Tooling / CI (dependency-cruiser, ESLint, Vitest config) | — | Not a runtime tier at all — a static/CI gate that runs before deploy, same category as the existing AC-07a money-brand lint rule |
| Performance budget (50 lines / 100ms) | API / Backend (in-process) | — | Measured in-process; no network latency involved, so the budget is pure CPU time for `assess()` itself |
| Golden-file / property tests | Tooling / CI | — | Test-only artifacts (`__fixtures__`, `expected.json`); no runtime component |

## Package Legitimacy Audit

**Not applicable this phase.** `packages/engine` introduces zero new runtime dependencies. It consumes only `@dsar/schemas` (already a workspace package) and `zod` (already installed, `4.6.5`, verified via `packages/schemas/package.json`). Test-only tooling (`vitest`, `fast-check`, `@fast-check/vitest`) is already installed at the root (`vitest@5.0.0`, `fast-check@4.10.0`, `@fast-check/vitest@0.5.0` — verified by reading `package.json` this session). No `npm view`/registry check is needed because nothing new is being added.

If the plan ends up wanting a calendar-date-math helper (see Pattern 4) and considers reaching for an external date library (`date-fns`, `dayjs`, `luxon`) to implement it: **do not.** Every mainstream JS date library wraps the native `Date` object internally, which the plan is trying to statically ban from `packages/engine`'s source (Success Criterion 2). Hand-roll the day-count arithmetic (≈15 lines, easily property-tested) instead — see Pattern 4.

## Standard Stack

### Core

| Library | Version (installed, verified) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | 4.6.5 | `RulePack`/`Assessment` parsing at the engine's boundary only | Already the project's schema layer; `assess()` itself never calls `.parse()` in its hot path (per `primitives.ts`'s own module comment) |
| TypeScript | 6.0.3 | Language | Pinned per PROJECT.md Key Decisions (must stay `<6.1.0` for `typescript-eslint@8.70.0` compatibility — do not bump) |

### Supporting (test-only, all already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 5.0.0 | Unit/property/perf tests in the `engine` project | Existing `vitest.config.ts` already declares an `engine` project (`packages/engine/src/**/*.test.ts`) |
| fast-check | 4.10.0 | Property test re-pointed at real `assess()` output | Phase 1 built `packages/schemas/src/assessment.property.test.ts` against hand-constructed `Assessment` values specifically so Phase 2 can re-point the same 10,000-run harness at real engine output (STATE.md decision log, 2026-09-15) — reuse `expenseLineArb`/`minimalRulePackArb` from `packages/schemas/src/__fixtures__/arbitraries.ts` rather than authoring new arbitraries |
| dependency-cruiser | 18.3.0 | Extend `.dependency-cruiser.cjs`'s existing `packages/engine` rules | Already gates `fs`/`net`/Prisma/`next`/`undici` imports; no new rule needed for the import-boundary half of Success Criterion 2 |
| ESLint (flat config) | 10.10.0, `typescript-eslint` present | New `no-restricted-globals`/`no-restricted-properties` rule for `Date`/`Math.random` | dependency-cruiser inspects imports, not global identifier usage — a bare `new Date()` or `Math.random()` call has no import to catch, so this needs an ESLint rule alongside the existing AC-07a money-brand rule in `eslint.config.js` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled day-count arithmetic for `reviewDueOn`/`STALE_PACK_WARNING` comparisons | `date-fns`/`dayjs`/`luxon` | Rejected outright — every one of these wraps the native `Date` object, which Success Criterion 2 requires `packages/engine`'s source to never reference at all. See Pattern 4 for the two compliant options. |
| `vitest bench` (tinybench) for the 100ms/50-line budget | A plain `it()` with `performance.now()` timing and a median-of-N assertion | `vitest bench` is designed for regression-trend dashboards (CodSpeed-style), not pass/fail CI gates — research confirms tinybench results vary run-to-run on shared CI hardware, which is exactly the "flaky perf test gets deleted" failure mode the phase description warns against. See Pattern 5. |

**Installation:** none required — no new packages.

## Architecture Patterns

### System Architecture Diagram

```
 Matter + ExpenseLine[] + RulePack + now (ISO string)
                    |
                    v
        +---------------------------+
        |   assess() (packages/     |
        |   engine, pure function)  |
        +---------------------------+
                    |
   1. Preconditions (pack ACTIVE & not stale,
      controllerType in appliesTo, currency match)
      --fail--> typed error, no Assessment
                    |
   2. Posture gate (PROHIBITED/PERMITTED_NARROW_EXCEPTION
      -> all DISALLOW; NO_EXPRESS_AUTHORITY -> all FLAG)
      --posture forces terminal verdict--> skip to step 6
                    |
   3. Per-line evaluation (CategoryRule lookup,
      Condition evaluation, treatment -> verdict/engineAmount)
                    |
   4. Cross-line checks (duplicate, rate-sanity,
      materiality, data-quality, vendor-evidence)
      -> each ADDS a FlagReason, never mutates engineAmount
                    |
   5. Aggregate cap (pro-rata floor across ALLOW/ALLOW_CAPPED
      lines, residue unallocated, "cap bit" recorded)
                    |
   6. Totals (claimedTotal, draftBaseline, disallowedTotal,
      flaggedTotal, restingOnUnverifiedRules, finalAmount=null)
      + flat-fee comparison if pack.flatFee present (ENGINE-16)
                    |
   7. Matter-level flags (matterFlagRules + LITIGATION_POSTURE
      + REPEAT_REQUEST + STALE_PACK_WARNING)
                    |
                    v
              Assessment (signOff: null)
```

### Recommended Project Structure

```
packages/engine/src/
├── index.ts                    # exports assess(), ENGINE_VERSION
├── assess.ts                   # the seven-step orchestration
├── preconditions.ts            # step 1 — typed precondition errors
├── posture-gate.ts             # step 2
├── evaluate-line.ts            # step 3 — per-treatment dispatch
├── apply-cap.ts                # applyCap() for PER_UNIT/PER_LINE/PERCENT_OF_CLAIM
├── aggregate-cap.ts            # step 5 — pro-rata + residue, separate from apply-cap.ts (see Pattern 3)
├── cross-line-checks.ts        # step 4 — duplicate/rate-sanity/materiality/data-quality/vendor-evidence
├── conditions.ts                # Condition evaluation against ExpenseLine/Matter
├── totals.ts                    # step 6 — Totals construction, disallowedTotal/restingOnUnverifiedRules formulas
├── matter-flags.ts              # step 7
├── calendar-math.ts              # isolated, Date-free (or Date-exempted) day-count helper — see Pattern 4
├── errors.ts                     # typed precondition error union
├── __fixtures__/
│   ├── reference-pack.ts         # hand-built SG-shaped fixture pack reproducing PRD §14
│   └── reference-lines.ts        # the 6 ExpenseLine fixtures from PRD §14's table
└── *.test.ts                     # one test file per module above, plus:
    ├── reference-fixture.golden.test.ts   # AC-09-shaped: exact totals/flags/verdicts
    ├── purity.perf.test.ts                # Pattern 5
    └── purity.tz-locale.test.ts           # Pattern 6
```

### Pattern 1: `Totals` formulas, derived from PRD §14's own numbers

PRD §8.1 step 6 states `disallowedTotal` and `restingOnUnverifiedRules` only in prose ("sum of `engineAmount` for ALLOW+ALLOW_CAPPED", "subset of draftBaseline, §7.2"). Recomputing PRD §14's published reference totals against its own six-line table [CITED: PRD §14, reference fixture table] pins down the exact formulas:

```
draftBaseline            = Σ engineAmount for lines with verdict ∈ {ALLOW, ALLOW_CAPPED}
disallowedTotal          = Σ claimedAmount for lines with verdict = DISALLOW
                          + Σ (claimedAmount − engineAmount) for lines with verdict = ALLOW_CAPPED
flaggedTotal              = Σ claimedAmount for lines with verdict = FLAG
restingOnUnverifiedRules = Σ engineAmount for lines with verdict ∈ {ALLOW, ALLOW_CAPPED}
                            AND appliedRule.verificationStatus = 'NEEDS_VERIFICATION'
```

Worked against PRD §14's own table (all figures in claimed-currency units for readability, engine stores minor units):
- `draftBaseline` = 160.00 (L1 ALLOW) + 80.00 (L2 ALLOW) + 26.40 (L4 ALLOW_CAPPED) = **266.40** ✓ matches PRD.
- `disallowedTotal` = 120.00 (L3 DISALLOW claimed) + (33.00 − 26.40) (L4's cap-trimmed 6.60) = **126.60** ✓ matches PRD exactly. A naive "sum of DISALLOW lines only" gives 120.00, which is wrong and would fail AC-09 for a reason indistinguishable from a totals-logic bug.
- `flaggedTotal` = 450.00 (L5) + 45.00 (L6) = **495.00**, 2 items ✓.
- `restingOnUnverifiedRules` = 80.00 (L2, `NEEDS_VERIFICATION`) + 26.40 (L4, `NEEDS_VERIFICATION`) = **106.40** ✓ — this forces L1 (`STAFF_TIME_SEARCH`) to be `VERIFIED` in the fixture pack, even though PRD §7.6 describes the *real* SG-PDPA production pack as shipping all 21 categories `NEEDS_VERIFICATION` initially. **These are not the same pack.** Phase 2's fixture is a hand-built pack built to reproduce §14's numbers (the phase explicitly does not wait on Phase 3's real pack content — ROADMAP.md, Phase 2 "Parallel with" note). Do not copy §7.6's "all NEEDS_VERIFICATION" description into the Phase 2 fixture; set `verificationStatus` per-rule to match the table above.

**Confidence: HIGH** — derived by direct arithmetic from PRD §14's own published table, cross-checked twice.

**Fixture pack needed for the reference test** (the concrete build target for Success Criterion 1's golden file):

| Category | Treatment | Cap | Conditions | verificationStatus |
|---|---|---|---|---|
| `STAFF_TIME_SEARCH` | `ALLOW` | — | — | `VERIFIED` |
| `STAFF_TIME_COLLATE` | `ALLOW` | — | — | `NEEDS_VERIFICATION` |
| `STAFF_TIME_ASSESS_EXEMPTIONS` | `DISALLOW` | — | — | (irrelevant — DISALLOW never contributes to `restingOnUnverifiedRules`) |
| `PHOTOCOPY_PRINT` | `ALLOW_WITH_CAP` | `PER_UNIT` amount=12, unit=PAGE | `unit eq PAGE` | `NEEDS_VERIFICATION` |
| `VENDOR_PAYROLL` | `ALLOW_IF` | — | `isThirdPartyInvoiced eq true`, `evidenceRef isNotNull` | (irrelevant — FLAG never contributes) |
| `OTHER_UNCLASSIFIED` | `FLAG` | — | — | (irrelevant) |

Remaining 15 categories must still be present (schema requires the full `CategoryRule[]` array even for a fixture pack that only exercises 6 of them in this specific test — though PACK-02's 21/21 exhaustiveness *validation* is a Phase 3 build-time check, not enforced by `RulePackSchema` itself). Fill the other 15 with any valid, uninteresting `DISALLOW` or `FLAG` rule to keep the fixture small and legible; they contribute nothing to this specific fixture's expected output since no `ExpenseLine` references them.

`feePosture.PRIVATE_ORGANISATION` must not be `PROHIBITED`/`PERMITTED_NARROW_EXCEPTION`/`NO_EXPRESS_AUTHORITY` (or the posture gate in step 2 short-circuits everything to a single verdict and the per-treatment table never runs) — use `PERMITTED_REASONABLE`, matching §7.6's real SG posture. `matterFlagRules` must include the three `{always:true}` informational SG flags (`SG.WRITTEN_ESTIMATE`, `SG.RESPOND_30_DAYS`, `SG.NOT_A_DETERRENT`) to reproduce the expected matter-flags list. `reviewDueOn` must be within 30 days of the fixture's `now` (to fire `STALE_PACK_WARNING`) but not already past it (or precondition step 1 rejects the pack outright per AC-39) — e.g. `now = "2026-09-15T00:00:00Z"`, `reviewDueOn = "2026-10-01"` (16 days out).

### Pattern 2: `applyCap` — three cap types are integer-exact, one needs a floor guard

Read directly from the frozen `CapSchema` (`packages/schemas/src/rule-pack.ts:66-72`):
```ts
z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("PER_UNIT"), amount: MinorSchema, unit: ExpenseUnitSchema }),
  z.strictObject({ type: z.literal("PER_LINE"), amount: MinorSchema }),
  z.strictObject({ type: z.literal("PER_MATTER"), amount: MinorSchema }),
  z.strictObject({ type: z.literal("PERCENT_OF_CLAIM"), percent: z.number().min(0).max(100) }),
])
```
`[VERIFIED: packages/schemas/src/rule-pack.ts:66-72]`

- **`PER_UNIT`**: `cappedAmount = cap.amount * line.quantity`. Both operands are already integers (`MinorSchema` and `quantity: z.number().int()...`), so the product is exact — no rounding needed. AC-07c's own example (`applyCap({type:'PER_UNIT',amount:12,unit:'PAGE'}, {quantity:7,...})` → 84) is exact multiplication, not a rounding case.
- **`PER_LINE`**: `cappedAmount = cap.amount` directly (already an integer Minor). No rounding.
- **`PER_MATTER`**: this is the *aggregate*-cap variant — see Pattern 3. Flag as an open question whether `CategoryRule.cap` (a single line's cap) should ever legally carry `PER_MATTER` — the schema permits it structurally but `applyCap`'s natural per-line signature has no access to other lines' totals, so a `PER_MATTER` cap on an individual `CategoryRule` cannot be correctly evaluated by a pure per-line function. **Recommendation:** treat `PER_MATTER` as invalid on `CategoryRule.cap` and have the engine raise a typed precondition-style error if encountered there (never silently misapply it) — flag this for Phase 3's pack validator (PACK-01..12) to also reject at build time, since a stub or authored pack could otherwise ship this combination unnoticed until an engine run trips over it.
- **`PERCENT_OF_CLAIM`**: `cappedAmount = Math.floor((claimedAmount * percent) / 100)`. **`percent` is `z.number().min(0).max(100)` with no `.int()` constraint** `[VERIFIED: packages/schemas/src/rule-pack.ts:70]` — a pack author can legally author `percent: 33.5`. This means the intermediate computation is not float-free even though the *result*, after `Math.floor`, is a valid integer `Minor`. AC-07c's example (`33` on `100` → `33`, "not `34`") is specifically guarding against a naive `Math.round` substitution producing an off-by-one — use `Math.floor`, never `Math.round`, and add unit-test boundary cases beyond the AC's own trivial example: a fractional `percent` (e.g. `33.33` on `3` minor units → `Math.floor(3 * 33.33 / 100)` = `Math.floor(0.9999)` = `0`) to catch any floating-point drift in the multiply-then-divide order.
- **Negative rate:** PRD §14 names "negative rate rejected" as a boundary case, but `ExpenseLineSchema.unitRate` is plain `MinorSchema` with **no `.nonnegative()`** `[VERIFIED: packages/schemas/src/expense-line.ts:47]` — the frozen schema does not reject a negative `unitRate`. This rejection must be an **engine precondition** (or a new explicit guard in step 3's per-line evaluation), not something already caught upstream. Flag this to the plan explicitly rather than assuming schema coverage exists.

**Confidence: HIGH** on the arithmetic (verified against frozen source); **MEDIUM** on the `PER_MATTER`-on-`CategoryRule.cap` recommendation (a reasoned position, not settled by the PRD).

### Pattern 3: aggregate cap (step 5) — pro-rata mechanics, and the flag-placement gap

PROJECT.md already settles the *policy* question (round each line down, leave the residue unallocated — do not re-litigate). What it does not settle is the *mechanics*, which this research derives, and the *flag placement*, which is a genuine open gap in the frozen schema.

**Mechanics (recommend):**
```ts
function applyAggregateCap(capAmount: Minor, allowedAmounts: readonly Minor[]): { allocated: Minor[]; residue: Minor } {
  const sum = allowedAmounts.reduce((a, b) => a + b, 0);
  if (sum <= capAmount) {
    // Cap does not bind — no reduction, no flag, no-op.
    return { allocated: [...allowedAmounts], residue: (capAmount - sum) as Minor };
  }
  const allocated = allowedAmounts.map((amt) => Math.floor((capAmount * amt) / sum) as Minor);
  const allocatedSum = allocated.reduce((a, b) => a + b, 0);
  return { allocated, residue: (capAmount - allocatedSum) as Minor };
}
```
Only run this — and only flag that the cap bit — when `sum(allowedAmounts) > capAmount` (i.e. the cap actually binds). When it doesn't bind, applying pro-rata is a needless no-op that would incorrectly suggest the cap did something.

**Boundary cases the plan must cover** (per the phase description's explicit ask):
- **Zero allowed lines** (`sum === 0`): guard against `0/0` — division must never execute; return immediately with no change.
- **Single allowed line**: pro-rata against one line degenerates to `min(capAmount, line)` exactly — a useful cross-check against `applyCap`'s `PER_LINE` behaviour.
- **Cap below the smallest line, all lines roughly equal** (e.g. three lines of 100 each, `capAmount = 1`): every line floors to `0` (`floor(1*100/300) = 0`), `allocatedSum = 0`, `residue = 1`. This is the scenario that makes the flag-placement question (below) concrete — every allowed line's amount silently drops to zero under this algorithm, with no visible signal on the line itself.
- **Cap exactly equal to the total**: every line's floor equals its own original amount exactly (`floor(cap*line_i/sum) = line_i` when `cap === sum`) — a no-rounding no-op, useful as a regression guard that the algorithm doesn't introduce spurious residue when the cap isn't actually reducing anything.

**Confidence: HIGH** on this arithmetic (standard integer pro-rata, matches the PROJECT.md-decided policy).

**Open gap — where does "the assessment flags that the cap bit" live?** This is genuinely unresolved by the frozen schema, not merely by the PRD:
- `FlagReasonCodeSchema` (line-level, `primitives.ts:161-172`) includes `"AGGREGATE_CAP_APPLIED"` `[VERIFIED: packages/schemas/src/primitives.ts:161-172]`.
- But `AssessmentLineSchema`'s `superRefine` (`assessment.ts:78-93`) requires `flagReasons` to be **empty** unless `verdict === 'FLAG'`: *"if (line.verdict !== "FLAG" && line.flagReasons.length > 0) { ... message: "flagReasons must be empty unless verdict is FLAG" }"* `[VERIFIED: packages/schemas/src/assessment.ts:86-92]`. A line that keeps its `ALLOW_CAPPED` verdict (reduced pro-rata amount, still counted in `draftBaseline`) **cannot** also carry an `AGGREGATE_CAP_APPLIED` `FlagReason` — doing so is a schema-validation failure, not a design choice.
- `MatterFlagCodeSchema` (matter-level, `primitives.ts:181-188`) has no cap-specific member: `["LITIGATION_POSTURE", "REPEAT_REQUEST", "STALE_PACK_WARNING", "NO_FEE_AUTHORITY_POSTURE", "PACK_FLAG"]` `[VERIFIED: packages/schemas/src/primitives.ts:181-188]` — and `PACK_FLAG`'s own module comment ties it specifically to `matterFlagRules` (pack-authored), not to an engine-derived computation like the aggregate cap.

This is **squarely a D-09 additive-schema decision**, not a Phase 2 algorithm decision to make silently. Recommend one of:
1. **Flip verdict to `FLAG` only for lines whose pro-rata share is fully squeezed to zero** by the aggregate cap (keep non-zero-share lines as `ALLOW_CAPPED` with the reduced amount, no per-line flag) — uses the existing `AGGREGATE_CAP_APPLIED` `FlagReasonCode` exactly where the schema already permits it, and needs no new enum member. Downside: a line that keeps a small nonzero pro-rata share has no per-line signal that an aggregate cap touched it at all.
2. **Add a new `MatterFlagCode` member** (e.g. `"AGGREGATE_CAP_APPLIED"`, additive per D-09 — a new enum member is an addition, not a rename/retype) recording the cap fired at the matter level, leaving every affected line's verdict untouched. Simpler mentally, but the lawyer reviewing individual lines has no per-line indicator of which specific lines were pro-rata-reduced (only that *some* aggregate reduction happened somewhere in the matter).
3. **Both** — matter-level flag for visibility, plus option 1's per-line `FLAG` treatment only for the zeroed-out edge case.

**This is an escalation-shaped decision, matching FREEZE.md's own "stop, write down what's wrong, escalate" instruction for D-10** — recommend the plan present this to the product owner/planner explicitly rather than picking silently. Given the phase has zero real packs with an `aggregateCap` yet (both HK and SG's `constraints.aggregateCap` are `null` in §7.5/§7.6), this can be resolved with a narrow, well-tested fixture rather than blocking the whole phase.

### Pattern 4: `now` injection and calendar-date arithmetic without `Date`

Signature per PRD §8.1: `assess(input: { matter, lines, pack, now: string }): Assessment`. `now` is server-generated UTC, matching `IsoDateTimeSchema` (`z.iso.datetime({ offset: false })` — accepts a bare `Z` suffix, rejects an explicit offset) `[VERIFIED: packages/schemas/src/primitives.ts:34]`. `RulePack.reviewDueOn` is `IsoDateSchema` (`z.iso.date()`, calendar date only, no time/zone) `[VERIFIED: packages/schemas/src/primitives.ts:27, rule-pack.ts:200]`.

**The comparison needed:** (a) step 1 precondition — is `now` past `reviewDueOn`? (b) step 7 — is `now` within 30 days of `reviewDueOn`? Both require converting an ISO date-time and an ISO date into comparable day-counts, **without referencing the `Date` global at all**, per Success Criterion 2's literal wording ("no bare `Date`, `Date.now()` or `Math.random()` appears in its source").

This is a real tension worth surfacing to the planner rather than silently resolving: a strict, literal "no `Date` anywhere" ban forces either:
1. **Hand-rolled day-count arithmetic** — parse `"YYYY-MM-DD"`/`"YYYY-MM-DDTHH:mm:ssZ"` with a regex/string split into `{y, m, d}` integers, and compute a proleptic-Gregorian day number using pure integer math (the well-known "days from civil" algorithm — a ~15-line pure function, no `Date` dependency, easily property-tested for correctness against known calendar facts, e.g. days-in-month and leap years). This satisfies the literal letter of the criterion.
2. **An ESLint-exempted, isolated `calendar-math.ts` module** that is the *only* file in `packages/engine` permitted to reference `Date` (e.g. via an ESLint `overrides`/per-file `ignores` block), used only for pure date-string-to-date-string arithmetic (never `new Date()` with no argument, never `Date.now()`) — pragmatically simpler, still CI-enforced everywhere else, but weakens the "no bare Date" gate to "no bare Date outside one reviewed file."

**Recommendation:** option 1 (hand-rolled, zero exceptions) is more defensible given the phase's own purity framing and is not meaningfully harder to implement or test than option 2 — recommend it, but flag the choice explicitly since it's a real tradeoff (test surface vs. gate purity) rather than an obvious call. **This should be a named task in the plan**, not an incidental detail inside step-1/step-7 implementation.

Timezone-independence follows from this design almost for free: since neither ISO string is ever parsed through the environment-dependent `Date` constructor, the day-count comparison is arithmetic on integers extracted from the string, immune to `TZ`/locale by construction — which is exactly what Success Criterion 2's TZ/locale test (Pattern 6) is there to prove.

**Confidence: MEDIUM** — the requirement to avoid `Date` entirely is explicit in the phase description; the two resolution options and the recommendation between them are this research's own reasoning, not something the PRD specifies.

### Pattern 5: performance budget (ENGINE-17, §11) — median-of-N, not `vitest bench`

Web research on tinybench/`vitest bench` (its underlying engine) confirms it is built for trend/regression *tracking* across many runs on controlled hardware, not a single-run CI pass/fail gate — result variance run-to-run on shared CI hardware is a documented problem for exactly this use case `[CITED: codspeed.io/blog/vitest-bench-performance-regressions]`. Recommend against it here.

**Recommended pattern**, in a plain Vitest `it()`:
```ts
import { performance } from "node:perf_hooks"; // NOT the banned Date global

it("assesses 50 lines in under 100ms (median of 20 runs, 5-run warmup)", () => {
  const { matter, lines, pack, now } = buildFiftyLineFixture();
  for (let i = 0; i < 5; i++) assess({ matter, lines, pack, now }); // JIT warmup, discarded
  const samples: number[] = [];
  for (let i = 0; i < 20; i++) {
    const start = performance.now();
    assess({ matter, lines, pack, now });
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  expect(median).toBeLessThan(100);
});
```
`performance.now()` (Node's `perf_hooks`) is unaffected by `TZ`/locale and is not the banned `Date` global — safe to use in `packages/engine`.

**Prove the gate fires** (per the phase's explicit "repeated lesson from Phase 1" instruction): during plan execution, temporarily inject an artificial delay (e.g. a tight busy-loop) into the 50-line fixture path, confirm the test fails, then remove it — do not merely trust that the assertion is reachable.

**Confidence:** HIGH on the median-of-N pattern being sounder than a single-run assertion; MEDIUM on the specific 100ms threshold not needing a CI-only relaxation — start with the literal §11 target and only add headroom if repeated runs on the actual CI hardware show it flaking, with evidence, rather than pre-emptively softening a testable acceptance criterion.

### Pattern 6: TZ/locale invariance — no subprocess spawn, no `cross-env` needed

Empirically verified this session, on this exact machine (Windows, Node v24.19.0, Git Bash):
```
$ node -e "console.log('before', new Date(2026,0,1).getTimezoneOffset()); process.env.TZ='Pacific/Kiritimati'; console.log('after', new Date(2026,0,1).getTimezoneOffset())"
before -480
after -840
```
`[VERIFIED: ran this command this session]` — Node re-reads `process.env.TZ` **dynamically, per `Date` computation**, not once at process startup, on this machine/Node version. This means the phase description's stated "concrete trap for this machine" (`TZ=... command` shell-prefix syntax not working in PowerShell/cmd) can be sidestepped entirely: **no subprocess spawn and no `cross-env` package are needed** — a single Vitest test file can flip `TZ` in-process and re-run the same fixture.

Also verified this session:
```
$ node -e "console.log(Intl.DateTimeFormat().resolvedOptions())"
{ locale: 'en-SG', ... timeZone: 'Asia/Singapore', ... }
$ LANG=de-DE node -e "console.log(Intl.DateTimeFormat().resolvedOptions().locale)"
en-SG
```
`[VERIFIED: ran this command this session]` — **`LANG` does not change Node's `Intl` default locale on this Windows machine.** This is a genuine environment limitation for the "locale" half of Success Criterion 2's "two timezone and locale combinations": there is no reliable env-var lever to flip effective locale on this dev box the way `TZ` reliably flips timezone. Flagging this explicitly rather than asserting a locale-flip test will pass when it demonstrably would not on this machine.

**Recommendation:**
- **Timezone leg:** use `vi.stubEnv('TZ', 'UTC')` / `vi.stubEnv('TZ', 'Pacific/Kiritimati')` (Vitest's built-in env-stubbing API, paired with `vi.unstubAllEnvs()` in an `afterEach`) `[CITED: vitest.dev/api/vi — vi.stubEnv/vi.unstubAllEnvs]` rather than raw `process.env.TZ =` mutation, so the value is guaranteed restored even if the test throws. Run the reference fixture's `assess()` twice, deep-`toEqual` the two `Assessment` outputs. Pick `UTC` and `Pacific/Kiritimati` (UTC+14, the most extreme currently-observed offset) specifically because it maximises the chance of exposing a hidden day-boundary bug in the `reviewDueOn`/`STALE_PACK_WARNING` comparisons from Pattern 4.
- **Locale leg:** since `LANG`/`LC_ALL` do not reliably move Node's `Intl` default locale on Windows (verified above), and `packages/engine` should never call `Intl`/`toLocale*` at all (money formatting is `packages/schemas`'s `money.ts` job, not the engine's), recommend the **static** enforcement: extend the same ESLint `no-restricted-globals`/`no-restricted-properties` rule from Pattern 4/Success Criterion 2 to also ban `Intl` and `.toLocale*`-suffixed member calls inside `packages/engine`. This turns "prove the suite is locale-independent" into "prove the only APIs that could introduce locale-dependence are statically absent" — a stronger and more portable guarantee than trying to flip an OS-level locale setting that this Windows dev machine does not honour via environment variable.
- **Confirm before relying on `vi.stubEnv` for TZ across sibling test files:** check `vitest.config.ts`'s `engine` project's `pool`/`poolOptions` at implementation time (currently unset in the existing config, meaning Vitest's default applies — confirm the installed `vitest@5.0.0`'s default isolates env vars per test file rather than per worker, since a leaked `TZ` stub could make an unrelated engine test elsewhere intermittently see a shifted timezone).

**Confidence: HIGH** on the two empirical findings (verified live, this session, on this exact machine); **MEDIUM** on the ESLint-based locale-independence recommendation (a reasoned substitute for an environment limitation, not something the PRD specifies).

### Anti-Patterns to Avoid

- **Silently adjusting a flagged/capped amount instead of flagging it.** PRD §8.1 step 4 is explicit: cross-line checks "never a silent adjustment." The same discipline should extend to the aggregate cap (Pattern 3) and to any future engine-authored heuristic — always represent an uncertain outcome as a `FLAG`/matter flag, never as a quietly-reduced number with no visible reason.
- **Reaching for a fuzzy-matching library for "near-identical description" (duplicate detection).** A similarity threshold that isn't a fixed, testable rule undermines the product's entire "the engine applied rule X" defensibility framing (§8.3) — a non-deterministic or tunable-threshold match is one step from "the model decided," which is precisely what this product exists to avoid. See the Open Questions section for the recommended narrow definition.
- **Populating `Totals.finalAmount` from `draftBaseline` "just so the type isn't null."** AC-25 requires it stays `null` until sign-off; the frozen schema (`MinorSchema.nullable()`, no `.default(...)`) does not structurally prevent a bug from doing this — it must be enforced by explicit construction discipline and tested (see Pattern 7 below).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Calendar date arithmetic across timezones | A general-purpose date library wrapper | A narrow, hand-rolled day-count function scoped to exactly the two comparisons the engine needs (`reviewDueOn` vs `now`) | General date libraries wrap the native `Date` object internally, which this phase is specifically trying to statically exclude from `packages/engine`'s source |
| Fuzzy string similarity for duplicate detection | A Levenshtein/similarity library or hand-rolled edit-distance algorithm | Normalized-string exact match (trim, lowercase, collapse whitespace) as the v1 definition of "near-identical", pending product-owner confirmation | A fixed, non-parameterized string-equality rule is defensible as "the engine applied a fixed rule"; a tunable similarity threshold reintroduces exactly the kind of undocumented judgment call the product exists to avoid |
| Performance regression tracking | `vitest bench`/tinybench as a pass/fail CI gate | Median-of-N `performance.now()` timing in a plain `it()` (Pattern 5) | tinybench is built for trend dashboards on controlled hardware, not single-run CI gates — using it as a merge-blocking assertion reproduces the "flaky perf test gets deleted" failure mode |

**Key insight:** every "don't hand-roll" item above is really the same principle stated three ways: this phase's credibility rests on every computed outcome being traceable to a fixed, testable rule — reaching for a general-purpose library (that pulls in `Date`) or an unbounded heuristic (fuzzy matching, benchmark noise) reintroduces exactly the kind of non-reproducible judgment call the product's core value proposition depends on not having.

## Common Pitfalls

### Pitfall 1: Computing `disallowedTotal` as "just the DISALLOW lines"
**What goes wrong:** AC-09's golden file fails on a totals mismatch that looks unrelated to the actual bug.
**Why it happens:** PRD §8.1 step 6's prose reads as if `disallowedTotal` only sums `DISALLOW`-verdict lines; the fixture's own numbers (Pattern 1) prove it must also absorb the amount a cap trimmed off an `ALLOW_CAPPED` line.
**How to avoid:** implement the formula from Pattern 1 directly; write the reference-fixture golden test before writing any other engine logic (per PRD §14's own instruction to build it first).
**Warning signs:** `disallowedTotal` is off by exactly the amount a capped line's cap trimmed (e.g. 120.00 instead of 126.60) — that specific delta is the tell.

### Pitfall 2: Attaching `AGGREGATE_CAP_APPLIED` to a line that keeps a non-`FLAG` verdict
**What goes wrong:** `AssessmentLineSchema.parse()` throws at the engine's own output boundary (or worse, a `.safeParse()` silently swallows the error if not checked).
**Why it happens:** the `FlagReasonCode` enum has the value; the schema's own `superRefine` invariant (non-empty `flagReasons` requires `verdict === 'FLAG'`) is easy to miss without reading `assessment.ts` directly.
**How to avoid:** resolve Pattern 3's open gap explicitly before writing the aggregate-cap step; whichever resolution is chosen, unit-test it against `AssessmentLineSchema.parse()` (not just `assess()`'s own return type) so a schema violation surfaces as a test failure, not a runtime throw in a later phase.
**Warning signs:** a zod `ZodError` mentioning `flagReasons` during aggregate-cap testing.

### Pitfall 3: `PERCENT_OF_CLAIM` rounding drift from a fractional `percent`
**What goes wrong:** an off-by-one Minor unit on a cap boundary that only reproduces with specific fractional `percent` values, not with AC-07c's own round-number example.
**Why it happens:** `percent` has no `.int()` constraint in the frozen schema — the multiply-then-divide-then-floor order matters, and `Math.round` instead of `Math.floor` anywhere in the chain silently violates AC-07c.
**How to avoid:** always `Math.floor((claimedAmount * percent) / 100)`, never round; add unit tests with fractional `percent` values, not just AC-07c's own `33`-on-`100` example.
**Warning signs:** a golden-file test passes with a whole-number `percent` cap but a hand-added fractional-percent test fails by exactly 1 minor unit.

### Pitfall 4: A `Date`-free rule that still leaks through a transitively-imported dependency
**What goes wrong:** the ESLint source-level ban (Pattern 4/6) passes, but `assess()`'s output still varies under a different `TZ` because a third-party or shared-schemas helper internally calls `new Date()`.
**Why it happens:** ESLint's `no-restricted-globals` only scans `packages/engine`'s own `.ts` source files — it does not see what `@dsar/schemas` or any dependency does internally.
**How to avoid:** the TZ/locale invariance test (Pattern 6) is the actual proof, not the lint rule — the lint rule is a fast local signal, the test is the real gate. Make sure `packages/schemas`'s own frozen modules (`money.ts` especially, which does currency-aware formatting) are never called from inside `assess()`'s computation path — only at rendering/display time in a later phase.
**Warning signs:** the TZ invariance test (Pattern 6) fails even though `packages/engine`'s own source has zero `Date` references — the leak is in an imported module, not the engine's own code.

## Code Examples

### `applyCap` for the three single-line cap types (Pattern 2)
```ts
// packages/engine/src/apply-cap.ts
// Source: derived from PRD §8.1 step 3/§6.0 AC-07c, and the frozen CapSchema
// (packages/schemas/src/rule-pack.ts:66-72, read this session).
import type { Cap, Minor } from "@dsar/schemas/rule-pack";

export function applyCap(
  cap: Exclude<Cap, { type: "PER_MATTER" }>,
  line: { claimedAmount: Minor; quantity: number; unit: string }
): Minor {
  switch (cap.type) {
    case "PER_UNIT":
      // Both operands already integers — exact, no rounding needed.
      return Math.min(line.claimedAmount, cap.amount * line.quantity) as Minor;
    case "PER_LINE":
      return Math.min(line.claimedAmount, cap.amount) as Minor;
    case "PERCENT_OF_CLAIM":
      // percent may be fractional (schema has no .int() constraint) — always
      // floor, never round (AC-07c: 33 on 100 must be 33, not 34).
      return Math.min(
        line.claimedAmount,
        Math.floor((line.claimedAmount * cap.percent) / 100)
      ) as Minor;
  }
}
```

### Reference-fixture golden test shape (Pattern 1)
```ts
// packages/engine/src/reference-fixture.golden.test.ts
// Source: PRD §14's reference fixture table, reproduced verbatim.
import { describe, expect, it } from "vitest";
import { assess } from "./assess.ts";
import { referencePack, referenceMatter, referenceLines, REFERENCE_NOW } from "./__fixtures__/reference-pack.ts";

describe("PRD §14 reference fixture (SG-shaped)", () => {
  it("reproduces the exact published totals", () => {
    const result = assess({ matter: referenceMatter, lines: referenceLines, pack: referencePack, now: REFERENCE_NOW });
    expect(result.totals).toEqual({
      claimedTotal: 88800,           // minor units: 888.00 SGD
      draftBaseline: 26640,          // 266.40
      disallowedTotal: 12660,        // 126.60 — see Pattern 1
      flaggedTotal: 49500,           // 495.00
      restingOnUnverifiedRules: 10640, // 106.40
      finalAmount: null,
    });
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `vitest.workspace.ts` for multi-project monorepos | `test.projects` field in a single root `vitest.config.ts` | Vitest 3.2+ (already how this repo is configured — `vitest.config.ts` verified this session) | No action needed — this repo already uses the current form; do not "fix" it back to a workspace file |
| `z.record(valueSchema)` single-argument shorthand | `z.record(keySchema, valueSchema)` (two-argument) required, or `z.partialRecord()` for optional-key maps | zod 4 | Already reflected in the frozen `rule-pack.ts`'s use of `z.partialRecord(StaffGradeSchema, MinorSchema)` for `rateSanityCeiling` — no action needed, noted only so a plan doesn't "fix" it to the old zod-3 shorthand by mistake |

**Deprecated/outdated:** none directly relevant to this phase beyond the two rows above, both already correctly reflected in the existing frozen code.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Near-identical description" for `POSSIBLE_DUPLICATE` should be implemented as normalized exact-string match (trim/lowercase/collapse whitespace), not fuzzy similarity | Don't Hand-Roll, Open Questions | If the product owner actually wants fuzzy matching, the golden-file duplicate-detection test cases will need a different, threshold-based fixture design — low risk to rework since it's isolated to one cross-line check |
| A2 | "Implausible magnitude" (`DATA_QUALITY`) has no PRD-specified numeric threshold; recommend a conservative placeholder (e.g. `quantity` far below the schema's 1,000,000 ceiling, or `unitRate` well above `rateSanityCeiling`) pending product-owner confirmation | Cross-line checks (Open Questions) | If left unresolved, this specific check either can't be implemented or ships with an arbitrary, undefensible number — directly conflicts with the product's core defensibility framing if not confirmed |
| A3 | `VENDOR_EVIDENCE_MISSING` (step 4) should only fire when a `CategoryRule`'s own `conditions` don't already cover the third-party-evidence gap, to avoid double-flagging the same root cause the fixture demonstrates line 5 does *not* double-flag | Open Questions | If wrong, the reference-fixture golden test (Pattern 1) will show an extra flag reason PRD §14's table doesn't list — will be caught immediately by the golden-file assertion, so risk is self-detecting |
| A4 | Rate-sanity check (`RATE_ABOVE_EXPECTED`) applies whenever `unit === 'HOUR' && incurredByGrade != null`, regardless of category code, not only to `STAFF_TIME_*` categories | Cross-line checks | Low risk — `rateSanityCeiling` is described in §7.2 as per-grade, not per-category, so scoping by unit+grade rather than category is the more literal reading; a narrower scoping would just mean fewer lines get checked, not incorrect ones |
| A5 | Hand-rolled day-count arithmetic (Pattern 4, option 1) is the recommended way to satisfy the literal "no bare Date" ban, over an ESLint-exempted calendar module (option 2) | Pattern 4 | If the planner prefers option 2 for lower implementation cost, both remain fully compliant with the purity *intent* (no clock reads); only the literal-strictness tradeoff differs |
| A6 | Aggregate-cap flag placement should flip affected lines fully squeezed to zero to `FLAG` (recommendation 1 in Pattern 3), rather than adding a new `MatterFlagCode` member | Pattern 3 | This is presented as a recommendation among three options, explicitly flagged as escalation-shaped — genuine risk if the plan picks silently instead of confirming with the product owner, since it changes what a lawyer sees on the review screen (a later phase's concern, but the schema shape is decided here) |

## Open Questions

1. **Aggregate-cap flag placement (Pattern 3).**
   - What we know: PROJECT.md fixed the arithmetic policy (round down, leave residue unallocated); the frozen schema has a `FlagReasonCode` for it but a `superRefine` invariant that makes attaching it to a non-`FLAG` line invalid, and no matching `MatterFlagCode` member.
   - What's unclear: whether affected lines should flip to `FLAG` (losing their pro-rata amount from `draftBaseline`) or stay `ALLOW_CAPPED` with a matter-level-only flag (a `MatterFlagCode` addition).
   - Recommendation: resolve explicitly before writing step 5 — this is escalation-shaped per FREEZE.md's own D-10 process, not a silent implementation detail. No real pack exercises this yet (both HK/SG's `aggregateCap` is `null`), so the decision can be made carefully with a small dedicated fixture rather than under fixture-matching pressure.

2. **"Implausible magnitude" threshold for `DATA_QUALITY` (§8.1 step 4).**
   - What we know: the check exists and must never silently adjust anything, only flag.
   - What's unclear: no numeric threshold appears anywhere in the PRD.
   - Recommendation: propose a starting number to the product owner (e.g. staff-time `quantity` over some multiple of a normal DSAR's expected hours, or `unitRate` a fixed multiple above `rateSanityCeiling`) and treat it as a `[ASSUMED]`-tagged, confirmable constant, not a hidden magic number buried in code.

3. **`ENGINE-16`'s output field.** Already resolved as an *additive* schema task (Pattern 3's sibling gap) — recommend a shape such as `Totals.flatFee: { amount: Minor; exceedsDirectCost: boolean } | null` or an equivalent field on `Assessment` directly, added to `packages/schemas/src/assessment.ts` this phase. "Itemised direct cost" for the exceeds-comparison should be `totals.draftBaseline` (the engine's own already-computed baseline after all other steps) — grounded in `rule-pack.ts`'s own module comment ("a flat figure cannot be shown to stay below direct cost without one[, the itemised baseline]" `[VERIFIED: packages/schemas/src/rule-pack.ts:150-152]`) — but confirm this reading with the planner since the PRD itself never defines "direct cost" precisely (PACK-12/D-02's own note acknowledges `FlatFeeSchema` is new design, not PRD transcription).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | v24.19.0 (verified `node --version`) | — |
| TypeScript | Compilation | ✓ | 6.0.3 (pinned, verified `package.json`) | — |
| Vitest | Test runner | ✓ | 5.0.0 (verified `package.json`) | — |
| fast-check | Property tests | ✓ | 4.10.0 (verified `package.json`) | — |
| @fast-check/vitest | Property test ergonomics | ✓ | 0.5.0 (verified `package.json`) | — |
| ESLint + typescript-eslint | Purity lint gates | ✓ | ESLint 10.10.0 (verified `package.json`); `eslint.config.js` already has a working pattern to extend | — |
| dependency-cruiser | Import-boundary gate | ✓ | 18.3.0 (verified `package.json`); `.dependency-cruiser.cjs` already configured for `packages/engine` | — |
| Docker | — | ✗ | — | Not needed this phase — `packages/engine` is pure in-memory functions over fixtures, no database involved (confirmed in phase description) |
| cross-env | (considered, not needed) | N/A | — | Not required — Pattern 6 shows in-process `TZ` mutation works without a subprocess spawn on this machine |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** Docker (not needed this phase; no action required).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.0 (verified `package.json`) |
| Config file | `vitest.config.ts` (root) — `engine` project already declared, `include: ["packages/engine/src/**/*.test.ts"]` |
| Quick run command | `pnpm vitest run --project engine` |
| Full suite command | `pnpm test` (runs `vitest run` across all projects — `package.json` script, verified) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENGINE-01 | `assess()` is pure — no I/O, no LLM import, no bare clock read | static (ESLint + dependency-cruiser) | `pnpm run lint && pnpm run depcruise` | ❌ Wave 0 — new ESLint rule for Date/Math.random needed |
| ENGINE-02 | Precondition errors (stale pack, controllerType, currency mismatch) | unit | `pnpm vitest run --project engine -t "preconditions"` | ❌ Wave 0 |
| ENGINE-03 | Posture gate (`PROHIBITED`/`PERMITTED_NARROW_EXCEPTION`/`NO_EXPRESS_AUTHORITY`) | unit | `pnpm vitest run --project engine -t "posture gate"` | ❌ Wave 0 |
| ENGINE-04 | Five treatments, `ALLOW_IF` → `CONDITIONS_NOT_MET` with failed-condition list | unit | `pnpm vitest run --project engine -t "per-line evaluation"` | ❌ Wave 0 |
| ENGINE-05 | `applyCap` all four types, round-down (AC-07c) | unit | `pnpm vitest run --project engine -t "applyCap"` | ❌ Wave 0 |
| ENGINE-06 | Cross-line checks raise flags, never silent adjustment | unit | `pnpm vitest run --project engine -t "cross-line"` | ❌ Wave 0 |
| ENGINE-07 | Aggregate cap pro-rata, residue unallocated, flagged | unit | `pnpm vitest run --project engine -t "aggregate cap"` | ❌ Wave 0 |
| ENGINE-08 | `finalAmount` null pre-sign-off, never defaulted | unit + property (extends SCHEMA-07 harness) | `pnpm vitest run --project engine -t "totals"` | ❌ Wave 0 |
| ENGINE-09 | `FLAG` lines contribute 0 to `draftBaseline` (AC-11) | golden fixture | reference-fixture golden test | ❌ Wave 0 |
| ENGINE-10 | `restingOnUnverifiedRules` subset of `draftBaseline` (AC-22) | golden fixture + property | reference-fixture golden test | ❌ Wave 0 |
| ENGINE-11 | Matter-level flags (`matterFlagRules` + 3 derived) | golden fixture | reference-fixture golden test | ❌ Wave 0 |
| ENGINE-12 | `OTHER_UNCLASSIFIED` always `FLAG` except posture-gate override (AC-19) | unit | `pnpm vitest run --project engine -t "OTHER_UNCLASSIFIED"` | ❌ Wave 0 |
| ENGINE-13 | Stored `claimedAmount` mismatch is a hard error (AC-08) | unit | `pnpm vitest run --project engine -t "claimedAmount"` | ❌ Wave 0 — note this may already be partly covered by `ExpenseLineSchema`'s own `superRefine` (Phase 1); confirm whether ENGINE-13 needs an *additional* engine-level check or is satisfied by re-parsing on load |
| ENGINE-15 | Suite passes identically under 2 TZ/locale combos | dedicated purity test | `pnpm vitest run --project engine -t "tz-locale"` | ❌ Wave 0 |
| ENGINE-16 | HK flat-fee comparison | unit (needs new schema field first) | `pnpm vitest run --project engine -t "flatFee"` | ❌ Wave 0 |
| ENGINE-17 | 50-line assessment < 100ms | perf test (median-of-N) | `pnpm vitest run --project engine -t "50 lines"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run --project engine` (fast — this project has no DB/network tests)
- **Per wave merge:** `pnpm test && pnpm run lint && pnpm run depcruise && pnpm run typecheck`
- **Phase gate:** full suite green, plus the reference-fixture golden test matching PRD §14's published numbers exactly, before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `packages/engine/src/assess.ts` and all step modules listed in Recommended Project Structure — none exist yet (`packages/engine/src/index.ts` is currently a placeholder)
- [ ] `packages/engine/src/__fixtures__/reference-pack.ts` — the hand-built fixture pack from Pattern 1
- [ ] New ESLint rule in `eslint.config.js` for `packages/engine`: `no-restricted-globals` (`Date`) + `no-restricted-properties` (`Math.random`), extending the existing money-brand rule block
- [ ] Additive schema change to `packages/schemas/src/assessment.ts` for ENGINE-16's flat-fee output field (see Open Question 3) — a `packages/schemas` change, but this phase's own requirement forces it
- [ ] `packages/schemas/src/assessment.property.test.ts` (Phase 1) re-pointed at real `assess()` output instead of hand-constructed `assessmentArb` values (per STATE.md's own decision log)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V1 Architecture, Design and Threat Modeling | yes | The engine/agent split itself (PRD §8.3) is the threat-modeling control — no LLM, no I/O, no clock read outside `now`, enforced by CI (dependency-cruiser + the new ESLint rule), not by convention |
| V2 Authentication | no | `packages/engine` has no HTTP surface; authentication is a later phase's concern (Phase 3.2/4) |
| V3 Session Management | no | Same — no session touches this package |
| V4 Access Control | no | Same — access control is enforced above this package, not inside it |
| V5 Input Validation | yes | `assess()`'s own precondition checks (stale pack, controller-type mismatch, currency mismatch) are input validation at a trust boundary between "whatever the caller passes" and "what the engine assumes is already valid" — even though the caller is expected to have already run `RulePack`/`Matter`/`ExpenseLine` through their zod schemas, the engine's own preconditions are a second, independent check specifically because a stale or wrong-currency pack is a defensibility failure, not just a data-quality one |
| V6 Cryptography | no | No cryptographic operation in this package |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Floating-point rounding exploited to leak a fraction of a cent across many lines (a classic "salami slicing" pattern in financial software) | Tampering | Integer-only `Minor` arithmetic throughout, `Math.floor` (never `Math.round`) on every cap/pro-rata division, verified by the AC-07c boundary tests and the 10,000-run property test (SCHEMA-07, re-pointed at real `assess()` output per Pattern 1) |
| Integer overflow on aggregate sums (e.g. `claimedTotal` across 50 lines each near `MINOR_MAX`) | Tampering | `MinorSchema` already bounds every individual value to ±2,147,483,647 (Postgres `Int32`, verified `primitives.ts`); the engine's own summation should assert results stay within `MinorSchema`'s range too (not just individual fields) since JS numbers can silently exceed 32-bit range without throwing — recommend a defensive `MinorSchema.parse()` (or equivalent bounds check) on every computed `Totals` field, not only on inputs |
| A pack- or matter-derived string reaching the engine's own emitted `FlagReason.message` and containing a banned word (`compliant`/`legal`/`lawful`/`approved`/`safe` — CLAUDE.md constraint) | Information Disclosure (of an implied legal conclusion the product must never make) | Unlike `basis`/`citation` (pack-authored, validated by Phase 3's PACK-11/AC-32a), the `FlagReason.message` strings for cross-line checks (`POSSIBLE_DUPLICATE`, `MATERIALITY`, `RATE_ABOVE_EXPECTED`, `DATA_QUALITY`, `VENDOR_EVIDENCE_MISSING`, `AGGREGATE_CAP_APPLIED`) are **engine-authored**, not pack-authored — there is currently no test anywhere in the codebase asserting the engine's own literal message strings avoid the banned-word list. Recommend a small dedicated test in this phase (analogous to Phase 3's pack-validator check) that asserts every hardcoded `FlagReason.message` template the engine emits is free of the canonical banned words, rather than deferring this entirely to Phase 5's DISC-03 (which scopes to the UI strings file and pack `basis` strings, not engine-internal message templates) |

## Sources

### Primary (HIGH confidence)
- `packages/schemas/src/*.ts` (all 12 frozen modules, read in full this session) — the authoritative, load-bearing source for every `[VERIFIED: ...]` claim in this document
- `packages/schemas/FREEZE.md` — the additive-only (D-09) rule and its escalation process (D-10), read in full this session
- `docs/PRD-dsar-fee-agent.md` §6.4, §7.2, §7.4, §7.5, §7.6, §8.1, §11, §13 (AC-07 through AC-42 as relevant), §14 — read in full this session
- `.planning/PROJECT.md`, `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` (Phase 2 section) — read in full this session
- `package.json`, `packages/engine/package.json`, `packages/schemas/package.json`, `vitest.config.ts`, `eslint.config.js`, `.dependency-cruiser.cjs` — read in full this session, all installed-version claims verified directly against these files
- Empirical Node/TZ/Intl behavior — commands run directly in this session on this machine (Windows, Node v24.19.0), see Pattern 6

### Secondary (MEDIUM confidence)
- [Using Vitest bench to track performance regressions in your CI (CodSpeed)](https://codspeed.io/blog/vitest-bench-performance-regressions) — WebSearch, informs the recommendation against `vitest bench` as a CI pass/fail gate
- [Vi | Vitest (vi.stubEnv / vi.unstubAllEnvs)](https://vitest.dev/api/vi) — WebSearch, confirms the recommended env-stubbing API exists in the installed Vitest major version
- [ESLint no-restricted-globals / no-restricted-properties](https://eslint.org/docs/latest/rules/no-restricted-globals) — WebSearch, confirms `Date` is banned via `no-restricted-globals` and `Math.random` via `no-restricted-properties` (two different rules, not one)

### Tertiary (LOW confidence)
- None — every claim in this document is either grounded in a file read this session, an empirical command run this session, or explicitly tagged `[ASSUMED]` in the Assumptions Log above.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all versions verified directly from `package.json`
- Architecture (the seven-step algorithm, `applyCap`, `Totals` formulas): HIGH on arithmetic derived from frozen source and PRD §14's own numbers; MEDIUM on the aggregate-cap flag-placement and flat-fee schema-extension recommendations, which are genuinely open and flagged as such
- Pitfalls: HIGH — each is grounded in a specific, cited schema constraint or arithmetic derivation, not speculation
- Purity/TZ/perf CI gates: HIGH on the empirically-verified Node/TZ/Intl behavior on this exact machine; MEDIUM on the recommended ESLint rule shape (a standard, well-known pattern, but not yet written/tested in this repo)

**Research date:** 2026-09-15
**Valid until:** No external dependency in this research is expected to move quickly — 60 days is a reasonable validity window, longer than the usual 30, specifically because this phase adds zero new packages and the frozen schema (its main input) cannot change without a D-09 escalation.
