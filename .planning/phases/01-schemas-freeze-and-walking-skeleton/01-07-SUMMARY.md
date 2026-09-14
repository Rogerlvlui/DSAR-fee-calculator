---
phase: 01-schemas-freeze-and-walking-skeleton
plan: 07
subsystem: schemas
tags: [zod, typescript, fast-check, json-schema, assessment, guard-input]

requires:
  - phase: 01-schemas-freeze-and-walking-skeleton (plan 01-02)
    provides: MinorSchema/toMinor, primitives (UserRefSchema, CitationSchema, FlagReasonSchema/FlagReasonCodeSchema, MatterFlagSchema), FREE_TEXT_LIMITS
  - phase: 01-schemas-freeze-and-walking-skeleton (plan 01-05)
    provides: ExpenseLineSchema/ExpenseUnitSchema (for the ExpenseLine JSON Schema artifact and expenseLineArb)
  - phase: 01-schemas-freeze-and-walking-skeleton (plan 01-06)
    provides: CapSchema (discriminated union, for AssessmentLine.appliedCap and the RulePack fixture), RulePackSchema
provides:
  - "AssessmentSchema/Assessment, AssessmentLineSchema/AssessmentLine, TotalsSchema/Totals, SignOffSchema/SignOff — PRD §6.4 and §8.1 step 6, frozen"
  - "GuardInput — SCHEMA-06's literal type structurally excluding advisory deadline fields (AC-15b)"
  - "toJsonSchemaArtifacts() and three committed JSON Schema artifacts under packages/schemas/schema/ — SCHEMA-05, the Phase 8 LLM boundary's contract"
  - "expenseLineArb, minimalRulePackArb, assessmentArb (packages/schemas/src/__fixtures__/arbitraries.ts) — reused by Phase 2's engine property tests"
  - "packages/schemas/FREEZE.md — the D-09 additive-only policy and D-10 escalation path for every later phase"
affects: [02-engine, 03-rulepacks-loader-and-content, 04-guarded-transitions, 08-llm-boundary]

actuals:
  tokens: 16500
  tasks: 3
  commits: 5
plan_head_before: 251dcab6

tech-stack:
  added: []
  patterns:
    - "z.toJSONSchema() (zod 4 native) generates committed JSON Schema artifacts, never the unmaintained zod-to-json-schema package; a drift test compares regenerated output byte-for-byte against the committed file, so a frozen type change shows up as a reviewable diff in the artifact rather than only at test time."
    - "GuardInput is a hand-authored literal object type, never Omit<>/Pick<>-derived, so the AC-15b compile-time exclusion of advisory-deadline fields stays structural even if Matter widens later. Proven, not assumed, via a @ts-expect-error fixture plus tsc --noEmit as the actual gate (guard-input.test.ts's runtime assertions are secondary — the type-level check is what matters)."
    - "fast-check arbitraries are typed as z.input<typeof XSchema> (the pre-brand plain-number shape), generated as plain JS objects, then passed through the schema's own .parse() to get the branded, validated output — the arbitrary never fabricates a branded value directly."
    - "AssessmentLine's flagReasons/FLAG invariant, like Matter's currency check and ExpenseLine's claimedAmount check before it, is enforced via .superRefine() (both directions asserted), continuing this phase's established convention over .transform()."

key-files:
  created:
    - packages/schemas/src/assessment.ts
    - packages/schemas/src/assessment.test.ts
    - packages/schemas/src/assessment.property.test.ts
    - packages/schemas/src/__fixtures__/arbitraries.ts
    - packages/schemas/src/guard-input.ts
    - packages/schemas/src/guard-input.test.ts
    - packages/schemas/src/json-schema.ts
    - packages/schemas/src/json-schema.test.ts
    - packages/schemas/scripts/generate-json-schema.ts
    - packages/schemas/schema/assessment.schema.json
    - packages/schemas/schema/assessment-line.schema.json
    - packages/schemas/schema/expense-line.schema.json
    - packages/schemas/FREEZE.md
  modified:
    - package.json
    - packages/schemas/package.json
    - packages/schemas/tsconfig.json
    - pnpm-lock.yaml

key-decisions:
  - "SignOffSchema.attestationVersion is a deliberate addition beyond PRD §6.4's literal SignOff fields, added per this plan's own <action> instruction so §9.5's attestation wording can be recorded verbatim by version even after the copy changes later. Recorded plainly as an addition, not described as a transcription — same pattern 01-06 used for FlatFeeSchema."
  - "AssessmentLineSchema.engineAmount is NOT constrained to 0 for DISALLOW/FLAG verdicts at the schema level, despite PRD §6.4's comment to that effect — that is an assess()-time invariant for Phase 2's engine to produce, not a structural constraint this freeze enforces. Only the flagReasons/FLAG cross-field invariant (explicitly named in this plan's must_haves) is enforced here."
  - "packages/schemas/tsconfig.json needed an explicit `types: [\"node\"]` compilerOption (see Deviations) — without it, tsc's automatic @types inclusion did not surface @types/node's ambient node:fs/node:path/node:url module declarations for this project, even with the package symlinked."
  - "@types/node and fast-check added as packages/schemas' own devDependencies rather than left to resolve only via directory walk-up from the workspace root — the package now directly imports both (json-schema.test.ts's node: builtins; arbitraries.ts's fast-check), so declaring them explicitly matches what the package actually uses."
  - "The fast-check property harness (assessment.property.test.ts) runs over hand-constructed Assessment values via assessmentArb, independently of ExpenseLine/RulePack — Totals fields are generated as independent random integers, not derived from the generated lines, because assess() does not exist yet in this phase. A module note in the test file records that Phase 2 re-points the harness at real assess() output without changing the invariant or the arbitraries."
  - "Recorded fast-check seed: 20260915 (assessment.property.test.ts's RECORDED_SEED) — re-running the 10,000-run property test with this seed reproduces any future counterexample exactly."

requirements-completed: [SCHEMA-01, SCHEMA-05, SCHEMA-06, SCHEMA-07]

coverage:
  - id: D1
    description: "Assessment, AssessmentLine, Totals and SignOff frozen field-for-field with PRD §6.4/§8.1 step 6; Totals.finalAmount is nullable with no default and never populated from draftBaseline (AC-25); AssessmentLine's flagReasons is non-empty exactly when verdict is FLAG, enforced both directions by superRefine"
    requirement: "SCHEMA-01"
    verification:
      - kind: unit
        ref: "packages/schemas/src/assessment.test.ts (15 cases)"
        status: pass
      - kind: unit
        ref: "pnpm tsc --noEmit -p packages/schemas"
        status: pass
    human_judgment: false
  - id: D2
    description: "GuardInput is a hand-authored literal type (11 members, no Omit</Pick<), structurally excluding every matter-level advisory deadline field; a guard function reaching for one fails to compile, proven by a @ts-expect-error fixture that tsc --noEmit confirms is a real error"
    requirement: "SCHEMA-06"
    verification:
      - kind: unit
        ref: "packages/schemas/src/guard-input.test.ts (2 runtime cases + 1 compile-time @ts-expect-error fixture)"
        status: pass
      - kind: unit
        ref: "pnpm tsc --noEmit -p packages/schemas"
        status: pass
    human_judgment: false
  - id: D3
    description: "z.toJSONSchema() (zod 4 native) generates JSON Schema for AssessmentSchema, AssessmentLineSchema and ExpenseLineSchema without throwing, including the branded Minor fields and the discriminated Cap union nested in appliedCap; every money-suffixed numeric property types as integer, never number; the three artifacts are committed under packages/schemas/schema/ and a drift test proves regenerated output is byte-identical"
    requirement: "SCHEMA-05"
    verification:
      - kind: unit
        ref: "packages/schemas/src/json-schema.test.ts (5 cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A 10,000-run fast-check property test (recorded seed 20260915) holds Number.isInteger() over every money field of a parsed Assessment, plus explicit zero-line (all Totals fields 0, finalAmount null) and claimed-amount-equals-cap-amount edge cases; expenseLineArb/minimalRulePackArb/assessmentArb are exported for Phase 2 to reuse"
    requirement: "SCHEMA-07"
    verification:
      - kind: unit
        ref: "packages/schemas/src/assessment.property.test.ts (3 cases, including the 10,000-run property)"
        status: pass
    human_judgment: false
  - id: D5
    description: "packages/schemas/FREEZE.md names all 12 frozen modules, states the D-09 additive-only rule and why it exists (four concurrent Phase 2-5 workstreams sharing one packages/schemas and one prisma/schema.prisma), the D-10 escalation escape valve to PROJECT.md's Key Decisions table, and the D-03 note that Assessment/AssessmentLine were committed to before assess() ran"
    verification:
      - kind: other
        ref: "grep -c for all 12 module names in packages/schemas/FREEZE.md (all 12 present)"
        status: pass
    human_judgment: true
    rationale: "Whether FREEZE.md is legible and sufficient for a Phase 2-5 implementer who has not read this plan is a judgment about writing quality, not a fact a test can assert. The schema-level facts (all 12 names present, additive-only rule and escalation path stated) are fully covered by the automated check above."

duration: 25min
completed: 2026-09-15
status: complete
---

# Phase 1 Plan 7: Assessment/AssessmentLine/GuardInput Frozen, JSON Schema Committed, Freeze Policy Written Summary

**`Assessment`/`AssessmentLine`/`Totals`/`SignOff` frozen from PRD §6.4/§8.1, a literal `GuardInput` type that makes reaching for a matter advisory deadline a compile error, three committed `z.toJSONSchema()` artifacts pinning money as `integer` for the Phase 8 LLM boundary, a 10,000-run (seed `20260915`) fast-check money-integer property harness, and `packages/schemas/FREEZE.md` recording the D-09 additive-only rule.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-15T07:05:00+08:00 (approx.)
- **Completed:** 2026-09-15T07:14:10+08:00
- **Tasks:** 3
- **Files modified:** 13 created, 4 modified

## Accomplishments

- `Assessment`/`AssessmentLine`/`Totals`/`SignOff` (`packages/schemas/src/assessment.ts`) transcribed field-for-field from PRD §6.4 and §8.1 step 6. `Totals.finalAmount` is nullable with no `.default(...)` and is never populated from `draftBaseline` — structurally unrepresentable as a number before sign-off (AC-25). `AssessmentLine`'s `flagReasons`/`verdict === 'FLAG'` invariant is enforced both directions via `.superRefine()`. `lawyerReason`'s cap is read from `FREE_TEXT_LIMITS.lawyerReason`, never a hardcoded `1000`. `SignOffSchema` adds `attestationVersion` (new, not a §6.4 field) so §9.5's attestation wording can be recorded verbatim by version.
- `packages/schemas/src/__fixtures__/arbitraries.ts` exports `expenseLineArb`, `minimalRulePackArb` and `assessmentArb` — fast-check arbitraries typed as each schema's `z.input<...>`, generated as plain JS objects and validated through the schema's own `.parse()`. Exported deliberately for Phase 2's engine property tests to reuse.
- `packages/schemas/src/assessment.property.test.ts` runs a 10,000-case `fc.assert` (recorded `seed: 20260915`) asserting `Number.isInteger()` over every money field of a parsed `Assessment`, plus two explicit deterministic edge cases: a zero-line assessment (every `Totals` field `0`, `finalAmount` `null`) and a line whose claimed amount exactly equals its applied cap amount.
- `GuardInput` (`packages/schemas/src/guard-input.ts`) — a hand-authored literal object type, 11 members, no `Omit<>`/`Pick<>` derivation. `reviewDueOn` is the **pack's** lifecycle date and is deliberately present; no field names the matter's advisory fee-notification deadline at all. `guard-input.test.ts` proves the exclusion is a real compile error via a `@ts-expect-error` fixture that `tsc --noEmit` confirms.
- `packages/schemas/src/json-schema.ts` exports `toJsonSchemaArtifacts()`, calling zod 4's native `z.toJSONSchema()` over `AssessmentSchema`, `AssessmentLineSchema` and `ExpenseLineSchema` — never the unmaintained `zod-to-json-schema` package. `packages/schemas/scripts/generate-json-schema.ts` (run via the new root `schema:json` script) writes the three artifacts to `packages/schemas/schema/*.schema.json`, **committed to the repository**. `json-schema.test.ts` proves generation doesn't throw (including over the branded `Minor` fields and the discriminated `Cap` union nested in `appliedCap`), every money-suffixed numeric property types as `integer` never `number`, and regenerated output is byte-identical to the committed artifact.
- `packages/schemas/FREEZE.md` names all 12 frozen modules, states the D-09 additive-only rule and why (four concurrent Phase 2–5 workstreams sharing one `packages/schemas` and one `prisma/schema.prisma`), the D-10 escalation escape valve to `PROJECT.md`'s Key Decisions table, and the D-03 note tying `Assessment`/`AssessmentLine`'s pre-`assess()` freeze to PRD §14's reference fixture.
- 167/167 tests pass across the full repo (up from 145 before this plan); `tsc --noEmit`, `eslint`, and `dependency-cruiser` all clean over `packages/engine` + `packages/schemas` (34 modules, 68 dependencies, no violations).

## Task Commits

1. **Task 1: Freeze Assessment/AssessmentLine/Totals/SignOff, and the 10,000-run property test**
   - `6dd019e` (test) — RED: `assessment.test.ts` and `assessment.property.test.ts` both fail to resolve `./assessment.ts`
   - `d81c28b` (feat) — GREEN: 15/15 new tests pass
2. **Task 2: Author GuardInput as a literal type**
   - `39796c3` (test) — RED: `guard-input.test.ts` fails `tsc --noEmit` with TS2307 (vitest itself passes trivially — the import is type-only and elided at runtime, so `tsc` is the real gate, per the plan's own note)
   - `6bf29b9` (feat) — GREEN: `tsc --noEmit` clean; 2/2 runtime tests pass
3. **Task 3: Generate and commit JSON Schema artifacts, and write the freeze policy**
   - `644af1e` (feat) — implementation + committed artifacts + FREEZE.md; 5/5 new tests pass (not a TDD task — no separate RED commit)

_No REFACTOR commits — each GREEN implementation was already minimal; no obvious cleanup existed._

**Plan metadata:** committed together with this SUMMARY (see below).

## Files Created/Modified

- `packages/schemas/src/assessment.ts` - `VerdictSchema`, `DispositionSchema`, `AssessmentLineSchema`, `TotalsSchema`, `SignOffSchema`, `AssessmentSchema`
- `packages/schemas/src/assessment.test.ts` - 15 cases falsifying the above
- `packages/schemas/src/assessment.property.test.ts` - 10,000-run property (seed 20260915) + 2 edge cases
- `packages/schemas/src/__fixtures__/arbitraries.ts` - `expenseLineArb`, `minimalRulePackArb`, `assessmentArb`
- `packages/schemas/src/guard-input.ts` - `GuardInput` literal type
- `packages/schemas/src/guard-input.test.ts` - runtime assertions + `@ts-expect-error` compile-time fixture
- `packages/schemas/src/json-schema.ts` - `toJsonSchemaArtifacts()`
- `packages/schemas/src/json-schema.test.ts` - generation, integer-typing, and byte-identical drift assertions
- `packages/schemas/scripts/generate-json-schema.ts` - `schema:json` entry point
- `packages/schemas/schema/assessment.schema.json`, `assessment-line.schema.json`, `expense-line.schema.json` - committed JSON Schema artifacts
- `packages/schemas/FREEZE.md` - the D-09/D-10 additive-only policy
- `package.json` - added `schema:json` script
- `packages/schemas/package.json` - added `@types/node`, `fast-check` devDependencies
- `packages/schemas/tsconfig.json` - added `types: ["node"]` (see Deviations)
- `pnpm-lock.yaml` - updated for the two new devDependencies

## Decisions Made

- `SignOffSchema.attestationVersion` added beyond PRD §6.4's literal fields, per this plan's own `<action>` instruction — recorded plainly as an addition, matching 01-06's precedent for `FlatFeeSchema`.
- `AssessmentLineSchema.engineAmount` is not schema-constrained to `0` for `DISALLOW`/`FLAG` (PRD §6.4's comment, not an invariant) — that's `assess()`'s job in Phase 2, not this freeze's.
- fast-check arbitraries are typed as `z.input<typeof XSchema>` and cast at each export boundary, then validated through the schema's own `.parse()` — never fabricated as pre-branded values directly.
- The property harness generates `Totals` independently of `lines` (no `assess()` exists yet); a module note in `assessment.property.test.ts` records that Phase 2 re-points it at real engine output without changing the invariant.
- Recorded fast-check seed: **20260915** — reproduces any future counterexample exactly via `assessment.property.test.ts`'s `RECORDED_SEED`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `types: ["node"]` to `packages/schemas/tsconfig.json`, and `@types/node`/`fast-check` as `packages/schemas` devDependencies**
- **Found during:** Task 3, first `pnpm tsc --noEmit -p packages/schemas` run after adding `json-schema.test.ts`
- **Issue:** `json-schema.test.ts`'s `node:fs`/`node:path`/`node:url` imports failed with `TS2591: Cannot find name 'node:fs'` — TypeScript's automatic `@types` inclusion was not surfacing `@types/node`'s ambient `node:fs`/`node:path`/`node:url` module declarations for this project, even after `@types/node` was symlinked into `packages/schemas/node_modules/@types`.
- **Fix:** Added `"types": ["node"]` to `packages/schemas/tsconfig.json`'s `compilerOptions`, which resolved the issue immediately. Also added `@types/node` (`26.5.1`, matching the root's pinned version) and `fast-check` (`4.10.0`) as explicit `packages/schemas` devDependencies — both were previously resolved only via directory walk-up from the workspace root (fast-check was already imported by `arbitraries.ts`/`assessment.property.test.ts` in Task 1 and compiled fine via walk-up; making the dependency explicit matches what the package actually uses and removes the implicit reliance).
- **Files modified:** `packages/schemas/tsconfig.json`, `packages/schemas/package.json`, `pnpm-lock.yaml`
- **Verification:** `pnpm tsc --noEmit -p packages/schemas` clean; full suite 167/167 pass.
- **Committed in:** `644af1e` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for the plan's own `tsc --noEmit -p packages/schemas` acceptance criterion to be satisfiable at all, given `json-schema.test.ts`'s `node:` builtin imports. No scope creep — only the three files already touched by Task 3 plus the pre-existing `packages/schemas/package.json`/`tsconfig.json` were changed.

## TDD Gate Compliance

Tasks 1 and 2 (`tdd="true"`) followed the full RED → GREEN cycle; Task 3 is a plain `type="auto"` task with no TDD requirement.

- **Task 1 RED:** `6dd019e` — `pnpm vitest run --project schemas assessment.test.ts assessment.property.test.ts` failed to resolve `./assessment.ts` (module did not exist). **GREEN:** `d81c28b` — 15/15 pass.
- **Task 2 RED:** `39796c3` — `pnpm tsc --noEmit -p packages/schemas` failed with `TS2307` (`./guard-input.ts` does not exist). Vitest itself trivially "passed" 2/2 because the import in `guard-input.test.ts` is `import type` and is elided at runtime by esbuild — the plan's own note states `tsc` is the gate that matters for this task, confirmed directly. **GREEN:** `6bf29b9` — `tsc --noEmit` clean (the `@ts-expect-error` fixture is now satisfied by a real error); 2/2 runtime tests pass.
- **REFACTOR:** None for either task — each GREEN implementation was already minimal.

`workflow.tdd_mode` is not enabled in this project's `config.json` (consistent with every prior plan's note on the same topic), so the strict `gsd_run check tdd-red-evidence` gate is not mandatory here; RED validity was confirmed by direct inspection of each failure (module-not-found for Task 1's vitest run, TS2307 for Task 2's tsc run) above.

## Known Stubs

None.

## Threat Flags

None beyond what this plan's own `<threat_model>` already named and mitigated (see coverage D1–D5 above) — no new, unaccounted-for security surface was introduced.

## Issues Encountered

None beyond the one documented deviation above, resolved during execution.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `Assessment`, `AssessmentLine`, `Totals`, `SignOff` and `GuardInput` are frozen and compile. Phase 2's `assess()` can be built directly against `Assessment`'s shape and PRD §14's reference fixture; Phase 4's guarded transition executor can build guard functions directly against `GuardInput`.
- The committed JSON Schema artifacts under `packages/schemas/schema/` are what Phase 8's LLM boundary is constrained by from day one — regenerating them (`pnpm schema:json`) after any frozen-type change is what the drift test in `json-schema.test.ts` will catch if forgotten.
- `packages/schemas/FREEZE.md` is the document every later phase should read instead of the six Phase 1 plans that produced these modules — it is what makes D-09's additive-only rule legible without re-reading this plan.
- `expenseLineArb`, `minimalRulePackArb` and `assessmentArb` (`packages/schemas/src/__fixtures__/arbitraries.ts`) are ready for Phase 2's engine property tests to import directly, rather than authoring a second set.
- **This SUMMARY closes out `SCHEMA-01`** — the shared requirement ID declared by plans 01-02, 01-05, 01-06 and this plan. All four sibling plans now have a `*-SUMMARY.md`, so the shared-ID gate (#2388) can mark it `Complete` in `REQUIREMENTS.md`.
- This is the last plan in Phase 1 (wave 5, `depends_on: ["01-06"]`, no further plans in this phase directory). Phase 1 is complete; ready for `/gsd-plan-phase 2` and `/gsd-verify-work 1`.
- No blockers for Phase 2 or Phase 3.

## Self-Check: PASSED

- All 13 created files found on disk: `packages/schemas/src/assessment.ts`, `assessment.test.ts`, `assessment.property.test.ts`, `__fixtures__/arbitraries.ts`, `guard-input.ts`, `guard-input.test.ts`, `json-schema.ts`, `json-schema.test.ts`, `scripts/generate-json-schema.ts`, `schema/assessment.schema.json`, `schema/assessment-line.schema.json`, `schema/expense-line.schema.json`, `FREEZE.md`
- All 5 task commits found in git log: `6dd019e`, `d81c28b`, `39796c3`, `6bf29b9`, `644af1e`
- Re-ran plan-level `<verification>`: `pnpm vitest run --project schemas` (145/145 pass), `pnpm tsc --noEmit -p packages/schemas` (clean), `pnpm eslint packages/engine packages/schemas` (clean), `packages/schemas/schema/` holds exactly 3 committed artifacts and the drift test passes, `packages/schemas/FREEZE.md` exists and names all 12 frozen modules
- Re-ran full suite: `pnpm vitest run` passes 167/167 (up from 145 before this plan) with no regressions
- Re-ran all acceptance criteria from all three tasks: `VerdictSchema`/`DispositionSchema` cardinality (4/5), `TotalsSchema` exactly 6 fields, no `.default(` in `assessment.ts`, literal `1000` absent from `assessment.ts`, `flagReasons`/`FLAG` refinement rejects both directions, `GuardInput` has exactly 11 members with no `Omit<`/`Pick<`, `guard-input.ts` exports no zod schema, `json-schema.ts` imports nothing from `zod-to-json-schema`, exactly 3 committed `.schema.json` files, `FREEZE.md` names all 12 modules and states the additive-only rule + escalation path, root `package.json` declares `schema:json` — all PASS
- `pnpm exec depcruise --config .dependency-cruiser.cjs packages/engine packages/schemas`: no violations, 34 modules cruised, 68 dependencies

---
*Phase: 01-schemas-freeze-and-walking-skeleton*
*Completed: 2026-09-15*
