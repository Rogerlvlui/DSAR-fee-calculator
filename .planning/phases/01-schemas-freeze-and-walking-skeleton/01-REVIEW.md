---
phase: 01-schemas-freeze-and-walking-skeleton
reviewed: 2026-09-15T00:00:00Z
depth: standard
files_reviewed: 43
files_reviewed_list:
  - .dependency-cruiser.cjs
  - eslint.config.js
  - vitest.config.ts
  - prisma.config.ts
  - package.json
  - .env.example
  - docker-compose.yml
  - prisma/schema.prisma
  - packages/engine/src/index.ts
  - packages/schemas/src/primitives.ts
  - packages/schemas/src/primitives.test.ts
  - packages/schemas/src/money.ts
  - packages/schemas/src/money.test.ts
  - packages/schemas/src/matter-status.ts
  - packages/schemas/src/matter-status.test.ts
  - packages/schemas/src/taxonomy.ts
  - packages/schemas/src/constants.ts
  - packages/schemas/src/matter.ts
  - packages/schemas/src/matter.test.ts
  - packages/schemas/src/expense-line.ts
  - packages/schemas/src/expense-line.test.ts
  - packages/schemas/src/audit-event.ts
  - packages/schemas/src/audit-event.test.ts
  - packages/schemas/src/condition.ts
  - packages/schemas/src/condition.test.ts
  - packages/schemas/src/rule-pack.ts
  - packages/schemas/src/rule-pack.test.ts
  - packages/schemas/src/assessment.ts
  - packages/schemas/src/assessment.test.ts
  - packages/schemas/src/assessment.property.test.ts
  - packages/schemas/src/guard-input.ts
  - packages/schemas/src/guard-input.test.ts
  - packages/schemas/src/json-schema.ts
  - packages/schemas/src/json-schema.test.ts
  - packages/schemas/src/__fixtures__/arbitraries.ts
  - packages/schemas/scripts/generate-json-schema.ts
  - packages/schemas/FREEZE.md
  - tests/boundary/denylist-scanner.ts
  - tests/boundary/denylist-scanner.test.ts
  - tests/boundary/prisma-field-denylist.test.ts
  - tests/boundary/dom-denylist.test.ts
  - tests/toolchain/pins.test.ts
  - tests/toolchain/purity-gate.test.ts
  - tests/toolchain/lint-money-brand.test.ts
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
fixed_at: 2026-09-15T00:00:00Z
fix_status: resolved
---

# Phase 1: Code Review Report

**Reviewed:** 2026-09-15
**Depth:** standard
**Files Reviewed:** 43
**Status:** issues_found

**Fix status (2026-09-15):** All three Warnings (WR-01, WR-02, WR-03) fixed
and committed individually — see the "RESOLVED" notes inline below and the
three `fix(01): WR-0N ...` commits. IN-01 (Info) left open by explicit,
recorded decision; not a defect.

## Summary

This phase transcribes PRD §6/§7.2 into zod, mirrors the same entities into `prisma/schema.prisma`, and stands up the two static gates (dependency-cruiser purity, AC-07a money-branding lint) plus the AC-06 deny-list scanner. The transcription itself is careful and, on the specific points the domain checklist asked to weight heavily, holds up:

- Every money-suffixed field I could find is typed `Minor`, not a bare `number` — no blind spot on a differently-named identifier turned up.
- `Totals.finalAmount` is `MinorSchema.nullable()` with no `.default(...)`, and nothing anywhere (`grep` across `packages/` and `tests/`) coerces it with `?? `, `Number(...)`, or a non-null assertion.
- The closed sets (`MatterStatus`, the 21-code taxonomy, `CONDITION_FIELDS`, `AUDIT_PAYLOAD_KEYS`) are genuinely closed — enums, `z.strictObject()`/`z.discriminatedUnion()`, and a `satisfies` clause where zod can't express `keyof`. No `.passthrough()`, `.catchall()`, or stray `z.string()` where an enum belongs.
- The deny-list word-boundary rewrite is sound: I traced `findDenyListViolations` by hand against `finalAmount` (no match), `requestor_name`/`RequestorName`/`nric`/`dateOfBirth`/`employeeID` (all match) — the fix for the `fin`/`finalAmount` false positive did not over-narrow the scanner.
- No occurrence of "compliant", "lawful", "approved" or "safe" as an output string or enum value in `packages/schemas` or `prisma/schema.prisma`.
- `packages/engine` and `packages/schemas` are clean per both static gates, and the gates themselves are falsified by their own tests (a real `node:fs` import in a fixture trips `no-io-in-engine`; a real bare-`number` money field trips the AC-07a rule; three look-alike identifiers correctly don't).

I found no Critical/BLOCKER-level defect — nothing here causes incorrect money arithmetic, lets personal data leak past the boundary, or lets HR see an unreviewed figure. The three Warnings below are real gaps worth fixing before more phases build on this freeze, not manufactured nitpicks.

## Warnings

### WR-01: Root `pnpm typecheck` silently checks nothing — RESOLVED

**Resolution:** Added a root `tsconfig.json` (TypeScript project references /
composite projects) over `packages/schemas`, `packages/engine`, and a new
`tests/tsconfig.json` covering the whole `tests/` tree. `typecheck` now runs
`tsc --build tsconfig.json`, which fails non-zero and names the file on a
real type error — proved by deliberately introducing one, confirming the
non-zero exit, then reverting it. Installed `@types/react`/`@types/react-dom`
(pinned exact, matching react/react-dom 19.3.0) so
`tests/fixtures/denylist-canary.fixture.tsx` typechecks for real rather than
being carved out of scope. Fixed two pre-existing type errors this surfaced
in `tests/toolchain/pins.test.ts` and `tests/toolchain/purity-gate.test.ts`
(the latter now uses dependency-cruiser's own exported types instead of a
hand-rolled, unsound interface). Commit: see `fix(01): WR-01 ...`.

**File:** `package.json:11` (`"typecheck": "tsc --noEmit"`)
**Issue:** There is no `tsconfig.json` at the repository root, and the script passes no `-p`/file arguments. Running it does not typecheck anything — `tsc` falls back to printing its own CLI help text and exits **0**:
```
$ pnpm run typecheck
$ tsc --noEmit
Version 6.0.3
tsc: The TypeScript Compiler - Version 6.0.3
...
$ echo $?
0
```
Every individual plan in this phase correctly ran a scoped `pnpm tsc --noEmit -p packages/schemas`, so the per-package work is genuinely typechecked — but the one command a future CI job or a new contributor would reach for at the repo root (`pnpm typecheck`) is a no-op that reports success. This was already flagged as a forward-looking gap in 01-03-SUMMARY.md's "Next Phase Readiness" but was never fixed in a later plan in this phase, and nothing else in the phase closes it.
**Fix:** Either add a root `tsconfig.json` with `references` to each package (composite project) and change the script to `tsc --build`, or make the script explicit about what it covers, e.g. `tsc --noEmit -p packages/schemas && tsc --noEmit -p packages/engine`. Whichever is chosen, the script should fail loudly (non-zero exit) if a package's tsconfig is missing, not silently no-op.

### WR-02: `AuditEventType` is a plain `String` column, not a native Postgres enum — inconsistent with every other closed set in this freeze, on the one table that can never be corrected — RESOLVED

**Resolution:** Added `enum AuditEventType` to `prisma/schema.prisma`,
mirroring `AuditEventTypeSchema` (`packages/schemas/src/primitives.ts`)
member-for-member — verified programmatically (17/17, same order), not just
by eye. Retyped `AuditEvent.type` to it and rewrote the inline comment to
record the new rationale. `prisma validate`/`prisma generate` both pass with
no DB required. No `packages/schemas` module changed, so `FREEZE.md` records
this as a Prisma-side post-freeze amendment rather than a schema-module
change. Commit: see `fix(01): WR-02 ...`.

**File:** `prisma/schema.prisma:352` (`type String` on `model AuditEvent`)
**Issue:** D-06 states the principle plainly: "if a rule is derivable from a frozen type, it lands with the freeze," and names `MatterStatus` as a real Postgres enum specifically so "no other status value exists anywhere in the system" holds at the database, not only in zod. That principle was applied consistently to twelve other closed sets in this same file (`MatterStatus`, `Role`, `ControllerType`, `RequestorClass`, `ExpenseUnit`, `StaffGrade`, `ExpenseCategoryCode`, `Verdict`, `Disposition`, `RulePackStatus`, `JurisdictionCode`, `CurrencyCode`) — but `AuditEvent.type`, the 17-value `AuditEventType` closed set (`packages/schemas/src/primitives.ts:189-207`), was deliberately left as a bare `String` with only application-layer (zod) validation. The module comment defends this ("so packages/audit's writer owns the validation"), but that reasoning would apply equally to any of the other eleven enums, all of which got a native enum anyway.
This is the one table where the gap matters most: AC-34 revokes `UPDATE`/`DELETE`/`TRUNCATE` on this table for the runtime role specifically so it is append-only. If any future code path — a bug in `packages/audit`, a maintenance script, a migration's `INSERT` — ever writes a value outside the 17 declared types, a native enum would reject it at the database; a `String` column accepts it, and because the table is immutable-by-design, that bad row can never be corrected, only worked around forever.
**Fix:** Add a native `enum AuditEventType { MATTER_CREATED LINE_ADDED ... }` mirroring `AuditEventTypeSchema` member-for-member (same pattern already used for every other enum in this file) and retype `AuditEvent.type` to it. If the concern is genuinely about `packages/audit` owning validation timing, a `CHECK` constraint mirroring the enum values is a materially weaker but still-DB-level fallback — a bare `String` is the one option that gives up the invariant entirely.

### WR-03: `Minor`/Prisma `Int` money columns can silently overflow Postgres's 32-bit range; nothing in the schema or Prisma bounds `quantity`/`unitRate` to prevent it — RESOLVED

**Resolution:** Bounded `MinorSchema` to the 32-bit signed range
(`MINOR_MIN`/`MINOR_MAX`, `±2,147,483,647`) rather than widening the columns
to `BigInt` — matches every Minor-typed Prisma `Int` column, keeps a single
integer-money representation, and the largest legitimate fee here is a few
thousand units of currency. Also bounded `ExpenseLineSchema.quantity`
(`EXPENSE_LINE_QUANTITY_MAX = 1,000,000`) so `quantity * unitRate` cannot
lose precision past `Number.MAX_SAFE_INTEGER` before either field's own
bound rejects it — closing the exact gap flagged (bounding only
`claimedAmount` would leave the multiplication itself able to exceed the
range before validation ever saw it). Regenerated the committed JSON Schema
artifacts (`pnpm schema:json`). Added tests for the boundary values, one
past each boundary, and the exact `50,000,000 * 100` overflow shape named in
the review. Recorded in `FREEZE.md` as a post-freeze amendment. Commit: see
`fix(01): WR-03 ...`.

**File:** `packages/schemas/src/primitives.ts:46` (`MinorSchema`), `packages/schemas/src/expense-line.ts:32,34` (`quantity`, `unitRate`), `prisma/schema.prisma:229-230` (`unitRate Int`, `claimedAmount Int`)
**Issue:** `MinorSchema = z.number().int().brand<"Minor">()` accepts any safe integer — the committed JSON Schema artifact confirms the effective bound is `±9007199254740991` (`packages/schemas/schema/assessment-line.schema.json`, `engineAmount.maximum`). Every Prisma column carrying a `Minor` value (`ExpenseLine.unitRate`, `.claimedAmount`; `Assessment.claimedTotal`/`draftBaseline`/.../`finalAmount`; `AssessmentLine.engineAmount`/`lawyerAmount`) is typed Prisma `Int`, which maps to Postgres's 4-byte `integer` — range ±2,147,483,647, roughly six orders of magnitude smaller than what the zod schema permits.
Compounding this: `ExpenseLine.quantity` (`z.number().int().positive()`) and `unitRate` (`MinorSchema`) both have no upper bound, and `claimedAmount`'s only check is the equality superRefine (`quantity * unitRate`) — there is nothing anywhere in this freeze stopping an (erroneous or malicious) HR-entered line like `quantity: 50_000_000, unitRate: 100` from parsing successfully at the zod boundary (product = 5,000,000,000, well under `Number.MAX_SAFE_INTEGER`) and then failing at the Prisma write with a raw Postgres integer-overflow error rather than a handled validation error.
**Fix:** Pick one: (a) narrow `MinorSchema` to `.min(-2_147_483_648).max(2_147_483_647)` (or a tighter, domain-appropriate bound) so the branded type and the column agree, and add the same bound as a superRefine-level check message rather than letting it surface as a raw DB error; or (b) widen the money columns to Postgres `bigint` (Prisma `BigInt`) to match `Minor`'s actual range. Either way, also put a sane upper bound on `ExpenseLine.quantity`/`unitRate` — nothing currently stops a data-entry typo from producing a claim that is orders of magnitude too large before it ever reaches a lawyer.

## Info

### IN-01: `Minor` permits negative values everywhere; "negative rate rejected" is named in PRD §14 but not enforced at this layer — LEFT OPEN (deliberate)

**Left open, not fixed:** out of scope for this fix pass by explicit
instruction. Consistent with the phase's documented pattern of deferring
value checks to Phase 2's `assess()` (recorded in 01-07-SUMMARY.md), and PRD
§14 itself lists "negative rate rejected" as an engine unit test, not a
schema constraint. No action taken; Phase 2 must explicitly validate
`unitRate >= 0` (and any other money precondition) before computing, since
the schema will not catch it.


**File:** `packages/schemas/src/primitives.ts:46`, `packages/schemas/src/expense-line.ts:34`, `packages/schemas/src/assessment.ts:63,70`
**Issue:** `MinorSchema` has no non-negativity constraint, so `unitRate`, `engineAmount`, `lawyerAmount`, and every `Totals` field currently accept negative integers at the schema layer. PRD §14 names "negative rate rejected" as an explicit engine-unit-test boundary case, and this freeze's own precedent (`engineAmount` not constrained to 0 for `DISALLOW`/`FLAG`, recorded plainly in 01-07-SUMMARY.md as "an assess()-time invariant... not a structural constraint this freeze enforces") suggests this was consciously deferred to Phase 2 rather than overlooked. Recording it here so Phase 2's `assess()` doesn't quietly rely on a schema-level guarantee that doesn't actually exist.
**Fix:** No action needed in this phase; confirm Phase 2's engine explicitly validates `unitRate >= 0` (and any other money precondition) before computing, since the schema will not catch it.

---

_Reviewed: 2026-09-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
