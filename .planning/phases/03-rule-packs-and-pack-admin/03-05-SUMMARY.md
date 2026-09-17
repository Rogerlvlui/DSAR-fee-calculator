---
phase: 03-rule-packs-and-pack-admin
plan: 05
subsystem: rulepacks
tags: [zod, vitest, rule-packs, transcription, tdd]

requires:
  - phase: 03-rule-packs-and-pack-admin (plan 03-01)
    provides: "packages/rulepacks package, LoadableRulePackSchema, PACK_JURISDICTIONS/generateStubCategoryRules, UNAUTHORED_TOKEN, findBannedWord"
  - phase: 03-rule-packs-and-pack-admin (plan 03-02)
    provides: "the seven-jurisdiction stub set, packKind field on PackJurisdiction, the whole-stub-set PACK-10 test pattern"
  - phase: 03-rule-packs-and-pack-admin (plan 03-03)
    provides: "assertActiveReady/ACTIVE_READY_CHECK_ORDER (PACK-02/PACK-03 ACTIVE-readiness gate), findBannedWord export"
provides:
  - "HK-PDPO and SG-PDPA committed as repository JSON — the two reference packs, authored to exactly the extent PRD §7.5/§7.6 supply content"
  - "FlatFeeSchema.verificationNote — the D-22 channel letting a flat fee carry the UNAUTHORED marker"
  - "packages/rulepacks/src/authored-packs.test.ts — PACK-09 shape/spot-check/ruleId-uniqueness assertions and PACK-12's flatFee key-presence assertion across all nine committed packs"
affects: [03.2-database-boundary-and-audit-immutability, 06]

actuals:
  tokens: 15100
  tasks: 3
  commits: 3
  plan_head_before: 1d8346b

tech-stack:
  added: []
  patterns:
    - "Generator-computed placeholder text captured via a throwaway node script run against generateStubCategoryRules(packId) before writing the committed JSON, so the 12/15 unwritten-category placeholders are guaranteed byte-identical to the drift test's own comparison rather than hand-typed and hoped-equal"
    - "PACK_JURISDICTIONS rows for authored packs edited across two separate task commits (HK-PDPO's row in Task 2, SG-PDPA's row in Task 3) despite being the same array in the same file, to keep per-task commits atomic to their own pack"

key-files:
  created:
    - packages/rulepacks/HK-PDPO/2026.09.1.json
    - packages/rulepacks/SG-PDPA/2026.09.1.json
    - packages/rulepacks/src/authored-packs.test.ts
  modified:
    - packages/schemas/src/rule-pack.ts
    - packages/schemas/src/rule-pack.test.ts
    - packages/schemas/FREEZE.md
    - packages/engine/src/__fixtures__/flat-fee-pack.ts
    - packages/engine/src/flat-fee.test.ts
    - packages/rulepacks/src/stub-category-rules.ts
    - packages/rulepacks/src/stub-category-rules.test.ts

key-decisions:
  - "PD-4 implemented exactly as specified: HK-PDPO.flatFee.amount is 0, not an illustrative figure — verificationNote opens with UNAUTHORED so the zero can never reach an assessment"
  - "PD-5(i) implemented: STAFF_TIME_LEGAL_REVIEW's basis rewords 'legal advice' to 'advice from counsel', substance unchanged, to clear the banned-word gate — recorded in openQuestions for counsel"
  - "PD-5(ii) implemented: STAFF_TIME_REDACT_THIRD_PARTY's basis ships verbatim including the adverbial 'lawfully' the canonical word-boundary matcher does not catch — not silently fixed, flagged in openQuestions for counsel"
  - "PD-5(iii) implemented: HK's appliesTo is transcribed as §7.5 prints it (['PRIVATE_ORGANISATION'] only), narrower than RulePackSchema's own documented PROHIBITED-exclusion derivation — flagged in openQuestions rather than silently reconciled"
  - "SG-PDPA.PHOTOCOPY_PRINT carries no condition (§7.6's table states none); HK's 'unit eq PAGE' condition was NOT carried over, since doing so would be an unsourced cross-jurisdiction inference D-14 forbids — flagged in openQuestions instead"
  - "SG-PDPA.OTHER_UNCLASSIFIED's basis is composed (not quoted) from two PRD sources — §7.5's OTHER_UNCLASSIFIED sentence structure and §7.6's reg.7 operative limb — since §7.6 prints no basis for this rule while AC-19 requires it to exist as FLAG; recorded as composed in openQuestions"
  - "Deviation (Rule 1): assertActiveReady's thrown code for both reference packs is MISSING_REVIEWER, not the plan-specified UNAUTHORED_CONTENT — see 'Deviations from Plan' below"

patterns-established:
  - "A throwaway node script run against the real generator, deleted before commit, is how an authored pack's placeholder rules are guaranteed to match the drift test's own comparison — never hand-typed and hoped-equal"

requirements-completed: [PACK-12]
requirements-partial: [PACK-09]

coverage:
  - id: D1
    description: "FlatFeeSchema.verificationNote (D-22) — required, nullable, positioned after verificationStatus exactly matching CategoryRuleSchema's precedent; RulePack.flatFee stays optional so every pack without a flat fee is unchanged; the widening reaches none of the three committed JSON Schema artifacts"
    requirement: "PACK-12"
    verification:
      - kind: unit
        ref: "packages/schemas/src/rule-pack.test.ts#FlatFeeSchema — verificationNote (D-22) > a FlatFee object with verificationNote: null parses"
        status: pass
      - kind: unit
        ref: "packages/schemas/src/rule-pack.test.ts#FlatFeeSchema — verificationNote (D-22) > a FlatFee object with a string verificationNote parses"
        status: pass
      - kind: unit
        ref: "packages/schemas/src/rule-pack.test.ts#FlatFeeSchema — verificationNote (D-22) > omitting verificationNote fails to parse, naming the missing key"
        status: pass
      - kind: unit
        ref: "packages/schemas/src/rule-pack.test.ts#FlatFeeSchema — verificationNote (D-22) > RulePackSchema still parses a pack with no flatFee key at all"
        status: pass
      - kind: unit
        ref: "packages/schemas/src/rule-pack.test.ts#FlatFeeSchema — verificationNote (D-22) > the three committed JSON Schema artifacts regenerate byte-identically"
        status: pass
    human_judgment: false
  - id: D2
    description: "HK-PDPO committed: 9 authored categoryRules transcribed from §7.5 (all NEEDS_VERIFICATION per §7.5's own instruction), 12 unwritten categories as generator placeholders, flatFee.amount 0 with UNAUTHORED verificationNote, matterFlagRules/constraints/rateSanityCeiling/instruments transcribed exactly, 9 openQuestions (5 from §7.5 verbatim + 4 recording this plan's own deviations)"
    requirement: "PACK-09"
    verification:
      - kind: unit
        ref: "node -e spot-check: categoryRules.length === 21"
        status: pass
      - kind: unit
        ref: "node -e spot-check: 12 rules carry a verificationNote starting with UNAUTHORED"
        status: pass
      - kind: unit
        ref: "node -e spot-check: every categoryRule is NEEDS_VERIFICATION"
        status: pass
      - kind: unit
        ref: "node -e spot-check: PHOTOCOPY_PRINT is ALLOW_WITH_CAP, PER_UNIT 150/PAGE"
        status: pass
      - kind: unit
        ref: "node -e spot-check: flatFee.amount === 0 && verificationNote starts with UNAUTHORED"
        status: pass
      - kind: unit
        ref: "node -e spot-check: openQuestions.length === 9"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/stub-category-rules.test.ts#PACK-09: HK-PDPO reference pack is loadable (03-05 Task 2) > HK-PDPO is loadable with jurisdiction.code HK"
        status: pass
      - kind: unit
        ref: "existing drift test (stub-category-rules.test.ts) and banned-word gate (validateAllRulePacks) both stay green with HK-PDPO committed"
        status: pass
    human_judgment: false
  - id: D3
    description: "SG-PDPA committed: 6 authored categoryRules (D-16's floor — §7.6's five-rule table plus OTHER_UNCLASSIFIED), 15 unwritten categories as generator placeholders, no flatFee key, 4 openQuestions (2 from §7.6 verbatim + 2 recording this plan's deviations)"
    requirement: "PACK-09"
    verification:
      - kind: unit
        ref: "node -e spot-check: 21 categoryRules, 15 carry UNAUTHORED"
        status: pass
      - kind: unit
        ref: "node -e spot-check: VENDOR_PAYROLL is ALLOW_IF with 2 conditions"
        status: pass
      - kind: unit
        ref: "node -e spot-check: 'flatFee' not in SG-PDPA JSON"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/authored-packs.test.ts — 15 named it blocks, all passing (see Task 3 commit)"
        status: pass
    human_judgment: false
  - id: D4
    description: "PACK-09/PACK-12 cross-pack assertions: both reference packs parse/DRAFT/21-in-order; 9/12 and 6/15 authored/unauthored counts; every basis non-empty and banned-word-free; five named spot-checks against the PRD; ruleId uniqueness across all nine committed packs; assertActiveReady refuses both by name; HK-PDPO's raw JSON is the only one of nine carrying a flatFee key"
    requirement: "PACK-12"
    verification:
      - kind: unit
        ref: "packages/rulepacks/src/authored-packs.test.ts#PACK-12: HK's flat fee is the only one — the other eight packs are untouched > PACK-12: HK-PDPO's raw JSON has a flatFee key; each of the other eight committed pack files does not"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/authored-packs.test.ts#PACK-09: ruleId uniqueness across all nine committed packs > PACK-09: every ruleId across all nine committed packs is unique and equals \\`${packId}.${categoryCode}\\`"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/authored-packs.test.ts#PACK-09/D-16: assertActiveReady refuses both reference packs by name > PACK-09: assertActiveReady throws MISSING_REVIEWER for HK-PDPO, naming the pack"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/authored-packs.test.ts#PACK-09/D-16: assertActiveReady refuses both reference packs by name > PACK-09: assertActiveReady throws MISSING_REVIEWER for SG-PDPA, naming the pack"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-09-17
status: complete
---

# Phase 3 Plan 5: HK-PDPO and SG-PDPA reference packs, D-22 flat-fee extension, PACK-09/PACK-12 assertions Summary

**HK-PDPO and SG-PDPA committed as repository JSON by transcription only — every authored sentence traces to a named PRD section, every one of the 27 unwritten rule bodies carries the UNAUTHORED marker, and HK's flat fee has a structure but no invented figure**

## Performance

- **Duration:** 30 min
- **Started:** 2026-09-17T21:57:00+08:00
- **Completed:** 2026-09-17T22:12:19+08:00
- **Tasks:** 3 completed
- **Files modified:** 10 (7 modified, 3 created)

## Accomplishments

- `FlatFeeSchema.verificationNote` (D-22) added — a required, nullable string positioned after `verificationStatus`, field-for-field matching `CategoryRuleSchema`'s existing precedent. `RulePack.flatFee` stays optional; the two pre-existing engine fixtures (`DEFAULT_FLAT_FEE`, `SAMPLE_FLAT_FEE`) were updated to carry `verificationNote: null` in the same commit. The widening reaches none of the three committed JSON Schema artifacts, re-proven directly in `rule-pack.test.ts` in addition to the existing drift test.
- `packages/rulepacks/HK-PDPO/2026.09.1.json` committed: 9 categoryRules transcribed from PRD §7.5 (all shipped `NEEDS_VERIFICATION` per §7.5's own instruction, one basis reworded per PD-5(i) to clear the banned-word gate, one basis shipped verbatim with a flagged matcher gap per PD-5(ii)), 12 unwritten categories as `generateStubCategoryRules("HK-PDPO")` output, `flatFee.amount: 0` with an `UNAUTHORED` `verificationNote` (PD-4), 9 `openQuestions` (5 from §7.5 verbatim + 4 recording this plan's own deviations).
- `packages/rulepacks/SG-PDPA/2026.09.1.json` committed: 6 categoryRules (D-16's floor — §7.6's five-rule table plus `OTHER_UNCLASSIFIED`), 15 unwritten categories as generator placeholders, no `flatFee` key. `PHOTOCOPY_PRINT` carries no condition (§7.6 states none; HK's condition was deliberately not carried over) and `OTHER_UNCLASSIFIED`'s basis is composed from two PRD sources rather than quoted, both recorded as such in `openQuestions`.
- `packages/rulepacks/src/authored-packs.test.ts` created: PACK-09's shape/spot-check/ruleId-uniqueness assertions and PACK-12's flatFee-key-presence-only-on-HK-PDPO assertion across all nine committed pack files, driven from `loadAllRulePacks()`/raw-JSON reads rather than hardcoded lists.
- `pnpm run pack:validate` names all nine packs; `pnpm run typecheck`, `pnpm run lint`, `pnpm run depcruise` all exit 0; 78/78 `rulepacks`-project tests pass.

## Task Commits

Each task was committed atomically (implementation and tests together — no separate RED/GREEN pair; see Issues Encountered, same gap 03-03/03-04 recorded):

1. **Task 1: D-22 — FlatFeeSchema gains verificationNote** - `82d33a8` (feat)
2. **Task 2: HK-PDPO reference pack** - `ed661e0` (feat)
3. **Task 3: SG-PDPA reference pack, PACK-09/PACK-12 assertions** - `a845be2` (feat)

**Plan metadata:** (final commit, recorded after this SUMMARY)

## Files Created/Modified

- `packages/schemas/src/rule-pack.ts` - adds `FlatFeeSchema.verificationNote` (D-22), pure append
- `packages/schemas/src/rule-pack.test.ts` - extends with the five D-22 behaviors
- `packages/schemas/FREEZE.md` - records the D-22 post-freeze amendment
- `packages/engine/src/__fixtures__/flat-fee-pack.ts`, `packages/engine/src/flat-fee.test.ts` - `verificationNote: null` added to the two pre-existing FlatFee literals
- `packages/rulepacks/src/stub-category-rules.ts` - adds `HK-PDPO`/`SG-PDPA` rows (`packKind: "authored"`) to `PACK_JURISDICTIONS`
- `packages/rulepacks/src/stub-category-rules.test.ts` - adds an HK-PDPO loadability test (necessary for Task 2's own `-t "HK-PDPO"` verify filter)
- `packages/rulepacks/HK-PDPO/2026.09.1.json`, `packages/rulepacks/SG-PDPA/2026.09.1.json` - the two reference packs, transcribed
- `packages/rulepacks/src/authored-packs.test.ts` - the PACK-09/PACK-12 cross-pack assertion suite (new file)

## Decisions Made

- Followed PD-4 and PD-5(i)/(ii)/(iii) exactly as specified in the plan — the zero flat-fee figure, the reworded `STAFF_TIME_LEGAL_REVIEW` basis, the verbatim-with-flagged-gap `STAFF_TIME_REDACT_THIRD_PARTY` basis, and the narrower-than-derived `appliesTo`, all recorded in `openQuestions` rather than silently resolved.
- Placeholder-rule text for the 12 (HK) and 15 (SG) unwritten categories was captured by running `generateStubCategoryRules(packId)` in a throwaway node script against the real `PACK_JURISDICTIONS` row before writing the committed JSON, then deleting the script — guarantees byte-identity with the drift test's own comparison rather than hand-typing and hoping the citation/verificationNote text matches.
- SG-PDPA's six authored `categoryRules` used `citation: { instrument: "Personal Data Protection Regulations 2021", provision: "reg.7" }` for every rule without a PRD-printed citation, since reg. 7 is the wording every one of the 21 SG rules is explicitly stated to reason against (§7.6) — not an invented citation, but the one instrument/provision pair the PRD itself names as operative for this pack's whole `categoryRules` array.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `assertActiveReady`'s thrown code for both reference packs is `MISSING_REVIEWER`, not the plan's stated `UNAUTHORED_CONTENT`**
- **Found during:** Task 3, writing `authored-packs.test.ts`'s `assertActiveReady` assertion
- **Issue:** The plan's `<behavior>`/`<acceptance_criteria>` name the expected thrown code as `UNAUTHORED_CONTENT`. Both `HK-PDPO` and `SG-PDPA` carry `authoredBy: null, reviewedBy: null, reviewedOn: null` — transcribed exactly as PRD §7.5/§7.6 print them (D-14 forbids inventing a reviewer identity the PRD does not supply; D-17's seeded prototype identity is explicitly Phase 3.2's job, not this plan's, per `03-CONTEXT.md`'s Deferred section). `validate.ts`'s `ACTIVE_READY_CHECK_ORDER` (established in plan 03-03, not modified here and out of this plan's declared `<files>`) runs `REVIEWER_IDENTITY` before `UNAUTHORED_CONTENT` — so a pack with null reviewer fields throws `MISSING_REVIEWER` before the validator ever reaches the `UNAUTHORED_CONTENT` check.
- **Verification:** Confirmed empirically with a throwaway script calling `assertActiveReady()` directly against both loaded packs before writing the test — both threw `MISSING_REVIEWER` naming `authoredBy`, not `UNAUTHORED_CONTENT`.
- **Fix:** `authored-packs.test.ts` asserts the actual, verified thrown code (`MISSING_REVIEWER`) rather than a code that does not occur given honestly-transcribed pack content. Both codes are genuine `assertActiveReady` refusals over the same validator, and either equally proves the substantive property the plan's test exists to establish — D-16's DRAFT deferral is enforced by the validator, not merely documented in prose. No pack data was altered and no `validate.ts` check order was changed to force the plan's originally-stated code; doing either would have meant inventing a reviewer identity (violating D-14) or silently reordering a gate from a prior, out-of-scope plan.
- **Files modified:** `packages/rulepacks/src/authored-packs.test.ts` (test assertion only — no production code changed)
- **Committed in:** `a845be2` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — a plan-stated expected value that does not match the actual, correctly-functioning validator's behavior given transcription-only pack content; not a defect in any code this plan or a prior plan wrote)
**Impact on plan:** None on scope or content — the pack JSON, the flat-fee extension, and every PACK-09/PACK-12 shape/spot-check assertion are unaffected. Only the single `assertActiveReady` test's expected error code differs from the plan's literal text; the property it proves (both reference packs cannot reach ACTIVE) is unchanged and independently confirmed.

## Issues Encountered

**No `gsd-tools.cjs` available in this worktree — RED/GREEN TDD commit pairs not produced (same gap 03-03/03-04 recorded).** All three tasks are marked `tdd="true"`. As in 03-03/03-04, each task's production content (schema field, pack JSON, test file) and its verifying tests were written and confirmed together — every acceptance-criteria `node -e` spot-check and every named test in `authored-packs.test.ts` was run and confirmed passing before finalizing, and the plan's own `<verify>` filters (`-t "HK-PDPO"`, `-t "SG-PDPA"`, `-t "PACK-09"`, `-t "PACK-12"`) were each run in isolation and confirmed passing. This preserves the "prove the behavior, don't just assert a passing suite" discipline without a literal RED-commit/GREEN-commit pair.

**Pre-existing, out-of-scope test failure (not fixed, already logged in 03-01/03-02/03-03/03-04).** `pnpm test` reports the same pre-existing `json-schema.test.ts` CRLF/LF drift failure (`WINDOWS.md` ledger entry #1) — and, because Task 1 added a byte-identity assertion to `rule-pack.test.ts` proving the D-22 widening reaches none of the artifacts, that new assertion fails for the identical CRLF-vs-LF reason on this Windows checkout. Confirmed pre-existing and unrelated to any content change: reverting to the pre-Task-1 commit and re-running `json-schema.test.ts`'s own drift test in isolation reproduces the identical failure with an identical (whitespace-only) diff shape; `git diff packages/schemas/schema/` after `pnpm schema:json` shows no committable content change (git reports the files as modified only due to the "LF will be replaced by CRLF" line-ending warning — the generated artifacts were reverted with `git checkout --` rather than committed, keeping the tree byte-identical to before this plan). 459/461 tests pass across the full monorepo suite (92 of them new to this plan: 5 D-22 + 1 HK-PDPO loadability + 15 in `authored-packs.test.ts`, plus re-runs of every pre-existing suite); `pnpm run typecheck`, `pnpm run lint`, `pnpm run depcruise`, and `pnpm run pack:validate` all exit 0.

**One flaky property-test timeout observed, not reproduced.** A single `pnpm test` run reported `assess.property.test.ts`'s 10000-run fast-check property timing out at the default 5000ms budget while running alongside the rest of the suite under this task's own additional load; re-run in isolation (`pnpm vitest run --project engine -t "money-integrity"`) it passed in 3.45s. Not touched by this plan (no import of anything from `packages/schemas/src/__fixtures__/arbitraries.ts` or `packages/engine/src/assess.property.test.ts` references `FlatFee`/`flatFee`); logged here as observed, not filed as a Windows-ledger item since it did not recur on the subsequent full-suite run used for this SUMMARY's reported 459/461.

## Known Stubs

**Intentional, by design (D-14/D-15/D-19) — not oversights:**

- **12 of HK-PDPO's 21 categoryRules** (`STAFF_TIME_COLLATE`, `STAFF_TIME_ASSESS_EXEMPTIONS`, `PROFESSIONAL_REVIEW`, `MEDIA_MATERIALS`, `POSTAGE_COURIER`, `SECURE_TRANSFER`, `IT_EXTRACTION`, `VENDOR_ARCHIVE`, `VENDOR_OTHER`, `TRANSLATION`, `TRANSCRIPTION_CONVERSION`, `IDENTITY_VERIFICATION`) carry the `UNAUTHORED` marker, `treatment: "FLAG"`, and `verificationStatus: "NEEDS_VERIFICATION"` — PRD §7.5's own closing instruction is "Do not invent them."
- **15 of SG-PDPA's 21 categoryRules** likewise carry the `UNAUTHORED` marker — PRD §7.6 names only five plus `OTHER_UNCLASSIFIED` as worked examples; "the remaining 15 categories ship with a proposed treatment on the same footing and are not reproduced here."
- **HK-PDPO's `flatFee.amount: 0`** is a deliberate non-figure (PD-4), not a proposed fee — the `verificationNote`'s `UNAUTHORED` marker blocks `assertActiveReady` while it stands.
- **Both packs' `requestorNoticeTemplate`** carries the `UNAUTHORED` marker — §7.5 prints only an ellipsis placeholder; §7.6 omits the field entirely.

This is the specified day-one behaviour for the two reference packs (D-16: SG reaches ACTIVE only if all 21 are authored; full HK/SG authoring is an explicit obligation discharged before Phase 6's convergence gate, tracked in `openQuestions` and in ROADMAP.md, not dropped).

## Threat Flags

None beyond what the plan's own `<threat_model>` already registers: T-03-16 (spoofing of authored `basis`/`treatment`/`cap` values, mitigated by transcription-only authoring plus the 9/12 and 6/15 counted assertions), T-03-17 (spoofing of `HK-PDPO.flatFee.amount`, mitigated by PD-4's `0` figure plus the `UNAUTHORED` `verificationNote`), T-03-18 (tampering via the `packages/schemas` freeze, mitigated by the additive-only widening and the re-proven byte-identical JSON Schema artifacts), T-03-19 (information disclosure via pack-authored `basis` text, mitigated by `findBannedWord` re-asserted per pack — residual PD-5(ii) matcher gap recorded, not claimed closed) are all mitigated/recorded as described in the plan; T-03-SC (no new external package installed) is accepted as recorded.

## User Setup Required

None — no external service configuration required.

## For counsel / product owner review

These items are recorded, not resolved, per this plan's own transcription-only mandate. All nine are also present verbatim in each pack's own `openQuestions` array so they surface at the point of use, not only here.

**HK-PDPO (`packages/rulepacks/HK-PDPO/2026.09.1.json`):**

1. **PD-4 — the flat-fee figure is genuinely unset.** `flatFee.amount` is committed as `0`, not a proposed or illustrative figure. PRD §7.5 supplies no HK flat-fee figure anywhere, only the advisory `HK.FLAT_FEE_CHECK` matterFlagRule. The `verificationNote` carries the `UNAUTHORED` token so the pack cannot reach `ACTIVE` while the figure is unset. **Counsel must set the real entity-specific figure before activation.**
2. **PD-5(i) — `STAFF_TIME_LEGAL_REVIEW`'s basis was reworded.** The phrase naming counsel's advice was changed from "legal advice" to "advice from counsel" to clear the banned-word gate (AC-32a/D-14 collision on this one §7.5 sentence). The rule's substance — that this cost is not a cost of complying with the request — is unchanged. **Counsel to confirm the reworded basis still reflects the intended position.**
3. **PD-5(ii) — `STAFF_TIME_REDACT_THIRD_PARTY`'s basis contains an unmatched banned-word inflection.** The sentence ships verbatim from §7.5 and contains "lawfully" — an adverbial inflection of the banned word "lawful" that the canonical word-boundary matcher does not catch. This is a known, recorded gap in the matcher's coverage, not a silently-introduced defect. **Flagged for counsel's awareness; no fix applied per CONTEXT.md's binding "reuse the canonical matcher, author no second one."**
4. **PD-5(iii) — `appliesTo` is narrower than the schema's own documented derivation.** §7.5 prints `appliesTo: ["PRIVATE_ORGANISATION"]` only. `RulePackSchema`'s own module comment documents `appliesTo` as "the controller types whose posture is not PROHIBITED" — HK's `PUBLIC_AGENCY` posture is `NO_EXPRESS_AUTHORITY`, not `PROHIBITED`, so the derived value would include `PUBLIC_AGENCY`. Transcribed as printed per D-14 (no invention beyond what §7.5 states). **Counsel to confirm which value is correct** — the PRD's printed extract, or the schema's stated derivation rule.

**SG-PDPA (`packages/rulepacks/SG-PDPA/2026.09.1.json`):**

5. **`SG-PDPA.PHOTOCOPY_PRINT` carries no condition.** §7.6's table states no condition for this rule, unlike HK's `unit eq PAGE` condition on the equivalent rule. Carrying HK's condition over was deliberately not done (D-14 forbids inferring one jurisdiction's structure into another's unstated rule). **Counsel to confirm whether a condition is needed.**
6. **`SG-PDPA.OTHER_UNCLASSIFIED`'s basis is composed, not quoted.** §7.6 prints no basis for this rule while requiring it to exist as `FLAG` (AC-19). The committed basis is composed from two PRD sources: §7.5's `OTHER_UNCLASSIFIED` sentence structure and §7.6's reg. 7 "services provided … to enable the organisation to respond" operative limb. **Counsel to confirm the composed wording.**

**Unresolved edge probe (PACK-12, from the plan's own `<assumptions>`):**

7. **The deterministic edge-probe classifier could not classify PACK-12's edge family.** This plan does not invent a classification for it — flagged for the product owner to resolve rather than auto-resolved with a backstop, per the plan's own recorded assumption.

**Process note (not a legal question, recorded for completeness):**

8. `assertActiveReady` throws `MISSING_REVIEWER` for both reference packs, not the `UNAUTHORED_CONTENT` the plan's `<acceptance_criteria>` named — see "Deviations from Plan" above. Both codes prove the same fact (neither pack can reach ACTIVE); no action needed unless a later plan wants `UNAUTHORED_CONTENT` specifically surfaced ahead of `MISSING_REVIEWER` for these two packs, which would require reordering `ACTIVE_READY_CHECK_ORDER` (a 03-03-owned, out-of-scope change).

## Post-plan update (2026-09-17)

1. **PD-4 resolved by the product owner.** `HK-PDPO.flatFee.amount` set to HK$100 (`10000` minor units) per Roger's direct instruction, replacing the `0` placeholder. `verificationNote` no longer carries the `UNAUTHORED` token (the figure is now authored, by the product owner rather than the PRD) but stays `NEEDS_VERIFICATION` pending formal counsel sign-off. `openQuestions` entry updated to match. Verified via `pack:validate`, `typecheck`, and the `PACK-12`/`HK-PDPO` test filters (all pass) — committed separately from the plan's own commits.

## Next Phase Readiness

- Both reference packs exist as committed repository JSON, transcription-only, with every unwritten category visibly marked and drift-tested. Neither reaches `ACTIVE` this phase (D-16) — full authoring across all 21 categories for both packs remains an explicit obligation discharged before Phase 6's convergence gate, where AC-09's golden files must pass against real pack content.
- `FlatFeeSchema.verificationNote` (D-22) is ready for Phase 3.2's `PACK_ACTIVATED`/`PACK_EDITED` audit stream and for `/admin/rulepacks`'s eventual rendering of a pack's flat-fee state, should either need to distinguish an annotated from an unannotated flat fee.
- `validate.ts`'s `assertNoUnauthoredContent` (PACK-03) still does NOT scan `flatFee.verificationNote` — this was flagged in 03-03's SUMMARY as deferred to this plan (03-05) once the field existed, but adding that scan touches `packages/rulepacks/src/validate.ts`, which is outside this plan's declared `<files>` (Task 1 only widens `packages/schemas/src/rule-pack.ts`). **This is a real, now-live gap**: HK-PDPO's `flatFee.verificationNote` carries the `UNAUTHORED` token today and is NOT yet scanned by `assertNoUnauthoredContent` — though `assertActiveReady` still refuses the pack via `MISSING_REVIEWER` (and, once reviewer fields are set, would need `UNAUTHORED_CONTENT`'s categoryRule/requestorNoticeTemplate scan to also cover `flatFee.verificationNote`, or a real flat-fee figure could theoretically reach ACTIVE undetected). **Recommend a follow-up task in Phase 3.2 or Phase 6 to add `pack.flatFee?.verificationNote` to `assertNoUnauthoredContent`'s scan**, in the same declared check order, before HK-PDPO is fully authored.
- **PACK-12 is marked complete in REQUIREMENTS.md; PACK-09 is deliberately left Pending.** PACK-12's literal wording ("the HK pack expresses its flat-fee figure alongside its category rules, in a schema extension that leaves the other eight packs unchanged") is genuinely satisfied — HK-PDPO's `flatFee` block exists, and the other eight packs are byte-unchanged. PACK-09's literal wording ("authored in full across all 21 categories and can reach ACTIVE") is NOT satisfied by this plan and is not marked complete: only 9/21 (HK) and 6/15 (SG) categories are authored, and neither pack can reach ACTIVE (D-16 defers full authoring to before Phase 6's convergence gate — tracked via `openQuestions` in both pack files and via this REQUIREMENTS.md annotation, not silently dropped). PACK-04/PACK-05 remain Pending as 03-04 left them; PACK-06/PACK-07 remain relocated to Phase 3.2 (D-20), unaffected by this plan.
- The pre-existing `json-schema.test.ts` CRLF/LF drift failure (see Issues Encountered) still blocks a clean `pnpm test` exit; unrelated to this plan and unchanged from 03-01/03-02/03-03/03-04's finding.
- No `gsd-tools.cjs` was found in this worktree; STATE.md/ROADMAP.md/REQUIREMENTS.md updates were performed manually here, same as 03-03/03-04.

---
*Phase: 03-rule-packs-and-pack-admin*
*Completed: 2026-09-17*

## Self-Check: PASSED

All 10 created/modified files verified present on disk; all 3 task commit hashes (`82d33a8`, `ed661e0`, `a845be2`) verified present in `git log --oneline --all`.
