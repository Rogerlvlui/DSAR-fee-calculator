---
phase: 07-sign-off-outputs-and-edge-states
plan: 04
subsystem: documents
tags: [pdf, react-pdf-renderer, dense-table, attestation, next-route-handler]

# Dependency graph
requires:
  - phase: 07-sign-off-outputs-and-edge-states (plan 01)
    provides: "packages/documents workspace package, the pure-view/thin-JSX split, the binary Route Handler architecture, and the real-HTTP proof that the react-pdf monorepo-import crash does not reproduce here"
provides:
  - "buildInternalRecordView (packages/documents/src/internal-record-view.ts) — the full DOC-01 data model: matter details, pack details, the ten-column line-item table, matter flags and acknowledgements, and the sign-off block, all pure and sourced only from the already-stored assessment"
  - "InternalRecordDocument / renderInternalRecordPdf (packages/documents/src/internal-record-document.tsx) — the dense five-section PDF layout, paginating, with a repeating column header (page 2+) and the DOC-05 footer on every page via the renderer's own fixed-component mechanism"
  - "GET /api/assessments/{id}/internal-record — now returns the complete internal record, wired to the real attestation text and a sign-off-instant-pinned staleness check, not the tracer's title+footer skeleton"
affects: [07-05-download-trigger-placement]

# Actuals (#2632)
actuals:
  tokens: 23500
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "buildInternalRecordView takes a single options object (assessment, matter, pinned pack, expenseLines, attestation) rather than positional arguments — the attestation is supplied by the caller (computed via apps/web's own renderAttestation) since packages/documents must never import from apps/web"
    - "A view section exposes precomputed empty-state selection (InternalRecordFlagsSection's noFlagsStatement/noAcknowledgementRequiredStatement, both nullable) rather than letting the JSX layer infer which of two Copywriting Contract sentences applies"
    - "A repeating PDF table header via @react-pdf/renderer's fixed + render({pageNumber}) prop, gated on pageNumber > 1, so it repeats on pages after the first without duplicating the in-flow header already correctly positioned under the Line items heading on page 1"
    - "Money and citation values are formatted exactly once, in the pure view layer (formatMinor, formatCitation) — every InternalRecordLineRow/InternalRecordSignOffBlock field the JSX layer reads is already a display string, never a raw Minor or Citation object"

key-files:
  created:
    - packages/documents/src/internal-record-document.test.tsx
  modified:
    - packages/documents/src/internal-record-view.ts
    - packages/documents/src/internal-record-view.test.ts
    - packages/documents/src/internal-record-document.tsx
    - "apps/web/app/api/assessments/[id]/internal-record/route.ts"
    - tests/routes/internal-record.test.ts
    - package.json
    - pnpm-lock.yaml
    - .planning/REQUIREMENTS.md

key-decisions:
  - "ATTESTATION_VERSION_MISMATCH_STATEMENT authored as a function (not a bare string constant) despite the plan's own artifact list describing it as '(const)' — the sentence must name the recorded attestation version dynamically, which a fixed string cannot do; the mismatch guard (T-07-04-01) would be meaningless without naming which version could not be reproduced."
  - "VERDICT_LABELS renders the raw enum word for three of four verdicts (ALLOW/DISALLOW/FLAG) and spells out ALLOW_CAPPED as 'ALLOW (CAPPED)' for readability — 07-UI-SPEC.md's Color section names only two of the four verdict labels literally ('FLAG'/'ALLOW'), leaving the other two as reasonable discretion within its own stated pattern."
  - "INTERNAL_RECORD_COLUMNS widths (Seq 3, Category 10, Verdict 6, Rule ID 9, Basis 20, Citation 15, Disposition 7, Claimed 7, Lawyer amount 7, Lawyer's reason 16 — summing to 100) sized so Basis/Citation/Lawyer's reason (the three UI-SPEC names as needing the most room) are the three widest columns, and Seq/the two money columns are the narrowest, per D-04's delegated PDF-layout discretion."
  - "The repeating table header uses @react-pdf/renderer's documented fixed + render({pageNumber}) API, gated to render only when pageNumber > 1 — avoids the visual collision a naive always-fixed header would create with the Matter details/Rule pack front matter that only ever occupies page 1."

patterns-established:
  - "A pure-view interface field can itself carry a precomputed decision (which empty-state sentence applies), not just data — extends the 'pure module + thin renderer' convention one step further than notice-draft.ts's own precedent, which returns only text."

requirements-completed: [DOC-01, DOC-05]

coverage:
  - id: D1
    description: "buildInternalRecordView() produces the full DOC-01 data model — matter details, pack details, the ten-column line-item table (never de-duplicated, ordered by ExpenseLine.seq with a stable tie-break), matter flags with correct acknowledgement entries and empty-state selection, and a sign-off block that refuses to restate a mismatched historical attestation"
    requirement: DOC-01
    verification:
      - kind: unit
        ref: "packages/documents/src/internal-record-view.test.ts#buildInternalRecordView"
        status: pass
      - kind: integration
        ref: "tests/routes/internal-record.test.ts#INTERNAL-RECORD"
        status: pass
    human_judgment: false
  - id: D2
    description: "InternalRecordDocument renders the full five-section dense-table PDF (Matter details, Rule pack, Line items, Matter flags and acknowledgements, Sign-off) at UI-SPEC's exact point-based spacing/typography/greyscale scales, paginating up to 50 lines without throwing"
    requirement: DOC-01
    verification:
      - kind: unit
        ref: "packages/documents/src/internal-record-document.test.tsx#renderInternalRecordPdf"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every page of the rendered PDF carries the DOC-05 disclosure footer, sourced from the assessment's own pinned/stamped pack id, pack version and engine version — proven against both real committed packs (SG-PDPA and HK-PDPO) through the real route"
    requirement: DOC-05
    verification:
      - kind: integration
        ref: "tests/routes/internal-record.test.ts#INTERNAL-RECORD (footer provenance, SG and HK)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Whether the repeated column header and the disclosure footer are textually correct on page 2 and later of a paginating document — this plan's own recorded backstop truth, not asserted by any automated test (07-RESEARCH.md's Don't-Hand-Roll rules out a PDF-text-extraction dependency; the pagination-size test proves pagination occurred, not what any specific page reads)"
    verification: []
    human_judgment: true
    rationale: "No PDF-text-extraction dependency exists in this project by deliberate choice, so no automated assertion can read text off a specific rendered page. This needs either a human opening a multi-page PDF and checking page 2's header/footer by eye, or a future phase's decision to add such a dependency."

duration: ~65min
completed: 2026-09-22
status: complete
---

# Phase 7 Plan 4: Dense Internal Fee Assessment Record Summary

**Expands the internal-record PDF tracer into the complete DOC-01/DOC-05 document — a dense ten-column line-item table, matter/pack/flags/sign-off sections, and a page-repeating disclosure footer, all sourced from the already-stored assessment with the attestation guarded against silent restatement.**

## Performance

- **Duration:** ~65 min
- **Tasks:** 3 (all executed, no checkpoints)
- **Files modified:** 8 (5 created/modified in packages/documents and apps/web, plus package.json/pnpm-lock.yaml/REQUIREMENTS.md)

## Accomplishments
- `buildInternalRecordView` widened from a title+footer-only tracer into the full DOC-01 data model: matter details, rule-pack details, the ten-column line-item table (never de-duplicated, stable-sorted by `ExpenseLine.seq`), matter flags with precomputed empty-state selection, and a sign-off block that guards the attestation against being silently restated in a later build's wording
- `InternalRecordDocument` renders all five sections in fixed order (Matter details → Rule pack → Line items → Matter flags and acknowledgements → Sign-off), at UI-SPEC's exact point-based spacing/typography/greyscale scales, with a column header that repeats from page 2 onward and a footer that repeats on every page — both via `@react-pdf/renderer`'s own `fixed` mechanism
- `GET /api/assessments/{id}/internal-record` now builds the real attestation text (mirroring the legal review page's own call to `renderAttestation`) and evaluates pack staleness against the assessment's own recorded sign-off instant, never the current wall clock, so a signed-off record renders byte-identically on any future download
- Proven end to end against real data through the real route: one row per assessment line with matching rule id/basis, a genuinely populated REDUCEd line's lawyer amount/reason, footer provenance against both real committed packs (SG-PDPA and HK-PDPO), the sign-off block's final amount and attestation text matching the stored record exactly, and a 60-line view producing a materially larger PDF buffer than a 1-line view of the same shape
- Full suite 993 → 1023 passing; typecheck/depcruise clean throughout. DOC-01 and DOC-05 marked Complete in REQUIREMENTS.md

## Task Commits

1. **Task 1: The dense record data model — buildInternalRecordView, pure and complete** - `93b763c` (feat, tdd)
2. **Task 2: The dense-table document — layout, pagination, and the footer on every page** - `82502ab` (feat, tdd)
3. **Task 3: Wire the full record through the route and prove DOC-01 and DOC-05 end to end** - `e3fd719` (feat)

**Plan metadata:** commit pending (this SUMMARY + STATE.md/ROADMAP.md update)

## Files Created/Modified
- `packages/documents/src/internal-record-view.ts` - widened to the full DOC-01 data model: `InternalRecordMatterDetails`, `InternalRecordPackDetails`, `InternalRecordLineRow`, `InternalRecordFlagRow`/`InternalRecordFlagsSection`, `InternalRecordSignOffBlock`, `VERDICT_LABELS`/`DISPOSITION_LABELS`, `formatCitation`, `ATTESTATION_VERSION_MISMATCH_STATEMENT`
- `packages/documents/src/internal-record-view.test.ts` - rewritten against the new options-object signature: mixed-verdict field sourcing, duplicate-basis/rule-id rows, stable-sort ordering under equal seq, em-dash placeholders, one-line/zero-line assessments, both flag empty-states, acknowledged/informational flag entries, final-amount sourcing, attestation-version-mismatch guard
- `packages/documents/src/internal-record-document.tsx` - the full five-section dense-table layout: `INTERNAL_RECORD_COLUMNS`, `SECTION_HEADINGS`, the page-2+ repeating header band, the sign-off-terminal section order
- `packages/documents/src/internal-record-document.test.tsx` - new thin smoke-test file: mixed/one-line/zero-line/fifty-line renders, `INTERNAL_RECORD_COLUMNS` label-list assertion, documented backstop for page-2+ textual correctness
- `apps/web/app/api/assessments/[id]/internal-record/route.ts` - fetches expense lines via `getExpenseLinesForLegalReview`, computes the real attestation text and sign-off-instant-pinned staleness flag, passes the full options object to `buildInternalRecordView`
- `tests/routes/internal-record.test.ts` - `dispositionAllLines` now drives every line (not one per verdict) through ACCEPT/REDUCE/STRIKE keyed on its own verdict; seven new `INTERNAL-RECORD` cases proving DOC-01/DOC-05 end to end against real SG-PDPA and HK-PDPO data
- `package.json` (root) - `@dsar/documents` added as a workspace dependency, matching `@dsar/rulepacks`/`@dsar/engine`'s own precedent for repo-root-level test resolution
- `.planning/REQUIREMENTS.md` - DOC-01 and DOC-05 marked Complete (checklist and traceability table)

## Decisions Made
- `ATTESTATION_VERSION_MISMATCH_STATEMENT` implemented as a function, not a bare string, so the mismatch sentence can name the recorded attestation version — see key-decisions above for the full rationale.
- `VERDICT_LABELS`/`INTERNAL_RECORD_COLUMNS` widths are judgment calls within D-04's delegated PDF-layout discretion — see key-decisions above.
- The page-2+ repeating table header uses `fixed` + `render({pageNumber})` gated on `pageNumber > 1`, avoiding a naive always-fixed header's collision with page 1's front matter.

## Deviations from Plan

### Auto-fixed Issues

None — Rule 1/2/3 deviations. The three items below are documented judgment calls within the plan's own delegated discretion (D-04, and the plan's own "(const)" vs. function tension for the mismatch statement), not bugs found and fixed, so they are recorded under Decisions Made / key-decisions rather than here.

**1. [Rule 3 - Blocking] `@dsar/documents` missing from the root `package.json`**
- **Found during:** Task 3, first run of the extended `tests/routes/internal-record.test.ts`
- **Issue:** `Cannot find package '@dsar/documents/internal-record-document' imported from tests/routes/internal-record.test.ts` — a repo-root-level test file cannot resolve a workspace package through `apps/web`'s own `node_modules` symlink, the identical gap `03.1-05` (`@dsar/rulepacks`) and `04-01` (`@dsar/engine`) already hit and fixed.
- **Fix:** Added `"@dsar/documents": "workspace:*"` to the root `package.json`'s `dependencies` and ran `pnpm install`.
- **Files modified:** `package.json`, `pnpm-lock.yaml`
- **Verification:** `pnpm vitest run --project routes -t "INTERNAL-RECORD"` — all 10 cases pass.
- **Committed in:** `e3fd719` (Task 3 commit)

**2. [Rule 1 - Bug] Trimmed HK line-item fixture produced no `DISALLOW`/`ALLOW_CAPPED` line**
- **Found during:** Task 3, writing the HK-PDPO footer-provenance test
- **Issue:** A hand-trimmed 4-line subset of the proven 9-line HK golden fixture (`tests/routes/hk-jurisdiction-review.test.ts`) picked the wrong category for the intended DISALLOW slot, and separately the PHOTOCOPY_PRINT line's `ALLOW_CAPPED` verdict turned out to depend on the fixture's full line set (the risk of guessing at cap-interaction effects rather than reusing a proven set).
- **Fix:** Reused the full, already-verified 9-line HK golden fixture verbatim instead of trimming it.
- **Files modified:** `tests/routes/internal-record.test.ts`
- **Verification:** `pnpm vitest run --project routes -t "INTERNAL-RECORD"` — the HK footer test passes with all four verdicts present.
- **Committed in:** `e3fd719` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking dependency-resolution gap, 1 bug in a hand-trimmed test fixture)
**Impact on plan:** Both necessary for the plan's own acceptance criteria (a real route test against both packs) to be achievable at all. No scope creep.

## Issues Encountered
- The null-`lawyerReason` em-dash path (a plain `ACCEPTED` non-`FLAG` line with no recorded reason) is genuinely unreachable through the real route: `apps/web/src/server/data/assessments.ts`'s `assertSufficientReason` requires and stores a non-empty reason on every disposition, `ACCEPT` included. Task 3's route-level test documents this finding rather than asserting a case that cannot occur through the real product surface; the null case is proven instead at the pure-view level (Task 1's `internal-record-view.test.ts`), which constructs it directly.
- `@react-pdf/renderer`'s repeating-table-header idiom (`fixed` + `render({pageNumber})`) is used here for the first time in this codebase. Its exact visual correctness on page 2+ could not be automated-verified without a PDF-text-extraction dependency this project has deliberately not added (07-RESEARCH.md's Don't-Hand-Roll) — recorded as a backstop truth (coverage entry D4) rather than faked as a passing assertion, per the plan's own explicit instruction not to fabricate that proof.

## Known Stubs

None — every field DOC-01/DOC-05 name is wired to real, already-stored data. No hardcoded placeholder value or unwired data source exists anywhere in `packages/documents` or the route.

## User Setup Required

None - no external service configuration required, no new dependency added beyond the workspace-internal `@dsar/documents` reference.

## Next Phase Readiness
- DOC-01 and DOC-05 are both Complete; the internal record PDF is production-complete content-wise. 07-05 (download-trigger placement, ACCESS-05) can wire a "Download internal record (PDF)" UI trigger against this endpoint with no further backend work.
- The page-2+ header/footer textual-correctness backstop (coverage D4) remains an open, explicitly-recorded item — a human opening a multi-page rendered PDF is the natural way to close it, whenever that verification is wanted; it does not block 07-05 or 07-06.

---
*Phase: 07-sign-off-outputs-and-edge-states*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: packages/documents/src/internal-record-view.ts
- FOUND: packages/documents/src/internal-record-view.test.ts
- FOUND: packages/documents/src/internal-record-document.tsx
- FOUND: packages/documents/src/internal-record-document.test.tsx
- FOUND: apps/web/app/api/assessments/[id]/internal-record/route.ts
- FOUND: tests/routes/internal-record.test.ts
- FOUND commit 93b763c (Task 1)
- FOUND commit 82502ab (Task 2)
- FOUND commit e3fd719 (Task 3)
