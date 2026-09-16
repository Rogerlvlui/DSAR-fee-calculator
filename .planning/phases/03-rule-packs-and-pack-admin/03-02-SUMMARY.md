---
phase: 03-rule-packs-and-pack-admin
plan: 02
subsystem: rulepacks
tags: [zod, vitest, rule-packs, tdd, stub-generator]

requires:
  - phase: 03-rule-packs-and-pack-admin (plan 03-01)
    provides: "packages/rulepacks package, LoadableRulePackSchema, the D-19 stub generator (PACK_JURISDICTIONS/generateStubPack), UNAUTHORED_TOKEN, VN-PDPL as the first committed stub pack"
provides:
  - "Six more committed stub packs: AU-PRIVACY-ACT, NZ-PRIVACY-ACT, JP-APPI, KR-PIPA, CN-PIPL, IN-DPDP -- completing the seven-jurisdiction stub set alongside VN-PDPL"
  - "packages/rulepacks/src/stub-packs.test.ts: the whole-stub-set PACK-10 assertions (bidirectional table/directory equality, 147-rule literal total, ruleId uniqueness)"
affects: [03-03, 03-04, 03-05]

actuals:
  tokens: 31000
  tasks: 3
  commits: 6
  plan_head_before: 02ff751

tech-stack:
  added: []
  patterns:
    - "Deliberately-inverted RED assertion on a single representative test (.not.toBe(147)) when the underlying data is already correct from a prior task -- same pattern as 03-01's Task 2/3 RED phases, extended here to data-generation tasks (not just gate-logic tasks)"
    - "RED evidence for pack-loadability tasks uses a genuine (not inverted) failure: a test asserting a not-yet-committed packId is loadable fails honestly until the JSON file lands, no defect injection needed"

key-files:
  created:
    - packages/rulepacks/AU-PRIVACY-ACT/2026.09.1.json
    - packages/rulepacks/NZ-PRIVACY-ACT/2026.09.1.json
    - packages/rulepacks/JP-APPI/2026.09.1.json
    - packages/rulepacks/KR-PIPA/2026.09.1.json
    - packages/rulepacks/CN-PIPL/2026.09.1.json
    - packages/rulepacks/IN-DPDP/2026.09.1.json
    - packages/rulepacks/src/stub-packs.test.ts
  modified:
    - packages/rulepacks/src/stub-category-rules.ts
    - packages/rulepacks/src/stub-category-rules.test.ts

key-decisions:
  - "PD-3's appliesTo derivation applied per jurisdiction exactly as specified: AU/NZ exclude PUBLIC_AGENCY (PROHIBITED); JP/KR/CN/IN keep both controller types (NO_EXPRESS_AUTHORITY is not PROHIBITED)"
  - "JP and KR's unresearched PUBLIC_AGENCY posture set to NO_EXPRESS_AUTHORITY per CONTEXT.md Claude's Discretion item 4 (same convention as PRD §7.4's own stated HK default)"
  - "authoringNote text transcribed verbatim from PRD §7.4 with only ** and * markdown emphasis markers stripped; backticks (e.g. \`feePosture\`, \`PERCENT_OF_CLAIM: 100\`, \`reviewedOn\`) retained as literal characters since they are not emphasis markers"
  - "Task 3's RED phase used one deliberately-inverted assertion (the 147-total test) rather than corrupting a committed pack file, since all seven packs' data was already correct from Tasks 1/2 -- consistent with 03-01's precedent of not injecting production defects to manufacture RED"

patterns-established:
  - "Whole-stub-set assertions (stub-packs.test.ts) select packs by packKind === \"stub\", never by iterating the whole PACK_JURISDICTIONS table -- so plan 03-05's authored HK-PDPO/SG-PDPA rows cannot make these tests fail for the wrong reason"

requirements-completed: [PACK-10]

coverage:
  - id: D1
    description: "Seven jurisdiction stub packs (VN-PDPL from 03-01, plus AU-PRIVACY-ACT/NZ-PRIVACY-ACT/JP-APPI/KR-PIPA/CN-PIPL/IN-DPDP from this plan) are committed as literal repository JSON, each generated via generateStubPack() with no hand-edits, each DRAFT with 21 FLAG/NEEDS_VERIFICATION categoryRules and all-null constraints"
    requirement: "PACK-10"
    verification:
      - kind: unit
        ref: "packages/rulepacks/src/stub-packs.test.ts#PACK-10: the whole stub set's shape > exactly seven rows carry packKind: \"stub\""
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/stub-packs.test.ts#PACK-10: the whole stub set's shape > each stub pack's status is DRAFT"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/stub-packs.test.ts#PACK-10: the whole stub set's shape > every stub categoryRule is FLAG/NEEDS_VERIFICATION with a verificationNote starting with UNAUTHORED_TOKEN"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/stub-packs.test.ts#PACK-10: the whole stub set's shape > every stub pack's eleven constraints are null, matterFlagRules is empty, rateSanityCeiling has no keys, and no flatFee key is present"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/stub-packs.test.ts#PACK-10: the whole stub set's shape > summed across the seven stub packs there are exactly 147 categoryRules"
        status: pass
    human_judgment: false
  - id: D2
    description: "The stub set's shape is asserted as a whole, driven off loadAllRulePacks()/PACK_JURISDICTIONS rather than a hardcoded packId list, so an eighth stub without a table row (or vice versa) fails loudly; the bidirectional table/directory check is proven non-vacuous by deleting one committed rule and observing four PACK-10 tests fail, then reverting"
    requirement: "PACK-10"
    verification:
      - kind: unit
        ref: "packages/rulepacks/src/stub-packs.test.ts#PACK-10: the whole stub set's shape > every PACK_JURISDICTIONS row has a committed pack directory (no row is missing its file)"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/stub-packs.test.ts#PACK-10: the whole stub set's shape > every committed pack directory has a PACK_JURISDICTIONS row (no stray directory is untracked by the table)"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/stub-packs.test.ts#PACK-10: the whole stub set's shape > every ruleId across the whole committed tree is unique and equals `${packId}.${categoryCode}`"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-09-16
status: complete
---

# Phase 3 Plan 2: Australia, New Zealand, Japan, South Korea, China and India stub packs Summary

**Completed the seven-jurisdiction stub set (six new committed packs plus a whole-set PACK-10 assertion suite), each generated from its own PRD §7.4 row with no hand-edits**

## Performance

- **Duration:** 15 min
- **Started:** 2026-09-16T04:44:00Z
- **Completed:** 2026-09-16T04:58:00Z
- **Tasks:** 3 completed (all `tdd="true"`)
- **Files modified:** 9

## Accomplishments
- Six more jurisdictions committed as literal repository JSON: `AU-PRIVACY-ACT`, `NZ-PRIVACY-ACT`, `JP-APPI`, `KR-PIPA`, `CN-PIPL`, `IN-DPDP` — each generated via `generateStubPack(packId)` and written byte-for-byte from the generator's output, joining `VN-PDPL` from 03-01 to complete all seven unauthored jurisdictions
- `PACK_JURISDICTIONS` in `packages/rulepacks/src/stub-category-rules.ts` grew from one row to seven, each carrying `packKind: "stub"`, `feePosture`/`appliesTo`/`instruments`/`authoringNote` traced to that jurisdiction's own PRD §7.4 row with PD-3's `appliesTo` derivation applied consistently (PROHIBITED excludes a controller type; NO_EXPRESS_AUTHORITY does not)
- `packages/rulepacks/src/stub-packs.test.ts` asserts the whole stub set's shape as a unit: bidirectional table/directory equality, exactly seven `packKind: "stub"` rows, DRAFT status, 21/21 categoryCode exhaustiveness and declaration order, universal FLAG/NEEDS_VERIFICATION/UNAUTHORED_TOKEN, all-null constraints with empty `matterFlagRules`/`rateSanityCeiling` and no `flatFee` key, the literal 147-rule total, and tree-wide `ruleId` uniqueness — every assertion driven off `loadAllRulePacks()`/`PACK_JURISDICTIONS`, never a hardcoded packId list
- `pnpm run pack:validate` now names all seven packs; all 28 tests in the `rulepacks` vitest project pass

## Task Commits

Each task is `tdd="true"` and produced a RED + GREEN commit pair (no REFACTOR commit needed for any task — nothing to clean up after GREEN):

1. **Task 1 RED: add failing test proving AU/NZ/JP stub packs are loadable** - `f6904db` (test)
2. **Task 1 GREEN: commit Australia, New Zealand and Japan stub rule packs** - `98ddffd` (feat)
3. **Task 2 RED: add failing test proving KR/CN/IN stub packs are loadable** - `ddd7d57` (test)
4. **Task 2 GREEN: commit South Korea, China and India stub rule packs** - `b3345c9` (feat)
5. **Task 3 RED: add failing test proving the PACK-10 whole-stub-set gate fires** - `b9df373` (test)
6. **Task 3 GREEN: confirm the PACK-10 whole-stub-set gate holds** - `9200c04` (feat)

**Plan metadata:** (final commit, recorded after this SUMMARY)

## Files Created/Modified
- `packages/rulepacks/src/stub-category-rules.ts` - adds AU-PRIVACY-ACT/NZ-PRIVACY-ACT/JP-APPI/KR-PIPA/CN-PIPL/IN-DPDP rows to `PACK_JURISDICTIONS`
- `packages/rulepacks/src/stub-category-rules.test.ts` - adds per-jurisdiction loadability proofs for the six new packIds (Tasks 1 and 2), scoped per-packId (not a total count) so they stay valid as later plans add more jurisdictions
- `packages/rulepacks/AU-PRIVACY-ACT/2026.09.1.json`, `NZ-PRIVACY-ACT/2026.09.1.json`, `JP-APPI/2026.09.1.json`, `KR-PIPA/2026.09.1.json`, `CN-PIPL/2026.09.1.json`, `IN-DPDP/2026.09.1.json` - the six new committed stub packs, generated (never hand-written)
- `packages/rulepacks/src/stub-packs.test.ts` - the whole-stub-set PACK-10 assertion suite (new file)

## Decisions Made
- Followed PD-3's `appliesTo` derivation and CONTEXT.md's Claude's Discretion item 4 (unresearched public-agency posture defaults to `NO_EXPRESS_AUTHORITY`) exactly as the plan specified; no deviation from the planner's per-jurisdiction data decisions.
- **Markdown-stripping scope for `authoringNote`:** the plan's instruction to transcribe each PRD §7.4 note "verbatim with markdown emphasis markers removed" was read as stripping only `**bold**`/`*italic*` markers, not backticks — PRD's own note text uses backticks to name actual schema/field identifiers (`feePosture`, `PERCENT_OF_CLAIM: 100`, `reviewedOn`), and those are code-span references useful to the authoring lawyer, not stylistic emphasis. VN-PDPL's precedent (03-01) had no backticks to test this against, so this is a new, explicit reading recorded here rather than left implicit.
- **Test-file additions beyond the plan's declared `<files>` list:** Tasks 1 and 2's `<files>` frontmatter lists only `stub-category-rules.ts` and the new pack JSON files, not a test file — but each task's own `<behavior>` bullet ("Test: `loadAllRulePacks()` now returns N packs...") requires a genuine RED/GREEN cycle per the TDD execution flow, and the existing drift/loader tests are parameterized over whatever is already on disk (they would not fail from a merely-tabled-but-uncommitted jurisdiction). Necessary per-packId loadability assertions were added to the existing `stub-category-rules.test.ts` (the natural home — it already houses the D-19 generator/loadability proofs from 03-01) to produce genuine, on-topic RED evidence without corrupting any committed pack file. This is judged Rule 2-adjacent (necessary for the task's own written behavior contract) rather than scope creep — no assertion introduced here asserts anything beyond what the task's `<behavior>` block already specified.
- **Task 3's RED-phase technique:** since all seven packs' data was already correct at the moment `stub-packs.test.ts` was written (from Tasks 1/2), a genuine RED needed either a deliberately-inverted assertion or a temporarily-corrupted committed file. Following 03-01's established precedent (do not inject a real defect into production/committed data to manufacture RED), one representative assertion (the 147-total test) was written as `.not.toBe(147)` first, confirmed to fail for the correct, on-topic reason, then flipped to `.toBe(147)` for GREEN. The acceptance criterion's own suggested verification (delete one committed rule, observe failure, revert) was additionally performed as a manual, uncommitted sanity check — confirmed 4 of the 28 tests fail non-vacuously when one rule is removed from `VN-PDPL/2026.09.1.json`, then the file was restored and all 28 tests pass again.

## Deviations from Plan

None beyond the two recorded decisions above (markdown-stripping scope for backticks, and the necessary test-file touch beyond the plan's literal `<files>` list) — both are interpretive clarifications of an underspecified plan detail, not corrections to broken code, so they are not filed as Rule 1/2/3 auto-fixes.

## Issues Encountered

**Pre-existing, out-of-scope test failure (not fixed, already logged in 03-01):** `pnpm test` still reports one failing test — `packages/schemas/src/json-schema.test.ts`'s CRLF/LF drift check — for the same reason documented in `.planning/phases/03-rule-packs-and-pack-admin/deferred-items.md` and `WINDOWS.md` ledger entry #1 during plan 03-01. Re-confirmed unrelated to this plan: this plan touches only `packages/rulepacks`, never `packages/schemas/src/json-schema.ts` or its committed schema artifacts. All 28 `rulepacks`-project tests pass; `pnpm run typecheck`, `pnpm run lint`, `pnpm run depcruise`, and `pnpm run pack:validate` all exit 0.

**Plan's own acceptance-criteria shell one-liner undercounts (not a code defect):** Task 2's acceptance criterion `ls -d packages/rulepacks/*/ | grep -v -E 'src|scripts' | wc -l` reports `8` in this checkout, not `7`, because this environment's pnpm workspace has materialized a `packages/rulepacks/node_modules/` symlink directory that the filter's regex does not exclude. `loadAllRulePacks()`/`pack:validate` (which use the same `NON_PACK_DIRECTORIES` set as `loader.ts`, already excluding `node_modules` and `dist`) correctly report and load exactly seven packs, confirmed via `pnpm run pack:validate`'s output naming all seven. Re-running the count with `node_modules` added to the exclusion list gives `7`. Not filed as a Windows-ledger item since it is a verification-script wording gap, not a shipped defect.

## Known Stubs

None introduced beyond the six new packs' own, intentional stub content (D-14/D-18/D-19, same pattern as VN-PDPL from 03-01): every `categoryRule` in all six new packs carries the `UNAUTHORED_TOKEN` marker and `treatment: "FLAG"` by design — each pack is DRAFT and cannot reach ACTIVE while the token is present (enforced in plan 03-03). This is the specified behavior for an unauthored jurisdiction stub, not an oversight.

## Threat Flags

None beyond what the plan's own `<threat_model>` already registers (T-03-05/T-03-06/T-03-07, all mitigated as described in the plan; T-03-SC accepted as recorded — no new external package was introduced).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All seven stub jurisdictions (VN-PDPL, AU-PRIVACY-ACT, NZ-PRIVACY-ACT, JP-APPI, KR-PIPA, CN-PIPL, IN-DPDP) are committed, load cleanly, and are bound to the D-19 drift generator and the new whole-set PACK-10 assertions — ready for plan 03-03 (the ACTIVE gate / PACK-02/03 validator work) and plan 03-05 (HK-PDPO/SG-PDPA authored packs, which append `packKind: "authored"` rows to the SAME `PACK_JURISDICTIONS` table without disturbing anything asserted here, since every stub-specific assertion filters on `packKind === "stub"`).
- The pre-existing `json-schema.test.ts` CRLF/LF drift failure (see Issues Encountered) still blocks a clean `pnpm test` exit; unrelated to this phase's `packages/rulepacks` work and unchanged from 03-01's finding.

---
*Phase: 03-rule-packs-and-pack-admin*
*Completed: 2026-09-16*

## Self-Check: PASSED

All 7 created/modified files verified present on disk; all 6 task commit hashes (`f6904db`, `98ddffd`, `ddd7d57`, `b3345c9`, `b9df373`, `9200c04`) verified present in `git log --oneline --all`.
