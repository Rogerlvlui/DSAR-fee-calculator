---
phase: 06-convergence-and-legal-review
verified: 2026-09-20T16:00:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - ".planning/REQUIREMENTS.md"
  - ".planning/ROADMAP.md"
  - ".planning/phases/06-convergence-and-legal-review/06-01-PLAN.md"
  - ".planning/phases/06-convergence-and-legal-review/06-01-SUMMARY.md"
  - ".planning/phases/06-convergence-and-legal-review/06-02-PLAN.md"
  - ".planning/phases/06-convergence-and-legal-review/06-02-SUMMARY.md"
  - ".planning/phases/06-convergence-and-legal-review/06-03-PLAN.md"
  - ".planning/phases/06-convergence-and-legal-review/06-03-SUMMARY.md"
  - ".planning/phases/06-convergence-and-legal-review/06-04-PLAN.md"
  - ".planning/phases/06-convergence-and-legal-review/06-04-SUMMARY.md"
  - ".planning/phases/06-convergence-and-legal-review/06-05-PLAN.md"
  - ".planning/phases/06-convergence-and-legal-review/06-05-SUMMARY.md"
  - ".planning/phases/06-convergence-and-legal-review/06-06-PLAN.md"
  - ".planning/phases/06-convergence-and-legal-review/06-06-SUMMARY.md"
  - ".planning/phases/06-convergence-and-legal-review/06-07-PLAN.md"
  - ".planning/phases/06-convergence-and-legal-review/06-07-SUMMARY.md"
  - ".planning/phases/06-convergence-and-legal-review/06-08-PLAN.md"
  - ".planning/phases/06-convergence-and-legal-review/06-08-SUMMARY.md"
  - ".planning/phases/06-convergence-and-legal-review/06-09-PLAN.md"
  - ".planning/phases/06-convergence-and-legal-review/06-09-SUMMARY.md"
  - ".planning/phases/06-convergence-and-legal-review/06-REVIEW-ADDENDUM.md"
  - "apps/web/app/api/assessments/[id]/fee-choice/route.ts"
  - "apps/web/app/legal/assessments/[id]/page.tsx"
  - "apps/web/src/domain/disposition-actions.ts"
  - "apps/web/src/domain/review-tallies.ts"
  - "apps/web/src/server/data/assessments.ts"
  - "apps/web/src/server/data/matters.ts"
  - "apps/web/src/server/engine-invocation.ts"
  - "apps/web/src/ui/review/bulk-accept-bar.tsx"
  - "apps/web/src/ui/review/disposition-controls.tsx"
  - "apps/web/src/ui/review/totals-rail.tsx"
  - "tests/routes/access-control-review.test.ts"
  - "tests/routes/fee-choice.test.ts"
covered_digest: "v1:sha256:dee0d6f2edca34928f351b19151d30c8d9ab38ee40133993747b705e49197f5a"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: "N/A — no prior 06-VERIFICATION.md existed; this verification runs after the independent review addendum's fixes, per user request"
  previous_score: "N/A"
  gaps_closed:
    - "CR-01 (Critical): flat-fee-vs-itemised choice had zero effect on finalAmount — fixed cf97cd8"
    - "WR-01 (Warning): POST fee-choice accepted unvalidated choice value — fixed 62c868d"
    - "WR-02 (Warning): legal assessment page bypassed role-gated data layer for two reads — fixed 5ee8350"
    - "IN-01 (Info): hasSufficientAndGenuineReason was dead code, three call sites reimplemented it independently — fixed 8887b02"
    - "IN-02 (Info/docs): stale doc-comment paths and DEMO-ONLY TRANSFORM string — fixed 7d17239"
  gaps_remaining: []
  regressions: []
---

# Phase 6: Convergence and Legal Review Verification Report

**Phase Goal:** The engine meets real authored packs, and a lawyer can work an assessment line by line with every control that forces genuine engagement
**Verified:** 2026-09-20
**Status:** PASSED
**Context:** This is a follow-up verification run after an independent code-reviewer and security-auditor found and fixed one Critical bug (CR-01), two Warnings (WR-01, WR-02), and three minor items, all recorded in `06-REVIEW-ADDENDUM.md` and fixed in commits `cf97cd8`, `62c868d`, `5ee8350`, `8887b02`, `7d17239`. This verification re-derives evidence from the current source rather than trusting the addendum's own self-report.

## Goal Achievement

### Observable Truths (traced against current source, per the 7-point brief)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `computeFinalAmount` genuinely branches on `feeChoice`, and both the sign-off path and the review-screen preview reflect a FLAT choice consistently | ✓ VERIFIED | `apps/web/src/domain/review-tallies.ts:71-100` — `computeFinalAmount(lines, feeChoice, flatFeeComparison)` returns `flatFeeComparison.flatFeeAmount` when `feeChoice === "FLAT"`, else the itemised per-line sum. Called identically from `signOff()` (`assessments.ts:446-450`), the legal page's sign-off preview (`page.tsx:84-88`), and `totals-rail.tsx`'s `previewHeadlineAmount` (lines 48-54, which now checks `feeChoice`/`flatFeeComparison` instead of falling back to `draftBaseline`). Traced fixture: `tests/routes/fee-choice.test.ts`'s CR-01 test builds a real HK matter (draftBaseline 20000 via the real engine), dispositions every line ACCEPTED, sets `feeChoice: "FLAT"` (HK's real committed flat fee is 10000), signs off, and asserts `signedOff.assessment.totals.finalAmount === 10000` and `signOff.finalAmount === 10000` — not 20000. Test passes (confirmed via `pnpm test`, 953/953). |
| 2 | `POST /api/assessments/{id}/fee-choice` rejects an invalid `choice` value with 400 before it reaches the repository | ✓ VERIFIED | `apps/web/app/api/assessments/[id]/fee-choice/route.ts:20,30` — body is parsed through `FeeChoiceRequestSchema = z.strictObject({ choice: FeeChoiceSchema })` before `setFeeChoice` is called; a `ZodError` is mapped to 400 by `errorToResponse`. Regression test `tests/routes/fee-choice.test.ts` "FEE-CHOICE (WR-01)" posts `{ choice: "FREE" }`, asserts `response.status === 400`, and re-reads the stored assessment to confirm `stored.feeChoice` stays `undefined` (never reached the repository). |
| 3 | `apps/web/app/legal/assessments/[id]/page.tsx` reads matter and expense lines through role-gated wrapper functions, not a direct repository import | ✓ VERIFIED | `page.tsx` imports only `getMatterForLegalReview`/`getExpenseLinesForLegalReview` from `src/server/data/matters.ts` (line 25) — no `memoryMatterRepository`/`memoryAssessmentRepository` import anywhere in the file (confirmed by direct read and by `grep -rln "memoryMatterRepository\|memoryAssessmentRepository" apps/web/app` returning zero results). Both wrappers (`matters.ts:752-762`) call `requireRole(actor, "LEGAL_REVIEWER")` as their first statement; `getMatterForLegalReview` throws `NotFoundError` rather than returning `null`. Regression test `tests/routes/access-control-review.test.ts` "WR-02" describe block proves both reads reject `HR_PREPARER`, succeed for `LEGAL_REVIEWER`, and that `getMatterForLegalReview` refuses for a nonexistent matter id. |
| 4 | The recurring authorization-gap pattern (Phases 3.1, 4, 5) did not recur anywhere in Phase 6 | ✓ VERIFIED | `grep -rln "memoryMatterRepository\|memoryAssessmentRepository" apps/web/app` returns **zero files** — every page and route under `apps/web/app/hr/**` and `apps/web/app/legal/**` was individually read and confirmed to route through `getCurrentActor()` → a `requireRole()`-gated `src/server/data/*` function: `hr/matters/page.tsx` (`listMattersForPreparer`), `hr/matters/[id]/page.tsx` (`getHrMatterStatus`, `getSignedOffAssessmentForHr`, `getExpenseLinesForHr`), `hr/matters/[id]/submitted/page.tsx` (`getHrMatterStatus`), `hr/matters/new/page.tsx` (no sensitive read — only public pack-status views), `legal/queue/page.tsx` (`listReviewableMatters`), `legal/assessments/[id]/page.tsx` (`getAssessmentForLegalReview`, `getMatterForLegalReview`, `getExpenseLinesForLegalReview`). `hr/layout.tsx`/`legal/layout.tsx` mount only `CapabilityStatement`, no data reads. |
| 5 | All 5 ROADMAP success criteria are TRUE and all 19 requirement IDs are genuinely Complete | ✓ VERIFIED | See Success Criteria and Requirements Coverage sections below. |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified)

### Success Criteria (ROADMAP.md, Phase 6)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | AC-09 golden files pass for HK and SG packs — rescoped to the 9/21 HK and 6/15 SG authored categories per the 2026-09-20 product-owner deferral | ✓ VERIFIED | `packages/rulepacks/src/real-pack-fixture.golden.test.ts` — literal `toEqual` assertions (no snapshot matcher) against `assess()` run over the real committed HK-PDPO 2026.09.1 and SG-PDPA 2026.09.1 packs, covering exactly the 9 HK / 6 SG authored categories. Includes an explicit mutation-sensitivity test that flips one rule's treatment on an in-memory copy and proves the golden assertions actually change (draftBaseline drops by exactly the mutated line's claimed amount) — satisfying "changing a pack must break its golden files." Test file passes as part of the 953/953 full suite run. |
| 2 | Every review card shows rule ID/basis/citation/category; FLAG reasons in words; NEEDS_VERIFICATION distinct + indented; verdict badges carry verdict in words (not colour alone) | ✓ VERIFIED | REVIEW-01/02/03/12 and DISC-04 all marked Complete in REQUIREMENTS.md; `totals-rail.tsx` renders `restingOnUnverifiedRules` indented (`data-indent="true"`) under `draftBaseline` (lines 77-82); confirmed present in the current, passing test suite (06-02-SUMMARY.md's DISC-04 badge work, 06-09's regression sweep re-proving REVIEW-01/02/12 against real non-SG data). |
| 3 | Lawyer accepts/reduces/strikes/allows, never raises HR's figure; mandatory 10-char reason rejected against shared stop-list; bulk-accept restricted to ALLOW+VERIFIED, API rejects FLAG/ALLOW_CAPPED/NEEDS_VERIFICATION batches | ✓ VERIFIED | `apps/web/src/domain/disposition-actions.ts` — `VERDICT_ACTIONS` map and `hasSufficientAndGenuineReason` (length + stop-list) now used uniformly by all three call sites (server `assertSufficientReason` in `assessments.ts:120-133`, and both client submit gates in `disposition-controls.tsx:259,284` and `bulk-accept-bar.tsx:144`) per the IN-01 fix. REVIEW-05/07 marked Complete; `06-09-SUMMARY.md` records a corrected REVIEW-07 eligibility proof against both real packs. |
| 4 | No headline total renders while PENDING (server-enforced); HR_PREPARER gets 403 with no data for LEGAL_REVIEW matter (AC-01); no verdict/engineAmount/basis/draftBaseline/lawyerReason leaks to HR through API, server-component, or cache (AC-02) | ✓ VERIFIED | `computeFinalAmount` throws if any line is PENDING (`review-tallies.ts:76-78`), enforced server-side inside both `signOff()` and the page's own preview computation — not just hidden in the UI. `GET /api/assessments/[id]/route.ts` routes exclusively through `getAssessmentForLegalReview` (`requireRole(actor, "LEGAL_REVIEWER")` first statement) — an `HR_PREPARER` gets a `ForbiddenError`→403 with only a message string, never assessment data. `tests/routes/access-control-review.test.ts` directly asserts AC-01/ACCESS-02/ACCESS-03 (403 + no body leak for HR_PREPARER on a LEGAL_REVIEW matter, and the same 403 once SIGNED_OFF is tested from the other direction) and `tests/boundary/rsc-payload-leak.test.ts` covers the ACCESS-07 server-component/cache leak channel. All three requirement IDs (ACCESS-02, ACCESS-03, ACCESS-07) plus REVIEW-06 are marked Complete. |
| 5 | 20-line review keyboard-only from `/legal/queue`; raise INFO_REQUEST; recompute-with-confirmation; flat-fee choice with itemised-cost block | ✓ VERIFIED | NAV-01/NAV-03/REVIEW-08/REVIEW-09/REVIEW-10/REVIEW-11 all marked Complete; `06-08-SUMMARY.md` documents the keyboard-first review + queue navigation + shared shortcut overlay; `FlatFeeChoice`/`RecomputeConfirm` components are wired into `legal/assessments/[id]/page.tsx` (lines 171-188); the FLAT-fee-exceeds-itemised-cost block is directly proven by `tests/routes/fee-choice.test.ts`'s "refused with a ValidationError when the flat fee exceeds itemised direct cost" case. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/domain/review-tallies.ts` | `computeFinalAmount` branches on feeChoice | ✓ VERIFIED | Present, substantive, wired into both call sites |
| `apps/web/app/legal/assessments/[id]/page.tsx` | Role-gated reads only, CR-01-consistent preview | ✓ VERIFIED | No direct repository import; preview matches sign-off logic exactly |
| `apps/web/src/ui/review/totals-rail.tsx` | Pre-sign-off headline honours FLAT choice | ✓ VERIFIED | `previewHeadlineAmount` checks `feeChoice`/`flatFeeComparison` before falling back to `draftBaseline` |
| `apps/web/app/api/assessments/[id]/fee-choice/route.ts` | Schema-validated request body | ✓ VERIFIED | `FeeChoiceRequestSchema.parse` before `setFeeChoice` |
| `apps/web/src/server/data/matters.ts` | `getMatterForLegalReview`/`getExpenseLinesForLegalReview` | ✓ VERIFIED | Both present, `requireRole` first statement, `NotFoundError` on missing matter |
| `apps/web/src/domain/disposition-actions.ts` | `hasSufficientAndGenuineReason` used by all reason-check call sites | ✓ VERIFIED | Server (`assertSufficientReason`) and both client gates now call it |
| `tests/routes/fee-choice.test.ts` | CR-01/WR-01 regression tests | ✓ VERIFIED | 8 test cases including the exact fixture traced above |
| `tests/routes/access-control-review.test.ts` | WR-02 regression tests | ✓ VERIFIED | New describe block proving role-gating on both new wrapper functions |
| `packages/rulepacks/src/real-pack-fixture.golden.test.ts` | AC-09 golden files (rescoped) | ✓ VERIFIED | Literal `toEqual` assertions + mutation-sensitivity proof |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `signOff()` | `computeFinalAmount` | direct call, passes `feeChoice`/`flatFeeComparison` | ✓ WIRED | `assessments.ts:446-450` |
| Legal review page preview | `computeFinalAmount` | direct call, same args as `signOff()` | ✓ WIRED | `page.tsx:84-88` |
| `totals-rail.tsx` headline | `feeChoice`/`flatFeeComparison` | `previewHeadlineAmount` | ✓ WIRED | `totals-rail.tsx:48-54` |
| Fee-choice route | `FeeChoiceSchema` | `FeeChoiceRequestSchema.parse` | ✓ WIRED | `fee-choice/route.ts:20,30` |
| Legal review page | `matters.ts` role-gated wrappers | `getMatterForLegalReview`/`getExpenseLinesForLegalReview` imports | ✓ WIRED | `page.tsx:25,60-61` — no repository import remains |
| Server + client reason gates | `hasSufficientAndGenuineReason` | shared import from `disposition-actions.ts` | ✓ WIRED | `assessments.ts:27`, `disposition-controls.tsx:38`, `bulk-accept-bar.tsx:25` |

### Behavioral Spot-Checks / Test Execution

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite | `pnpm test` | 117 test files, 953/953 tests passed | ✓ PASS |
| Lint | `pnpm run lint` (eslint .) | Clean, no output | ✓ PASS |
| Typecheck | `pnpm run typecheck` (tsc --build + apps/web tsc) | Clean, no output | ✓ PASS |
| Dependency-cruiser | `pnpm run depcruise` | "no dependency violations found (385 modules, 708 dependencies cruised)" | ✓ PASS |
| CR-01 regression (named) | `tests/routes/fee-choice.test.ts` "FEE-CHOICE (CR-01)" | Included in the 953 passing tests; asserts `finalAmount === 10000` not `20000` | ✓ PASS |
| WR-01 regression (named) | `tests/routes/fee-choice.test.ts` "FEE-CHOICE (WR-01)" | Included in the 953 passing tests; bogus choice rejected 400 | ✓ PASS |
| WR-02 regression (named) | `tests/routes/access-control-review.test.ts` "WR-02" describe block | Included in the 953 passing tests | ✓ PASS |

Test baseline claimed in the addendum (949 → 953, 4 new tests) matches the current full-suite result of 953/953 exactly.

### Requirements Coverage

All 19 requirement IDs named in the brief are marked `[x]` Complete in `.planning/REQUIREMENTS.md`: ENGINE-14, REVIEW-01 through REVIEW-12, NAV-01, NAV-03, ACCESS-02, ACCESS-03, ACCESS-07, DISC-04. Cross-checked against ROADMAP.md's Phase 6 requirements list (identical set) — no orphans, no omissions.

PACK-09 (Phase 3, not Phase 6) remains correctly marked "Partial — 15/36 categories authored... remaining 27 deferred 2026-09-20" — this is the documented, intentional re-scoping referenced in the verification brief, not a Phase 6 gap.

### Anti-Patterns Found

None. Scanned all files touched by the addendum's fixes (`review-tallies.ts`, `assessments.ts`, the legal review page, `totals-rail.tsx`, `fee-choice/route.ts`, `matters.ts`, `disposition-actions.ts`, `disposition-controls.tsx`, `bulk-accept-bar.tsx`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` — zero matches. The one remaining `(legal)/assessments` string (in `legal/queue/page.tsx`'s module comment) is a historical "moved here from" note describing where the page used to live, not a stale claim about the current path, and is not one of the four route-handler comments the addendum's IN-02 fix targeted.

### Regression Check (point 7 of the brief)

- `hasSufficientAndGenuineReason` call-site wiring preserves identical behavior: `assertSufficientReason` still checks stop-list before length to produce the same two distinct error messages (verified by reading the unchanged message-selection logic at `assessments.ts:120-133`); the client-side counters in `disposition-controls.tsx`/`bulk-accept-bar.tsx` still compute `reasonCounterFailureText`/equivalent using `matchesReasonStopList` first, `hasSufficientReason` second, for display — only the *submit gate* (not the message logic) now calls the combined function, which is logically equivalent to the prior separate checks since (per the code's own comment) every stop-list entry is already shorter than the 10-character minimum.
- `FeeChoiceSchema` is `z.enum(["ITEMISED", "FLAT"])` — confirmed both legitimate values pass through `FeeChoiceRequestSchema.parse` (proven directly by `tests/routes/fee-choice.test.ts`'s ITEMISED and FLAT success-path tests, both of which return 200 and record the audit event, run *after* the WR-01 fix was applied).
- No new regressions found in `pnpm test` (953/953), `pnpm run lint`, `pnpm run typecheck`, or `pnpm run depcruise` — all clean.

### Human Verification Required

None. All must-haves were verifiable programmatically against the current source and a real, passing test suite.

### Gaps Summary

No gaps found. All 5 ROADMAP success criteria hold against current source, all 19 requirement IDs are genuinely satisfied, the Critical bug (CR-01) and both Warnings (WR-01, WR-02) from the independent review addendum are fixed and covered by targeted regression tests that were traced and confirmed to exercise the actual bug scenario (not just re-assert the fix's own logic), and the full verification gate (test/lint/typecheck/depcruise) is clean at 953/953.

---

_Verified: 2026-09-20_
_Verifier: Claude (gsd-verifier)_
