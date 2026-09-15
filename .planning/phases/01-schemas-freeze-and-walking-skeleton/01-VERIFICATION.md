---
phase: 01-schemas-freeze-and-walking-skeleton
verified: 2026-09-15T09:30:00Z
status: verified
status_history: gaps_found (2026-09-15T08:00Z) -> verified (2026-09-15T08:40Z, gap closed in c9442d9 and re-verified independently by the orchestrator) -> verified (2026-09-15T09:30Z, staleness re-verification at HEAD after WR-01/02/03 + gap-closure commits, re-run independently — no regression found)
gap_status: closed
gap_closed_at: 2026-09-15T08:15:00Z
re_verified_at_head: b69ff0161c1fc685ac4b0e012473ec47b08309b4
score: 9/9 must-haves verified
covered_files:
  - ".dependency-cruiser.cjs"
  - ".env.example"
  - ".gitignore"
  - ".planning/REQUIREMENTS.md"
  - ".planning/ROADMAP.md"
  - ".planning/phases/01-schemas-freeze-and-walking-skeleton/01-01-PLAN.md"
  - ".planning/phases/01-schemas-freeze-and-walking-skeleton/01-01-SUMMARY.md"
  - ".planning/phases/01-schemas-freeze-and-walking-skeleton/01-02-PLAN.md"
  - ".planning/phases/01-schemas-freeze-and-walking-skeleton/01-02-SUMMARY.md"
  - ".planning/phases/01-schemas-freeze-and-walking-skeleton/01-03-PLAN.md"
  - ".planning/phases/01-schemas-freeze-and-walking-skeleton/01-03-SUMMARY.md"
  - ".planning/phases/01-schemas-freeze-and-walking-skeleton/01-05-PLAN.md"
  - ".planning/phases/01-schemas-freeze-and-walking-skeleton/01-05-SUMMARY.md"
  - ".planning/phases/01-schemas-freeze-and-walking-skeleton/01-06-PLAN.md"
  - ".planning/phases/01-schemas-freeze-and-walking-skeleton/01-06-SUMMARY.md"
  - ".planning/phases/01-schemas-freeze-and-walking-skeleton/01-07-PLAN.md"
  - ".planning/phases/01-schemas-freeze-and-walking-skeleton/01-07-SUMMARY.md"
  - ".planning/phases/01-schemas-freeze-and-walking-skeleton/01-CONTEXT.md"
  - ".planning/phases/01-schemas-freeze-and-walking-skeleton/01-REVIEW.md"
  - ".planning/phases/01-schemas-freeze-and-walking-skeleton/01-VALIDATION.md"
  - "docker-compose.yml"
  - "eslint.config.js"
  - "package.json"
  - "packages/engine/package.json"
  - "packages/engine/src/index.ts"
  - "packages/engine/src/schemas-boundary.test.ts"
  - "packages/engine/tsconfig.json"
  - "packages/schemas/FREEZE.md"
  - "packages/schemas/package.json"
  - "packages/schemas/schema/assessment-line.schema.json"
  - "packages/schemas/schema/assessment.schema.json"
  - "packages/schemas/schema/expense-line.schema.json"
  - "packages/schemas/src/__fixtures__/arbitraries.ts"
  - "packages/schemas/src/assessment.ts"
  - "packages/schemas/src/audit-event.ts"
  - "packages/schemas/src/condition.ts"
  - "packages/schemas/src/constants.ts"
  - "packages/schemas/src/expense-line.ts"
  - "packages/schemas/src/guard-input.ts"
  - "packages/schemas/src/json-schema.ts"
  - "packages/schemas/src/matter-status.ts"
  - "packages/schemas/src/matter.ts"
  - "packages/schemas/src/money.ts"
  - "packages/schemas/src/primitives.ts"
  - "packages/schemas/src/rule-pack.ts"
  - "packages/schemas/src/taxonomy.ts"
  - "packages/schemas/tsconfig.json"
  - "prisma.config.ts"
  - "prisma/schema.prisma"
  - "tests/boundary/denylist-scanner.test.ts"
  - "tests/boundary/denylist-scanner.ts"
  - "tests/boundary/dom-denylist.test.ts"
  - "tests/boundary/prisma-field-denylist.test.ts"
  - "tests/fixtures/denylist-canary.fixture.tsx"
  - "tests/toolchain/lint-money-brand.test.ts"
  - "tests/toolchain/pins.test.ts"
  - "tests/toolchain/purity-gate.test.ts"
  - "tests/tsconfig.json"
  - "tsconfig.base.json"
  - "tsconfig.json"
  - "vitest.config.ts"
covered_digest: "v1:sha256:9bf37a1cb76c0a31f841ad5f798795a27abb23f38df85a4816818b40c4c05d71"
overrides_applied: 0
re_verification:
  previous_status: verified (gap closed same-session; score recorded as 8/9 in frontmatter even though narrative already treated the gap as resolved)
  previous_score: 8/9
  gaps_closed:
    - "A downstream package can import Matter, ExpenseLine, RulePack, Assessment, AssessmentLine, AuditEvent and MatterStatus and compile without redefining a field (ROADMAP Phase 1 Success Criterion 1)"
  gaps_remaining: []
  regressions: []
  corrections_made_this_round:
    - "covered_files was missing packages/engine/src/schemas-boundary.test.ts (added in the same commit, c9442d9, that wrote the previous covered_files list) — added it here; covered_digest recomputed and changed as a result"
    - "Frontmatter score updated from 8/9 to 9/9 to match the body's own 'gap closed' narrative, which the previous round left inconsistent with its own frontmatter score"
gaps:
  - truth: "A downstream package can import Matter, ExpenseLine, RulePack, Assessment, AssessmentLine, AuditEvent and MatterStatus and compile without redefining a field (ROADMAP Phase 1 Success Criterion 1)"
    status: fixed
    fixed_at: 2026-09-15T08:15:00Z
    confirmed_at_head: 2026-09-15T09:30:00Z
    resolution: >
      Three causes fixed, one deliberately not: (1) added
      "@dsar/schemas": "workspace:*" to packages/engine/package.json and ran
      `pnpm install`, linking @dsar/schemas into
      packages/engine/node_modules; (2) moved `allowImportingTsExtensions`
      out of packages/schemas/tsconfig.json and tests/tsconfig.json and into
      the shared tsconfig.base.json so every current and future consumer
      inherits it; (3) did NOT add an explicit TS project-reference edge
      from packages/engine to packages/schemas — attempted this and it
      produced TS6310 ("Referenced project ... may not disable emit"),
      because packages/schemas inherits `noEmit: true` from
      tsconfig.base.json by design (it ships raw .ts source via its
      subpath-exports map, never a built dist/). Adding a references edge
      would force packages/schemas to emit declarations nothing consumes,
      contradicting the established source-only architecture. Verified
      instead that `tsc --build tsconfig.json` already orders and
      typechecks the cross-package import correctly without that edge
      (falsified with a deliberately-wrong probe: `const bogus: Matter =
      "not a matter"` produced a real TS2322 naming Matter's actual shape,
      then reverted). (4) Added a permanent regression test,
      packages/engine/src/schemas-boundary.test.ts, which imports Matter,
      Assessment, AssessmentLine, ExpenseLine, RulePack and AuditEvent
      (type-only) plus MATTER_STATUSES (runtime) from @dsar/schemas through
      its real subpath-exports map, and registered a new "engine" vitest
      project in vitest.config.ts so the test runs. All five gates
      (vitest, typecheck, lint, depcruise, db:validate) pass clean; test
      count is 175 (173 + 2 new). Independently reproduced at current HEAD
      in this re-verification round (see "Staleness Re-Verification" below):
      a fresh `pnpm run typecheck` with cleared .tsbuildinfo passes, and a
      new deliberately-wrong probe (`const bogus: Matter = "not a matter"`)
      still produces a real TS2322 naming Matter's actual 16-field shape,
      then was reverted with a clean `git status` on packages/engine/.
    status_was: failed
    reason: "packages/schemas ships a wildcard subpath exports map (\"./*\": \"./src/*.ts\") with no built declaration output — every module imports its siblings with an explicit .ts extension. Consuming that from any other package requires the consumer's own tsconfig to set `allowImportingTsExtensions: true`. That flag exists on packages/schemas/tsconfig.json and tests/tsconfig.json (added during this same phase's WR-01 fix) but was never added to tsconfig.base.json or to packages/engine/tsconfig.json — the one package that exists specifically so a downstream consumer of the freeze has somewhere to compile against it. A real import of any frozen type into packages/engine, compiled with the project's own `pnpm run typecheck` (tsc --build tsconfig.json), fails with TS5097 on every packages/schemas module the import graph touches."
    artifacts:
      - path: "packages/engine/tsconfig.json"
        issue: "RESOLVED — inherits `allowImportingTsExtensions: true` from tsconfig.base.json as of c9442d9"
      - path: "tsconfig.base.json"
        issue: "RESOLVED — now declares `allowImportingTsExtensions: true` directly, confirmed present at HEAD"
    missing: []
---

# Phase 1: Schemas Freeze and Walking Skeleton Verification Report

**Phase Goal:** Every core type is frozen so nothing downstream has to re-open it, and the data model is authored and validated ready for the database boundary in Phase 3.2
**Verified:** 2026-09-15 (initial pass) / 2026-09-15 (staleness re-verification at HEAD, commit `b69ff01`)
**Status:** verified
**Re-verification:** Yes — staleness re-verification after 4 follow-up commits (`a8dd5d1` WR-01, `9d3844f` WR-02, `dc112a2` WR-03, `c9442d9` gap closure, plus `db1a209`/`b69ff01` doc updates)

## Staleness Re-Verification (this round, run independently against HEAD)

The phase's previous verification round closed its one open gap and marked itself `verified` in the same session as the fix. That is not, on its own, evidence the fix survives at the current commit — this round re-ran every check independently rather than trusting the embedded narrative.

**All five project gates re-run from a clean build (`.tsbuildinfo` cleared first):**

| Gate | Command | Result |
|---|---|---|
| Typecheck | `pnpm run typecheck` (`tsc --build tsconfig.json`) | exit 0 |
| Tests | `pnpm vitest run` | 19 files, **175/175 passed** |
| Lint | `pnpm run lint` (`eslint .`) | exit 0 |
| Dependency purity | `pnpm run depcruise` | "no dependency violations found (36 modules, 70 dependencies cruised)" |
| Prisma validate | `pnpm run db:validate` | "The schema at prisma\schema.prisma is valid" |

**Cross-package compile probe, reproduced independently (not copy-pasted from the SUMMARY):**

1. Added `packages/engine/src/__reverify_probe.ts` with `import type { Matter } from "@dsar/schemas/matter";` (the correct specifier — no `.ts` suffix, since the exports map is `"./*": "./src/*.ts"` and appending `.ts` resolves to `matter.ts.ts` / `TS2307`) and a deliberately-wrong `const bogus: Matter = "not a matter";`.
2. Cleared `.tsbuildinfo`, ran `pnpm run typecheck`. Result: a genuine `TS2322` — `Type 'string' is not assignable to type '{ id: string; reference: string; jurisdictionCode: ...; ... }'` — naming `Matter`'s actual 16-field shape across the package boundary. This proves the import resolves and is type-checked for real, not merely accepted syntactically.
3. Removed the probe file, cleared `.tsbuildinfo` again, re-ran `pnpm run typecheck` — exit 0. `git status --short packages/engine/` empty (no residue).

**Regression-test load-bearing check (independently confirmed, not just cited from the SUMMARY):** Temporarily flipped `tsconfig.base.json`'s `allowImportingTsExtensions` from `true` to `false`, cleared `.tsbuildinfo`, ran `pnpm run typecheck`. Result: **38 `TS5097` errors** across `packages/schemas/src/*.ts` and `tests/boundary/*.test.ts` (not just `packages/engine`) — confirming the flag is genuinely load-bearing repo-wide, not a no-op. Restored the flag with `git checkout -- tsconfig.base.json`, cleared `.tsbuildinfo`, re-ran `pnpm run typecheck` — exit 0. `git status --short` shows no diff introduced by this check.

**WR-02 (`AuditEventType` native enum) spot-check:** Diffed `prisma/schema.prisma`'s `enum AuditEventType` (17 members: `MATTER_CREATED` … `CAPABILITY_STATEMENT_ACKNOWLEDGED`) against `AuditEventTypeSchema` in `packages/schemas/src/primitives.ts` (`z.enum([...])`, same 17 values). Identical, member-for-member, identical order. Holds.

**WR-03 (`Minor` bounds) spot-check against the PRD §14 reference fixture:** `MINOR_MIN`/`MINOR_MAX` are `±2,147,483,647` (32-bit signed range, matching every `Minor`-typed Prisma `Int` column). The fixture's largest value (`claimedTotal 88800` minor units) is trivially inside that range. Ran `pnpm vitest run assessment.test.ts` directly — 12/12 pass, including the fixture-parsing case. `ExpenseLine.quantity` is separately bounded by `EXPENSE_LINE_QUANTITY_MAX = 1,000,000` specifically so `quantity × unitRate` cannot overflow before either field's own bound catches it (confirmed by reading `packages/schemas/src/expense-line.ts`). Holds.

**Closed-set cardinality spot-checks (not re-derived from scratch, but confirmed against current source):**
- `MatterStatus`: Prisma enum and `MATTER_STATUSES` both hold exactly 7 values, identical order (`DRAFT, COMPUTING, LEGAL_REVIEW, INFO_REQUEST, SIGNED_OFF, CLOSED, SUPERSEDED`).
- `ExpenseCategoryCode`: `EXPENSE_CATEGORY_CODES` in `taxonomy.ts` — counted 21 entries directly by reading the source array.
- `CONDITION_FIELDS`: counted 15 entries directly (9 `ExpenseLine` fields + 6 `Matter` fields), `satisfies readonly (keyof ExpenseLine | keyof Matter)[]` clause present.
- `AUDIT_PAYLOAD_KEYS`: 5 entries (`entityId, field, before, after, elapsedReviewMs`).
- `AuditEventType`: 17 entries (see WR-02 check above).
- `Decimal`/`Float`/`Cascade` in `prisma/schema.prisma`: 0 occurrences each, confirmed by `grep -c`.

**Anti-pattern scan across every file touched by the four new commits** (`git diff --name-only 967db61 HEAD`): no `TODO`/`FIXME`/`HACK`/`PLACEHOLDER`/`TBD`/`XXX` markers in any changed source file. The only string matches were base64 integrity-hash substrings in `pnpm-lock.yaml` (false positives) and the word "XXX" appearing inside 01-VERIFICATION.md's own prose describing that no markers were found (not a real marker). Clean.

**Finding, not a regression:** the previous round's `covered_files` list (written in commit `c9442d9`, the same commit that added `packages/engine/src/schemas-boundary.test.ts`) omitted that new test file from its own coverage list, and the frontmatter `score: 8/9` was left stale after the body's own narrative already treated the gap as closed. Both corrected in this round's frontmatter (see `re_verification.corrections_made_this_round`). Neither is a goal-achievement gap — both are bookkeeping inconsistencies in the previous report, now fixed.

**Conclusion:** The phase goal holds at current HEAD (`b69ff01`). Nothing regressed. All 9 must-haves — the 5 ROADMAP success criteria plus the requirements-coverage items previously scored — are independently confirmed. This is not a rubber stamp: every gate was re-run from a clean build, the compile probe and its negative control were both reproduced with fresh evidence, and the regression test's own load-bearing-ness was verified by deliberately breaking and restoring the flag it guards.

---

## Scope Note

Per the phase's mid-flight re-scope (2026-09-14), this verification checks the six non-Docker plans (01-01, 01-02, 01-03, 01-05, 01-06, 01-07) against the *current* ROADMAP.md Phase 1 entry. ACCESS-01, ACCESS-06, ACCESS-08, BOUND-01 and AUDIT-02, the walking-skeleton routes, the `SIGNED_OFF` immutability trigger, and any applied migration are Phase 3.2's and are correctly absent here — their absence is not treated as a gap.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A downstream package can import `Matter`, `ExpenseLine`, `RulePack`, `Assessment`, `AssessmentLine`, `AuditEvent` and the seven-value `MatterStatus`, and compile without redefining a field; the frozen `RulePack` already carries the HK flat-fee extension | ✓ VERIFIED (fixed in c9442d9, reproduced independently at HEAD) | Original gap: cross-package import from `packages/engine` failed `pnpm run typecheck` with `TS5097` (missing `allowImportingTsExtensions` + missing workspace dependency). Fix: workspace dependency added, flag moved to `tsconfig.base.json`, permanent regression test added (`packages/engine/src/schemas-boundary.test.ts`). This round reproduced the fix independently: fresh `pnpm run typecheck` passes; a fresh deliberately-wrong probe (`const bogus: Matter = "not a matter"`) produces a real `TS2322` naming `Matter`'s actual shape; flipping the flag off breaks 38 imports repo-wide, proving it load-bearing; all reverted cleanly. |
| 2 | Money cannot go wrong silently: AC-07a lint fires inside `packages/engine`/`packages/schemas`, a 10,000-case property test shows every money field of a returned `Assessment` is an integer, and formatting the same integer as JPY and SGD gives zero and two decimal places respectively | ✓ VERIFIED | `pnpm vitest run` (175/175, includes the lint-rule and purity-gate falsification tests and the 10,000-run property test); `MINOR_UNIT_DECIMALS.JPY === 0`, `.SGD === 2` confirmed in `packages/schemas/src/money.ts` |
| 3 | All six core entities plus `User` are authored in `prisma/schema.prisma` with native enums and no cascading deletes, the schema validates, and the client generates — none of which needs a running database | ✓ VERIFIED | `pnpm run db:validate` → "is valid" (exit 0), re-run this round with no `DATABASE_URL`/Docker present; `grep -c 'Cascade\|Decimal\|Float' prisma/schema.prisma` → 0 for each, re-confirmed this round; `AuditEventType` now a native 17-member Postgres enum (WR-02), verified member-for-member against the zod tuple |
| 4 | No Prisma field name matches the personal-data deny-list (via `getDMMF()`), and the DOM half is proven non-vacuous by a canary rather than passing vacuously with no form yet | ✓ VERIFIED | Included in the 175/175 `pnpm vitest run` pass this round; unchanged by the four new commits |
| 5 | Cross-field invariants hold: a `Matter` whose `currency` isn't its jurisdiction's designated currency fails zod naming both codes (AC-42 layer 1), and `MatterStatus` is a closed set of seven | ✓ VERIFIED | Re-confirmed this round: `MATTER_STATUSES` / Postgres `enum MatterStatus` both hold exactly 7 values in identical order |

**Score:** 5/5 ROADMAP success criteria verified at HEAD (all previously-gapped items closed and independently reproduced).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/schemas/src/*.ts` (13 modules) | Frozen zod modules per PRD §6/§7.2/§8.1 | ✓ VERIFIED | Unchanged by the four new commits except `expense-line.ts`/`primitives.ts` (WR-03 bounds, additive only) |
| `prisma/schema.prisma` | All six entities + User, native enums, no cascades | ✓ VERIFIED | `AuditEventType` now native enum (WR-02); `db:validate` passes; 0 Decimal/Float/Cascade |
| `.dependency-cruiser.cjs` / `eslint.config.js` | Purity + money-branding gates | ✓ VERIFIED | `pnpm run lint` and `pnpm run depcruise` both exit 0 at HEAD |
| `tsconfig.json` (root) + `packages/*/tsconfig.json` | Real `tsc --build` gate (WR-01), consumable by `packages/engine` (gap fix) | ✓ VERIFIED | Both the gate's genuineness (fresh injected-error check) and the cross-package consumability (fresh compile probe) reproduced independently this round |
| `packages/engine/src/schemas-boundary.test.ts` | Permanent regression test for the gap | ✓ VERIFIED, load-bearing | Confirmed present, passing, and that disabling `allowImportingTsExtensions` breaks the build (38 errors) — not a decorative test |
| `packages/schemas/schema/*.schema.json` (3 files) | Committed JSON Schema, money as `integer` | ✓ VERIFIED | Unchanged by the four new commits except WR-03's regenerated bounds |
| `packages/schemas/FREEZE.md` | D-09/D-10 policy, post-freeze amendments recorded | ✓ VERIFIED | Records both WR-02 and WR-03 as post-freeze amendments |

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| SCHEMA-01 | ✓ SATISFIED | All six entities + primitives compile within `packages/schemas`; now also demonstrated to compile from a real downstream consumer (`packages/engine`) |
| SCHEMA-02 | ✓ SATISFIED | Branded, bounded (WR-03) `MinorSchema`; falsification test passes |
| SCHEMA-03 | ✓ SATISFIED | `MINOR_UNIT_DECIMALS` confirmed |
| SCHEMA-04 | ✓ SATISFIED (schema layer; DB layer is Phase 3.2) | Nine-entry map, `.superRefine()` enforcement confirmed |
| SCHEMA-05 | ✓ SATISFIED | JSON Schema artifacts regenerated with WR-03 bounds, drift test passes |
| SCHEMA-06 | ✓ SATISFIED | `GuardInput` literal-type exclusion, unaffected by the four new commits |
| SCHEMA-07 | ✓ SATISFIED | 10,000-run property test passing in the 175/175 suite |
| STATE-01 | ✓ SATISFIED (schema + Prisma-enum layer) | 7-value `MatterStatus` confirmed identical in zod and Postgres |
| BOUND-02 | ✓ SATISFIED | `getDMMF()` scan + DOM canary both pass |

No orphaned requirements. No requirement regressed by the four new commits.

### Anti-Patterns Found

None, re-scanned this round across every file touched since the previous verification (`git diff --name-only 967db61 HEAD`). See "Staleness Re-Verification" above for detail. All three 01-REVIEW.md Warnings (WR-01, WR-02, WR-03) confirmed genuinely fixed in the tree at HEAD, not merely marked resolved in prose. IN-01 remains open by explicit, recorded, in-scope decision (deferred to Phase 2).

### Human Verification Required

None. Every truth in this phase is a structural/schema-level property or a static gate, all independently re-run this round.

### Gaps Summary

None remaining. The single gap from the initial verification round (ROADMAP Success Criterion 1 — cross-package compile) was fixed in `c9442d9` and is independently reproduced as fixed at current HEAD (`b69ff01`) in this re-verification round. No new gaps introduced by the WR-01/02/03 fix commits or the gap-closure commit.

---

_Verified (initial): 2026-09-15_
_Verified (staleness re-verification): 2026-09-15, against HEAD `b69ff0161c1fc685ac4b0e012473ec47b08309b4`_
_Verifier: Claude (gsd-verifier)_
_Gap closed: 2026-09-15 (`c9442d9`) — re-confirmed independently in this round, not re-derived from the SUMMARY_
