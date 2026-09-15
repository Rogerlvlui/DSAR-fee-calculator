---
phase: 01-schemas-freeze-and-walking-skeleton
verified: 2026-09-15T08:00:00Z
status: gaps_found
gap_status: closed
gap_closed_at: 2026-09-15T08:15:00Z
score: 8/9 must-haves verified
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
covered_digest: "v1:sha256:1af50b02cea595d29ea758c2581f99acf6ca332740e0514f158d4704a02d22e1"
overrides_applied: 0
gaps:
  - truth: "A downstream package can import Matter, ExpenseLine, RulePack, Assessment, AssessmentLine, AuditEvent and MatterStatus and compile without redefining a field (ROADMAP Phase 1 Success Criterion 1)"
    status: fixed
    fixed_at: 2026-09-15T08:15:00Z
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
      count is 175 (173 + 2 new).
    status_was: failed
    reason: "packages/schemas ships a wildcard subpath exports map (\"./*\": \"./src/*.ts\") with no built declaration output — every module imports its siblings with an explicit .ts extension. Consuming that from any other package requires the consumer's own tsconfig to set `allowImportingTsExtensions: true`. That flag exists on packages/schemas/tsconfig.json and tests/tsconfig.json (added during this same phase's WR-01 fix) but was never added to tsconfig.base.json or to packages/engine/tsconfig.json — the one package that exists specifically so a downstream consumer of the freeze has somewhere to compile against it. A real import of any frozen type into packages/engine, compiled with the project's own `pnpm run typecheck` (tsc --build tsconfig.json), fails with TS5097 on every packages/schemas module the import graph touches."
    artifacts:
      - path: "packages/engine/tsconfig.json"
        issue: "Missing `allowImportingTsExtensions: true` (or equivalent project-reference wiring to packages/schemas), so importing any @dsar/schemas subpath from packages/engine fails tsc --build with TS5097"
      - path: "tsconfig.base.json"
        issue: "Does not declare `allowImportingTsExtensions`, so every future package that imports from packages/schemas must remember to add the flag itself individually, as packages/schemas and tests/ already had to"
    missing:
      - "Add `allowImportingTsExtensions: true` to tsconfig.base.json (or individually to every current and future consumer's tsconfig) so a real cross-package import of a frozen type compiles under the project's own tsc --build command"
      - "A regression test or CI step that actually imports a frozen type from packages/engine (or another consumer) and typechecks it, so this class of gap cannot reappear silently — nothing in the current suite exercises a real cross-package import of packages/schemas"
---

# Phase 1: Schemas Freeze and Walking Skeleton Verification Report

**Phase Goal:** Every core type is frozen so nothing downstream has to re-open it, and the data model is authored and validated ready for the database boundary in Phase 3.2
**Verified:** 2026-09-15
**Status:** gaps_found
**Re-verification:** No — initial verification

## Scope Note

Per the phase's mid-flight re-scope (2026-09-14), this verification checks the six non-Docker plans (01-01, 01-02, 01-03, 01-05, 01-06, 01-07) against the *current* ROADMAP.md Phase 1 entry. ACCESS-01, ACCESS-06, ACCESS-08, BOUND-01 and AUDIT-02, the walking-skeleton routes, the `SIGNED_OFF` immutability trigger, and any applied migration are Phase 3.2's and are correctly absent here — their absence is not treated as a gap.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A downstream package can import `Matter`, `ExpenseLine`, `RulePack`, `Assessment`, `AssessmentLine`, `AuditEvent` and the seven-value `MatterStatus`, and compile without redefining a field; the frozen `RulePack` already carries the HK flat-fee extension | ✗ FAILED (partial) | All six types plus `MatterStatus` are present, correctly shaped, and every field lines up with the PRD and with `prisma/schema.prisma`. But a real cross-package import from `packages/engine` — the package that exists precisely to be this freeze's first downstream consumer — fails to compile under the project's own `pnpm run typecheck` (`tsc --build tsconfig.json`) with `TS5097`, because `packages/schemas`'s subpath-exports-to-source design requires `allowImportingTsExtensions: true` in every consumer's tsconfig and that flag was never propagated to `packages/engine` or to the shared `tsconfig.base.json`. Reproduced directly (see "Downstream Compile Probe" below) and the fix (adding the one compiler flag) was verified to resolve it completely. The `flatFee` extension itself is correctly optional and proven, by test, to leave the other eight packs' JSON unchanged. |
| 2 | Money cannot go wrong silently: AC-07a lint fires inside `packages/engine`/`packages/schemas`, a 10,000-case property test shows every money field of a returned `Assessment` is an integer, and formatting the same integer as JPY and SGD gives zero and two decimal places respectively | ✓ VERIFIED | `pnpm vitest run --project toolchain` (8/8 pass, including the lint-rule and purity-gate falsification tests); `packages/schemas/src/assessment.property.test.ts` runs `numRuns: 10000` with a recorded seed `20260915` (`pnpm vitest run --project schemas` — 151/151 pass); `MINOR_UNIT_DECIMALS.JPY === 0`, `.SGD === 2` confirmed directly in `packages/schemas/src/money.ts`, exercised by `money.test.ts` |
| 3 | All six core entities plus `User` are authored in `prisma/schema.prisma` with native enums and no cascading deletes, the schema validates, and the client generates — none of which needs a running database | ✓ VERIFIED | `pnpm exec prisma validate` → "is valid" (exit 0); `pnpm exec prisma generate` → "Generated Prisma Client (7.10.0)" (exit 0), both run with no `DATABASE_URL`/Docker present; `grep -c 'Cascade\|Decimal\|Float' prisma/schema.prisma` → 0 for each; 11/11 relations carry `onDelete: Restrict` |
| 4 | No Prisma field name matches the personal-data deny-list (via `getDMMF()`), and the DOM half is proven non-vacuous by a canary rather than passing vacuously with no form yet | ✓ VERIFIED | `pnpm vitest run --project boundary` — 14/14 pass, including `prisma-field-denylist.test.ts` (via `@prisma/internals` `getDMMF`, confirmed by source read — not the runtime client) and `dom-denylist.test.ts`'s canary case (a full-width-character deny-listed fixture, confirmed caught) |
| 5 | Cross-field invariants hold: a `Matter` whose `currency` isn't its jurisdiction's designated currency fails zod naming both codes (AC-42 layer 1), and `MatterStatus` is a closed set of seven | ✓ VERIFIED | `packages/schemas/src/matter.ts`'s `.superRefine()` confirmed by direct read (issue message names both codes, `path: ['currency']`); `MATTER_STATUSES` / Postgres `enum MatterStatus` both hold exactly `DRAFT, COMPUTING, LEGAL_REVIEW, INFO_REQUEST, SIGNED_OFF, CLOSED, SUPERSEDED` in identical order (confirmed by direct diff of both sources) |

**Score:** 4/5 ROADMAP success criteria fully verified; 1 partially verified with a demonstrated gap (see below).

### Downstream Compile Probe (falsifies Truth 1)

This is the specific check the task brief asked to weight heavily ("packages/engine exists and is nearly empty; it should be able to import the core types and compile"). It was run directly, not inferred from a SUMMARY claim:

1. Added a temporary file `packages/engine/src/__verify_probe.ts` importing `Matter` (from `@dsar/schemas/matter`), `Assessment`/`AssessmentLine` (from `@dsar/schemas/assessment`), `ExpenseLine` (from `@dsar/schemas/expense-line`), `RulePack` (from `@dsar/schemas/rule-pack`), `AuditEvent` (from `@dsar/schemas/audit-event`) and `MATTER_STATUSES` (from `@dsar/schemas/matter-status`).
2. Ran the project's own gate: `pnpm run typecheck` (`tsc --build tsconfig.json`).
3. Result: **non-zero exit**, 15 `TS5097` errors — `An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled` — against `packages/schemas/src/{assessment,audit-event,expense-line,matter,rule-pack}.ts`, because those modules use `.ts`-suffixed relative imports internally and `packages/engine/tsconfig.json` does not set `allowImportingTsExtensions`.
4. Confirmed the exact fix: adding `"allowImportingTsExtensions": true` to `packages/engine/tsconfig.json` alone made the same probe compile cleanly (`pnpm run typecheck` exit 0).
5. Reverted both the probe file and the tsconfig edit; `git diff --stat packages/engine/` is empty and the full suite (`pnpm vitest run`, 173/173) and `pnpm run typecheck` both pass exactly as before the probe.

This is not a hypothetical: it is the literal first thing that happens the moment Phase 2 writes `import { ... } from "@dsar/schemas/..."` inside `packages/engine`, which is exactly what Phase 2's `assess()` must do on day one. Nothing in this phase's test suite exercises a real cross-package import of `packages/schemas`, so the gap was invisible to every gate that ran during execution.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/schemas/src/{primitives,money,matter-status,taxonomy,constants,matter,expense-line,audit-event,condition,rule-pack,assessment,guard-input,json-schema}.ts` | Frozen zod modules per PRD §6/§7.2/§8.1 | ✓ VERIFIED | All 13 present, `pnpm tsc --noEmit -p packages/schemas` clean, 151/151 `schemas` project tests pass |
| `prisma/schema.prisma` | All six entities + User, native enums, no cascades | ✓ VERIFIED | `prisma validate`/`generate` both exit 0; enums verified byte-for-byte against zod tuples |
| `.dependency-cruiser.cjs` / `eslint.config.js` | Purity + money-branding gates | ✓ VERIFIED | Both fire on their own falsification fixtures (`purity-gate.test.ts`, `lint-money-brand.test.ts`), confirmed passing in the toolchain project |
| `tsconfig.json` (root) + `packages/*/tsconfig.json` | Real `tsc --build` gate (WR-01 fix) | ⚠️ PARTIAL | The gate itself is real (verified by injecting and reverting a genuine type error — see below) but `packages/engine/tsconfig.json` is missing the flag needed to actually typecheck an import of `@dsar/schemas` — see Downstream Compile Probe above |
| `packages/schemas/schema/*.schema.json` (3 files) | Committed JSON Schema, money as `integer` | ✓ VERIFIED | 3 files present; `engineAmount`/`claimedTotal` etc. typed `"integer"` with the WR-03 bounds `[-2147483648, 2147483647]`; drift test passes |
| `packages/schemas/FREEZE.md` | D-09/D-10 policy, all 12 modules named | ✓ VERIFIED | All 12 module names present; states additive-only rule, escalation path, and both post-freeze amendments (WR-02, WR-03) |
| `tests/boundary/denylist-scanner.ts` + both AC-06 tests + canary | Non-vacuous personal-data scan | ✓ VERIFIED | NFKC-normalize + word-boundary matching confirmed by source read; canary and Prisma-model-count assertions both present and passing |

### Gate Falsification (Step 7b-style spot checks, run directly)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `pnpm run typecheck` is a real, non-vacuous gate | Injected `const x: number = 'not a number'` into `packages/schemas/src/money.ts`, ran `pnpm run typecheck`, reverted | Non-zero exit, named the file and line; after revert, exit 0 | ✓ PASS |
| AC-07a money-branding lint rule fires | `pnpm vitest run --project toolchain` (includes `lint-money-brand.test.ts`) | 8/8 pass (fires on 5 bad fixtures, silent on 3 look-alikes) | ✓ PASS |
| dependency-cruiser purity gate fires | `pnpm vitest run --project toolchain` (includes `purity-gate.test.ts`); `pnpm run depcruise` | 8/8 pass; "no dependency violations found (34 modules, 68 dependencies)" | ✓ PASS |
| `Assessment` can express PRD §14's reference fixture exactly | Ad hoc probe test parsing `claimedTotal 88800 / draftBaseline 26640 / disallowedTotal 12660 / flaggedTotal 49500 / restingOnUnverifiedRules 10640 / finalAmount null` (minor units) through `AssessmentSchema` | Parsed successfully; `finalAmount` round-trips as `null`; reconciliation `26640+12660+49500=88800` holds | ✓ PASS |
| `AuditEventType` enum matches the zod tuple member-for-member | Direct diff of `prisma/schema.prisma`'s `enum AuditEventType` (17 values) against `AuditEventTypeSchema` in `primitives.ts` | Identical 17 values, identical order | ✓ PASS |
| `MatterStatus` enum matches the zod tuple member-for-member | Direct diff of `prisma/schema.prisma`'s `enum MatterStatus` against `MATTER_STATUSES` | Identical 7 values, identical order | ✓ PASS |
| Downstream compile (`packages/engine` importing `@dsar/schemas`) | See "Downstream Compile Probe" above | **Fails** with TS5097 as currently configured | ✗ FAIL (the phase's one open gap) |

### Requirements Coverage

| Requirement | Description (abridged) | Status | Evidence |
|-------------|-------------------------|--------|----------|
| SCHEMA-01 | Every core type defined as a zod schema with inferred TS type | ✓ SATISFIED | All six entities + primitives present and compiling within `packages/schemas`; see Downstream Compile Probe for the separate cross-package caveat, which does not falsify SCHEMA-01's own wording (definition, not downstream consumption) |
| SCHEMA-02 | Branded `Minor`, lint rule rejects bare `number` for money-suffixed identifiers | ✓ SATISFIED | Falsification test passes (8/8 toolchain); `MinorSchema` bounded and branded |
| SCHEMA-03 | `MINOR_UNIT_DECIMALS` map, currency-aware formatting | ✓ SATISFIED | JPY/KRW/VND = 0, others = 2, confirmed in source and by test |
| SCHEMA-04 | `JURISDICTION_CURRENCY` nine-entry map; matter currency must equal jurisdiction's | ✓ SATISFIED (schema layer; DB layer is Phase 3.2) | Nine entries confirmed; `.superRefine()` confirmed enforcing the match |
| SCHEMA-05 | JSON Schema generated for LLM boundary | ✓ SATISFIED | Native `z.toJSONSchema()`, 3 committed artifacts, money typed `integer`, drift test passes |
| SCHEMA-06 | `GuardInput` structurally excludes advisory deadline fields | ✓ SATISFIED | Literal type (no `Omit`/`Pick`), 11 members, `@ts-expect-error` fixture confirmed satisfied by `tsc --build` passing cleanly |
| SCHEMA-07 | 10,000-run property test, every money field an integer | ✓ SATISFIED | `assessment.property.test.ts`, `numRuns: 10000`, recorded seed `20260915`, passing |
| STATE-01 | `MatterStatus` closed set of seven, no other value anywhere | ✓ SATISFIED (schema + Prisma-enum layer; DB CHECK/constraint enforcement beyond the enum type is Phase 3.2's) | Confirmed identical 7-value tuple in zod and Postgres enum |
| BOUND-02 | No Prisma field / form input matches the personal-data deny-list | ✓ SATISFIED | `getDMMF()`-based scan + DOM canary both pass; word-boundary matching avoids the `fin`/`finalAmount` false positive documented in 01-03-SUMMARY.md |

No orphaned requirements found: `.planning/REQUIREMENTS.md`'s Phase-1 rows (SCHEMA-01..07, STATE-01, BOUND-02) all appear in at least one plan's `requirements` frontmatter.

### Anti-Patterns Found

None. No `TODO`/`FIXME`/`HACK`/`PLACEHOLDER`/`TBD`/`XXX` markers found in any file this phase modified. No `.passthrough()`/`.catchall()`/stray `z.string()` where an enum belongs (confirmed by the 01-REVIEW.md pass and spot-checked again here for `CONDITION_FIELDS`, `AUDIT_PAYLOAD_KEYS`, `EXPENSE_CATEGORY_CODES`). All three 01-REVIEW.md Warnings (WR-01, WR-02, WR-03) are confirmed genuinely fixed in the current tree (not merely marked resolved in prose) — each was independently re-verified above (WR-01: real typecheck gate; WR-02: native `AuditEventType` enum; WR-03: bounded `Minor`/`quantity`). IN-01 remains open by explicit, recorded decision (negative `Minor` values deferred to Phase 2's `assess()`), which is a documented scope choice, not an unaddressed defect.

### Human Verification Required

None. Every truth in this phase is either a structural/schema-level property (verifiable by direct read, `tsc`, or a parse test) or a static gate (verifiable by triggering it). Nothing in this phase renders UI or depends on runtime/visual judgment.

### Gaps Summary

One gap, scoped narrowly: `packages/engine`'s `tsconfig.json` (and the shared `tsconfig.base.json`) never received the `allowImportingTsExtensions` compiler flag that `packages/schemas`'s own subpath-exports-to-source design requires of every consumer. This was added ad hoc to `packages/schemas/tsconfig.json` and `tests/tsconfig.json` during the WR-01 fix, but not propagated to the one package whose entire purpose in this phase is to be the freeze's first downstream consumer. The result: a real import of any frozen type into `packages/engine`, checked with the project's own `pnpm run typecheck`, fails to compile. This directly falsifies ROADMAP Phase 1 Success Criterion 1's "a downstream package can import ... and compile" — not because a field is wrong or missing, but because the build configuration that would let a consumer actually use the freeze was never finished.

The fix is small and does not touch any frozen field: add `"allowImportingTsExtensions": true` to `tsconfig.base.json` (so every current and future package inherits it, matching the pattern already applied twice — to `packages/schemas` and to `tests/`) or to `packages/engine/tsconfig.json` specifically. Recommend also adding a regression check — a real cross-package import compiled as part of the test suite — so this class of gap cannot reappear silently the way it did here (every gate in this phase passed while this was broken, because nothing exercised a real cross-package import until this verification did).

Everything else checked — the six entity types, the closed sets (`MatterStatus` 7, `ExpenseCategoryCode` 21, `CONDITION_FIELDS` 15 with its `satisfies` clause, `AUDIT_PAYLOAD_KEYS` 5, Prisma `AuditEventType` 17), the PRD §14 reference fixture's expressibility, all three static gates (money-branding lint, dependency-cruiser purity, `tsc --build`), and the Prisma/zod field alignment — verified directly against the codebase and holds.

### Gap Resolution (2026-09-15, post-verification fix)

The single open gap above is closed. Four causes were diagnosed and addressed:

1. **No workspace dependency.** `packages/engine/package.json` declared no `dependencies` at all, so `@dsar/schemas` was never linked into `packages/engine/node_modules`. Fixed by adding `"@dsar/schemas": "workspace:*"` to `packages/engine/package.json` and running `pnpm install`. Confirmed the symlink now exists at `packages/engine/node_modules/@dsar/schemas`.
2. **`allowImportingTsExtensions` not inherited.** Moved the flag out of `packages/schemas/tsconfig.json` and `tests/tsconfig.json` (where it was added ad hoc during the WR-01 fix) and into the shared `tsconfig.base.json`, so every current and future consumer (`packages/rulepacks` in Phase 3, `apps/web` in Phase 3.1, `packages/agent` in Phase 8) inherits it automatically rather than needing to remember it individually.
3. **No project reference — investigated, deliberately not added.** The gap's stated Cause 3 asked for a `references` entry from `packages/engine/tsconfig.json` to `packages/schemas`. This was attempted and reverted: adding `"references": [{ "path": "../schemas" }]` produces `TS6310: Referenced project '...packages/schemas' may not disable emit`, because `packages/schemas` inherits `noEmit: true` from `tsconfig.base.json` by design — it ships raw `.ts` source through its subpath-exports map (`"./*": "./src/*.ts"`) and has no built `dist/` output for anything to consume. Forcing emit to satisfy a project-reference edge would produce declaration files nothing uses, contradicting the source-only architecture this freeze already established for two other consumers. Verified directly that `tsc --build tsconfig.json` already type-checks and orders the cross-package import correctly without this edge: a deliberately-wrong probe (`const bogus: Matter = "not a matter"`) inside `packages/engine/src` produced a real `TS2322` naming `Matter`'s actual field shape, proving the check is genuine and not silently skipped; reverting the probe restored a clean build. No further action taken on this cause; recorded here rather than silently doing the narrow fix, per this task's instructions.
4. **No test exercised a real cross-package import.** Added `packages/engine/src/schemas-boundary.test.ts` — a permanent test that imports `Matter`, `Assessment`, `AssessmentLine`, `ExpenseLine`, `RulePack` and `AuditEvent` (type-only) plus `MATTER_STATUSES` (runtime) from `@dsar/schemas`, through its real subpath-exports map (never a relative path that would sidestep it). Registered a new `"engine"` project in `vitest.config.ts` so the test runs under `pnpm vitest run`. The type-only imports are checked by `pnpm run typecheck`; the runtime import is asserted by a vitest test. Either regressing (workspace dependency, `allowImportingTsExtensions`, or the exports map itself) now fails a gate.

**Gate evidence (fresh build, tsbuildinfo cleared first):**
- `pnpm run typecheck` (`tsc --build tsconfig.json`) — exit 0
- `pnpm vitest run` — 19 test files, **175 passed** (173 pre-existing + 2 new in `schemas-boundary.test.ts`)
- `pnpm run lint` (`eslint .`) — exit 0
- `pnpm run depcruise` — "no dependency violations found (36 modules, 70 dependencies cruised)" (up from 34/68 pre-fix; no new violations — a type-only cross-package import does not trip the purity boundary)
- `pnpm run db:validate` (`prisma validate`) — "The schema at prisma\schema.prisma is valid" (untouched — no frozen schema or Prisma model was changed)

Files changed: `tsconfig.base.json`, `packages/engine/package.json`, `packages/schemas/tsconfig.json`, `tests/tsconfig.json`, `vitest.config.ts`, `pnpm-lock.yaml` (relink), plus the new `packages/engine/src/schemas-boundary.test.ts`. `packages/engine/tsconfig.json` and `packages/schemas`'s frozen zod modules are unchanged.

---

_Verified: 2026-09-15_
_Verifier: Claude (gsd-verifier)_
_Gap closed: 2026-09-15 (fix(01) commit — see git log)_
