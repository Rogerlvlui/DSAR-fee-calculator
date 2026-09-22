---
phase: 02-deterministic-fee-engine
plan: "03"
subsystem: schemas
tags: [zod, schema-freeze, matter-flag, totals, flat-fee, tdd]

requires:
  - phase: 01-schemas-freeze-and-walking-skeleton
    provides: The frozen packages/schemas modules (primitives.ts's MatterFlagCode, assessment.ts's TotalsSchema) this plan additively extends under D-09.
provides:
  - "MatterFlagCodeSchema gains a sixth member, AGGREGATE_CAP_APPLIED (D-11) — a matter-level home for the aggregate-cap notice that AssessmentLineSchema.superRefine's bidirectional flagReasons/FLAG refinement cannot express at line level without forcing a capped line to FLAG and dropping its amount from draftBaseline"
  - "TotalsSchema gains an optional FlatFeeComparisonSchema block, flatFeeComparison (D-12) — flatFeeAmount, itemisedDirectCostAmount and flatFeeExceedsItemisedCost, all branded/typed, no currency sub-field, following the RulePack.flatFee optional-not-nullable precedent"
  - "Regenerated packages/schemas/schema/assessment.schema.json, byte-identical to a fresh generation per the existing drift test"
  - "FREEZE.md post-freeze amendment recording both changes under D-09, D-11 and D-12"
affects: [02-05-aggregate-cap-and-cross-line, 02-06-flat-fee-and-matter-flags]

actuals:
  tokens: 4845
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "A pre-existing shape-cardinality unit test (TotalsSchema.shape key count) had to be updated in the same commit as the additive schema change — any optional field addition changes z.object's declared shape, so an exact-length shape assertion is inherently incompatible with the additive-only freeze policy; the behavioral guarantee (a six-key object still parses with no comparison property) is what actually matters and is covered by dedicated new tests"
    - "RED evidence captured via vitest tap-flat reporter plus a hand-appended '# tests/# pass/# fail' summary line counting only non-SKIP TAP lines — continuing 02-01/02-02's documented workaround for gsd-tools check tdd-red-evidence's Node-test-runner-shaped TAP parser"

key-files:
  created: []
  modified:
    - packages/schemas/src/primitives.ts
    - packages/schemas/src/primitives.test.ts
    - packages/schemas/src/assessment.ts
    - packages/schemas/src/assessment.test.ts
    - packages/schemas/schema/assessment.schema.json
    - packages/schemas/FREEZE.md

key-decisions:
  - "D-11 implemented exactly as decided: AGGREGATE_CAP_APPLIED added to MatterFlagCode only, FlagReasonCodeSchema's line-level member of the same name left untouched, AssessmentLineSchema.superRefine unmodified and re-proven both directions"
  - "D-12 implemented exactly as decided: FlatFeeComparisonSchema is a z.strictObject with three fields (flatFeeAmount, itemisedDirectCostAmount, flatFeeExceedsItemisedCost), no currency field, attached to TotalsSchema as .optional() not .nullable()"
  - "Updated the pre-existing 'declares exactly 6 fields' TotalsSchema shape assertion to expect 7 (the new optional field is a declared key in z.object's shape regardless of optionality) — an unavoidable consequence of any additive field, distinct from and not a relaxation of the parse-behavior guarantee that a six-key object still parses with no comparison property"

requirements-completed: []

coverage:
  - id: D1
    description: "MatterFlagCodeSchema has six members including the new AGGREGATE_CAP_APPLIED, all five pre-existing codes still parse individually, a MatterFlag using the new code parses, and AssessmentLineSchema.superRefine's bidirectional refinement is proven unchanged in both directions"
    requirement: "ENGINE-07"
    verification:
      - kind: unit
        ref: "packages/schemas/src/primitives.test.ts#MatterFlagCodeSchema (D-11) / MatterFlagSchema — AGGREGATE_CAP_APPLIED (D-11) / AssessmentLineSchema.superRefine — unchanged by the MatterFlag D-11 addition"
        status: pass
    human_judgment: false
  - id: D2
    description: "TotalsSchema accepts an optional flatFeeComparison block (branded flatFeeAmount, itemisedDirectCostAmount, boolean flatFeeExceedsItemisedCost, z.strictObject, no currency field); a six-key Totals still parses with no comparison property; fractional/out-of-bounds amount, missing boolean, and undeclared extra key all rejected; AC-25's finalAmount shape unaffected"
    requirement: "ENGINE-16"
    verification:
      - kind: unit
        ref: "packages/schemas/src/assessment.test.ts#TotalsSchema — flatFeeComparison (D-12)"
        status: pass
    human_judgment: false
  - id: D3
    description: "packages/schemas/schema/assessment.schema.json regenerated and verified byte-identical to a fresh z.toJSONSchema() generation; assessment-line.schema.json and expense-line.schema.json correctly unaffected; FREEZE.md records both amendments under D-09/D-11/D-12; full monorepo suite green"
    verification:
      - kind: unit
        ref: "packages/schemas/src/json-schema.test.ts#toJsonSchemaArtifacts (regenerated output is byte-identical to the committed artifact)"
        status: pass
      - kind: other
        ref: "pnpm test (full workspace) — 217/217 passing"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-15
status: complete
---

# Phase 2 Plan 3: D-11/D-12 Additive Schema Amendments Summary

**`MatterFlagCode` gains `AGGREGATE_CAP_APPLIED` and `Totals` gains an optional `flatFeeComparison` block — both additive under D-09, both regenerated into the committed JSON Schema artifacts, both recorded in `FREEZE.md`.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-15T08:50:00Z
- **Completed:** 2026-09-15T09:05:01Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- `MatterFlagCodeSchema` (`primitives.ts`) has six members; `AGGREGATE_CAP_APPLIED` gives ENGINE-07's aggregate-cap notice a matter-level home without touching `FlagReasonCodeSchema`'s line-level member of the same name or relaxing `AssessmentLineSchema.superRefine`'s bidirectional flagReasons/FLAG refinement — both re-proven intact by dedicated tests
- `TotalsSchema` (`assessment.ts`) carries an optional `flatFeeComparison: FlatFeeComparisonSchema` block (`flatFeeAmount`, `itemisedDirectCostAmount`, `flatFeeExceedsItemisedCost`, no currency field, `z.strictObject`) giving ENGINE-16 somewhere to write its flat-fee-vs-itemised-direct-cost comparison; a six-key `Totals` object still parses with no comparison property, so every pre-existing behavioral assertion keeps passing
- `packages/schemas/schema/assessment.schema.json` regenerated via `pnpm schema:json` and verified byte-identical to a fresh generation; `assessment-line.schema.json`/`expense-line.schema.json` correctly untouched since neither downstream schema reaches `MatterFlagCode` or `Totals`
- `FREEZE.md` gains a post-freeze amendment section naming both changes, both modules, D-09 as the authority, and D-11/D-12 as the decisions implemented

## Task Commits

Each TDD task followed RED → GREEN (no REFACTOR needed — both implementations were minimal on first pass):

1. **Task 1: D-11 — a matter-level flag code for the aggregate cap**
   - `1ef2a2a` — test(02-03): add failing test for MatterFlagCode AGGREGATE_CAP_APPLIED (D-11) (RED)
   - `2ee1fe6` — feat(02-03): add AGGREGATE_CAP_APPLIED to MatterFlagCode (D-11) (GREEN)
2. **Task 2: D-12 — an optional flat-fee comparison block on Totals**
   - `82c1450` — test(02-03): add failing test for Totals.flatFeeComparison (D-12) (RED)
   - `46d7ff9` — feat(02-03): add optional FlatFeeComparison block to Totals (D-12) (GREEN)
3. **Task 3: Regenerate the JSON Schema artifacts and record the amendment in FREEZE.md**
   - `7e8df57` — feat(02-03): regenerate JSON Schema artifacts and record D-11/D-12 in FREEZE.md

**Plan metadata:** committed alongside this SUMMARY (see final commit below).

## TDD Gate Compliance

| Task | RED commit | GREEN commit | RED evidence | Status |
|------|-----------|---------------|---------------|--------|
| 1 | `1ef2a2a` | `2ee1fe6` | `RED_EVIDENCE_OK` (3 named assertions failed: options length 5≠6, new code not parsing in MatterFlagCodeSchema, MatterFlagSchema rejecting the new code) | Pass |
| 2 | `82c1450` | `46d7ff9` | `RED_EVIDENCE_OK` (5 named assertions failed: comparison block not parsing, fractional/out-of-bounds amount and missing-boolean/extra-key cases not yet rejected because the field didn't exist) | Pass |

Task 3 is `type="auto"` (not `tdd="true"`) — regeneration and documentation, verified directly against the acceptance criteria (`git diff --stat`, `grep -c "D-11"/"D-12"`, full `pnpm test`).

## Files Created/Modified

- `packages/schemas/src/primitives.ts` — `MatterFlagCodeSchema` gains `AGGREGATE_CAP_APPLIED` (D-11), with a module comment recording the PRD §6.0 tension and why it was resolved additively
- `packages/schemas/src/primitives.test.ts` — cardinality assertion updated to 6; new describe blocks proving the new code parses, all five pre-existing codes still parse individually, a `MatterFlag` using the new code parses, and the line-level refinement is unchanged in both directions
- `packages/schemas/src/assessment.ts` — `FlatFeeComparisonSchema` added; `TotalsSchema` gains the optional `flatFeeComparison` field, with a module comment recording D-12's reasoning and the `draftBaseline` grounding for "itemised direct cost"
- `packages/schemas/src/assessment.test.ts` — new describe block covering all five D-12 behaviors plus two AC-25 regression checks; pre-existing shape-cardinality test updated (see Deviations)
- `packages/schemas/schema/assessment.schema.json` — regenerated
- `packages/schemas/FREEZE.md` — post-freeze amendment section for D-11/D-12

## Decisions Made

- Field names inside `FlatFeeComparisonSchema` (`flatFeeAmount`, `itemisedDirectCostAmount`) both end in the AC-07a money suffix so the branded-`Minor` ESLint rule applies to them structurally, per the plan's own instruction not to add an `eslint-disable`
- `itemisedDirectCostAmount` is stored as its own field rather than requiring the reader to re-derive it from `Totals.draftBaseline` elsewhere on the same object — the comparison self-describes what was compared against what at computation time, surviving a later change to how `draftBaseline` is computed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing `TotalsSchema` shape-cardinality test broke on the additive D-12 field**
- **Found during:** Task 2, GREEN phase, `pnpm vitest run --project schemas -t "Totals"`
- **Issue:** A Phase 1 test (`TotalsSchema — the six §8.1 step 6 fields > declares exactly 6 fields`) asserts `Object.keys(TotalsSchema.shape).sort()` equals exactly the six original keys. Any field added to a `z.object`'s shape — even `.optional()` — appears in `.shape`, so this assertion is structurally incompatible with the additive-only freeze policy (D-09) that this exact task is authorized to use. It is not testing a behavior D-12 threatens (a six-key object still parses with no comparison property, which is separately and correctly asserted); it is testing the literal declared-key count, which any authorized addition necessarily changes.
- **Fix:** Updated the test's expected array to include `flatFeeComparison` and renamed it to record why (the original six §8.1 fields are still there, unretyped; the seventh is the authorized D-12 addition). The test's actual purpose — catching an *unintended* field creep — is preserved: a stray eighth key would still fail it.
- **Files modified:** `packages/schemas/src/assessment.test.ts`
- **Verification:** `pnpm vitest run --project schemas` green (168/168); `pnpm test` green (217/217)
- **Committed in:** `46d7ff9` (Task 2 GREEN)

### Tooling/Plan-Text Note (documented, not a deviation from plan scope)

Task 3's `<verify>` literal command `pnpm vitest run --project schemas -t "json-schema"` matches **zero tests** — the describe block in `json-schema.test.ts` is named `toJsonSchemaArtifacts`, which contains no `json-schema` substring. Per the same task's own `<fails_when>` ("the run matches zero tests"), the literal command as written always reports failure regardless of actual state. Verified instead with `-t "JsonSchema"` (matches the actual describe name; 5/5 pass, including the drift check) and with the plan's second verify line, `pnpm test` (217/217, full workspace). Recorded here so a future reader does not treat the literal `-t "json-schema"` string as a working gate for this file without correcting the filter.

---

**Total deviations:** 1 auto-fixed (1 bug — a frozen-era test's cardinality assertion incompatible with an authorized additive change)
**Impact on plan:** The fix preserves the pre-existing test's actual purpose (catching unintended field creep) while accommodating the plan's own authorized addition. No scope creep beyond the plan's three tasks.

## Issues Encountered

None beyond the deviation and tooling note above — both resolved within the task that found them.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `MatterFlagCodeSchema.AGGREGATE_CAP_APPLIED` is available for plan 02-05 (aggregate-cap step) to emit as a matter-level flag.
- `TotalsSchema.flatFeeComparison` is available for plan 02-06 (flat-fee step) to populate.
- `ENGINE-07` and `ENGINE-16` remain `Pending` in `REQUIREMENTS.md` — both are shared with sibling plans 02-05 and 02-06 respectively, which implement the actual engine behavior this plan only unblocked; `gsd-tools query requirements.ready-ids` confirms 0/2 ready to mark complete until those siblings produce their `SUMMARY.md` (shared-ID gate, #2388).
- No blockers for the next plan in this phase. `packages/schemas` remains additive-only and green across the full workspace (217/217 tests, lint, typecheck, depcruise all clean).

## Self-Check: PASSED

- All 6 modified files verified present on disk (`[ -f ]`): `primitives.ts`, `primitives.test.ts`, `assessment.ts`, `assessment.test.ts`, `assessment.schema.json`, `FREEZE.md`.
- All 5 task commit hashes verified present in `git log --oneline --all`.
- `pnpm vitest run --project schemas` — 168/168 passing.
- `pnpm test` (full workspace) — 217/217 passing (200 prior + 17 new/updated).
- `pnpm run lint`, `pnpm run typecheck`, `pnpm run depcruise` all re-run clean.
- `git diff --stat packages/schemas/schema/` shows `assessment.schema.json` changed (26 insertions), `assessment-line.schema.json`/`expense-line.schema.json` unchanged, as expected.
- `grep -c "D-11" packages/schemas/FREEZE.md` → 3; `grep -c "D-12" packages/schemas/FREEZE.md` → 2.
- `plan_head_before: 44ae4c04d710d5cb9bf81309f21f01c0e405ac8f`, `commits: 5` (measured via `git rev-list --count`).

---
*Phase: 02-deterministic-fee-engine*
*Completed: 2026-09-15*
