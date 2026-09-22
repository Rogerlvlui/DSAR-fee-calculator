---
phase: 01-schemas-freeze-and-walking-skeleton
plan: 02
subsystem: schemas
tags: [zod, typescript, money, taxonomy, state-machine]

requires:
  - phase: 01-01
    provides: pnpm workspace, tsconfig.base.json, vitest.config.ts's `schemas` project, dependency-cruiser purity gate, AC-07a money-branding ESLint rule
provides:
  - "@dsar/schemas package (wildcard subpath exports, no barrel index.ts)"
  - "Every PRD §6.0 shared primitive as a zod schema with an inferred type"
  - "Branded Minor money type + toMinor() single conversion point"
  - "JURISDICTION_CURRENCY nine-entry map (SCHEMA-04)"
  - "MINOR_UNIT_DECIMALS + formatMinor()/minorToMajorParts() currency-aware money formatting (SCHEMA-03)"
  - "MatterStatus closed seven-value enum (STATE-01, schema layer)"
  - "ExpenseCategoryCode closed 21-code taxonomy (PRD §6.3) with HR-facing labels"
  - "PERSONAL_DATA_DENY_LIST (AC-06) and FREE_TEXT_LIMITS (§12.1), exported once"
affects: [01-03, 01-05, 01-06, 01-07]

actuals:
  tokens: 6538
  tasks: 3
  commits: 4
plan_head_before: bdbb57881660da632800109b82895ef524f8f3fe

tech-stack:
  added: []
  patterns:
    - "Zod-first authoring: schemas are the source of truth, TypeScript types are derived via z.infer, never declared separately and validated alongside (CONTEXT.md Claude's Discretion)"
    - "packages/schemas ships a wildcard subpath exports map (\"./*\": \"./src/*.ts\") and no barrel index.ts — modules import each other's files directly (e.g. `from \"./primitives.ts\"`), so four separate plans authoring entity modules in this package never serialise onto one shared file, and zod's circular-import hazard between cross-referencing schemas is avoided by construction"
    - "MatterFlagRule and Condition are deliberately NOT declared in primitives.ts — Condition's field union depends on Matter/ExpenseLine, which don't exist yet; both are authored alongside RulePack in plan 01-06 so the dependency points one way"
    - "allowImportingTsExtensions: true added to packages/schemas/tsconfig.json — relative `./foo.ts` imports under nodenext + noEmit require this compiler flag"

key-files:
  created:
    - packages/schemas/package.json
    - packages/schemas/tsconfig.json
    - packages/schemas/src/primitives.ts
    - packages/schemas/src/money.ts
    - packages/schemas/src/matter-status.ts
    - packages/schemas/src/taxonomy.ts
    - packages/schemas/src/constants.ts
    - packages/schemas/src/primitives.test.ts
    - packages/schemas/src/money.test.ts
    - packages/schemas/src/matter-status.test.ts
  modified:
    - pnpm-lock.yaml

key-decisions:
  - "Zod authoring shape (CONTEXT.md Claude's Discretion): zod-first with z.infer deriving every TypeScript type, not types-first with validators bolted on. .parse()/.safeParse() runs only at boundaries (HTTP body, Prisma-row mapper, rule-pack JSON load) — never inside Phase 2's hot assess() path, so the AC-07(b) 100ms/50-line budget is unaffected."
  - "Subpath exports, no barrel (CONTEXT.md Claude's Discretion): packages/schemas/package.json declares \"./*\": \"./src/*.ts\" and deliberately ships no index.ts. Four separate plans (01-02, 01-03/05/06/07) author entity modules in this same package; a shared barrel would serialise them onto one file and worsen zod's classic circular-import hazard between cross-referencing schemas."
  - "MatterFlagRule and Condition deferred to plan 01-06 (alongside RulePack) rather than declared here, because Condition.field: keyof ExpenseLine | keyof Matter cannot be frozen until those two entities exist. Keeps the dependency pointing one way: rulepacks depends on primitives, never the reverse."
  - "MINOR_UNIT_DECIMALS authored as an explicit, exhaustive Record<CurrencyCode, 0 | 2> literal rather than derived from Intl's ICU currency-digits default (01-RESEARCH.md Pitfall #6) — the zero-decimal behaviour for JPY/KRW/VND is visible in source and testable without trusting the runtime's ICU build."

patterns-established:
  - "Money formatting: read decimal count from MINOR_UNIT_DECIMALS, divide by 10**decimals (never hard-coded 100), always pass explicit minimumFractionDigits/maximumFractionDigits to Intl.NumberFormat. The division inside formatMinor is the only division on the money path."
  - "Closed enums (MatterStatus, ExpenseCategoryCode) are declared as a readonly `as const` tuple first, then z.enum(TUPLE) derives the schema — so the tuple is the single source for both runtime validation and any downstream cardinality/order assertion (e.g. plan 01-03's Postgres enum mirror)."

requirements-completed: [SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04, STATE-01]

coverage:
  - id: D1
    description: "PRD §6.0 shared primitives transcribed into zod (ULID/ISODate/ISODateTime, branded Minor + toMinor, JurisdictionCode/CurrencyCode, ControllerType/Role/StaffGrade, UserRef/Instrument/Citation, FlagReason(Code)/MatterFlag(Code), AuditEventType, recursive Json) in a new @dsar/schemas package with subpath exports and no barrel"
    requirement: "SCHEMA-01"
    verification:
      - kind: unit
        ref: "packages/schemas/src/primitives.test.ts"
        status: pass
      - kind: unit
        ref: "pnpm tsc --noEmit -p packages/schemas"
        status: pass
    human_judgment: false
  - id: D2
    description: "Money cannot be a bare number: MinorSchema rejects 1.5 and NaN, accepts 0, and the AC-07a lint rule from plan 01-01 stays green over the new package"
    requirement: "SCHEMA-02"
    verification:
      - kind: unit
        ref: "packages/schemas/src/primitives.test.ts#MinorSchema"
        status: pass
      - kind: integration
        ref: "pnpm eslint packages/engine packages/schemas"
        status: pass
    human_judgment: false
  - id: D3
    description: "MINOR_UNIT_DECIMALS map plus formatMinor()/minorToMajorParts() — the same minor-unit integer renders zero decimal places under JPY/KRW/VND and two under the other six currencies, with the decimal count read from an authored map, never Intl's implicit ICU default"
    requirement: "SCHEMA-03"
    verification:
      - kind: unit
        ref: "packages/schemas/src/money.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "JURISDICTION_CURRENCY maps each of the nine jurisdictions to exactly one currency, exhaustive Record with no default branch"
    requirement: "SCHEMA-04"
    verification:
      - kind: unit
        ref: "packages/schemas/src/primitives.test.ts#JURISDICTION_CURRENCY"
        status: pass
    human_judgment: false
  - id: D5
    description: "MatterStatus is a closed seven-value enum in PRD §5 lifecycle order; case, whitespace, empty-string, null and undefined variants are all rejected (schema layer — the Postgres enum mirror is plan 01-03)"
    requirement: "STATE-01"
    verification:
      - kind: unit
        ref: "packages/schemas/src/matter-status.test.ts#MatterStatusSchema"
        status: pass
    human_judgment: false
  - id: D6
    description: "ExpenseCategoryCode is a closed 21-code taxonomy transcribed code-for-code from PRD §6.3, with a non-empty HR-facing label for every code including the OTHER_UNCLASSIFIED escape hatch"
    verification:
      - kind: unit
        ref: "packages/schemas/src/matter-status.test.ts#ExpenseCategoryCodeSchema / taxonomy"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-15
status: complete
---

# Phase 1 Plan 2: PRD §6.0 Primitives, Money Formatting, MatterStatus and Expense Taxonomy Summary

**`@dsar/schemas` package transcribing every PRD §6.0 shared primitive into zod, a currency-aware `MINOR_UNIT_DECIMALS`/`formatMinor` money formatter that never trusts Intl's implicit ICU defaults, and the two closed sets (seven-value `MatterStatus`, 21-code expense taxonomy) both asserted by cardinality test.**

## Performance

- **Duration:** 25 min (approx.)
- **Started:** 2026-09-15T02:05:00+08:00 (approx.)
- **Completed:** 2026-09-15T02:23:00+08:00
- **Tasks:** 3
- **Files modified:** 10 created, 1 modified (pnpm-lock.yaml)

## Accomplishments

- `@dsar/schemas` package scaffolded with a wildcard subpath exports map (`"./*": "./src/*.ts"`) and deliberately no barrel `index.ts`, so the four plans authoring entity modules in this package (01-02, 01-03, 01-05/06/07) never serialise onto one shared file.
- Every PRD §6.0 shared primitive transcribed into `packages/schemas/src/primitives.ts`: `ULID`/`ISODate`/`ISODateTime`, the branded `Minor` type with its single `toMinor()` conversion point, `JurisdictionCode`/`CurrencyCode` plus the exhaustive nine-entry `JURISDICTION_CURRENCY` map, `ControllerType`/`Role`/`StaffGrade`, `UserRef`/`Instrument`/`Citation`, `FlagReason(Code)`/`MatterFlag(Code)`, all 17 `AuditEventType` values, and the recursive `Json` type.
- `packages/schemas/src/constants.ts` exports the AC-06 ten-token `PERSONAL_DATA_DENY_LIST` and PRD §12.1's four `FREE_TEXT_LIMITS` caps once, for every later consumer to import.
- `packages/schemas/src/money.ts`, built through a real RED→GREEN TDD cycle: `MINOR_UNIT_DECIMALS` is an authored, exhaustive `Record<CurrencyCode, 0 | 2>` (never derived from `Intl`'s ICU default), and `formatMinor()`/`minorToMajorParts()` read the decimal count from that map and pass it explicitly to `Intl.NumberFormat`.
- `MatterStatus` frozen as a closed seven-value enum in PRD §5 lifecycle order (`packages/schemas/src/matter-status.ts`), and `ExpenseCategoryCode` frozen as the closed 21-code taxonomy from PRD §6.3 with verbatim HR-facing labels (`packages/schemas/src/taxonomy.ts`).
- 35/35 tests pass across the `schemas` Vitest project; `tsc --noEmit`, `eslint`, and `dependency-cruiser` all clean over `packages/engine` + `packages/schemas`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the @dsar/schemas package and transcribe PRD §6.0's shared primitives** - `5036cf7` (feat)
2. **Task 2 RED: Add failing test for MINOR_UNIT_DECIMALS and formatMinor** - `0f8b762` (test)
3. **Task 2 GREEN: Implement MINOR_UNIT_DECIMALS and currency-aware money formatter** - `d126277` (feat)
4. **Task 3: Freeze the seven-value MatterStatus and 21-code expense taxonomy** - `30b160f` (feat)

_No REFACTOR commit for Task 2 — the GREEN implementation was already minimal; no obvious cleanup existed._

## Files Created/Modified

- `packages/schemas/package.json` - `@dsar/schemas`, wildcard subpath exports map, `zod` dependency
- `packages/schemas/tsconfig.json` - Extends `tsconfig.base.json`; adds `allowImportingTsExtensions` (see Deviations)
- `packages/schemas/src/primitives.ts` - Every PRD §6.0 shared primitive as a zod schema + inferred type
- `packages/schemas/src/constants.ts` - `PERSONAL_DATA_DENY_LIST` (AC-06) and `FREE_TEXT_LIMITS` (§12.1)
- `packages/schemas/src/money.ts` - `MINOR_UNIT_DECIMALS`, `formatMinor`, `minorToMajorParts` (SCHEMA-03)
- `packages/schemas/src/matter-status.ts` - `MATTER_STATUSES`, `MatterStatusSchema`, `MatterStatus` (STATE-01)
- `packages/schemas/src/taxonomy.ts` - `EXPENSE_CATEGORY_CODES`, `ExpenseCategoryCodeSchema`, `EXPENSE_CATEGORY_LABELS` (PRD §6.3)
- `packages/schemas/src/primitives.test.ts` - Falsifies Minor precision, JURISDICTION_CURRENCY cardinality, FlagReason cap, ULID/ISODateTime rejection, AuditEventType/FlagReasonCode/MatterFlagCode cardinality
- `packages/schemas/src/money.test.ts` - Falsifies MINOR_UNIT_DECIMALS cardinality and every `formatMinor`/`minorToMajorParts` behavior in the plan
- `packages/schemas/src/matter-status.test.ts` - Falsifies MatterStatus cardinality/order/rejection cases and taxonomy cardinality/labels
- `pnpm-lock.yaml` - Updated for the new `@dsar/schemas` workspace member's `zod` dependency

## Decisions Made

- Zod-first authoring (CONTEXT.md Claude's Discretion): every type in this package is derived via `z.infer` from its schema, never declared separately. `.parse()` is called only at `toMinor()` and other explicit boundary points — never inside a hot path.
- Subpath exports, no barrel (CONTEXT.md Claude's Discretion): `"./*": "./src/*.ts"` rather than a shared `index.ts`, so this phase's four schema-authoring plans never contend on one file and zod's cross-referencing-schema circular-import hazard is avoided by construction.
- `MatterFlagRule` and `Condition` deliberately not declared in this plan (deferred to plan 01-06 alongside `RulePack`), because `Condition.field: keyof ExpenseLine | keyof Matter` cannot be frozen before those two entities exist.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `allowImportingTsExtensions` to `packages/schemas/tsconfig.json`**
- **Found during:** Task 1, first `pnpm tsc --noEmit -p packages/schemas` run
- **Issue:** `primitives.test.ts`'s relative import `from "./primitives.ts"` failed with `TS5097: An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled`. The package's exports map (`"./*": "./src/*.ts"`) uses explicit `.ts` extensions by design, and internal relative imports between sibling modules in this package follow the same convention for consistency — that combination requires the compiler flag under `nodenext` + `noEmit`.
- **Fix:** Added `"allowImportingTsExtensions": true` to `packages/schemas/tsconfig.json`'s `compilerOptions`. Valid alongside `noEmit: true` (inherited from `tsconfig.base.json`), which is a hard requirement of the flag.
- **Files modified:** `packages/schemas/tsconfig.json`
- **Verification:** `pnpm tsc --noEmit -p packages/schemas` reports no errors after the change.
- **Committed in:** `5036cf7` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for the plan's own acceptance criteria (`pnpm tsc --noEmit -p packages/schemas` reports no errors) to be satisfiable at all, given the `.ts`-extension import convention the plan's exports map already established. No scope creep — only `packages/schemas/tsconfig.json`'s `compilerOptions` was touched.

## TDD Gate Compliance

Task 2 (`tdd="true"`) followed the full RED → GREEN cycle:

- **RED:** `test(01-02): add failing test for MINOR_UNIT_DECIMALS and formatMinor` (`0f8b762`) — `pnpm vitest run --project schemas money.test.ts` failed with `Cannot find module './money.ts'` (the module did not exist yet). Confirmed via direct run output above.
- **GREEN:** `feat(01-02): implement MINOR_UNIT_DECIMALS and currency-aware money formatter` (`d126277`) — all 10 `money.test.ts` cases pass; `tsc` and `eslint` both clean.
- **REFACTOR:** None — the GREEN implementation was already minimal.

`workflow.tdd_mode` is not enabled in this project's `config.json` (per 01-01-SUMMARY.md's note on the same topic), so the strict `gsd_run check tdd-red-evidence` gate is not mandatory here; RED validity was confirmed by direct inspection of the vitest failure output (see commit `0f8b762`'s message).

## Known Stubs

None. `MatterFlagRule` and `Condition` are explicitly out of scope for this plan (deferred to 01-06 per CONTEXT.md and the plan's own `<action>` text), not undocumented stubs.

## Issues Encountered

None beyond the one documented deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `@dsar/schemas` compiles, and every primitive plan 01-03/01-05/01-06/01-07 needs (`Minor`, `toMinor`, `JurisdictionCode`, `CurrencyCode`, `JURISDICTION_CURRENCY`, `Role`, `StaffGrade`, `UserRef`, `Citation`, `MatterStatus`, `ExpenseCategoryCode`, `PERSONAL_DATA_DENY_LIST`, `FREE_TEXT_LIMITS`, and the rest) is available by subpath import, e.g. `import { toMinor } from "@dsar/schemas/primitives"`.
- Plan 01-03 can mirror `MATTER_STATUSES` into a native Postgres enum and assert member-for-member equality against it.
- Plan 01-06 can build `RulePack`, `CategoryRule`, `Cap`, `MatterFlagRule` and `Condition` directly on top of this package's primitives without redeclaring anything.
- No blockers for Plan 01-03.

## Self-Check: PASSED

- `packages/schemas/package.json`, `packages/schemas/tsconfig.json`, `packages/schemas/src/primitives.ts`, `packages/schemas/src/money.ts`, `packages/schemas/src/matter-status.ts`, `packages/schemas/src/taxonomy.ts`, `packages/schemas/src/constants.ts`, `packages/schemas/src/primitives.test.ts`, `packages/schemas/src/money.test.ts`, `packages/schemas/src/matter-status.test.ts` — all FOUND on disk.
- Commits `5036cf7`, `0f8b762`, `d126277`, `30b160f` — all FOUND in `git log --oneline --all`.
- All plan-level `<verification>` commands re-run and passing: `pnpm vitest run --project schemas` (35/35 pass), `pnpm tsc --noEmit -p packages/schemas` (clean), `pnpm eslint packages/engine packages/schemas` (clean), `pnpm exec depcruise --config .dependency-cruiser.cjs packages/engine packages/schemas` (no violations, 11 modules cruised).

---
*Phase: 01-schemas-freeze-and-walking-skeleton*
*Completed: 2026-09-15*
