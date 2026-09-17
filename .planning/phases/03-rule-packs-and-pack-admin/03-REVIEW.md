---
phase: 03-rule-packs-and-pack-admin
reviewed: 2026-09-17T00:00:00Z
depth: standard
files_reviewed: 44
files_reviewed_list:
  - packages/engine/package.json
  - packages/engine/src/__fixtures__/flat-fee-pack.ts
  - packages/engine/src/flat-fee.test.ts
  - packages/rulepacks/AU-PRIVACY-ACT/2026.09.1.json
  - packages/rulepacks/CN-PIPL/2026.09.1.json
  - packages/rulepacks/HK-PDPO/2026.09.1.json
  - packages/rulepacks/IN-DPDP/2026.09.1.json
  - packages/rulepacks/JP-APPI/2026.09.1.json
  - packages/rulepacks/KR-PIPA/2026.09.1.json
  - packages/rulepacks/NZ-PRIVACY-ACT/2026.09.1.json
  - packages/rulepacks/SG-PDPA/2026.09.1.json
  - packages/rulepacks/VN-PDPL/2026.09.1.json
  - packages/rulepacks/package.json
  - packages/rulepacks/scripts/validate-cli.ts
  - packages/rulepacks/src/__fixtures__/active-ready.fixture.json
  - packages/rulepacks/src/__fixtures__/banned-word-basis.fixture.json
  - packages/rulepacks/src/__fixtures__/duplicate-category.fixture.json
  - packages/rulepacks/src/__fixtures__/malformed.fixture.json
  - packages/rulepacks/src/__fixtures__/missing-category.fixture.json
  - packages/rulepacks/src/__fixtures__/missing-reviewed-by.fixture.json
  - packages/rulepacks/src/__fixtures__/unauthored-token.fixture.json
  - packages/rulepacks/src/__fixtures__/versions-single/ACME-FIXTURE/2026.01.1.json
  - packages/rulepacks/src/__fixtures__/versions/ACME-FIXTURE/2026.01.1.json
  - packages/rulepacks/src/__fixtures__/versions/ACME-FIXTURE/2026.06.1.json
  - packages/rulepacks/src/authored-packs.test.ts
  - packages/rulepacks/src/loader.test.ts
  - packages/rulepacks/src/loader.ts
  - packages/rulepacks/src/prototype-counsel.ts
  - packages/rulepacks/src/stale.test.ts
  - packages/rulepacks/src/stale.ts
  - packages/rulepacks/src/stub-category-rules.test.ts
  - packages/rulepacks/src/stub-category-rules.ts
  - packages/rulepacks/src/stub-constraints.ts
  - packages/rulepacks/src/stub-packs.test.ts
  - packages/rulepacks/src/validate.test.ts
  - packages/rulepacks/src/validate.ts
  - packages/rulepacks/src/versions.test.ts
  - packages/rulepacks/tsconfig.json
  - packages/schemas/FREEZE.md
  - packages/schemas/src/constants.ts
  - packages/schemas/src/rule-pack.test.ts
  - packages/schemas/src/rule-pack.ts
  - tsconfig.json
  - vitest.config.ts
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-09-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 44
**Status:** issues_found

## Summary

Reviewed the Phase 3 schema/validator/loader/staleness code and all nine
committed rule packs (HK-PDPO, SG-PDPA authored; AU, NZ, JP, KR, CN, IN, VN
stub). The engineering is disciplined overall: the loader/validator split is
clean, `deriveEffectiveStatus`'s never-upgrade/never-revive asymmetries are
correctly implemented and tested at both boundaries, the PACK-02 exhaustiveness
check correctly rejects a complete-but-duplicated pack (not just a naive
set-size check), and the stub generator/drift test pairing (D-19) is sound.
Money in both authored packs is consistently expressed in integer minor
units with no floats. The `FlatFeeSchema.verificationNote` schema widening
(D-22) is genuinely additive as FREEZE.md claims, and the two engine-side
`FlatFee` literals were correctly updated to match.

However, one finding is a genuine, unfixed gap between the phase's own stated
design (D-22, and validate.ts's own TODO comment) and its implementation: the
PACK-03 ACTIVE-readiness gate never scans `flatFee.verificationNote` for the
`UNAUTHORED_TOKEN` marker, so a future pack that reaches ACTIVE status with an
unauthored flat-fee figure still carrying the token would not be caught by
`assertActiveReady`. A second finding notes an un-flagged occurrence of the
banned word "Legal" in HK-PDPO's `OTHER_UNCLASSIFIED` basis text that, unlike
every other borderline banned-word judgment call in the same pack, has no
recorded product-owner sign-off.

## Critical Issues

### CR-01: PACK-03's `assertNoUnauthoredContent` never scans `flatFee.verificationNote`, so an ACTIVE pack can carry an unauthored flat fee undetected

**File:** `packages/rulepacks/src/validate.ts:182-210` (see also the stale
comment at lines 185-190)

**Issue:** `validate.ts`'s own module comment says outright:

> NOTE: `flatFee.verificationNote` is NOT scanned here. `FlatFeeSchema`
> (packages/schemas/src/rule-pack.ts) does not yet carry a `verificationNote`
> field — D-22's flat-fee UNAUTHORED-token channel is scheduled to land in
> plan 03-05 alongside the HK-PDPO pack that is this schema's only consumer.
> When that field lands, add a `pack.flatFee?.verificationNote` check here...

`FlatFeeSchema.verificationNote` **did** land in this same phase (plan 03-05,
`packages/schemas/src/rule-pack.ts:164-170`, confirmed by
`packages/schemas/FREEZE.md`'s "D-22" amendment section), and HK-PDPO's
committed pack now sets `flatFee.verificationNote` to a non-null string
(`packages/rulepacks/HK-PDPO/2026.09.1.json:388`). But `assertNoUnauthoredContent`
(`validate.ts:191-210`) was never updated to add the flagged check — it still
only scans `pack.categoryRules[].verificationNote` and
`pack.requestorNoticeTemplate`.

Concretely: nothing in `assertActiveReady`'s five-check pipeline
(`ACTIVE_READY_CHECKS`, `validate.ts:235-244`) would refuse a pack whose
`status` is `"ACTIVE"` and whose `flatFee.verificationNote` still starts with
`UNAUTHORED_TOKEN`. The final re-parse against the frozen `RulePackSchema`
doesn't help either — `RulePackSchema`'s `flatFee.verificationNote` is a plain
`z.string().nullable()` with no token-awareness (schema-level typing was never
meant to encode this business rule; that's exactly why `assertNoUnauthoredContent`
exists for the analogous `categoryRules` and `requestorNoticeTemplate` cases).

This defeats the entire point of D-22/D-15's design: the `UNAUTHORED_TOKEN`
marker exists specifically so nobody can forget to formally verify a
provisional figure before it goes live — "a rule is 'unauthored' in a way
that must be indistinguishable from nothing, not from a decision"
(`packages/schemas/src/constants.ts:54-63`). For every other authored channel
(`categoryRules[].verificationNote`, `requestorNoticeTemplate`) that guarantee
is machine-enforced; for `flatFee.verificationNote` it currently is not.

No committed pack is ACTIVE today (all nine are DRAFT), so this gap is latent
rather than actively wrong right now — but it is a genuine, silent hole in a
safety-critical validator that the code's own comment flagged as a TODO for
this exact phase and the TODO was not completed. No test in
`validate.test.ts` or `authored-packs.test.ts` exercises this path either
(both files check `categoryRules[].verificationNote`/`requestorNoticeTemplate`
UNAUTHORED_CONTENT paths, but nothing constructs a pack with an
UNAUTHORED-tagged `flatFee.verificationNote` and a `status: "ACTIVE"`).

**Fix:**
```ts
// in assertNoUnauthoredContent, packages/rulepacks/src/validate.ts
function assertNoUnauthoredContent(pack: LoadableRulePack): void {
  for (const rule of pack.categoryRules) {
    if (rule.verificationNote !== null && rule.verificationNote.startsWith(UNAUTHORED_TOKEN)) {
      throw new RulePackValidationFailure(
        "UNAUTHORED_CONTENT",
        pack.packId,
        `Pack "${pack.packId}" categoryRule "${rule.ruleId}" verificationNote still carries the ${UNAUTHORED_TOKEN} token`,
        rule.ruleId
      );
    }
  }

  if (pack.flatFee?.verificationNote?.startsWith(UNAUTHORED_TOKEN)) {
    throw new RulePackValidationFailure(
      "UNAUTHORED_CONTENT",
      pack.packId,
      `Pack "${pack.packId}" flatFee verificationNote still carries the ${UNAUTHORED_TOKEN} token`
    );
  }

  if (pack.requestorNoticeTemplate.startsWith(UNAUTHORED_TOKEN)) {
    throw new RulePackValidationFailure(
      "UNAUTHORED_CONTENT",
      pack.packId,
      `Pack "${pack.packId}" requestorNoticeTemplate still carries the ${UNAUTHORED_TOKEN} token`
    );
  }
}
```
Add a matching `validate.test.ts` case: an `active-ready.fixture.json`-derived
pack with a `flatFee` whose `verificationNote` starts with `UNAUTHORED_TOKEN`
must throw `UNAUTHORED_CONTENT` naming the flat fee. Also update the now-stale
module comment at `validate.ts:185-190`, which still says the check is
unimplemented pending a schema change that has already happened.

## Warnings

### WR-01: HK-PDPO's `OTHER_UNCLASSIFIED` basis contains the banned word "Legal", undetected only because of sentence-initial capitalization, with no recorded sign-off

**File:** `packages/rulepacks/HK-PDPO/2026.09.1.json:345`

**Issue:** The basis text reads:

> "Uncategorised cost. Legal to determine whether it is directly related to
> and necessary for compliance."

`findBannedWord` is deliberately case-sensitive (`validate.ts:59-65`,
confirmed by its own test at `validate.test.ts:108-110`:
`findBannedWord("This outcome is Compliant...")` returns `null`), because a
case-insensitive matcher was shown to break legitimate uses of "Legal" as the
department's proper noun (module comment, `validate.ts:14-17`). That
precedent covers a genuine proper-noun reference to a Legal department. Here,
though, "Legal" is capitalized only because it is the first word of a new
sentence — the same capitalization a lowercase "legal" would receive at that
position — so this instance is not distinguishable, by the matcher or by a
reader, from the literal banned word "legal" the scan exists to catch.

Every other borderline banned-word judgment call touching this same pack has
an explicit `RESOLVED` entry in `openQuestions` recording the product owner's
sign-off (see `HK-PDPO/2026.09.1.json:375-377`: the `STAFF_TIME_LEGAL_REVIEW`
basis reword, and the `STAFF_TIME_REDACT_THIRD_PARTY` "lawfully" no-fix-needed
decision). SG-PDPA's equivalent `OTHER_UNCLASSIFIED` rule deliberately used
"Counsel" instead of "Legal" for exactly this reason, and that choice is
recorded as its own `RESOLVED` entry
(`SG-PDPA/2026.09.1.json:375`: "...Counsel to determine whether it is a
service provided..."). HK-PDPO's `OTHER_UNCLASSIFIED` rule has no equivalent
recorded decision — it is the one banned-word-adjacent judgment call in this
pack that was not explicitly escalated and confirmed, despite the pattern the
rest of the pack establishes.

Both `validate.test.ts` and `authored-packs.test.ts` (`findBannedWord(rule.basis)`
assertions) pass today because of the matcher's documented case-sensitivity —
this is not a test gap, but it does mean the automated gate provides no actual
protection against this specific occurrence.

**Fix:** Either record an explicit product-owner-confirmed `RESOLVED` entry in
`openQuestions` (matching the pattern already used three times in this same
pack) affirming "Legal" here is the intended department reference, or reword
to "Counsel" as SG-PDPA did, removing the ambiguity outright.

### WR-02: Identical `rateSanityCeiling` figures across HK-PDPO and SG-PDPA with no basis/citation for either

**File:** `packages/rulepacks/HK-PDPO/2026.09.1.json:29-33`,
`packages/rulepacks/SG-PDPA/2026.09.1.json:33-37`

**Issue:** Both packs carry the exact same `rateSanityCeiling` figures
(`ADMIN: 3000, EXECUTIVE: 5000, MANAGER: 9000`) in two different currencies
(HKD minor units vs SGD minor units). Unlike every `categoryRule` and the
`flatFee`, `rateSanityCeiling` carries no `basis`/`citation`/`verificationNote`
field to record where these entity-specific sanity-check figures came from,
so there is no way to confirm from the pack JSON alone whether this is a
deliberate parity (e.g. both figures transcribed from the same PRD table) or
an accidental copy-paste that never differentiated the two currencies. Given
this project's D-14 rule ("no invented legal content — every rule pack value
must trace to the PRD"), a reviewer with the PRD open should confirm this
parity is sourced rather than copied.

**Fix:** No code change needed if the PRD independently specifies identical
figures for both jurisdictions; otherwise correct the value that doesn't
match its source and consider whether `rateSanityCeiling` should carry a
provenance note the way `flatFee` and `categoryRules` do.

## Info

### IN-01: `RulePackValidationFailure.ruleId` typed as `string | undefined` purely to satisfy `exactOptionalPropertyTypes`

**File:** `packages/rulepacks/src/validate.ts:41`

**Issue:** Not a defect — flagged only because the reasoning is
non-obvious without the inline comment. `readonly ruleId: string | undefined`
(rather than `ruleId?: string`) is required because the constructor always
assigns the field, including explicit `undefined`, and
`exactOptionalPropertyTypes` forbids assigning `undefined` to a `?:` member.
Confirmed correct as implemented; noting only so a future refactor doesn't
"simplify" this back to `ruleId?: string` and reintroduce a type error.

**Fix:** None required.

---

_Reviewed: 2026-09-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
