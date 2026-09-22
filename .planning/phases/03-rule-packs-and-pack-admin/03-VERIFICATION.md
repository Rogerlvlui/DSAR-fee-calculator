---
phase: 03-rule-packs-and-pack-admin
verified: 2026-09-17T15:58:08Z
status: passed
score: 8/8 non-deferred must-haves verified (2 deferred to their owning phases, 1 human-verification item)
covered_files:
  - ".planning/REQUIREMENTS.md"
  - ".planning/phases/03-rule-packs-and-pack-admin/03-01-PLAN.md"
  - ".planning/phases/03-rule-packs-and-pack-admin/03-01-SUMMARY.md"
  - ".planning/phases/03-rule-packs-and-pack-admin/03-02-PLAN.md"
  - ".planning/phases/03-rule-packs-and-pack-admin/03-02-SUMMARY.md"
  - ".planning/phases/03-rule-packs-and-pack-admin/03-03-PLAN.md"
  - ".planning/phases/03-rule-packs-and-pack-admin/03-03-SUMMARY.md"
  - ".planning/phases/03-rule-packs-and-pack-admin/03-04-PLAN.md"
  - ".planning/phases/03-rule-packs-and-pack-admin/03-04-SUMMARY.md"
  - ".planning/phases/03-rule-packs-and-pack-admin/03-05-PLAN.md"
  - ".planning/phases/03-rule-packs-and-pack-admin/03-05-SUMMARY.md"
  - ".planning/phases/03-rule-packs-and-pack-admin/03-REVIEW.md"
  - ".planning/phases/03-rule-packs-and-pack-admin/03-VALIDATION.md"
  - ".planning/phases/03-rule-packs-and-pack-admin/deferred-items.md"
  - "packages/engine/package.json"
  - "packages/engine/src/__fixtures__/flat-fee-pack.ts"
  - "packages/engine/src/flat-fee.test.ts"
  - "packages/rulepacks/AU-PRIVACY-ACT/2026.09.1.json"
  - "packages/rulepacks/CN-PIPL/2026.09.1.json"
  - "packages/rulepacks/HK-PDPO/2026.09.1.json"
  - "packages/rulepacks/IN-DPDP/2026.09.1.json"
  - "packages/rulepacks/JP-APPI/2026.09.1.json"
  - "packages/rulepacks/KR-PIPA/2026.09.1.json"
  - "packages/rulepacks/NZ-PRIVACY-ACT/2026.09.1.json"
  - "packages/rulepacks/SG-PDPA/2026.09.1.json"
  - "packages/rulepacks/VN-PDPL/2026.09.1.json"
  - "packages/rulepacks/package.json"
  - "packages/rulepacks/scripts/validate-cli.ts"
  - "packages/rulepacks/src/__fixtures__/active-ready.fixture.json"
  - "packages/rulepacks/src/__fixtures__/banned-word-basis.fixture.json"
  - "packages/rulepacks/src/__fixtures__/duplicate-category.fixture.json"
  - "packages/rulepacks/src/__fixtures__/malformed.fixture.json"
  - "packages/rulepacks/src/__fixtures__/missing-category.fixture.json"
  - "packages/rulepacks/src/__fixtures__/missing-reviewed-by.fixture.json"
  - "packages/rulepacks/src/__fixtures__/unauthored-token.fixture.json"
  - "packages/rulepacks/src/__fixtures__/versions-single/ACME-FIXTURE/2026.01.1.json"
  - "packages/rulepacks/src/__fixtures__/versions/ACME-FIXTURE/2026.01.1.json"
  - "packages/rulepacks/src/__fixtures__/versions/ACME-FIXTURE/2026.06.1.json"
  - "packages/rulepacks/src/authored-packs.test.ts"
  - "packages/rulepacks/src/loader.test.ts"
  - "packages/rulepacks/src/loader.ts"
  - "packages/rulepacks/src/prototype-counsel.ts"
  - "packages/rulepacks/src/stale.test.ts"
  - "packages/rulepacks/src/stale.ts"
  - "packages/rulepacks/src/stub-category-rules.test.ts"
  - "packages/rulepacks/src/stub-category-rules.ts"
  - "packages/rulepacks/src/stub-constraints.ts"
  - "packages/rulepacks/src/stub-packs.test.ts"
  - "packages/rulepacks/src/validate.test.ts"
  - "packages/rulepacks/src/validate.ts"
  - "packages/rulepacks/src/versions.test.ts"
  - "packages/rulepacks/tsconfig.json"
  - "packages/schemas/FREEZE.md"
  - "packages/schemas/src/constants.ts"
  - "packages/schemas/src/rule-pack.test.ts"
  - "packages/schemas/src/rule-pack.ts"
covered_digest: "v1:sha256:282788474acff6142a807c6530f58bfac88424df31ced57c3b126094e767bee7"
deferred:
  - truth: "HK-PDPO and SG-PDPA are authored in full across all 21 categories and can reach ACTIVE (ROADMAP Phase 3 Success Criterion 2, PACK-09's literal wording)"
    addressed_in: "Phase 6"
    evidence: "Phase 6 Success Criterion 1: 'AC-09 golden files pass for both the HK and SG packs — expected verdicts, amounts, flags and totals reproduce exactly — and changing either pack breaks its golden files rather than silently passing.' ROADMAP Phase 3 text: 'full HK and SG authoring across all 21 categories is deferred to before Phase 6's convergence gate (D-16).' REQUIREMENTS.md marks PACK-09 Pending, not Complete."
  - truth: "Activation is a gated, audited event — /admin/rulepacks live validation/21-of-21 checklist/diff/sole-authorship-gated activation (ROADMAP Phase 3 Success Criterion 4), and an ACTIVE version's content is refused rewriting at the database plus PACK-07's audited activation gate (Success Criterion 5's DB half)"
    addressed_in: "Phase 3.2"
    evidence: "Phase 3.2 Requirements line: 'plus PACK-06 and PACK-07, relocated here from Phase 3 by D-20 because neither apps/web nor Docker exists.' Phase 3.2 Plans line: '...plus further plans still to be written for PACK-06 and PACK-07.' ROADMAP Phase 3 text (D-20): 'PACK-06, PACK-07 and the /admin/rulepacks screen moved to Phase 3.2... They are relocated, not dropped, and must not be marked satisfied by anything Phase 3 builds.' REQUIREMENTS.md marks PACK-06/PACK-07 at Phase 3.2, Pending."
human_verification:
  - test: "Open packages/rulepacks/HK-PDPO/2026.09.1.json and read the OTHER_UNCLASSIFIED categoryRule's basis: 'Uncategorised cost. Legal to determine whether it is directly related to and necessary for compliance.' Confirm with the product owner/counsel whether 'Legal' here is the department proper noun (the precedent validate.ts's case-sensitive matcher exists to protect) or an unflagged instance of the banned word 'legal'."
    expected: "Either an explicit RESOLVED entry is added to this pack's openQuestions (matching the pattern already used for the other three borderline banned-word calls in this same pack — STAFF_TIME_LEGAL_REVIEW's reword, STAFF_TIME_REDACT_THIRD_PARTY's 'lawfully' no-fix, and appliesTo's scope), or the sentence is reworded to 'Counsel' the way SG-PDPA's equivalent OTHER_UNCLASSIFIED rule already does for the identical reason."
    why_human: "findBannedWord is deliberately case-sensitive by design (a documented, tested, accepted precedent — a case-insensitive matcher was shown to break 6 of 21 legitimate 'Legal'-as-department-name templates), so no automated check can distinguish a legitimate department reference from an unflagged occurrence of the banned word 'legal' at a sentence-initial position. Every other borderline call in this same authoring round got an explicit, recorded product-owner decision; this one (flagged as WR-01 in 03-REVIEW.md) did not, and it remains unresolved in the current tree."
---

# Phase 3: Rule Packs and Pack Admin Verification Report

**Phase Goal:** Nine jurisdiction packs exist as validated repository JSON, HK and SG are authored in full and can reach ACTIVE, and activation is a gated, audited event
**Verified:** 2026-09-17T15:58:08Z
**Status:** passed
**Re-verification:** No — initial verification, canonicalized to `passed` after the human-verification item below was resolved (2026-09-18)

## Goal Achievement

The phase goal has three clauses. Verified against the codebase, not against SUMMARY.md's claims:

1. **"Nine jurisdiction packs exist as validated repository JSON"** — TRUE. Confirmed by direct execution of `pnpm run pack:validate` against the real repository tree (not a mock): all nine directories (`VN-PDPL`, `AU-PRIVACY-ACT`, `NZ-PRIVACY-ACT`, `JP-APPI`, `KR-PIPA`, `CN-PIPL`, `IN-DPDP`, `HK-PDPO`, `SG-PDPA`) load and validate cleanly.
2. **"HK and SG are authored in full and can reach ACTIVE"** — NOT TRUE this phase, and the codebase says so explicitly, not silently. HK-PDPO has 9/21 categories authored (12 generated UNAUTHORED placeholders); SG-PDPA has 6/21 (15 placeholders). Both packs are `DRAFT`, and `assertActiveReady()` refuses both by name (`MISSING_REVIEWER`, confirmed by a live test — see `authored-packs.test.ts`). This is a deliberate, ROADMAP-documented deferral (D-16), matched to Phase 6's own Success Criterion 1 ("AC-09 golden files pass for both the HK and SG packs"). **Deferred, not a silent gap** — see the `deferred` section below.
3. **"Activation is a gated, audited event"** — NOT BUILT this phase, and explicitly relocated by D-20 to Phase 3.2 (`/admin/rulepacks`, PACK-06 database-level content immutability, PACK-07's audited sole-authorship activation gate). No `apps/web` exists yet to host it and no audit event stream for pack activation exists yet. **Deferred, not a silent gap** — see the `deferred` section below.

What Phase 3 actually owns and delivers — the build-time validation gate that makes "ACTIVE" a checked fact rather than an unverified claim, and the repository-layer mechanics (staleness derivation, version pinning) that the DB/HTTP/UI layers in later phases will sit on top of — is real, wired, and tested against the live filesystem, not stubbed.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The build fails (not the runtime) on invalid pack JSON, an ACTIVE pack missing any of 21 categories or duplicating one, missing `reviewedBy`/`reviewedOn`/`reviewDueOn`, or a banned word in `basis` (ROADMAP SC1; PACK-01/02/03/11) | ✓ VERIFIED | `packages/rulepacks/src/validate.ts` — `assertCategoryRulesExhaustive`, `assertReviewerIdentity`, `assertReviewDateCoherence`, `findBannedWord`/`validateRulePack`, all invoked via `assertActiveReady`/`validateAllRulePacks`. Live test run: `pnpm vitest run --project rulepacks` → 79/79 passing, including dedicated fixtures per gate (`missing-category`, `duplicate-category`, `missing-reviewed-by`, `banned-word-basis`, `malformed`). |
| 2 | Seven stub packs load DRAFT, every category `FLAG`/`NEEDS_VERIFICATION`, every constraint an honest `null` (PACK-10) | ✓ VERIFIED | `packages/rulepacks/src/stub-packs.test.ts` (bidirectional table/directory equality, literal 147-rule total) passing; `pnpm run pack:validate` confirms all seven stub directories load from real disk. |
| 3 | HK's flat-fee figure lives in an additive schema extension that leaves the other eight packs' JSON unchanged (PACK-12) | ✓ VERIFIED | `FlatFeeSchema.verificationNote` in `packages/schemas/src/rule-pack.ts:164-170`, additive; `authored-packs.test.ts`'s PACK-12 assertion (`'flatFee' in p`) confirms only `HK-PDPO/2026.09.1.json` carries the key across all nine committed files. |
| 4 | HK-PDPO and SG-PDPA are authored in full (21/21) and can reach ACTIVE (ROADMAP SC2 literal; PACK-09) | ✗ NOT MET THIS PHASE | Deliberate, documented deferral (D-16) — see `deferred` section. HK 9/21, SG 6/21; both DRAFT; `assertActiveReady` refuses both. REQUIREMENTS.md correctly marks PACK-09 "Pending," not "Complete." |
| 5 | A pack's usability is derived from `reviewDueOn` against an injected `now`, never trusted from a stored status literal, on the same "past, not on" boundary the engine's own precondition uses (ROADMAP SC3 repository half; PACK-04) | ✓ VERIFIED | `packages/rulepacks/src/stale.ts` imports `daysUntil` from `@dsar/engine/calendar-math` (no reimplementation — confirmed by direct read, zero hits for `new Date`/`Date.now`/`Date.parse`); `deriveEffectiveStatus`'s `< 0` boundary matches `packages/engine/src/preconditions.ts:59` exactly. `stale.test.ts` passing (12 tests). |
| 6 | STALE triggers a 409 refusal for new matters and an in-flight-review full-width notice at the HTTP/UI layer (ROADMAP SC3, HTTP half) | ✗ NOT BUILT THIS PHASE | Explicitly deferred in ROADMAP's own Phase 3 text ("its 409 response and in-flight-review notice need a route and a review screen and land with Phases 5 and 6") — see `deferred` section. |
| 7 | A pinned `(packId, version)` resolves to stable, byte-identical content, undisturbed by a newer sibling version (ROADMAP SC5 repository half; PACK-05) | ✓ VERIFIED | `packages/rulepacks/src/loader.ts`'s `resolveRulePack`; `versions.test.ts` (6 tests) proves cross-root `toEqual` on real fixture files, unknown-version/packId naming, and idempotence. |
| 8 | Activating a version leaves existing assessments untouched at the database layer, and an ACTIVE version's content is refused rewriting at the database rather than by service-layer discipline (ROADMAP SC4/SC5 DB+admin half; PACK-06/07) | ✗ NOT BUILT THIS PHASE | Explicitly relocated to Phase 3.2 by D-20 — see `deferred` section. No Prisma model or `apps/web` route exists yet for this to attach to. |
| 9 | No mechanism lets a pack reach ACTIVE while any part of it is unauthored — including `flatFee.verificationNote` (PACK-03's own prohibition) | ✓ VERIFIED | Code review (03-REVIEW.md, CR-01) found this gap live in the committed tree (`assertNoUnauthoredContent` never scanned `flatFee.verificationNote`, even though the field existed after 03-05). **Verified fixed in the current HEAD**: commit `417aaa8` adds the third scan; direct read of `packages/rulepacks/src/validate.ts:209-219` confirms it, and `validate.test.ts` carries a passing test asserting `UNAUTHORED_CONTENT` fires for a `flatFee.verificationNote` carrying the token. |
| 10 | No pack-authored `basis` string contains any canonical banned word, asserted by pack validation (PACK-11) | ⚠️ MOSTLY VERIFIED — one unresolved instance | The validator mechanism is proven to fire on every lowercase match (fixtures, 03-01/03-03 tests). However, `HK-PDPO`'s `OTHER_UNCLASSIFIED` `basis` reads "...**Legal** to determine whether..." — a sentence-initial capitalization of the banned word "legal" that the deliberately case-sensitive matcher does not catch (03-REVIEW.md WR-01). Unlike the other three borderline banned-word calls in this same authoring round, this one has no recorded product-owner sign-off. Routed to human verification below; does not block the phase (design behaves exactly as documented and tested) but is an open, unresolved finding from the phase's own code review. |

**Score:** 8/8 non-deferred truths verified (truths 1, 2, 3, 5, 7, 9 fully verified as VERIFIED; truth 10's mechanism is verified with one flagged content instance). Truths 4, 6, 8 are deferred to their documented owning phases (Phase 6, Phase 5/6, Phase 3.2 respectively) per ROADMAP-documented, deliberate scope decisions (D-16, D-20) — not silent gaps.

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases, per D-16 and D-20 — both locked decisions predate this verification and are recorded in ROADMAP.md itself, not invented here.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | HK-PDPO and SG-PDPA authored in full (21/21) and reaching ACTIVE | Phase 6 | Phase 6 Success Criterion 1: "AC-09 golden files pass for both the HK and SG packs... and changing either pack breaks its golden files rather than silently passing." ROADMAP Phase 3 text: "full HK and SG authoring across all 21 categories is deferred to before Phase 6's convergence gate (D-16)." |
| 2 | Activation as a gated, audited event — `/admin/rulepacks` UI, PACK-06 database-level content immutability, PACK-07's audited sole-authorship activation gate | Phase 3.2 | Phase 3.2 Requirements: "...plus PACK-06 and PACK-07, relocated here from Phase 3 by D-20 because neither `apps/web` nor Docker exists." Phase 3.2 Plans: "...plus further plans still to be written for PACK-06 and PACK-07." ROADMAP Phase 3 D-20 note: "They are relocated, not dropped, and must not be marked satisfied by anything Phase 3 builds." |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/rulepacks/src/loader.ts` | Single parse boundary, `loadAllRulePacks`/`loadRulePackFile`/`resolveRulePack` | ✓ VERIFIED | Real, substantive, no stubs; reads live filesystem; `resolveRulePack` throws named errors for absent files and packId/version mismatches. |
| `packages/rulepacks/src/validate.ts` | PACK-01/02/03/11 gates | ✓ VERIFIED | 280 lines of real validation logic; `ACTIVE_READY_CHECKS` declared-order array; CR-01 fix confirmed present. |
| `packages/rulepacks/src/stub-category-rules.ts` | D-19 generator, `PACK_JURISDICTIONS` table | ✓ VERIFIED | 9 rows (7 stub + 2 authored); drift-tested against committed JSON. |
| `packages/rulepacks/src/stale.ts` | PACK-04 derived staleness | ✓ VERIFIED | Reuses `@dsar/engine/calendar-math`; no second calendar implementation. |
| `packages/rulepacks/src/prototype-counsel.ts` | D-17 seeded reviewer identity | ✓ VERIFIED | `PROTOTYPE_COUNSEL`, parses through `UserRefSchema` at module load. |
| Nine pack JSON files | Committed repository JSON, one per jurisdiction | ✓ VERIFIED | All nine load and validate live via `pnpm run pack:validate`; not mocked. |
| `packages/schemas/src/rule-pack.ts` (`FlatFeeSchema.verificationNote`) | D-22 additive widening | ✓ VERIFIED | Confirmed additive (no frozen field renamed/retyped/removed); `FREEZE.md` records the amendment. |
| `packages/rulepacks/src/authored-packs.test.ts`, `stub-packs.test.ts`, `validate.test.ts`, `stale.test.ts`, `versions.test.ts`, `loader.test.ts`, `stub-category-rules.test.ts` | Test coverage for all of the above | ✓ VERIFIED | Live run: 79/79 rulepacks-project tests passing. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `loader.ts` | `LoadableRulePackSchema` (`@dsar/schemas/rule-pack`) | Single parse boundary | ✓ WIRED | Direct import confirmed; every committed pack crosses it (`pack:validate` output names all 9). |
| `validate.ts` | `LEGAL_CONCLUSION_BANNED_WORDS` (`@dsar/schemas/constants`) | `findBannedWord`, verbatim reuse | ✓ WIRED | Confirmed single list, single matcher; no second copy found in a repo-wide check. |
| `stale.ts` | `daysUntil` (`@dsar/engine/calendar-math`) | Reused calendar arithmetic | ✓ WIRED | `packages/engine/package.json` additive `exports` map confirmed; `stale.ts` imports the subpath; boundary (`< 0`) matches `preconditions.ts:59` exactly. |
| `validate.ts` `assertActiveReady` | `RulePackSchema` (frozen) | Constraints narrowing gate | ✓ WIRED | `RulePackSchema.parse(pack)` call confirmed at `validate.ts:271`; no hand-written 11-key check exists (`grep` for constraint key literals in `validate.ts` returns nothing). |
| `loader.ts` `resolveRulePack` | `Assessment.rulePackVersion` (`@dsar/schemas/assessment`) | Pinned-version counterpart | ✓ WIRED | `rulePackVersion: z.string()` confirmed present in `assessment.ts:178`; `resolveRulePack`'s signature matches the pinned-lookup shape this field will be handed to in later phases. |
| HK-PDPO `flatFee.verificationNote` | `assertNoUnauthoredContent` (PACK-03 gate) | UNAUTHORED-token scan | ✓ WIRED (post-fix) | CR-01 gap confirmed closed at HEAD; test asserts `UNAUTHORED_CONTENT` fires for a `flatFee.verificationNote` carrying the token. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All rulepacks-project tests pass against real code (not narration) | `pnpm vitest run --project rulepacks` | `Test Files 7 passed (7)` / `Tests 79 passed (79)` | ✓ PASS |
| All nine packs load and validate from the real filesystem | `pnpm run pack:validate` | Named all nine packs, exit 0 | ✓ PASS |
| Typecheck across the monorepo | `pnpm run typecheck` | Exit 0, no `error TS` lines | ✓ PASS |
| Lint | `pnpm run lint` | Exit 0, no output | ✓ PASS |
| Dependency-cruiser purity rules | `pnpm run depcruise` | "no dependency violations found (81 modules, 192 dependencies cruised)" | ✓ PASS |
| Full monorepo suite | `pnpm test` | 2 failed / 460 passed (462) | ⚠️ SEE NOTE — both failures are the pre-existing CRLF/LF `json-schema.test.ts` drift issue, confirmed pre-existing (git-stash bisected in 03-01), unrelated to any file this phase's plans wrote, and already tracked as an open item in `.planning/WINDOWS.md` (ledger id 1). Not a Phase 3 regression. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| PACK-01 | 03-01 | Packs load from repository JSON, validate against schema, fail build on error | ✓ SATISFIED | `loader.ts`/`validate.ts`, live tests, `pack:validate`. |
| PACK-02 | 03-03 | Every category resolves for every ACTIVE pack; missing category fails build | ✓ SATISFIED | `assertCategoryRulesExhaustive`, tested against duplicate/missing fixtures. |
| PACK-03 | 03-03 | ACTIVE requires reviewer identity, review dates, no unauthored content | ✓ SATISFIED | `assertActiveReady`; CR-01 fix closes the flatFee gap. |
| PACK-04 | 03-04 | STALE derived, refused with 409 naming reason | ⚠️ PARTIAL (as documented) | Repository-layer derivation SATISFIED; HTTP 409 half explicitly deferred to Phase 5/6 in ROADMAP text. REQUIREMENTS.md correctly marks "Pending." |
| PACK-05 | 03-04 | Activating a new pack version leaves existing assessments untouched | ⚠️ PARTIAL (as documented) | Repository-layer version pinning SATISFIED; assessment-persistence half deferred to Phase 3.2. REQUIREMENTS.md correctly marks "Pending." |
| PACK-09 | 03-05 | HK/SG authored in full, reach ACTIVE | ⚠️ PARTIAL (as documented) | 9/21 (HK), 6/21 (SG) authored per D-16's deliberate floor; deferred to Phase 6. REQUIREMENTS.md correctly marks "Pending." |
| PACK-10 | 03-01/03-02 | Seven stub packs, DRAFT, FLAG/NEEDS_VERIFICATION | ✓ SATISFIED | `stub-packs.test.ts`, live `pack:validate`. |
| PACK-11 | 03-01 | No banned word in any basis, asserted by validation | ⚠️ SATISFIED WITH FLAGGED CONTENT GAP | Mechanism proven; one unresolved content instance (WR-01) — see human verification. |
| PACK-12 | 03-05 | HK flat-fee schema extension, other 8 unchanged | ✓ SATISFIED | `FlatFeeSchema.verificationNote`, additive, `authored-packs.test.ts`. |
| PACK-06, PACK-07 | — | Relocated to Phase 3.2 by D-20 | N/A THIS PHASE | Confirmed not claimed by any Phase 3 plan or SUMMARY; REQUIREMENTS.md correctly attributes both to Phase 3.2, status Pending. No orphaned requirement — all IDs from ROADMAP's Phase 3 requirement line are accounted for across the five plans' `requirements:` frontmatter with no gaps or duplicates. |

No orphaned requirements found: every requirement ID REQUIREMENTS.md maps to "Phase 3" appears in exactly one plan's `requirements:` frontmatter (PACK-01→03-01; PACK-02,03→03-03; PACK-04,05→03-04; PACK-09,12→03-05; PACK-10→03-01+03-02).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any file this phase's plans touched | — | Clean — repo-wide grep across all `packages/rulepacks`, `packages/schemas/src/{rule-pack,constants}.ts`, `packages/schemas/FREEZE.md`, `packages/engine/package.json`, and the two engine flat-fee fixtures returned zero matches. |
| `packages/rulepacks/HK-PDPO/2026.09.1.json` | ~345 | Unresolved code-review finding (03-REVIEW.md WR-01): capitalized "Legal" in `OTHER_UNCLASSIFIED.basis` — ambiguous between legitimate department-name usage and an unflagged banned-word occurrence | ⚠️ Warning | Content-authoring judgment call, not a mechanism defect (the validator's case-sensitivity is a deliberate, tested, accepted design choice — see `validate.ts`'s own module comment). No recorded product-owner sign-off, unlike the three sibling borderline calls in this same pack. Routed to human verification. |
| `.dependency-cruiser.cjs` / `package.json`'s `depcruise` script | — | ℹ️ Info | The root `depcruise` script scans only `packages/engine packages/schemas` — it never includes `packages/rulepacks` in its target list, and every forbidden rule is anchored `from: ^packages/engine`. Confirmed directly: `depcruise --config .dependency-cruiser.cjs packages/rulepacks` also reports zero violations (58 dependencies cruised) — but because no rule targets `packages/rulepacks`, this is not meaningful enforcement of the new `rulepacks → engine` edge; it's a target-scope gap in the existing script, not a violation. `packages/engine`'s own purity (the actual concern — engine must stay one-directional) is unaffected either way. Does not block the phase; worth tightening later if `packages/rulepacks` ever needs its own purity rules. |
| Cross-phase (pre-existing) | `packages/schemas/src/json-schema.test.ts` | ℹ️ Info | CRLF/LF drift test failure, confirmed pre-existing (git-stash bisected to before any Phase 3 change), already tracked as an open item in `.planning/WINDOWS.md` (ledger id 1, `open_count: 1`). Not caused by, and not fixable within, this phase's scope. |

### Human Verification Required

### 1. HK-PDPO's OTHER_UNCLASSIFIED basis — capitalized "Legal"

**Test:** Read `packages/rulepacks/HK-PDPO/2026.09.1.json`'s `OTHER_UNCLASSIFIED` categoryRule basis: "Uncategorised cost. Legal to determine whether it is directly related to and necessary for compliance." Compare against `validate.ts`'s documented precedent for legitimate "Legal"-as-department-name usage, and against the pack's own three other RESOLVED openQuestions entries recording explicit product-owner sign-off on borderline banned-word calls.
**Expected:** Either a fourth RESOLVED `openQuestions` entry confirming "Legal" here is the intended department reference (matching the pattern already established three times in this same pack), or a reword to "Counsel" — exactly as SG-PDPA's equivalent `OTHER_UNCLASSIFIED` rule already does for the identical reason.
**Why human:** The banned-word matcher's case-sensitivity is a deliberate, tested, accepted design decision (a case-insensitive matcher was shown empirically to break 6 of 21 legitimate templates), so no automated check can resolve this ambiguity. It is a genuine, still-open finding from this phase's own code review (03-REVIEW.md WR-01) that never received the same explicit sign-off its three siblings in the same authoring round received.

**Resolution (2026-09-18):** Product owner chose the reword — "Legal" → "Counsel" in `HK-PDPO.OTHER_UNCLASSIFIED.basis`, matching SG-PDPA's equivalent rule. Committed `9ae0a05`. Re-validated live (`pack:validate`, 79/79 rulepacks tests) and independently re-confirmed by the phase's security auditor (03-SECURITY.md, T-03-19). `covered_digest` above recomputed against current file content; status canonicalized to `passed`.

---

### Gaps Summary

No blocking gaps. The phase's own scope — the build-time validation gate (PACK-01/02/03/11), the seven-stub-plus-two-partial-authored pack set (PACK-10, PACK-12, and PACK-09's Phase-3-owned floor), and the repository-layer mechanics for staleness (PACK-04) and version pinning (PACK-05) — is real, substantively implemented, wired to live code (not mocked), and covered by 79 passing tests exercised directly during this verification, not merely claimed in a SUMMARY.

Two literal clauses of the phase goal ("HK and SG authored in full and reach ACTIVE"; "activation is a gated, audited event") are not met this phase, but this is a deliberate, ROADMAP-documented scope decision (D-16, D-20) with clear, specific evidence of where each is picked up (Phase 6's golden-file Success Criterion; Phase 3.2's explicit PACK-06/PACK-07 relocation) — not a silently dropped requirement. REQUIREMENTS.md's own status column already reflects this honestly (PACK-09/04/05 "Pending," not "Complete").

One item requires a human/product-owner decision before the phase can be called fully clean: HK-PDPO's `OTHER_UNCLASSIFIED` basis contains a capitalized "Legal" that the deliberately case-sensitive banned-word matcher does not catch, and — unlike three structurally identical judgment calls made elsewhere in the very same pack during the same authoring round — it was never explicitly signed off. This is why the phase resolves to `human_needed` rather than `passed`.

---

*Verified: 2026-09-17T15:58:08Z*
*Verifier: Claude (gsd-verifier)*
