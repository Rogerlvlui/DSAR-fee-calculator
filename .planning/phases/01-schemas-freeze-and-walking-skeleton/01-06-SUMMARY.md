---
phase: 01-schemas-freeze-and-walking-skeleton
plan: 06
subsystem: schemas
tags: [zod, typescript, rule-pack, condition, flat-fee]

requires:
  - phase: 01-schemas-freeze-and-walking-skeleton (plan 01-05)
    provides: Matter/ExpenseLine (the two types Condition.field is closed over), MinorSchema/toMinor, JURISDICTION_CURRENCY, primitives (UserRefSchema, InstrumentSchema, CitationSchema, ControllerTypeSchema, StaffGradeSchema)
provides:
  - "ConditionSchema/Condition/CONDITION_FIELDS/ConditionFieldSchema — PRD §6.0, closed at compile time via `satisfies readonly (keyof ExpenseLine | keyof Matter)[]` and at runtime via a zod enum"
  - "RulePackSchema/RulePack, CategoryRuleSchema/CategoryRule, CapSchema/Cap, FeePostureSchema/FeePosture, MatterFlagRuleSchema/MatterFlagRule — PRD §7.2, field-for-field"
  - "FlatFeeSchema/FlatFee — the PACK-12/D-02 extension, new design (not a §7.2 transcription), optional on RulePack, no currency sub-field"
affects: [01-07, 02-engine, 03-rulepacks-loader-and-content]

actuals:
  tokens: 6986
  tasks: 3
  commits: 4
plan_head_before: 73eb81617cd427e12d7370c15ce42b832e2bbb37

tech-stack:
  added: []
  patterns:
    - "z.discriminatedUnion('type', [...]) for Cap — four strict-object variants, each carrying only its own keys, so a PERCENT_OF_CLAIM cap cannot smuggle an amount and a PER_LINE cap cannot smuggle a unit"
    - "A full both-key strict object (FeePostureMapSchema) rather than z.record() for feePosture — ControllerType has exactly two known values, so an explicit two-key strict object gives exhaustiveness (both keys required, no third key accepted) without depending on zod 4's enum-key z.record() exhaustiveness semantics"
    - "z.partialRecord(StaffGradeSchema, MinorSchema) for rateSanityCeiling — zod 4's replacement for the removed single-argument z.record() shorthand, confirmed against 01-RESEARCH.md Pattern 1"
    - "Condition.field closed by a literal CONDITION_FIELDS tuple carrying `satisfies readonly (keyof ExpenseLine | keyof Matter)[]`, per 01-RESEARCH.md Pattern 2 and CONTEXT.md's Claude's-Discretion instruction — the rejected alternative (widening field to string) is recorded in a condition.ts module note"

key-files:
  created:
    - packages/schemas/src/condition.ts
    - packages/schemas/src/condition.test.ts
    - packages/schemas/src/rule-pack.ts
    - packages/schemas/src/rule-pack.test.ts
  modified: []

key-decisions:
  - "D-02 checkpoint (blocking-human gate) confirmed as `extend-now`, but WITHOUT the `currency` sub-field originally in PLAN.md's FlatFeeSchema design. Before the checkpoint resolved, this executor's own reading of PRD §7.2/§7.4/§7.5/§7.6/§17 q.2 surfaced that (a) PRD §7.2's RulePack carries no flatFee field at all — the PRD's only HK flat-fee mechanism is §7.5's HK.FLAT_FEE_CHECK matterFlagRule, advisory prose for a lawyer, not a machine-readable figure ENGINE-16 can compare against — so FlatFeeSchema is new design filling a gap between the PRD and ENGINE-16, not a §7.2 transcription; and (b) the originally-planned `currency` sub-field on FlatFee would duplicate JURISDICTION_CURRENCY with no cross-field check, risking silent drift from the jurisdiction's designated currency. Both findings were independently verified by the coordinator before the checkpoint was put to the user, and the user's decision (extend-now, drop currency) matched both findings' direction. PROJECT.md's Key Decisions table now records both outcomes (the D-02 row and a new row for the currency removal) verbatim."
  - "FlatFeeSchema carries amount (Minor), basis (max 240), citation, verificationStatus — the same provenance fields as any other pack rule — but no currency. A flat figure's currency is always derived from RulePack.jurisdiction.code via the existing JURISDICTION_CURRENCY map (PRD §6.0: currency 'is deliberately not a per-pack field'); removing the field eliminates the drift failure mode rather than adding a superRefine to detect it after the fact."
  - "flatFee is attached to RulePack as an optional (not nullable-required) field, so the eight packs without a flat fee parse to an object with the key entirely absent — proven directly by a test asserting Object.hasOwn(parsed, 'flatFee') is false for a pack that omits it."
  - "MatterFlagRuleSchema lives in rule-pack.ts (not primitives.ts), per primitives.ts's own note and 01-RESEARCH.md Pattern 2 — its `when` union has a Condition arm, and Condition could not be frozen until Matter/ExpenseLine existed (01-05)."
  - "No cross-field superRefine was needed in this plan (unlike 01-05's currency/claimedAmount invariants) — the currency-drift risk that would have needed one was designed out by removing the field instead, per the D-02 checkpoint resolution."

requirements-completed: [SCHEMA-01]

coverage:
  - id: D1
    description: "ConditionSchema is closed at the type level (CONDITION_FIELDS satisfies readonly (keyof ExpenseLine | keyof Matter)[]) and at runtime (a 3-arm union over a 15-entry field enum), so a pack cannot smuggle a free-text predicate past it"
    requirement: "SCHEMA-01"
    verification:
      - kind: unit
        ref: "packages/schemas/src/condition.test.ts (14 cases, including a @ts-expect-error compile-time fixture)"
        status: pass
      - kind: unit
        ref: "pnpm tsc --noEmit -p packages/schemas"
        status: pass
    human_judgment: false
  - id: D2
    description: "RulePackSchema, CategoryRuleSchema, CapSchema (4 variants), FeePostureSchema (7 values, full 2-key map) and MatterFlagRuleSchema (3 when arms) are frozen field-for-field with PRD §7.2, with categoryRules exhaustiveness deliberately deferred to Phase 3's PACK-02 validator"
    requirement: "SCHEMA-01"
    verification:
      - kind: unit
        ref: "packages/schemas/src/rule-pack.test.ts (24 cases)"
        status: pass
      - kind: unit
        ref: "pnpm eslint packages/engine packages/schemas"
        status: pass
      - kind: unit
        ref: "pnpm exec depcruise --config .dependency-cruiser.cjs packages/engine packages/schemas"
        status: pass
    human_judgment: false
  - id: D3
    description: "The HK flat-fee extension (PACK-12/D-02) exists as an optional flatFee field on RulePack, proven to leave a pack that omits it parsing to an object with the key literally absent, and carrying no currency sub-field per the checkpoint's resolution"
    requirement: "SCHEMA-01"
    verification:
      - kind: unit
        ref: "packages/schemas/src/rule-pack.test.ts#RulePackSchema — flat fee extension (D-02 / PACK-12)"
        status: pass
    human_judgment: true
    rationale: "The schema-level proof (parses, key absent, no currency field) is fully covered by passing tests. Whether the D-02 checkpoint's resolution was the right call for the product is a judgment already made by the user at the checkpoint gate during this session, not a re-verifiable test assertion — recorded here for traceability rather than left silently unclassified."

duration: 30min
completed: 2026-09-15
status: complete
---

# Phase 1 Plan 6: RulePack Contract Frozen, Including the D-02 Flat-Fee Extension Summary

**PRD §7.2 transcribed into zod as `RulePack`/`CategoryRule`/`Cap`/`FeePosture`/`MatterFlagRule`, plus a new-design `FlatFeeSchema` extension (D-02) attached as an optional `flatFee` field with no `currency` sub-field, following a blocking-human checkpoint that surfaced the extension has no basis in PRD §7.2's actual text.**

## Performance

- **Duration:** ~30 min (includes the D-02 checkpoint investigation, the coordinator's independent verification, and the user's decision, before code execution resumed)
- **Started:** 2026-09-15T06:24:00Z (approx., session start)
- **Completed:** 2026-09-15T06:48:54Z
- **Tasks:** 3 (1 checkpoint:decision + 2 tdd auto tasks)
- **Files modified:** 4 created

## Accomplishments

- **Task 1 (checkpoint:decision, gate="blocking-human"): D-02 confirmed as `extend-now`, with the `currency` sub-field dropped.** This executor halted at the gate as instructed and read PRD §7.2, §7.4, §7.5, §7.6 and §17 q.2 directly before returning the checkpoint. Two findings were surfaced: (1) PRD §7.2's `RulePack` type has no `flatFee` field of any kind — the PRD's only flat-fee mechanism is §7.5's `HK.FLAT_FEE_CHECK` `matterFlagRule`, advisory prose for a lawyer to manually consider, not a figure an engine can compute against, so the plan's `FlatFeeSchema` is new design filling a gap between the PRD and ENGINE-16, not a transcription; (2) the originally-planned `currency` sub-field on `FlatFee` would duplicate `JURISDICTION_CURRENCY` with no cross-field check. Both findings were independently re-verified by the coordinator, and the user decided `extend-now` without `currency`. PROJECT.md's Key Decisions table now carries both outcomes.
- `Condition` (`packages/schemas/src/condition.ts`) — `CONDITION_FIELDS` is a 15-entry readonly tuple carrying `satisfies readonly (keyof ExpenseLine | keyof Matter)[]`, closing the loop between PRD §6.0's compile-time constraint and a runtime-checkable zod enum. `ConditionSchema` is the three-arm union (comparison / `in` / null-check), each arm a `z.strictObject()` so the null-check arm rejects a stray `value` key and the `in` arm rejects a scalar value.
- `RulePack` (`packages/schemas/src/rule-pack.ts`) — every §7.2 field transcribed: `CapSchema` as a 4-variant `z.discriminatedUnion`, `FeePostureSchema` over exactly 7 values with a full both-controller-type `feePosture` map, `CategoryRuleSchema` (5 treatments, 240-char `basis`), `MatterFlagRuleSchema` (3 `when` arms, deliberately homed here rather than `primitives.ts` per its `Condition` dependency), and `rateSanityCeiling` via `z.partialRecord()`.
- `FlatFeeSchema` — the PACK-12/D-02 extension — carries `amount` (branded `Minor`), `basis` (max 240), `citation`, `verificationStatus`, and **no `currency`**. Attached to `RulePack` as `flatFee`, optional, proven by test to leave a pack that omits it parsing to an object with the key entirely absent.
- 145/145 tests pass across the full repo (up from 107 before this plan); `tsc --noEmit`, `eslint`, and `dependency-cruiser` all clean over `packages/engine` + `packages/schemas`.

## Task Commits

1. **Task 1: Confirm D-02 (checkpoint:decision, gate="blocking-human")** — no code commit; resolved via coordinator round-trip. The coordinator's own commit recording the outcome: `73eb816` (`docs: record D-02 outcome and flat-fee currency removal`) — made before this executor resumed, visible in `git log` and reflected in PROJECT.md's Key Decisions table.
2. **Task 2: Freeze the closed Condition union**
   - `21f2427` (test) — RED: `condition.test.ts` fails to resolve `./condition.ts`
   - `9fec75b` (feat) — GREEN: 14/14 pass
3. **Task 3: Freeze PRD §7.2 RulePack, including the HK flat-fee extension**
   - `056979c` (test) — RED: `rule-pack.test.ts` fails to resolve `./rule-pack.ts`
   - `c9f70df` (feat) — GREEN: 24/24 pass

_No REFACTOR commits — both GREEN implementations were already minimal; no obvious cleanup existed._

**Plan metadata:** committed together with this SUMMARY (see below).

## Files Created/Modified

- `packages/schemas/src/condition.ts` - `ConditionSchema`/`Condition`, `CONDITION_FIELDS`, `ConditionFieldSchema`
- `packages/schemas/src/condition.test.ts` - 14 cases falsifying `ConditionSchema`, including a `@ts-expect-error` compile-time fixture
- `packages/schemas/src/rule-pack.ts` - `RulePackSchema`/`RulePack`, `CategoryRuleSchema`, `CapSchema`, `FeePostureSchema`, `MatterFlagRuleSchema`, `FlatFeeSchema`
- `packages/schemas/src/rule-pack.test.ts` - 24 cases falsifying `RulePackSchema` and its component schemas

## Decisions Made

- **D-02 confirmed `extend-now`, without `currency`.** See the checkpoint findings above and the `key-decisions` frontmatter for the full account. PROJECT.md's Key Decisions table is the durable record (two new rows: the flat-fee-extension outcome, and the currency-field removal).
- **`FlatFeeSchema` is new design, not a §7.2 transcription — recorded plainly, not described as a freeze.** Phase 3's pack author needs to know this: the shape was invented here to satisfy ENGINE-16, not read off the PRD, so the field names and constraints in it carry less inherited authority than the rest of `RulePack` and are worth a second look when the HK pack is actually authored.
- **`currency` deliberately omitted from `FlatFee`.** PRD §6.0 states currency "is deliberately not a per-pack field: it is a property of the jurisdiction, not of any one rule pack version." A flat fee's currency is always `JURISDICTION_CURRENCY[jurisdiction.code]`; no cross-field check was added because there is no second currency value left to disagree with it.
- **`MatterFlagRuleSchema` lives in `rule-pack.ts`, not `primitives.ts`**, matching the note already left in `primitives.ts` by plan 01-02/01-05 and 01-RESEARCH.md Pattern 2 — its `when` union depends on `ConditionSchema`, which depends on `Matter`/`ExpenseLine`.
- **`Condition.field` closed via an enumerated literal union with a `satisfies keyof` clause, not widened to `string`.** This was CONTEXT.md's "Claude's Discretion" item; the rejected alternative is recorded in a `condition.ts` module note per that instruction.

## Deviations from Plan

None — plan executed exactly as written, with the one substantive change (`currency` removed from `FlatFeeSchema`) made explicitly through the plan's own checkpoint mechanism rather than as an undocumented deviation.

## Issues Encountered

None. Both TDD cycles passed on the first GREEN attempt; no fix-up commits were needed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `Condition`, `RulePack`, `CategoryRule`, `Cap`, `FeePosture`, `MatterFlagRule` and `FlatFee` are frozen and compile. Phase 2's engine and Phase 3's rule-pack authoring/loader/validator can both build directly against these shapes.
- Phase 3's HK pack author should read this SUMMARY's decisions section before authoring `flatFee` content — the field's shape is new design, not a PRD-sourced freeze, and its `basis`/`citation`/`verificationStatus` provenance fields carry the same authorial weight as any `categoryRule`.
- Phase 2's ENGINE-16 has a concrete `RulePack.flatFee?: FlatFee` to read from; the itemised-vs-flat comparison itself remains Phase 2's to build.
- No blockers for plan 01-07 or Phase 2/3.

## Self-Check: PASSED

- All 4 created files found on disk: `packages/schemas/src/condition.ts`, `packages/schemas/src/condition.test.ts`, `packages/schemas/src/rule-pack.ts`, `packages/schemas/src/rule-pack.test.ts`
- All 4 task commits found in git log: `21f2427`, `9fec75b`, `056979c`, `c9f70df` (plus coordinator commit `73eb816` recording the D-02 outcome)
- Re-ran plan-level `<verification>`: `pnpm vitest run --project schemas` (123/123 pass), `pnpm tsc --noEmit -p packages/schemas` (clean), `pnpm eslint packages/engine packages/schemas` (clean), a fixture pack omitting `flatFee` and the same fixture with it both parse (asserted in `rule-pack.test.ts`)
- Re-ran full suite: `pnpm vitest run` passes 145/145 (up from 107 before this plan) with no regressions
- Re-ran all acceptance criteria from both code tasks: `CONDITION_FIELDS` has exactly 15 entries and carries the `satisfies` clause, `ConditionSchema` is a 3-arm union, null-check/`in` arm rejections hold, `condition.ts` contains no `z.string()` typing of `field`; `FeePostureSchema` has exactly 7 members, `CapSchema` is a 4-variant discriminated union, `CategoryRuleSchema.treatment` has 5 members, `feePosture` rejects a missing controller type, `flatFee` is optional and a pack omitting it parses with the key absent, `rateSanityCeiling` uses `z.partialRecord` with no single-argument `z.record(` call present, `basis` maxima are 240 in both schemas, `profitElementPermitted`/`deterrentUsePermitted` are required with no `.default(` — all PASS
- `pnpm exec depcruise --config .dependency-cruiser.cjs packages/engine packages/schemas`: no violations, 21 modules cruised

---
*Phase: 01-schemas-freeze-and-walking-skeleton*
*Completed: 2026-09-15*
