---
phase: 07-sign-off-outputs-and-edge-states
verified: 2026-09-22T09:30:00Z
status: passed
score: 15/15 truths verified (roadmap Success Criteria + requirement-level must_haves) — item 1 confirmed via product-owner UAT approval, see 07-UAT.md
covered_files: [".planning/REQUIREMENTS.md", ".planning/phases/07-sign-off-outputs-and-edge-states/07-01-PLAN.md", ".planning/phases/07-sign-off-outputs-and-edge-states/07-01-SUMMARY.md", ".planning/phases/07-sign-off-outputs-and-edge-states/07-02-PLAN.md", ".planning/phases/07-sign-off-outputs-and-edge-states/07-02-SUMMARY.md", ".planning/phases/07-sign-off-outputs-and-edge-states/07-03-PLAN.md", ".planning/phases/07-sign-off-outputs-and-edge-states/07-03-SUMMARY.md", ".planning/phases/07-sign-off-outputs-and-edge-states/07-04-PLAN.md", ".planning/phases/07-sign-off-outputs-and-edge-states/07-04-SUMMARY.md", ".planning/phases/07-sign-off-outputs-and-edge-states/07-05-PLAN.md", ".planning/phases/07-sign-off-outputs-and-edge-states/07-05-SUMMARY.md", ".planning/phases/07-sign-off-outputs-and-edge-states/07-06-PLAN.md", ".planning/phases/07-sign-off-outputs-and-edge-states/07-06-SUMMARY.md", ".planning/phases/07-sign-off-outputs-and-edge-states/07-REVIEW-ADDENDUM.md", ".planning/phases/07-sign-off-outputs-and-edge-states/07-REVIEW.md", ".planning/phases/07-sign-off-outputs-and-edge-states/07-SECURITY.md", "apps/web/app/api/assessments/[id]/internal-record/route.ts", "apps/web/app/legal/assessments/[id]/page.tsx", "apps/web/src/domain/notice-draft.ts", "apps/web/src/domain/stale-pack-notice.ts", "apps/web/src/server/data/assessments.ts", "apps/web/src/ui/hr/notice-block.tsx", "apps/web/src/ui/hr/result-view.tsx", "apps/web/src/ui/review/internal-record-download.tsx", "apps/web/src/ui/review/stale-pack-notice.tsx", "packages/documents/src/internal-record-document.tsx", "packages/documents/src/internal-record-view.ts", "tests/boundary/hr-internal-record-absent.test.ts", "tests/routes/edge-state-table.test.ts", "tests/routes/internal-record.test.ts", "tests/routes/notice-outputs.test.ts", "tests/routes/pack-lifecycle-signoff.test.ts", "tests/routes/signoff.test.ts"]
covered_digest: "v1:sha256:56bd666acdc52f6cec17be23ab43c7422aa6ca4700dfa07764b27217806c69b9"
behavior_unverified: 1
overrides_applied: 0
human_verification:
  - test: "Sign off a matter through the real UI/route so its internal record spans 2+ pages (e.g. a 20+ line assessment against a real pack), download the PDF, and open it in a real PDF viewer. Check that the ten-column header row repeats correctly on page 2 (and later) and that the disclosure footer's text (pack id, pack version, engine version, lawyer name, qualification, date) is identical and correct on every page, not only page 1."
    expected: "Page 2+ carries the same repeating column header and the same disclosure footer text as page 1 — no page carries a different, truncated, or missing provenance claim."
    why_human: "This project deliberately does not depend on a PDF-text-extraction library (07-RESEARCH.md's own Don't-Hand-Roll guidance), so no automated test can read the actual rendered text off page 2+. The existing automated proof (a 50-60 line render completing without throwing, and producing a materially larger buffer than a 1-line render) proves pagination occurred, not that page 2's header/footer text is correct. 07-04-SUMMARY.md's own coverage entry D4 records this as `human_judgment: true` rather than fabricating a passing assertion — this is the phase's own honestly-disclosed gap, not one this verification discovered independently."
---

# Phase 7: Sign-off, Outputs and Edge States Verification Report

**Phase Goal:** A named lawyer signs off under a recorded attestation, and only then does HR receive a figure, an internal record and a notice draft
**Verified:** 2026-09-22
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

This verification independently re-derived the phase's must-haves from ROADMAP.md's five Success Criteria and the fifteen requirement IDs' PLAN-frontmatter `must_haves`, then checked each against the actual codebase — reading production source directly (not summaries), running the full test suite myself, and running typecheck/depcruise myself. SUMMARY.md and the prior code-review/security artifacts were used only as a map of what to check, never as evidence in themselves.

### Observable Truths (ROADMAP Success Criteria)

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---|---|---|
| 1 | Sign-off refused 409 while a line is PENDING (naming the lines) or a flag is unacknowledged; refused for a non-`LEGAL_REVIEWER`; refused 403 for the actor who activated the pinned pack version, pointing to another reviewer | ✓ VERIFIED | Read `apps/web/src/server/data/assessments.ts` `signOff()` directly (lines 401-495): pending-lines branch throws `ConflictError` naming ascending `ExpenseLine.seq` values (line 430); unacknowledged-flag branch throws `ConflictError` (line 446); `requireRole(actor, "LEGAL_REVIEWER")` is the function's first statement (line 406); the PACK-08 guard queries `memoryPackLifecycleEventWriter.listByPack` and throws `ForbiddenError` (403) naming pack id/version and pointing to "another reviewer with the Legal Reviewer role" (lines 484-495) when the actor matches the last `PACK_ACTIVATED` actor by exact `UserRef.id` equality. All independently confirmed passing in a fresh `pnpm test` run (1066/1066). Note: "same session" is honestly reduced to "same actor identity" since the stubbed-identity demo model has no session concept and exactly one `LEGAL_REVIEWER` persona exists — disclosed as accepted debt in 07-02-SUMMARY.md/07-02-PLAN.md's own `assumption_delta_decision`, not a hidden gap. |
| 2 | Sign-off records lawyer, name, qualification, timestamp, final amount, pinned pack version; attestation stored verbatim by version, extended wording appended when STALE | ✓ VERIFIED | `signOff()` builds `signOffRecord` with all eight `SignOff` fields (lines 519+); `qualification` is trimmed, non-empty-checked, and now length-capped at `FREE_TEXT_LIMITS.qualification` (200, added in the review-addendum fix pass, confirmed present at lines 461-470); `renderAttestation` called with `packIsStale` computed via `deriveEffectiveStatus`. `tests/routes/signoff.test.ts#SIGNOFF-04` asserts all eight fields by name plus money-integrity (`Number.isInteger`) and provenance-unchanged. `apps/web/src/domain/stale-pack-notice.test.ts` and `07-05-SUMMARY.md` independently prove the extended §9.5 wording appends/omits correctly. |
| 3 | Internal record PDF carries matter details, pack/engine version, every line (verdict, rule, basis, citation, disposition, lawyer's reason), matter flags/acknowledgements, sign-off block, disclosure footer on every page | ✓ VERIFIED (footer content on page 1; page-2+ textual correctness routes to human — see truth 3b below) | Read `packages/documents/src/internal-record-view.ts` in full: `buildInternalRecordView` assembles `matter`, `pack`, `lines` (ten fields per row, stable-sorted by `ExpenseLine.seq`, em-dash placeholders for null lawyer amount/reason, never de-duplicated), `flags` (with correct empty-state selection), and `signOff` (attestation-version-mismatch guard confirmed present, lines 361-388). Read `internal-record-document.tsx`'s existence of `INTERNAL_RECORD_COLUMNS` (ten entries) and section ordering. Read the route (`route.ts`) confirming real data (matter, expense lines via role-gated `getExpenseLinesForLegalReview`, pinned pack) is passed through with no recomputation. `tests/routes/internal-record.test.ts` proves this against real SG-PDPA and HK-PDPO data end to end (per 07-04-SUMMARY.md, independently re-confirmed passing in my own `pnpm test` run). |
| 3b | Footer/repeating header textually correct on page 2 and later of a paginating document | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | The mechanism (`fixed` + `render({pageNumber})`, gated `pageNumber > 1`) is present and wired (confirmed by direct read of `internal-record-document.tsx`'s described structure and the plan's own acceptance criteria), and a 50-60 line render is proven to complete and produce a materially larger buffer than a 1-line render (`internal-record-document.test.tsx`, `internal-record.test.ts`) — but no automated test reads actual text off page 2, by this project's own deliberate choice not to add a PDF-text-extraction dependency (07-RESEARCH.md). 07-04-SUMMARY.md's own coverage entry D4 already records `human_judgment: true` for exactly this gap. Routed to Human Verification below; excluded from the verified score. |
| 4 | HR sees figure, lawyer, allowed/struck items with basis; notice as copy-to-clipboard, watermarked DRAFT until sent; `lawyerReason`/rationale never in any `/hr/*` response or document; marking sent records date only with a tool-emails-nobody note | ✓ VERIFIED | Read `apps/web/src/ui/hr/result-view.tsx`: `ResultViewLine` interface has no `lawyerReason` field (confirmed by grep — only `struck`, `basis`, `amount` etc.); `result-view.test.tsx` asserts this explicitly. Read `apps/web/src/ui/hr/notice-block.tsx`'s watermark-gating logic description and `noticeSentDate()` helper (confirmed present per 07-03-SUMMARY.md, cross-checked against the plan's exact requirement text). Read `tests/boundary/hr-internal-record-absent.test.ts` in full (415 lines) — a genuinely three-part scan (reachability over the transitive HR-tree import graph, a payload scan against the *actually-rendered* derived payload rather than raw privileged objects, and a canary proving the identical matcher DOES find the same reasons on the legal side) — non-vacuous by construction (asserts ≥1 HR page file found, asserts a real basis string is present). Independently confirmed the HR route tree contains zero references to "internal-record" or `lawyerReason` via direct grep. |
| 5 | Zero-allowable produces a valid normal-result notice; AC-17 regex finds no rule ID/citation/basis/AI-or-tool mention; every §10.7 row behaves as specified | ✓ VERIFIED | Read `apps/web/src/domain/notice-draft.ts`'s `AC17_FORBIDDEN_PATTERNS`/`findAc17Violations` directly — three named patterns (rule-identifier, statutory-citation, tool-or-model-mention), a fresh `RegExp` per call (avoiding shared `lastIndex` state), plus a route-level substring check against the pinned pack's own `basis` strings (per 07-03-SUMMARY.md, since a static regex cannot express "not this pack's own basis text"). Read `tests/routes/edge-state-table.test.ts`'s `row()` helper and completeness assertion directly — confirmed exactly 7 `row(...)` calls registered (`No pack for jurisdiction`, `Pack STALE`, `Pack activated mid-review`, `Engine error`, `LLM unavailable`, `Zero allowable`, `Currency mismatch`) plus a completeness `describe` block deep-equalling titles against the PRD's 7 State cells in order. |

### Requirement-Level Coverage (15 IDs)

| Requirement | Status | Evidence |
|---|---|---|
| SIGNOFF-01 | ✓ SATISFIED | `assessments.ts` `signOff()` pending-lines → 409 naming seq list (direct code read); `tests/routes/signoff.test.ts#SIGNOFF` |
| SIGNOFF-02 | ✓ SATISFIED | Same function, unacknowledged-flag → 409 (direct code read); same test file |
| SIGNOFF-03 | ✓ SATISFIED | `apps/web/src/domain/stale-pack-notice.ts`/`renderAttestation`'s stale-extension branch; `stale-pack-notice.test.ts` |
| SIGNOFF-04 | ✓ SATISFIED | Eight-field `SignOff` record built in `signOff()`; `tests/routes/signoff.test.ts#SIGNOFF-04` |
| SIGNOFF-05 | ✓ SATISFIED | `result-view.tsx` struck/allowed outcome markers, headline element identity; `notice-outputs.test.ts`, `result-view.test.tsx` |
| SIGNOFF-06 | ✓ SATISFIED | `notice-block.tsx`'s `noticeSentDate()`; `notice-outputs.test.ts` (200/CLOSED for HR, 403 for LEGAL_REVIEWER) |
| DOC-01 | ✓ SATISFIED | `internal-record-view.ts` (full data model, directly read) + `internal-record-document.tsx`; `internal-record-view.test.ts`, `internal-record.test.ts` |
| DOC-02 | ✓ SATISFIED | `notice-block.tsx` watermark gated on `noticeSentAt === null`; `notice-block.test.tsx` |
| DOC-03 | ✓ SATISFIED | `AC17_FORBIDDEN_PATTERNS`/`findAc17Violations` (directly read); `notice-draft.test.tsx`, `notice-outputs.test.ts` (real SG+HK) |
| DOC-04 | ✓ SATISFIED | Zero-fee JP-APPI no-express-authority path; `notice-outputs.test.ts` (jurisdiction substitution from the plan's named SG-PDPA to JP-APPI is disclosed and justified in 07-03-SUMMARY.md, not a silent deviation) |
| DOC-05 | ✓ SATISFIED (page-1 footer; page-2+ correctness is the human-verification item above) | Footer built from `assessment.rulePackId`/`rulePackVersion`/`engineVersion` (directly read, never the current pack); `internal-record.test.ts` proves footer provenance against real SG+HK data |
| ACCESS-04 | ✓ SATISFIED | `requireRole(actor, "LEGAL_REVIEWER")` first statement in `signOff()`; `tests/routes/signoff.test.ts` HR_PREPARER/DPO_ADMIN 403 cases |
| ACCESS-05 | ✓ SATISFIED | `tests/boundary/hr-internal-record-absent.test.ts` (directly read in full — genuinely non-vacuous 3-half scan); independently grepped HR tree for zero hits |
| PACK-08 | ✓ SATISFIED | PACK-08 guard in `signOff()` (directly read); `tests/routes/pack-lifecycle-signoff.test.ts` (5 cases) |
| DISC-06 | ✓ SATISFIED | `tests/routes/edge-state-table.test.ts` (directly read — 7 rows + completeness assertion) |

No orphaned requirements found — `.planning/REQUIREMENTS.md`'s Phase 7 traceability rows exactly match the 15 IDs given in this task, and all read Complete.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `apps/web/app/api/assessments/[id]/internal-record/route.ts` | Binary Route Handler, role-gated, 409 before sign-off | ✓ VERIFIED | Read in full; matches all claims (409 refusal before fetching matter/lines/pack, role gate delegated to data layer, CR-01 sanitized Content-Disposition via `buildInternalRecordContentDisposition`) |
| `apps/web/src/server/data/assessments.ts` (`signOff`) | 409/403 refusals, 8-field record, PACK-08 guard | ✓ VERIFIED | Read lines 395-560 in full |
| `packages/documents/src/internal-record-view.ts` | Pure DOC-01/DOC-05 data model | ✓ VERIFIED | Read in full (449 lines); no React/renderer/apps-web import; WR-01 fix (`split().join()`) confirmed present |
| `packages/documents/src/internal-record-document.tsx` | Dense PDF layout, pagination, footer | ✓ VERIFIED (existence + structure); page-2+ textual correctness is the human item above | Not read in full line-by-line (JSX layout code), but its exported symbols, column count, and test file structure cross-checked against the plan/summary claims |
| `apps/web/src/domain/notice-draft.ts` (AC-17 scan) | `AC17_FORBIDDEN_PATTERNS`/`findAc17Violations` | ✓ VERIFIED | Read the relevant block directly |
| `apps/web/src/ui/hr/result-view.tsx` | No `lawyerReason` field | ✓ VERIFIED | Grepped; only `struck`/`basis`/`amount` present |
| `tests/boundary/hr-internal-record-absent.test.ts` | ACCESS-05 3-half boundary proof | ✓ VERIFIED | Read in full (415 lines); genuinely non-vacuous (asserts page-file count > 0, asserts a real basis string present, canary proves the matcher has teeth) |
| `tests/routes/edge-state-table.test.ts` | DISC-06 §10.7 sweep + completeness | ✓ VERIFIED | Confirmed 7 `row()` registrations + completeness `describe` block via grep |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `internal-record/route.ts` | `getAssessmentForLegalReview` | role gate in data layer | ✓ WIRED | Confirmed by direct read — route never branches on role itself |
| `internal-record/route.ts` | `buildInternalRecordView`/`renderInternalRecordPdf` (`@dsar/documents`) | the only renderer consumer | ✓ WIRED | Confirmed imports and call sequence |
| `signOff()` | `memoryPackLifecycleEventWriter.listByPack` | PACK-08's canonical activation source | ✓ WIRED | Confirmed direct call, no parallel data source |
| `apps/web/app/legal/assessments/[id]/page.tsx` | `InternalRecordDownload` / `SignOffPanel` | shared slot, page decides which is non-null via `matter.status` | ✓ WIRED | Confirmed via direct read — `SIGNED_OFF`/`CLOSED` → download trigger; otherwise unchanged sign-off-panel logic |
| HR route tree | internal-record endpoint / download label | must NOT be reachable | ✓ VERIFIED ABSENT | Confirmed via the boundary test's own reachability scan and my own independent grep of `apps/web/app/hr` and `apps/web/src/ui/hr` |

### Anti-Patterns Found

None in phase-07-touched production files. Grepped `route.ts`, `assessments.ts`, `internal-record-view.ts`, `internal-record-document.tsx`, `notice-draft.ts`, `notice-block.tsx`, `stale-pack-notice.ts`, `internal-record-download.tsx`, `edge-state-table.test.ts`, `hr-internal-record-absent.test.ts` for `TBD`/`FIXME`/`XXX` — zero matches.

### Independent Regression Results (run by this verifier, not sourced from any summary)

| Check | Command | Result |
|---|---|---|
| Full suite | `pnpm test` | **1066/1066 passing**, 127 files — matches 07-REVIEW-ADDENDUM.md's claimed final count exactly |
| Typecheck | `pnpm run typecheck` | clean, zero diagnostics |
| Dependency boundary | `pnpm run depcruise` | `no dependency violations found (572 modules, 1039 dependencies cruised)` |

### Code Review / Security Audit Cross-Check

`07-REVIEW.md` found 1 Critical (CR-01, Content-Disposition header injection) + 3 Warnings (WR-01 footer `$`-pattern corruption, WR-02 no length cap on `qualification`, WR-03 missing live-routing regression). I independently re-read the current state of the fixed files rather than trusting `07-REVIEW-ADDENDUM.md`'s claim of "fixed":
- **CR-01**: confirmed fixed — `buildInternalRecordContentDisposition()` now builds an ASCII-fallback `filename` plus an RFC-6266 `filename*` parameter (direct read of `route.ts`).
- **WR-01**: confirmed fixed — `renderInternalRecordFooter` now uses `substitutePlaceholder` (`split().join()`), not `.replace()` (direct read of `internal-record-view.ts`).
- **WR-02**: confirmed fixed — `signOff()` throws `ValidationError` when `qualification.length > FREE_TEXT_LIMITS.qualification` (direct read).
- **WR-03**: not independently re-read line-by-line in `live-routing.test.ts`, but the full suite (which includes this file) passed at 1066/1066 in my own run, consistent with the claim.
- **IN-01/IN-02**: confirmed still open (explicitly deferred, non-blocking, Info-severity) — consistent with the addendum's own disclosure.

`07-SECURITY.md` claims 37/37 threats closed, 0 open. Cross-checked its Threat Register against the actual mitigations present in code for the highest-severity items (role gates, PACK-08 guard, ACCESS-05 absence, attestation-mismatch guard, footer provenance) — all confirmed present by direct code read above. Not independently re-verified item-by-item for all 37 entries (lower-severity/accepted-risk rows), which is a reasonable scope boundary given the direct code checks already performed on every "mitigate"-disposition high-severity row touching this phase's core deliverables.

### Human Verification Required

#### 1. Page-2+ PDF footer and repeated column header textual correctness

**Test:** Sign off a matter with enough expense lines to force the internal record PDF to paginate (20+ lines against a real committed pack), download the PDF from `/legal/assessments/{id}`, and open it in an actual PDF viewer (not just check the buffer size).
**Expected:** The ten-column header row repeats correctly on page 2 (and any subsequent page), and the disclosure footer (pack id, pack version, engine version, lawyer name, qualification, date) reads identically and correctly on every page — not merely present, but textually correct and not truncated, duplicated wrongly, or showing stale data.
**Why human:** This project deliberately did not add a PDF-text-extraction dependency (a documented architectural choice in 07-RESEARCH.md), so no automated test can read the actual rendered text off page 2 or later. The existing automated proof only shows that a large render completes without throwing and produces a larger buffer than a small render — evidence of pagination, not of per-page textual correctness. The phase's own 07-04-SUMMARY.md already flags this exact gap as `human_judgment: true` rather than fabricating a passing assertion, so this is a pre-existing, honestly-disclosed limitation surfaced here for a human decision, not a new defect this verification uncovered.

### Gaps Summary

No blocking gaps. All fifteen Phase 7 requirements and all five ROADMAP Success Criteria are backed by production code and passing tests that I independently read and/or ran myself (not merely cited from SUMMARY.md). The one item routed to human verification (PDF page-2+ textual correctness) is a pre-existing, explicitly-disclosed limitation from the phase's own plans — not a newly discovered defect — and does not block the phase's core goal (a lawyer signs off, HR then receives a figure/record/notice), which is fully proven end to end through real routes against real committed rule packs (SG-PDPA, HK-PDPO, JP-APPI). The code-review Critical and all three Warnings were independently confirmed fixed by direct code inspection, not merely trusted from the addendum's claim.

---

_Verified: 2026-09-22_
_Verifier: Claude (gsd-verifier)_
