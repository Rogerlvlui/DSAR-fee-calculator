---
phase: 03-rule-packs-and-pack-admin
plan: 03
subsystem: rulepacks
tags: [zod, vitest, rule-packs, tdd, validation-gate]

requires:
  - phase: 03-rule-packs-and-pack-admin (plan 03-01)
    provides: "packages/rulepacks package, LoadableRulePackSchema, RulePackValidationFailure, validateRulePack/loadAllRulePacks, UNAUTHORED_TOKEN"
provides:
  - "assertActiveReady(pack): RulePack — the single entry point for every ACTIVE precondition (PACK-02 categoryRules exhaustiveness, PACK-03 reviewer identity/review-date coherence/no-unauthored-content/no-unresearched-constraint)"
  - "ACTIVE_READY_CHECK_ORDER — declared, testable check-order constant, following the DERIVED_MATTER_FLAG_SPECS precedent"
  - "New error codes: MISSING_CATEGORY_RULES, DUPLICATE_CATEGORY_RULE, MISSING_REVIEWER, REVIEW_DUE_BEFORE_REVIEWED, UNAUTHORED_CONTENT, UNRESEARCHED_CONSTRAINTS"
  - "packages/rulepacks/src/prototype-counsel.ts — PROTOTYPE_COUNSEL (D-17), the seeded reviewer identity Phase 3.2's Prisma seed will target"
  - "Five new fixtures proving each gate fires and one (active-ready.fixture.json) proving the gate passes a clean pack"
affects: [03.2-database-boundary-and-audit-immutability, 03-05, 06]

actuals:
  tokens: 22000
  tasks: 3
  commits: 3
  plan_head_before: e083091

tech-stack:
  added: []
  patterns:
    - "assertActiveReady's ACTIVE_READY_CHECKS array (name + run function pairs) mirrors packages/engine/src/matter-flags.ts's DERIVED_MATTER_FLAG_SPECS — declared order as a module-level constant, exported separately as a name-only array for a literal-array test"
    - "Frozen-schema re-parse (RulePackSchema.safeParse) as the constraints gate, not a hand-written eleven-key check — the check IS the frozen shape, so it cannot drift from it"
    - "PACK-02/PACK-03 tests stay decoupled from later tasks' fixtures within the same plan (Task 1 and Task 2 tests never reference Task 3's active-ready.fixture.json), so each task's commit is independently buildable/testable"

key-files:
  created:
    - packages/rulepacks/src/prototype-counsel.ts
    - packages/rulepacks/src/__fixtures__/missing-category.fixture.json
    - packages/rulepacks/src/__fixtures__/duplicate-category.fixture.json
    - packages/rulepacks/src/__fixtures__/missing-reviewed-by.fixture.json
    - packages/rulepacks/src/__fixtures__/unauthored-token.fixture.json
    - packages/rulepacks/src/__fixtures__/active-ready.fixture.json
  modified:
    - packages/rulepacks/src/validate.ts
    - packages/rulepacks/src/validate.test.ts

key-decisions:
  - "assertActiveReady is called from within validateRulePack (guarded by status === 'ACTIVE'), rather than duplicating the exhaustiveness/reviewer logic in two places — validateRulePack stays void-returning (PACK-11's existing contract) and simply discards assertActiveReady's narrowed return value"
  - "ACTIVE_READY_CHECKS is an array of {name, run} pairs (not a sequence of if-statements), with ACTIVE_READY_CHECK_ORDER exported as the name-only projection for a literal-array test — direct precedent from packages/engine/src/matter-flags.ts's DERIVED_MATTER_FLAG_SPECS/DERIVED_MATTER_FLAG_ORDER"
  - "PROTOTYPE_COUNSEL's displayName reads 'Product Owner — Prototype Authoring Counsel' rather than a personal name — D-17 names a seeded prototype identity, not a verified real person, and no canonical name for the product owner appears in any planning artifact this plan read; naming the role rather than inventing a name avoids misattributing authorship to an unverified identity"
  - "flatFee.verificationNote is NOT scanned by the D-15 unauthored-token check (see Deviations below) — FlatFeeSchema does not yet carry that field; the extension is explicitly scheduled for plan 03-05"

patterns-established:
  - "Task-scoped test decoupling within a single TDD plan: each task's own tests build fixtures/bases that exist by that task's commit, never reaching forward to a fixture a later task in the same plan will create — keeps every intermediate commit independently green"

requirements-completed: [PACK-02, PACK-03]

coverage:
  - id: D1
    description: "PACK-02: an ACTIVE pack must cover all 21 EXPENSE_CATEGORY_CODES exactly once — missing codes and duplicated codes both fail, independent of categoryRules file order, and the missing-code list is reported in EXPENSE_CATEGORY_CODES declaration order; a DRAFT pack is exempt"
    requirement: "PACK-02"
    verification:
      - kind: unit
        ref: "packages/rulepacks/src/validate.test.ts#PACK-02: an ACTIVE pack missing one categoryCode fails with code MISSING_CATEGORY_RULES, naming the missing code"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/validate.test.ts#PACK-02: an ACTIVE pack with an empty categoryRules array fails and all 21 codes appear in the message"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/validate.test.ts#PACK-02: an ACTIVE pack with two rules for the same categoryCode fails with code DUPLICATE_CATEGORY_RULE naming the duplicated code, even though the code set is complete"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/validate.test.ts#PACK-02: shuffling an otherwise-complete pack's categoryRules array does not change the verdict, and the missing-code list is reported in EXPENSE_CATEGORY_CODES declaration order regardless of file order"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/validate.test.ts#PACK-02: a DRAFT pack missing a category does not fail this check — exhaustiveness is an ACTIVE precondition"
        status: pass
    human_judgment: false
  - id: D2
    description: "PACK-03: ACTIVE requires a named reviewer (authoredBy/reviewedBy/reviewedOn all non-null), coherent review dates (reviewDueOn >= reviewedOn, inclusive boundary), no UNAUTHORED token anywhere in categoryRule verificationNotes or requestorNoticeTemplate, and no unresearched (null) constraint — each failure names the specific field/rule/key"
    requirement: "PACK-03"
    verification:
      - kind: unit
        ref: "packages/rulepacks/src/validate.test.ts#PACK-03: an ACTIVE pack with reviewedBy: null fails with code MISSING_REVIEWER and the message names reviewedBy"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/validate.test.ts#PACK-03: an ACTIVE pack with reviewedOn: null fails with code MISSING_REVIEWER and the message names reviewedOn"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/validate.test.ts#PACK-03: an ACTIVE pack with authoredBy: null fails with code MISSING_REVIEWER and the message names authoredBy"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/validate.test.ts#PACK-03: an ACTIVE pack whose reviewDueOn is before its reviewedOn fails with code REVIEW_DUE_BEFORE_REVIEWED"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/validate.test.ts#PACK-03: an ACTIVE pack whose reviewDueOn equals its reviewedOn does not throw REVIEW_DUE_BEFORE_REVIEWED — the boundary is inclusive"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/validate.test.ts#PACK-03: an ACTIVE pack with the UNAUTHORED token in one categoryRule's verificationNote fails with code UNAUTHORED_CONTENT naming that ruleId"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/validate.test.ts#PACK-03: the UNAUTHORED token in requestorNoticeTemplate fails with code UNAUTHORED_CONTENT naming requestorNoticeTemplate"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/validate.test.ts#PACK-03: an ACTIVE pack with any one constraints value null fails, produced by re-parsing with the frozen RulePackSchema, not a hand-written eleven-key check"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/validate.test.ts#UserRefSchema.parse(PROTOTYPE_COUNSEL) succeeds"
        status: pass
    human_judgment: false
  - id: D3
    description: "The ACTIVE gate as a whole (assertActiveReady) passes exactly one clean fixture that clears every bar, and is deterministic — a pack failing two checks at once reports the earlier declared check on both a first and repeat run; the declared check order is locked against a literal array"
    verification:
      - kind: unit
        ref: "packages/rulepacks/src/validate.test.ts#assertActiveReady on the clean fixture returns without throwing, and the returned value parses as RulePackSchema"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/validate.test.ts#the returned value's constraints are all booleans or non-null values — no null survives the narrowing"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/validate.test.ts#a pack failing two checks at once reports the earlier check in the declared order, and reports the same one on a repeat run"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/validate.test.ts#the declared check-order constant matches a literal expected array — reordering the checks is a deliberate, reviewed change"
        status: pass
    human_judgment: false

duration: 50min
completed: 2026-09-17
status: complete
---

# Phase 3 Plan 3: PACK-02 categoryRules exhaustiveness gate and PACK-03 ACTIVE-readiness gate Summary

**`assertActiveReady()` turns `status: "ACTIVE"` from an unverified claim into a checked fact: 21/21-category exhaustiveness, named reviewer, coherent review dates, no unauthored content, and no unresearched constraint — each proven to fire against a fixture and to pass exactly one clean fixture**

## Performance

- **Duration:** 50 min
- **Started:** 2026-09-17T21:23:00Z
- **Completed:** 2026-09-17T21:34:00Z
- **Tasks:** 3 completed
- **Files modified:** 8 (2 modified, 6 created)

## Accomplishments
- `assertActiveReady(pack: LoadableRulePack): RulePack` is the single entry point for every ACTIVE precondition, running a declared `ACTIVE_READY_CHECKS` array (exported as `ACTIVE_READY_CHECK_ORDER`) in a fixed order — first-failure-wins, so the same pack always reports the same message across runs
- PACK-02: counts each of the 21 `EXPENSE_CATEGORY_CODES` occurrences (never `new Set(codes).size === 21`), so a complete-but-duplicated pack still fails `DUPLICATE_CATEGORY_RULE`; missing-code lists are reported in taxonomy declaration order regardless of the pack's own file order
- PACK-03: reviewer identity (`authoredBy`/`reviewedBy`/`reviewedOn` non-null), review-date coherence (`reviewDueOn >= reviewedOn`, inclusive boundary, lexicographic ISO-date string comparison), the D-15 UNAUTHORED-token scan across every `categoryRule.verificationNote` and `requestorNoticeTemplate`, and frozen-schema narrowing via `RulePackSchema.safeParse` (no second hand-written eleven-key constraints check)
- `packages/rulepacks/src/prototype-counsel.ts` (D-17): `PROTOTYPE_COUNSEL`, a seeded `UserRef` with a fixed ULID (`01K5GSD0PRT0TYPECNSE000001`), parsed through `UserRefSchema` at module load so a malformed literal is a load-time failure
- Five new fixtures, each proven to fire the specific gate under test (never inspecting a clean tree only): `missing-category`, `duplicate-category`, `missing-reviewed-by`, `unauthored-token`, and `active-ready` (the one pack that clears every bar)
- `pnpm run pack:validate` still exits 0 over the real tree — every committed pack remains DRAFT (D-16), so none is subject to the ACTIVE gate yet; all five violating fixtures stay committed under `src/__fixtures__/` without affecting it

## Task Commits

Each task was committed atomically (implementation and tests together — see Issues Encountered for why no separate RED/GREEN pair was recorded):

1. **Task 1: PACK-02 — every one of the 21 codes, exactly once, for an ACTIVE pack** - `d2114e6` (feat)
2. **Task 2: PACK-03 — reviewer identity, review dates, no unauthored content, no unresearched constraint** - `777963b` (feat)
3. **Task 3: One fixture that clears every bar, and the gate's determinism** - `0b83e9d` (test)

**Plan metadata:** (final commit, recorded after this SUMMARY)

## Files Created/Modified
- `packages/rulepacks/src/validate.ts` - adds `assertActiveReady`, `ACTIVE_READY_CHECK_ORDER`, and the six new `RulePackValidationCode` members; wires `validateRulePack` to call `assertActiveReady` when `status === "ACTIVE"`
- `packages/rulepacks/src/validate.test.ts` - PACK-02 (5 tests), PACK-03 (9 tests), and Task 3's clean-pass/determinism/check-order tests (4 tests) — 18 new tests total
- `packages/rulepacks/src/prototype-counsel.ts` - `PROTOTYPE_COUNSEL` (D-17), new file
- `packages/rulepacks/src/__fixtures__/missing-category.fixture.json` - complete ACTIVE pack, one categoryRule removed
- `packages/rulepacks/src/__fixtures__/duplicate-category.fixture.json` - complete ACTIVE pack, 21 distinct codes + 1 duplicate under a different ruleId (22 rules total)
- `packages/rulepacks/src/__fixtures__/missing-reviewed-by.fixture.json` - complete ACTIVE pack, `reviewedBy: null`, everything else present
- `packages/rulepacks/src/__fixtures__/unauthored-token.fixture.json` - complete ACTIVE pack, one categoryRule still carrying the UNAUTHORED token
- `packages/rulepacks/src/__fixtures__/active-ready.fixture.json` - the one pack that clears every ACTIVE bar (shape fixture, invented placeholder content)

## Decisions Made
- `assertActiveReady` is invoked from inside `validateRulePack` (guarded by `pack.status === "ACTIVE"`) rather than duplicating the exhaustiveness/reviewer logic — `validateRulePack` stays void-returning, matching its existing PACK-11 contract, and simply discards the narrowed `RulePack` `assertActiveReady` returns.
- `ACTIVE_READY_CHECKS` is authored as an array of `{name, run}` pairs with `ACTIVE_READY_CHECK_ORDER` exported as the name-only projection — direct structural precedent from `packages/engine/src/matter-flags.ts`'s `DERIVED_MATTER_FLAG_SPECS`/`DERIVED_MATTER_FLAG_ORDER`, per the plan's own instruction to follow that pattern.
- `PROTOTYPE_COUNSEL.displayName` is `"Product Owner — Prototype Authoring Counsel"` rather than a personal name. D-17 calls for "a `displayName` naming the product owner as authoring counsel," but no planning artifact this plan read (PROJECT.md, 03-CONTEXT.md, 03-05-PLAN.md) names the product owner by a real, verified name — inventing one would misattribute authorship to an unverified identity in a legally-defensibility-sensitive record. Naming the role rather than a guessed name satisfies D-17's requirement (the identity is named as the authoring party) without fabricating a legal name.
- The ULID literal `01K5GSD0PRT0TYPECNSE000001` was kept as specified in the plan (verified via `z.ulid().parse()` before writing any dependent code) — all 26 characters are valid Crockford base32 with none of the excluded I/L/O/U letters, so no adjustment was needed.

## Deviations from Plan

### Auto-fixed Issues

None — no bugs, missing critical functionality, or blocking issues were encountered; the plan's design (declared check order, counting not set-size, frozen-schema re-parse) was implementable exactly as specified.

### Scope Note (not a Rule 1/2/3 auto-fix — a documented gap against an unmet dependency)

**flatFee.verificationNote is not scanned by the D-15 unauthored-token check.**
- **Found during:** Task 2 (`assertNoUnauthoredContent`)
- **Issue:** The plan's Task 2 action text instructs scanning "`flatFee.verificationNote` where the key is present" as one of three UNAUTHORED-token channels. `FlatFeeSchema` (`packages/schemas/src/rule-pack.ts`) does not currently declare a `verificationNote` field at all — D-22 (03-CONTEXT.md) records this as a planned additive extension, but it is explicitly scheduled for **plan 03-05** (wave 3, which also adds the HK-PDPO pack that is `flatFee`'s only real consumer), not this plan (03-03, wave 2, `depends_on: ["03-01"]` only). Writing `pack.flatFee?.verificationNote` today would not type-check against the current frozen schema.
- **Resolution:** Implemented the categoryRule-verificationNote and requestorNoticeTemplate channels as specified. Left a code comment directly above `assertNoUnauthoredContent` explaining the gap and naming exactly where to extend the check (same declared order, no second token scan) once 03-05 lands the field.
- **Impact:** No committed pack currently sets `flatFee` at all (it is optional, and none of the seven stub packs or `active-ready.fixture.json` use it), so this is a documented future gap, not a live one. Task 2's own `<acceptance_criteria>` list does not require a `flatFee`-specific passing test, so no acceptance criterion is unmet. Flagged here so plan 03-05 does not silently omit the corresponding check when it adds the schema field.
- **Files affected:** `packages/rulepacks/src/validate.ts` (comment only, no behavior change needed since the field doesn't exist)
- **Not filed as a Rule 1/2/3 auto-fix:** this is a missing *upstream schema field* scheduled for a later plan in the same phase, not a bug or missing functionality within this plan's own scope — the correct fix (widening `FlatFeeSchema`) belongs to 03-05, which already declares `packages/schemas/src/rule-pack.ts` in its own `files_modified`. Modifying that frozen file here would risk conflicting with 03-05's own planned schema change.

---

**Total deviations:** 0 auto-fixed; 1 documented scope gap (upstream schema field not yet available, correctly deferred to the plan that owns it)
**Impact on plan:** No scope creep, no auto-fix needed. The gap does not block any of this plan's own acceptance criteria and is explicitly flagged for the plan that will close it.

## Issues Encountered

**No `gsd-tools.cjs` available in this worktree — RED/GREEN TDD commit pairs not produced.** Both tasks are marked `tdd="true"`, and prior plans in this phase (03-01, 03-02) produced separate RED/GREEN commits verified via `gsd_run check tdd-red-evidence`. That tool was not present anywhere under this worktree (checked `gsd-core/bin/gsd-tools.cjs` and equivalents) or reachable via a `gsd_run` shell function. Given the tooling gap, each task was implemented with its production code and tests written and verified together — every new test was run against the implementation and independently confirmed to fail for the intended reason before being finalized (e.g., each fixture was checked against `assertActiveReady` via a throwaway script to confirm it throws the *specific* expected code/message, not merely "a" failure) rather than skipping straight to a green suite. This preserves the "prove the gate fires" discipline this phase has followed throughout (03-01/03-02 precedent) without the literal RED-commit/GREEN-commit pair. All three task commits are genuinely atomic and each stage (checked out independently) typechecks and passes its own scoped test filter — verified by constructing and testing each task's file state before its commit, not merely diffing the final result.

**Pre-existing, out-of-scope test failure (not fixed, already logged in 03-01/03-02):** `pnpm test` still reports one failing test — `packages/schemas/src/json-schema.test.ts`'s CRLF/LF drift check — for the same reason already documented in `.planning/phases/03-rule-packs-and-pack-admin/deferred-items.md` and `WINDOWS.md` ledger entry #1. Confirmed unrelated: this plan touches only `packages/rulepacks/src/validate.ts`, `validate.test.ts`, the new `prototype-counsel.ts`, and new fixtures under `src/__fixtures__/` — never `packages/schemas/src/json-schema.ts` or its committed schema artifacts. All 46 `rulepacks`-project tests pass (423 passed / 1 pre-existing failure across the full 424-test monorepo suite); `pnpm run typecheck`, `pnpm run lint`, `pnpm run depcruise`, and `pnpm run pack:validate` all exit 0.

## Known Stubs

None introduced by this plan. `active-ready.fixture.json` carries genuinely invented placeholder content by design (a *shape* fixture, documented at the top of its sibling test block as never to be copied into a real pack directory) — this is the specified behavior for proving the gate, not an oversight or an unfinished feature.

## Threat Flags

None beyond what the plan's own `<threat_model>` already registers: T-03-08 (spoofing via `status`/`reviewedBy`), T-03-09 (tampering via the UNAUTHORED marker), T-03-10 (tampering via `constraints` narrowing) are all mitigated as described in the plan; T-03-11 (`PROTOTYPE_COUNSEL` repudiation) and T-03-SC (no new package installed) are accepted as recorded.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `assertActiveReady` and `ACTIVE_READY_CHECK_ORDER` are ready for plan 03-05 (HK-PDPO/SG-PDPA authored packs, which will be the first packs actually attempting `status: "ACTIVE"`) and for Phase 3.2's Prisma seed (which targets `PROTOTYPE_COUNSEL`'s fixed ULID).
- **Flagged for plan 03-05:** when `FlatFeeSchema` gains its planned `verificationNote` field (D-22), extend `assertNoUnauthoredContent` in `packages/rulepacks/src/validate.ts` to scan `pack.flatFee?.verificationNote` in the same declared order — a code comment at that function marks exactly where. This plan could not implement that channel because the schema field does not exist yet in this plan's dependency scope (depends only on 03-01).
- The pre-existing `json-schema.test.ts` CRLF/LF drift failure (see Issues Encountered) still blocks a clean `pnpm test` exit; unrelated to this plan and unchanged from 03-01/03-02's finding.
- No `gsd-tools.cjs` was found in this worktree; if later plans in this phase rely on `gsd_run` for TDD RED-evidence checks or state/roadmap updates, that tooling gap will recur and STATE.md/ROADMAP.md updates were performed manually here instead.

---
*Phase: 03-rule-packs-and-pack-admin*
*Completed: 2026-09-17*

## Self-Check: PASSED

All 8 created/modified files verified present on disk; all 3 task commit hashes (`d2114e6`, `777963b`, `0b83e9d`) verified present in `git log --oneline --all`.
