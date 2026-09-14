---
phase: 01-schemas-freeze-and-walking-skeleton
plan: 05
subsystem: schemas
tags: [zod, typescript, personal-data-boundary, audit, money]

requires:
  - phase: 01-schemas-freeze-and-walking-skeleton (plan 01-02)
    provides: MinorSchema/toMinor, JURISDICTION_CURRENCY, MatterStatusSchema, ExpenseCategoryCodeSchema, PERSONAL_DATA_DENY_LIST, FREE_TEXT_LIMITS, AuditEventTypeSchema, UserRefSchema, RoleSchema, JsonSchema, InstrumentSchema
provides:
  - "MatterSchema/Matter — PRD §6.1, with the jurisdiction/currency superRefine (AC-42 schema layer)"
  - "ExpenseLineSchema/ExpenseLine/ExpenseUnitSchema — PRD §6.2, with the claimedAmount = quantity × unitRate superRefine (AC-08 schema layer)"
  - "AuditEventSchema/AuditEvent/AUDIT_PAYLOAD_KEYS/AuditPayloadSchema — PRD §6.5, with a strict, closed payload key set (§12.1)"
affects: [01-06, 01-07, 02-engine, 03.2-database-boundary-and-audit-immutability, 04-guarded-transitions]

actuals:
  tokens: 5367
  tasks: 3
  commits: 8
plan_head_before: 8224f9209ee5a80107eefc07d1a0e1f8e9c7a681

tech-stack:
  added: []
  patterns:
    - "z.strictObject() (zod 4) for AuditPayloadSchema — rejects an undeclared key by name rather than silently stripping it, the mechanism the §12.1 closed-payload-set requirement needs"
    - "superRefine over transform for load-time invariants: both MatterSchema (currency) and ExpenseLineSchema (claimedAmount) enforce a derived-value check with .superRefine() and an explicit issue path, never .transform() — consistent with 01-RESEARCH.md Pattern 1 and the same choice CONTEXT.md's Claude's Discretion recorded for claimedAmount specifically"

key-files:
  created:
    - packages/schemas/src/matter.ts
    - packages/schemas/src/matter.test.ts
    - packages/schemas/src/expense-line.ts
    - packages/schemas/src/expense-line.test.ts
    - packages/schemas/src/audit-event.ts
    - packages/schemas/src/audit-event.test.ts
  modified: []

key-decisions:
  - "claimedAmount validated by .superRefine() rather than .transform() (CONTEXT.md Claude's Discretion, reconfirmed): AC-08 requires a *stored* value checked against quantity × unitRate on load, which is a load-time invariant, not a schema-level derivation, and it sidesteps zod 4's changed transform/default type inference."
  - "AUDIT_PAYLOAD_KEYS = ['entityId', 'field', 'before', 'after', 'elapsedReviewMs'] (readonly tuple, this exact order) — the entity id the change applies to, the changed field name, the before/after pair, and the elapsedReviewMs §6.5 requires on LINE_DISPOSITIONED and SIGNED_OFF. AuditPayloadSchema is z.strictObject() derived from this tuple with every member optional; before/after are typed as the recursive JsonSchema from primitives.ts. Phase 4's AUDIT-01 and BOUND-05 build directly on this closed set and this exact key list."
  - "PRD §6.1 Matter actually has 16 fields, not the 15 the plan's own acceptance criteria state (miscount in the plan text, verified by direct transcription against docs/PRD-dsar-fee-agent.md lines 203-222). Implemented all 16 per the PRD — the source of truth per CLAUDE.md — rather than omitting one to match the plan's stated count."

requirements-completed: [SCHEMA-01, SCHEMA-04]

coverage:
  - id: D1
    description: "MatterSchema transcribes PRD §6.1's 16 fields and enforces the jurisdiction/currency invariant at parse time, issue naming both codes, path ['currency']"
    requirement: "SCHEMA-04"
    verification:
      - kind: unit
        ref: "packages/schemas/src/matter.test.ts (17 cases)"
        status: pass
      - kind: unit
        ref: "pnpm tsc --noEmit -p packages/schemas"
        status: pass
    human_judgment: false
  - id: D2
    description: "ExpenseLineSchema transcribes PRD §6.2's 14 fields; claimedAmount is validated against quantity × unitRate via superRefine (not a transform), quantity must be a positive integer, and both free-text caps (description/hrNote) are read from FREE_TEXT_LIMITS"
    requirement: "SCHEMA-01"
    verification:
      - kind: unit
        ref: "packages/schemas/src/expense-line.test.ts (21 cases, including the zero-product boundary and the reverse SCHEMA-01 adjacency edge)"
        status: pass
    human_judgment: false
  - id: D3
    description: "AuditEventSchema transcribes PRD §6.5's 9 fields; payload is a z.strictObject() over the closed AUDIT_PAYLOAD_KEYS set, rejecting any undeclared key by name (§12.1) — including a simulated whole-request-body payload"
    requirement: "SCHEMA-01"
    verification:
      - kind: unit
        ref: "packages/schemas/src/audit-event.test.ts (12 cases, including the declared-key-order pin and the Instrument.provisions ordering edge)"
        status: pass
    human_judgment: false
  - id: D4
    description: "SCHEMA-01 adjacency and ordering edges named in this plan's must_haves: Matter/ExpenseLine remain distinct types in both directions despite a shared id field, and array-valued fields (Instrument.provisions, AUDIT_PAYLOAD_KEYS) preserve input order through parse"
    requirement: "SCHEMA-01"
    verification:
      - kind: unit
        ref: "packages/schemas/src/expense-line.test.ts#SCHEMA-01 adjacency edge (reverse direction)"
        status: pass
      - kind: unit
        ref: "packages/schemas/src/audit-event.test.ts#SCHEMA-01 ordering edge"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-15
status: complete
---

# Phase 1 Plan 5: Matter, ExpenseLine and AuditEvent Frozen with Their Cross-Field Invariants Summary

**PRD §6.1/§6.2/§6.5 transcribed into zod as `Matter`, `ExpenseLine` and `AuditEvent`, each carrying the one cross-field invariant derivable at freeze time — jurisdiction/currency agreement, `claimedAmount` against `quantity × unitRate`, and a `z.strictObject()`-enforced closed audit payload key set — all validated by superRefine rather than a transform.**

## Performance

- **Duration:** 25 min (approx.)
- **Started:** 2026-09-15T06:24:00Z (approx.)
- **Completed:** 2026-09-15T06:33:00Z
- **Tasks:** 3
- **Files modified:** 6 created

## Accomplishments

- `Matter` (`packages/schemas/src/matter.ts`) transcribed field-for-field from PRD §6.1 (16 fields), with a `.superRefine()` enforcing `currency === JURISDICTION_CURRENCY[jurisdictionCode]` — AC-42's schema layer, issue naming both the selected and expected currency, path `['currency']`. `identityVerifiedNote` capped via `FREE_TEXT_LIMITS.identityVerifiedNote`; `status` defaults to `DRAFT`.
- `ExpenseLine` (`packages/schemas/src/expense-line.ts`) transcribed field-for-field from PRD §6.2 (14 fields), with `ExpenseUnitSchema` over exactly `HOUR`/`PAGE`/`ITEM`/`GIGABYTE`/`FIXED`. `claimedAmount` is an ordinary required `Minor` field validated against `quantity × unitRate` via `.superRefine()` — never a `.transform()` — so a stored mismatch surfaces as a validation issue (AC-08) rather than being silently recomputed. `description`/`hrNote` caps read from `FREE_TEXT_LIMITS`.
- `AuditEvent` (`packages/schemas/src/audit-event.ts`) transcribed field-for-field from PRD §6.5 (9 fields). `AUDIT_PAYLOAD_KEYS` is a `readonly` tuple (`entityId`, `field`, `before`, `after`, `elapsedReviewMs`) and `AuditPayloadSchema` — a `z.strictObject()` with every member optional — is derived from it. An undeclared payload key, or a simulated whole request body, fails validation and names the offending key (§12.1).
- Two plan-level `must_haves` truths that spanned beyond any single task's declared behaviour list — the reverse-direction SCHEMA-01 adjacency edge (Matter-shaped object fails `ExpenseLineSchema`) and the SCHEMA-01 array-ordering edge (`Instrument.provisions` preserves input order through parse) — were added as their own tests once the relevant modules existed, closing the gap between the plan's task-level behaviours and its full must_haves list.
- 85/85 tests pass in the `schemas` Vitest project (up from 51 before this plan); 107/107 across the full repo. `tsc --noEmit`, `eslint`, and `dependency-cruiser` all clean over `packages/engine` + `packages/schemas`.

## Task Commits

Each task followed the full RED → GREEN TDD cycle:

1. **Task 1: Transcribe PRD §6.1 Matter, with the jurisdiction/currency refinement**
   - `73dae98` (test) — RED: `matter.test.ts` fails to resolve `./matter.ts`
   - `d209bd5` (feat) — GREEN: 17/17 pass
2. **Task 2: Transcribe PRD §6.2 ExpenseLine, with the claimedAmount invariant and the free-text caps**
   - `605f54e` (test) — RED: `expense-line.test.ts` fails to resolve `./expense-line.ts`
   - `b05dc39` (feat) — GREEN: 20/20 pass
3. **Task 3: Transcribe PRD §6.5 AuditEvent with a closed declared payload key set**
   - `64acd5f` (test) — RED: `audit-event.test.ts` fails to resolve `./audit-event.ts`
   - `2d4b8d0` (feat) — GREEN: 11/11 pass (after fixing a test-fixture bug found during GREEN — see Deviations)
4. **Rule 2 additions closing must_haves gaps not covered by any single task's behaviour list:**
   - `5250eec` (test) — reverse-direction SCHEMA-01 adjacency test
   - `4d6f9fa` (test) — SCHEMA-01 array-ordering test for `Instrument.provisions`

_No REFACTOR commits — each GREEN implementation was already minimal; no obvious cleanup existed._

**Plan metadata:** committed together with this SUMMARY (see below).

## Files Created/Modified

- `packages/schemas/src/matter.ts` - `MatterSchema`/`Matter`, `RequestorClassSchema`, jurisdiction/currency refinement
- `packages/schemas/src/matter.test.ts` - 17 cases falsifying `MatterSchema`
- `packages/schemas/src/expense-line.ts` - `ExpenseLineSchema`/`ExpenseLine`, `ExpenseUnitSchema`, claimedAmount refinement
- `packages/schemas/src/expense-line.test.ts` - 21 cases falsifying `ExpenseLineSchema` (20 original + 1 reverse-adjacency)
- `packages/schemas/src/audit-event.ts` - `AuditEventSchema`/`AuditEvent`, `AUDIT_PAYLOAD_KEYS`, `AuditPayloadSchema`
- `packages/schemas/src/audit-event.test.ts` - 12 cases falsifying `AuditEventSchema` (11 original + 1 ordering-edge)

## Decisions Made

- **`claimedAmount` validated via `.superRefine()`, not `.transform()`** (CONTEXT.md Claude's Discretion, reconfirmed at implementation time per 01-RESEARCH.md Pattern 1): AC-08 requires the *stored* value to be checked against `quantity × unitRate` on load — a load-time invariant, not a schema-level derivation — and this sidesteps zod 4's changed `.transform()`/default type inference entirely.
- **`AUDIT_PAYLOAD_KEYS` fixed as `['entityId', 'field', 'before', 'after', 'elapsedReviewMs']`**, this exact order, with `AuditPayloadSchema` derived from it via `z.strictObject()`. This is the closed set Phase 4's AUDIT-01 and BOUND-05 build directly on top of — widening it later is a visible, reviewed change to one exported constant, not a silent schema drift.
- **`before`/`after` in the payload are typed as the recursive `JsonSchema`** from `primitives.ts` (not `z.unknown()`), keeping them consistent with PRD §6.5's `payload: Json` while still living inside the closed-key `AuditPayloadSchema` wrapper.
- **PRD §6.1 `Matter` has 16 fields, not the 15 stated in this plan's own acceptance criteria.** Verified by direct line-by-line transcription against `docs/PRD-dsar-fee-agent.md` lines 203–222. Implemented all 16 — the PRD is the source of truth per `CLAUDE.md`, and CONTEXT.md's freeze principle is "transcription, not design," so a plan-authored miscount is not grounds for omitting a PRD-named field.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Self-authored test fixture in `audit-event.test.ts` used a mistyped value across all payload keys**
- **Found during:** Task 3 GREEN phase — `pnpm vitest run --project schemas audit-event.test.ts` failed one case ("parses a payload containing only declared keys") that my own RED-phase test had authored
- **Issue:** The original fixture built the payload via `Object.fromEntries(AUDIT_PAYLOAD_KEYS.map(k => [k, "x"]))`, applying the string `"x"` to every declared key — including `elapsedReviewMs`, which `AuditPayloadSchema` correctly requires to be a non-negative integer. The test was asserting the schema's own correct rejection as a failure.
- **Fix:** Replaced the fixture with a well-typed value per key (`entityId`/`field` as strings, `before`/`after` as numbers, `elapsedReviewMs` as a non-negative integer), plus a sanity assertion that every fixture key is itself one of `AUDIT_PAYLOAD_KEYS`.
- **Files modified:** `packages/schemas/src/audit-event.test.ts`
- **Verification:** All 11 (now 12) `audit-event.test.ts` cases pass; no change to `audit-event.ts` was needed — the schema was correct, the test fixture was not.
- **Committed in:** `2d4b8d0` (Task 3 GREEN commit, fixed before commit — no separate broken-fixture commit exists)

**2. [Rule 2 - Missing Critical] Added the reverse-direction SCHEMA-01 adjacency test and the array-ordering test named in this plan's must_haves but not assigned to any single task's `<behavior>` list**
- **Found during:** Post-Task-3 review of the plan's `must_haves.truths` against what the three tasks' behaviour lists actually required
- **Issue:** Task 1's behaviour list required only "an ExpenseLine-shaped object fails `MatterSchema`," and no task explicitly required the reverse ("a Matter-shaped object fails `ExpenseLineSchema`") or the array-ordering truth for `Instrument.provisions` and the audit payload's declared keys — both stated as required truths in the plan's frontmatter `must_haves` block.
- **Fix:** Added both tests once the relevant modules existed: the reverse adjacency test in `expense-line.test.ts` (confirms the fixture parses as a valid `Matter` first, so the `ExpenseLineSchema` failure isn't explained by a malformed fixture), and the `Instrument.provisions` ordering test in `audit-event.test.ts` using a deliberately non-sorted fixture.
- **Files modified:** `packages/schemas/src/expense-line.test.ts`, `packages/schemas/src/audit-event.test.ts`
- **Verification:** 85/85 `schemas` tests pass; `tsc --noEmit` clean.
- **Committed in:** `5250eec`, `4d6f9fa`

---

**Total deviations:** 2 auto-fixed (1 Rule 1 - bug in a self-authored test fixture, 1 Rule 2 - missing coverage for must_haves truths not assigned to any single task)
**Impact on plan:** Both were necessary for the plan's own must_haves and acceptance criteria to be fully satisfied. No scope creep — only the six files already in this plan's `files_modified` list were touched.

## TDD Gate Compliance

All three tasks (`tdd="true"`) followed the full RED → GREEN cycle:

- **Task 1 RED:** `73dae98` — `pnpm vitest run --project schemas matter.test.ts` failed to resolve `./matter.ts` (module did not exist). **GREEN:** `d209bd5` — 17/17 pass.
- **Task 2 RED:** `605f54e` — `pnpm vitest run --project schemas expense-line.test.ts` failed to resolve `./expense-line.ts`. **GREEN:** `b05dc39` — 20/20 pass.
- **Task 3 RED:** `64acd5f` — `pnpm vitest run --project schemas audit-event.test.ts` failed to resolve `./audit-event.ts`. **GREEN:** `2d4b8d0` — 11/11 pass (after the test-fixture fix documented above).
- **REFACTOR:** None for any task — each GREEN implementation was already minimal.

`workflow.tdd_mode` is not enabled in this project's `config.json` (consistent with plans 01-01/01-02's notes on the same topic), so the strict `gsd_run check tdd-red-evidence` gate is not mandatory here; RED validity was confirmed by direct inspection of each vitest failure output (module-not-found, not merely an assertion failure) above.

## Known Stubs

None.

## Issues Encountered

None beyond the two documented deviations above, both resolved during execution.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `Matter`, `ExpenseLine` and `AuditEvent` are frozen and compile; plans 01-06 (RulePack, `MatterFlagRule`, `Condition`) and 01-07 can build directly on top of them, and `Condition.field`'s literal-union enumeration (01-RESEARCH.md Pattern 2) now has both entity types available to check `satisfies readonly (keyof ExpenseLine | keyof Matter)[]` against.
- `AUDIT_PAYLOAD_KEYS` — `['entityId', 'field', 'before', 'after', 'elapsedReviewMs']` — is the exact closed set Phase 4's AUDIT-01 and BOUND-05 build on; this list is recorded here per this plan's `<output>` instruction.
- Phase 3.2 can mirror the currency check constraint (AC-42's second layer) and the `SIGNED_OFF` immutability trigger against these frozen shapes without reopening this plan's files.
- No blockers for plan 01-06.

## Self-Check: PASSED

- All 6 created files found on disk: `packages/schemas/src/matter.ts`, `packages/schemas/src/matter.test.ts`, `packages/schemas/src/expense-line.ts`, `packages/schemas/src/expense-line.test.ts`, `packages/schemas/src/audit-event.ts`, `packages/schemas/src/audit-event.test.ts`
- All 8 task commits found in git log: `73dae98`, `d209bd5`, `605f54e`, `b05dc39`, `64acd5f`, `2d4b8d0`, `5250eec`, `4d6f9fa`
- Re-ran plan-level `<verification>`: `pnpm vitest run --project schemas` (85/85 pass), `pnpm tsc --noEmit -p packages/schemas` (clean), `pnpm eslint packages/engine packages/schemas` (clean), `pnpm exec depcruise --config .dependency-cruiser.cjs packages/engine packages/schemas` (no violations, 17 modules cruised)
- Re-ran full suite: `pnpm vitest run` passes 107/107 (up from 57 before this plan) with no regressions
- Re-ran all acceptance criteria from all three tasks: field counts (16/14/9), literal caps absent (`grep` for 200/300/500 in the three source files returns nothing outside comments/constants), `.transform()` absent from `expense-line.ts`, `ExpenseUnitSchema` has exactly 5 members, currency refinement issue path `['currency']`, claimedAmount refinement issue path `['claimedAmount']`, `AUDIT_PAYLOAD_KEYS` is a `readonly` tuple with `AuditPayloadSchema` derived from it — all PASS

---
*Phase: 01-schemas-freeze-and-walking-skeleton*
*Completed: 2026-09-15*
