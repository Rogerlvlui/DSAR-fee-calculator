---
phase: 01-schemas-freeze-and-walking-skeleton
plan: 03
subsystem: database
tags: [prisma, postgres, zod, deny-list, bound-02, schema-freeze]

requires:
  - phase: 01-schemas-freeze-and-walking-skeleton (plan 01-02)
    provides: MATTER_STATUSES tuple, EXPENSE_CATEGORY_CODES tuple, PERSONAL_DATA_DENY_LIST constant, packages/schemas primitives
provides:
  - prisma/schema.prisma with all six core entities (Matter, ExpenseLine, Assessment, AssessmentLine, RulePackVersion, AuditEvent) plus User, native Postgres enums, integer money columns, no cascades
  - prisma.config.ts (Prisma 7's post-datasource-url config seam)
  - docker-compose.yml (single postgres:17 service for Phase 3.2)
  - .env.example (DATABASE_URL / RUNTIME_DATABASE_URL split, D-08's precondition)
  - tests/boundary deny-list scanner (normalizeFieldName, findDenyListViolations) plus both AC-06 tests and a canary fixture
affects: [03.2-database-boundary-and-audit-immutability, 02-engine, 04-guarded-transitions]

actuals:
  tokens: 8312
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Prisma 7.10.0 config-first datasource: connection URL lives in prisma.config.ts, not schema.prisma's datasource block (P1012 — that syntax was removed)"
    - "Word-boundary deny-list matching: split on camelCase/snake_case/kebab-case, check contiguous word concatenations against normalized tokens, rather than a raw substring-of-flattened-name check"

key-files:
  created:
    - prisma/schema.prisma
    - prisma.config.ts
    - docker-compose.yml
    - .env.example
    - tests/boundary/denylist-scanner.ts
    - tests/boundary/denylist-scanner.test.ts
    - tests/boundary/prisma-field-denylist.test.ts
    - tests/boundary/dom-denylist.test.ts
    - tests/fixtures/denylist-canary.fixture.tsx
  modified:
    - package.json
    - .gitignore
    - tests/toolchain/pins.test.ts

key-decisions:
  - "D-01 checkpoint reconfirmed at implementation time: proceed with all-six-now — no new information surfaced that argues against modeling Assessment/AssessmentLine before assess() exists"
  - "ExpenseLine.quantity is read as an integer count of whole units of the declared ExpenseUnit (HOUR/PAGE/ITEM/GIGABYTE/FIXED), not a fractional quantity"
  - "SIGNED_OFF immutability trigger deliberately NOT written here (D-07) — Phase 4's"
  - "Deny-list matching is word-boundary-based, not raw substring, to avoid a real false positive (finalAmount contains fin)"

patterns-established:
  - "Every FK-owning Prisma relation carries onDelete: Restrict, onUpdate: Restrict explicitly; back-relation array fields on the non-owning side cannot and do not carry onDelete (Prisma requirement) — zero cascades verified by grep"

requirements-completed: [SCHEMA-01, STATE-01, BOUND-02]

coverage:
  - id: D1
    description: "All six core entities plus User modelled as Prisma models; schema validates and the client generates"
    requirement: "SCHEMA-01"
    verification:
      - kind: other
        ref: "pnpm exec prisma validate"
        status: pass
      - kind: other
        ref: "pnpm exec prisma generate"
        status: pass
    human_judgment: false
  - id: D2
    description: "MatterStatus is a native Postgres enum with the same 7 values, same order, as the frozen MATTER_STATUSES tuple"
    requirement: "STATE-01"
    verification:
      - kind: other
        ref: "grep -A9 '^enum MatterStatus' prisma/schema.prisma"
        status: pass
    human_judgment: false
  - id: D3
    description: "No cascading delete, Decimal, or Float anywhere in the data model"
    verification:
      - kind: other
        ref: "grep -c 'Cascade|Decimal|Float' prisma/schema.prisma == 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "Assessment.finalAmount is nullable with no default (AC-25)"
    verification:
      - kind: other
        ref: "grep -n finalAmount prisma/schema.prisma"
        status: pass
    human_judgment: false
  - id: D5
    description: "Personal-data deny-list scanner: normalizeFieldName (NFKC/lowercase/strip) and findDenyListViolations (word-boundary token match, dedup, order-independent)"
    requirement: "BOUND-02"
    verification:
      - kind: unit
        ref: "tests/boundary/denylist-scanner.test.ts (8 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Every Prisma field name checked against the deny-list via @prisma/internals getDMMF (not the generated client's simplified runtime DMMF)"
    requirement: "BOUND-02"
    verification:
      - kind: unit
        ref: "tests/boundary/prisma-field-denylist.test.ts (2 tests)"
        status: pass
    human_judgment: false
  - id: D7
    description: "DOM form-input deny-list check: glob half over apps/web/app/**/page.tsx (currently zero routes) plus a canary fixture proving the scanner fires"
    requirement: "BOUND-02"
    verification:
      - kind: unit
        ref: "tests/boundary/dom-denylist.test.ts (2 tests)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Two-connection-string split (DATABASE_URL / RUNTIME_DATABASE_URL) and single-service docker-compose.yml, D-08's precondition for Phase 3.2's boot assertion"
    verification:
      - kind: other
        ref: "grep DATABASE_URL .env.example; grep postgres:17 docker-compose.yml"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-15
status: complete
---

# Phase 1 Plan 3: Prisma Schema Freeze and AC-06 Deny-List Tests Summary

**All six core entities (User, Matter, ExpenseLine, Assessment, AssessmentLine, RulePackVersion, AuditEvent) modelled in `prisma/schema.prisma` with native Postgres enums and zero cascades, plus a word-boundary-aware personal-data deny-list scanner backing both AC-06 tests.**

## Performance

- **Duration:** ~20 min (post-checkpoint execution)
- **Completed:** 2026-09-15
- **Tasks:** 2 (Task 1 was the D-01 checkpoint, confirmed by the user before this executor resumed)
- **Files modified:** 13 (9 created, 3 modified in code; plus this SUMMARY and STATE/ROADMAP/REQUIREMENTS)

## Accomplishments

- `prisma/schema.prisma`: all six core entities plus `User`, twelve native Postgres enums transcribed member-for-member from `packages/schemas` and the PRD, integer money columns throughout, `finalAmount` nullable with no default (AC-25), and `onDelete: Restrict`/`onUpdate: Restrict` on every one of the 11 FK-owning relations — zero cascades anywhere
- `prisma.config.ts`, `docker-compose.yml`, `.env.example`: the config-first datasource seam Prisma 7.10.0 now requires, a single local `postgres:17` service, and the `DATABASE_URL`/`RUNTIME_DATABASE_URL` two-variable split D-08's boot assertion (Phase 3.2) will check
- A single deny-list scanner (`normalizeFieldName`, `findDenyListViolations`) driving both AC-06 tests, with a canary fixture proving the DOM half is non-vacuous before any real form exists

## Task Commits

1. **Task 2: Model all six core entities in prisma/schema.prisma** — `1b64bde` (feat)
2. **Task 3: Build the personal-data deny-list scanner and both AC-06 tests, with a canary** — TDD, three commits:
   - `d39e415` (test) — RED: failing tests against a deliberately-broken stub
   - `b5ee42f` (feat) — GREEN: real implementation; no REFACTOR commit needed (implementation was already clean on first pass)

**Plan metadata:** committed together with this SUMMARY (see below).

## Files Created/Modified

- `prisma/schema.prisma` - All six core entities + User, 12 native enums, zero cascades
- `prisma.config.ts` - Prisma 7's post-datasource-url config (DATABASE_URL, the migrator's connection string)
- `docker-compose.yml` - Single `postgres:17` service for Phase 3.2
- `.env.example` - `DATABASE_URL` / `RUNTIME_DATABASE_URL` two-variable split
- `tests/boundary/denylist-scanner.ts` - `normalizeFieldName` + `findDenyListViolations`, word-boundary token matching
- `tests/boundary/denylist-scanner.test.ts` - 8 tests covering the scanner's behavior contract
- `tests/boundary/prisma-field-denylist.test.ts` - AC-06 half one, via `@prisma/internals` `getDMMF`
- `tests/boundary/dom-denylist.test.ts` - AC-06 half two, glob + canary
- `tests/fixtures/denylist-canary.fixture.tsx` - Deliberately deny-listed rendered input (full-width "nric")
- `package.json` - `db:validate`/`db:generate`/`db:migrate`/`db:migrate:dev` scripts; `@dsar/schemas` workspace dependency; `dotenv` devDependency
- `.gitignore` - `prisma/generated/` (regenerated client output)
- `tests/toolchain/pins.test.ts` - Exempted `workspace:` protocol dependencies from the exact-version check

## Decisions Made

- **D-01 checkpoint reconfirmed at implementation time.** The user replied `all-six-now`: proceed with modeling all six core entities now, exactly as CONTEXT.md records. No new information surfaced during implementation that argues against it — PRD §14's reference fixture already pins `Assessment`'s shape field-by-field, which is D-03's named mitigation for this trade-off.
- **`ExpenseLine.quantity` reading:** an integer count of whole units of the declared `ExpenseUnit` (HOUR/PAGE/ITEM/GIGABYTE/FIXED) — e.g. 3 hours, 40 pages — not a fractional quantity. Recorded per this plan's `<output>` instruction.
- **`SIGNED_OFF` immutability trigger deliberately NOT written here.** D-07 holds it for Phase 4, where the assessment lifecycle makes it testable.
- **Deny-list matching is word-boundary-based, not raw substring-of-flattened-name.** See Deviations below — this was a mid-implementation discovery, not a plan-time decision.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prisma 7.10.0 removed `datasource { url = ... }` from schema files**
- **Found during:** Task 2 (writing `prisma/schema.prisma` exactly as the plan's `<action>` specified: `datasource db { provider = "postgresql"; url = env("DATABASE_URL") }`)
- **Issue:** Running `pnpm exec prisma validate` against that literal schema failed with `P1012: The datasource property 'url' is no longer supported in schema files`. This is a genuine breaking change in the exact Prisma version this project is pinned to (7.10.0) — not a hypothetical, confirmed against the installed CLI's own scaffold templates (`node_modules/prisma/build/cli.js`).
- **Fix:** Added `prisma.config.ts` at the repo root, following Prisma's own current scaffold pattern: `import { defineConfig } from "prisma/config"; export default defineConfig({ schema: "prisma/schema.prisma", migrations: { path: "prisma/migrations" }, datasource: { url: process.env["DATABASE_URL"] } })`. `prisma/schema.prisma`'s `datasource` block now declares only `provider = "postgresql"`. Verified both `prisma validate` and `prisma generate` succeed with no database available (this plan needs none) and with no `DATABASE_URL` set at all (validate/generate don't need a live connection).
- **Files modified:** `prisma/schema.prisma`, `prisma.config.ts` (new)
- **Verification:** `pnpm exec prisma validate` and `pnpm exec prisma generate` both exit zero
- **Committed in:** `1b64bde`

**2. [Rule 3 - Blocking] `@dsar/schemas` not resolvable from root-level test files**
- **Found during:** Task 2/3 preparation — the plan's own acceptance criteria require `tests/boundary/denylist-scanner.ts` to `import { PERSONAL_DATA_DENY_LIST } from "@dsar/schemas/constants"`, but root `package.json` had no dependency on the `packages/schemas` workspace package, so the import would fail to resolve outside `packages/schemas` itself.
- **Fix:** Added `"@dsar/schemas": "workspace:*"` to root `package.json` dependencies and ran `pnpm install` to link it.
- **Follow-on fix:** `tests/toolchain/pins.test.ts` (from plan 01-01) asserts every dependency/devDependency is an exact `\d+\.\d+\.\d+` version with no ranges — `workspace:*` fails that regex. Updated the test to exempt `workspace:`-protocol dependencies specifically: they are linked locally via pnpm's workspace resolution, not fetched off the npm registry, so they cannot drift to an unreviewed major the way a caret/latest range on an external package can (the exact risk that test guards against). All other dependencies are still required to be exact-pinned.
- **Files modified:** `package.json`, `tests/toolchain/pins.test.ts`
- **Verification:** `pnpm vitest run --project toolchain` still passes (8/8); `pnpm install` links `@dsar/schemas` from `packages/schemas` with no registry fetch
- **Committed in:** `1b64bde`

**3. [Rule 3 - Blocking] `dotenv` was only a transitive dependency**
- **Found during:** Task 2, after adding `prisma.config.ts`'s `import "dotenv/config"` (following Prisma's own scaffold pattern)
- **Issue:** `dotenv` was present in the pnpm virtual store only as a transitive dependency of `prisma` itself, not hoisted to root `node_modules` — resolvable when Prisma's own CLI loaded the config, but not a dependency this project's own code should rely on staying available as an undeclared transitive.
- **Fix:** Added `"dotenv": "17.4.2"` (the version already resolved in the lockfile) as an explicit root devDependency.
- **Files modified:** `package.json`
- **Verification:** `pnpm install` resolves it as a direct dependency; `prisma.config.ts` still loads correctly
- **Committed in:** `1b64bde`

**4. [Rule 1 - Bug] Naive substring deny-list matching produced a false positive on `Assessment.finalAmount`**
- **Found during:** Task 3, GREEN phase — after implementing `findDenyListViolations` as a straightforward "does the normalized name contain a normalized token" check (which the plan's `must_haves` truths describe: "matching is done on the normalized token... normalization lowercases and strips non-alphanumerics"), running `prisma-field-denylist.test.ts` against the real schema failed: `finalAmount` was reported as matching the deny-list token `"fin"` (Singapore's Foreign Identification Number abbreviation), because `"finalamount"` contains `"fin"` as a bare substring.
- **Issue:** `finalAmount` is a required, frozen field (`Assessment.finalAmount`, AC-25) — it cannot be renamed, the `"fin"` token is one of the PRD's own literal AC-06 deny-list tokens (§13, verbatim) and cannot be removed from `packages/schemas/src/constants.ts` (frozen in plan 01-02, out of this plan's file list), and a purely substring-based matcher will always have this collision risk for any 3-letter token embedded in ordinary English words (finance, define, refine, confine...).
- **Fix:** Re-designed `findDenyListViolations` to split each name into constituent words along camelCase/snake_case/kebab-case/space boundaries (a step that must run before, and separately from, `normalizeFieldName`'s blanket strip — which deliberately discards those boundaries for its own contract), then check every contiguous *word* concatenation against the normalized deny-list tokens, rather than checking the fully-flattened name for a raw substring. `"finalAmount"` splits into the words `["final", "amount"]` — neither individually, nor concatenated, equals the token `"fin"` — so it is no longer flagged. Every existing behavior the plan's tests require still holds: `requestorName` (splits to `requestor`+`name`, concatenation equals the token `requestorname`), `employeeId`, `dateOfBirth`, and a bare `fin`/`nric` field are all still caught; `requestorNote` is still correctly excluded.
- **Files modified:** `tests/boundary/denylist-scanner.ts`
- **Verification:** All 14 boundary tests pass, including the specific `prisma-field-denylist.test.ts` case that surfaced the false positive; re-ran the full deny-list test suite plus all 43 pre-existing tests with no regressions
- **Committed in:** `b5ee42f`

---

**Total deviations:** 4 auto-fixed (3 Rule 3 - blocking, 1 Rule 1 - bug)
**Impact on plan:** All four were necessary for the plan's own verification commands and acceptance criteria to be satisfiable at all, given the exact pinned tool versions (Prisma 7.10.0's real breaking change) and the exact schema this plan itself specifies (`finalAmount`, a frozen AC-25 field, colliding with the PRD's own literal deny-list token `"fin"`). No scope creep — no file outside this plan's own `files_modified` list (plus the one pre-existing toolchain test needed to make `@dsar/schemas` importable) was touched.

## Issues Encountered

None beyond the four deviations documented above, all resolved during execution.

## User Setup Required

None - no external service configuration required. This plan needs no Docker and applies no migration; Phase 3.2 is where the database is actually stood up.

## Next Phase Readiness

- `prisma/schema.prisma` is validated and generates cleanly; Phase 3.2 (plans 03.2-01, 03.2-02) can build the two-role GRANT/REVOKE migration, the currency check constraint, and the `SELECT current_user` boot assertion directly on top of it without re-opening the model.
- Both AC-06 deny-list tests are wired to generated artifacts (the real schema via `getDMMF`, a real rendered fixture) rather than a hand-maintained list, so a field or route added in Phases 3-8 is covered automatically.
- No blockers. The one open item worth flagging forward: `tests/boundary` and `tests/fixtures` are not yet covered by any working `tsc --noEmit` path (there is no root `tsconfig.json`, and the root `typecheck` script currently prints the `tsc` CLI help rather than checking anything — a pre-existing gap from plan 01-01, not introduced here). `@types/react`/`@types/react-dom` are also not yet installed, which the new `.tsx` fixture would need to fully typecheck. Neither blocks this plan's verification, and the natural place to resolve both is Phase 5's `apps/web` scaffold, which needs a real Next.js TypeScript setup anyway.

---
*Phase: 01-schemas-freeze-and-walking-skeleton*
*Completed: 2026-09-15*

## Self-Check: PASSED

- All 9 created files found on disk: `prisma/schema.prisma`, `prisma.config.ts`, `docker-compose.yml`, `.env.example`, `tests/boundary/denylist-scanner.ts`, `tests/boundary/denylist-scanner.test.ts`, `tests/boundary/prisma-field-denylist.test.ts`, `tests/boundary/dom-denylist.test.ts`, `tests/fixtures/denylist-canary.fixture.tsx`
- All 3 task commits found in git log: `1b64bde`, `d39e415`, `b5ee42f`
- Re-ran plan-level `<verification>`: `pnpm exec prisma validate` exits zero; `pnpm exec prisma generate` reports "Generated"; `pnpm vitest run --project boundary` passes 14/14 (≥ 8 required); `grep -c 'Cascade' prisma/schema.prisma` == 0; `grep -c 'Decimal' prisma/schema.prisma` == 0
- Re-ran full suite: `pnpm vitest run` passes 57/57 (up from 43 before this plan) with no regressions
- Re-ran all acceptance criteria from both tasks: model names, `MatterStatus` (7 values, correct order), `ExpenseCategoryCode` (21 values), zero `Cascade`/`Decimal`/`Float`, `finalAmount: Int?` with no default, every `@relation` names `onDelete: Restrict` (Prisma forbids the attribute on the non-owning back-relation side — confirmed all 11 FK-owning relations carry it), `.env.example` declares both connection strings, `docker-compose.yml` declares one `postgres:17` service — all PASS
