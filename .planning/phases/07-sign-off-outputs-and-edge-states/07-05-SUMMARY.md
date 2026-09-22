---
phase: 07-sign-off-outputs-and-edge-states
plan: 05
subsystem: legal-review-ui
tags: [stale-pack-notice, download-trigger, access-control, boundary-scan]

# Dependency graph
requires:
  - phase: 07-sign-off-outputs-and-edge-states (plan 01)
    provides: "GET /api/assessments/{id}/internal-record — the LEGAL_REVIEWER-only binary Route Handler this plan's download trigger is the only in-app caller of"
  - phase: 07-sign-off-outputs-and-edge-states (plan 04)
    provides: "the complete DOC-01/DOC-05 internal record the download trigger now surfaces to a lawyer"
provides:
  - "shouldRenderStalePackNotice (apps/web/src/domain/stale-pack-notice.ts) — the AC-39 in-flight-review gating predicate, keyed off the same deriveEffectiveStatus helper the attestation's own stale flag uses"
  - "StalePackNoticeView / StalePackNotice (apps/web/src/ui/review/stale-pack-notice.tsx) — the full-width red review notice"
  - "InternalRecordDownloadView / InternalRecordDownload (apps/web/src/ui/review/internal-record-download.tsx) — the labelled, focusable download trigger, /legal/* only"
  - "tests/boundary/hr-internal-record-absent.test.ts — the ACCESS-05 observed-absence proof (reachability scan + payload scan + canary)"
affects: [07-06]

# Actuals (#2632)
actuals:
  tokens: 12750
  tasks: 3
  commits: 3
  plan_head_before: 15f255fb467025ddb46c5271f8845c1d8f294e19

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A gating predicate with no interaction (shouldRenderStalePackNotice) gets a plain, server-renderable *View + thin wrapper pair with NO \"use client\" directive at all — one step further than recompute-confirm.tsx's stateful pair, since this banner never expands, fetches, or owns state"
    - "internalRecordDownload and signOffPanel share one composition slot in AssessmentView (rendered adjacent, at the same position), with the caller (the legal assessment page) responsible for ensuring only one is ever non-null based on matter.status — the shared-slot decision stays in the page, never re-derived inside the pure view component"
    - "A boundary scan resolves relative imports transitively from a directory of real route-tree files (tests/boundary/hr-internal-record-absent.test.ts), deliberately never crossing a workspace-package (\"@dsar/...\") import boundary, since only a relative import inside apps/web can ever resolve to the surface being proven absent"
    - "A payload-absence scan asserts against the DERIVED, actually-rendered payload (ResultViewLine[] + notice draft text) rather than the raw Assessment/ExpenseLine objects fetched server-side only to derive it — the raw objects legitimately carry the privileged field by schema, so scanning them directly would prove nothing about the real leak boundary"

key-files:
  created:
    - apps/web/src/domain/stale-pack-notice.ts
    - apps/web/src/domain/stale-pack-notice.test.ts
    - apps/web/src/ui/review/stale-pack-notice.tsx
    - apps/web/src/ui/review/stale-pack-notice.test.tsx
    - apps/web/src/ui/review/internal-record-download.tsx
    - apps/web/src/ui/review/internal-record-download.test.tsx
    - tests/boundary/hr-internal-record-absent.test.ts
  modified:
    - "apps/web/app/legal/assessments/[id]/page.tsx"
    - apps/web/src/ui/review/assessment-view.tsx
    - apps/web/src/ui/review/assessment-view.test.tsx
    - tests/tsconfig.json
    - .planning/REQUIREMENTS.md

key-decisions:
  - "internalRecordDownload and signOffPanel are two distinct AssessmentViewProps slots rendered adjacent to each other (never one slot carrying either element), with the legal assessment page — not AssessmentView itself — deciding which is non-null via matter.status; AssessmentView stays a pure composition layer with no status-derived branching of its own."
  - "The ACCESS-05 payload scan (Task 3) serialises the HR page's DERIVED render output (ResultViewLine[] + notice draft) rather than the raw Assessment/ExpenseLine objects getSignedOffAssessmentForHr/getExpenseLinesForHr return — those raw objects carry lawyerReason by schema (a fact, not a bug), so a scan against them would trivially and meaninglessly fail; the real leak boundary is what the page actually hands down for rendering, mirroring the distinction tests/boundary/rsc-payload-leak.test.ts already draws for the \"use client\" serialisation boundary."
  - "The reachability scan (Task 3, half one) follows relative imports only, never a workspace-package (\"@dsar/...\") specifier — the download trigger and the internal-record route both live inside apps/web and are reachable only by relative import if the HR route tree ever referenced them, so this bound is deliberate, not a shortcut."

patterns-established:
  - "A shared composition slot pair (signOffPanel/internalRecordDownload) where the CALLER — not the presentational component — owns the mutual-exclusion decision, extending the existing 'composed by the caller, rendered as a plain ReactNode slot' convention this file already established for bulkAcceptBar/flatFeeChoice/recomputeBanner"

requirements-completed: [SIGNOFF-03, ACCESS-05]

coverage:
  - id: D1
    description: "shouldRenderStalePackNotice is false one day before the review-due date, false exactly on it (the helper's own past-not-on boundary), and true one day after — proven against a synthetic reviewDueOn override, since every committed pack's real reviewDueOn (2027-03-12) is never stale today"
    requirement: SIGNOFF-03
    verification:
      - kind: unit
        ref: "apps/web/src/domain/stale-pack-notice.test.ts#STALE-PACK-NOTICE"
        status: pass
    human_judgment: false
  - id: D2
    description: "The rendered stale-pack notice contains the pack id, the version, the review-due date and the heading words, and its container carries the destructive (--stop/--stop-wash) token classes, never the warn ones"
    requirement: SIGNOFF-03
    verification:
      - kind: unit
        ref: "apps/web/src/ui/review/stale-pack-notice.test.tsx#STALE-PACK-NOTICE"
        status: pass
    human_judgment: false
  - id: D3
    description: "renderAttestation still appends the extended §9.5 sentence verbatim when packIsStale is true and omits it when false; ATTESTATION_TEMPLATE_VERSION unchanged"
    requirement: SIGNOFF-03
    verification:
      - kind: unit
        ref: "apps/web/src/domain/stale-pack-notice.test.ts#STALE-PACK-NOTICE"
        status: pass
    human_judgment: false
  - id: D4
    description: "The download trigger's accessible text equals the Copywriting Contract label exactly; it is disabled with byte-identical text while pending, with no spinner in either state; an error renders inline with an alert role and leaves nothing download-bearing on the page"
    requirement: ACCESS-05
    verification:
      - kind: unit
        ref: "apps/web/src/ui/review/internal-record-download.test.tsx#INTERNAL-RECORD-DOWNLOAD"
        status: pass
    human_judgment: false
  - id: D5
    description: "The HR route tree's transitive import graph (every relatively-imported module reachable from apps/web/app/hr/**) contains zero references to the internal-record endpoint path or the download trigger's label, over a non-empty discovered-page-file set"
    requirement: ACCESS-05
    verification:
      - kind: integration
        ref: "tests/boundary/hr-internal-record-absent.test.ts#HR-INTERNAL-RECORD-ABSENT (reachability scan)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The serialised HR-rendered payload (derived ResultViewLine[] + notice draft, built from a real matter driven through submit/mixed-disposition/sign-off) contains none of the recorded lawyer-reason strings and no endpoint-path reference, while containing a real basis string proving the scan examined populated content; the identical matcher DOES find the same reasons in the legal-side payload"
    requirement: ACCESS-05
    verification:
      - kind: integration
        ref: "tests/boundary/hr-internal-record-absent.test.ts#HR-INTERNAL-RECORD-ABSENT (payload scan + canary)"
        status: pass
    human_judgment: false

duration: ~55min
completed: 2026-09-22
status: complete
---

# Phase 7 Plan 5: Stale-Pack Notice, Internal-Record Download Trigger and the ACCESS-05 Boundary Proof Summary

**Adds the two missing legal-review-screen surfaces — a full-width red "past review date" notice and a labelled internal-record download trigger — and closes ACCESS-05 with a three-half boundary scan proving neither the trigger nor the lawyer's own rationale reaches any HR channel.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3 (all executed, no checkpoints)
- **Files modified:** 12 (7 created, 5 modified)

## Accomplishments

- `shouldRenderStalePackNotice` (`apps/web/src/domain/stale-pack-notice.ts`) reuses `deriveEffectiveStatus` so the banner and the sign-off attestation's own stale flag can never disagree about the "past, not on" boundary — no `"use client"` directive, no React import, since the legal review page (a Server Component) is its only caller
- `StalePackNoticeView`/`StalePackNotice` render the full-width red notice (`--stop`/`--stop-wash`, deliberately distinct from the amber recompute banner and pack-rail cell), with the heading words carrying the state independently of colour; wired into a new `stalePackNotice` slot on `AssessmentView`, rendered above `recomputeBanner`
- `InternalRecordDownloadView`/`InternalRecordDownload` (`apps/web/src/ui/review/internal-record-download.tsx`) render a real, labelled, focusable button that fetches the internal-record endpoint, triggers a browser download from the response's `content-disposition` filename on success, and renders the typed failure sentence inline (alert role, nothing download-bearing) on failure — disabled with unchanged text while pending, no spinner, matching `signoff-submit`/`notice-mark-sent`
- The legal assessment page now composes `internalRecordDownload` in the same `AssessmentView` slot `signOffPanel` occupies: once `matter.status` is `SIGNED_OFF` or `CLOSED`, the download trigger replaces the sign-off panel; every earlier status keeps the exact pre-existing `pendingCount`-gated behaviour. `getCurrentActor`/`requireRole` call-site count in the page verified unchanged (2 before, 2 after both edits)
- `tests/boundary/hr-internal-record-absent.test.ts` proves ACCESS-05 as an observed absence, not a convention, in three halves mirroring `dom-denylist.test.ts`'s own structure: a source-level reachability scan over the HR route tree's transitive relative-import graph, a payload scan over a real signed-off matter's HR-rendered output (never the raw privileged objects fetched to derive it), and a canary proving the identical matcher DOES find the same recorded reasons on the legal side
- Full suite 1023 → 1046 passing (18 new tests); `pnpm run typecheck` and `pnpm run depcruise` clean after every commit. SIGNOFF-03 and ACCESS-05 marked Complete in REQUIREMENTS.md

## Task Commits

1. **Task 1: The stale-pack review notice (AC-39's in-flight half)** - `b8c383a` (feat, tdd)
2. **Task 2: The "Download internal record (PDF)" trigger, on /legal/* only** - `9c02967` (feat, tdd)
3. **Task 3: ACCESS-05 — prove the record and its trigger reach no HR channel** - `0e3afa0` (feat)

**Plan metadata:** commit pending (this SUMMARY + STATE.md/ROADMAP.md update)

## Files Created/Modified

- `apps/web/src/domain/stale-pack-notice.ts` - pure `shouldRenderStalePackNotice(pack, now)`, no React import
- `apps/web/src/domain/stale-pack-notice.test.ts` - boundary proof (one day before / exactly on / one day after) against a real-pack-spread synthetic fixture, plus `renderAttestation`'s stale-extension proof
- `apps/web/src/ui/review/stale-pack-notice.tsx` - `STALE_PACK_NOTICE_HEADING`, `stalePackNoticeBody`, `StalePackNoticeView`, `StalePackNotice`
- `apps/web/src/ui/review/stale-pack-notice.test.tsx` - component-level proof of body content, heading presence, and destructive-vs-warn token classes
- `apps/web/src/ui/review/internal-record-download.tsx` - `INTERNAL_RECORD_DOWNLOAD_LABEL`, `internalRecordDownloadFailure`, `filenameFromContentDisposition`, `InternalRecordDownloadView`, `InternalRecordDownload`
- `apps/web/src/ui/review/internal-record-download.test.tsx` - pure-View-only proof (label, disabled/text-identity while pending, no spinner, inline alert-role error, nothing download-bearing on error)
- `tests/boundary/hr-internal-record-absent.test.ts` - the three-half ACCESS-05 boundary proof
- `apps/web/app/legal/assessments/[id]/page.tsx` - `stalePackNotice`/`internalRecordDownload` slots composed; `getCurrentActor`/`requireRole` call-site count unchanged
- `apps/web/src/ui/review/assessment-view.tsx` - `stalePackNotice` and `internalRecordDownload` optional slot props added
- `apps/web/src/ui/review/assessment-view.test.tsx` - `renderView` widened to accept prop overrides; two new slot-composition tests
- `tests/tsconfig.json` - added `internal-record-download.tsx` to the include list (the one new file the boundary test imports directly), per that file's own documented narrow-include discipline
- `.planning/REQUIREMENTS.md` - SIGNOFF-03 and ACCESS-05 marked Complete (checklist and traceability table)

## Decisions Made

- `internalRecordDownload`/`signOffPanel` share one visual position via two adjacent slots, with the page (not `AssessmentView`) deciding which is non-null — see key-decisions above.
- The ACCESS-05 payload scan asserts against the HR page's derived render output, never the raw fetched objects — see key-decisions above for the full rationale.
- The reachability scan follows relative imports only, deliberately not crossing a workspace-package boundary — see key-decisions above.

## Deviations from Plan

None — Rule 1/2/3 auto-fixes. Plan executed as written; the one open discretionary point the plan itself left unresolved (exactly how the payload scan should be built, given the raw HR-side read already contains `lawyerReason` by schema) was resolved as a documented decision, not a deviation from an explicit instruction.

## Issues Encountered

- `-t <pattern>` filtering with `pnpm vitest run --project <name> -t "<lowercase-tag>"` (the plan's own literal verify commands) matched zero tests in this environment, even for pre-existing, already-passing describe blocks (e.g. `-t "assessment-view"` against the existing `describe("ASSESSMENT-VIEW", ...)`) — `-t` behaves case-sensitively here despite every test tag in this codebase being authored in upper-case. Exit code stayed 0 with "N skipped" rather than tripping `passWithNoTests`, since the target project's test FILES do exist (only the NAME pattern matched nothing). Substituted direct file-path invocation (`pnpm vitest run --project <name> <file-path>...`) for every verify step in this plan, which exercises the identical test files/assertions the `-t` filter names — not a new environment gap this plan introduces, but worth recording since every `<verify>` block's literal command as written would silently report a false pass in this environment. Full-project and whole-suite runs (`pnpm test`) are unaffected, since those default to running every file with no name filter at all.

## Known Stubs

None — every surface this plan adds is wired to real data and a real endpoint; no hardcoded placeholder value or unwired data source.

## User Setup Required

None - no external service configuration required, no new dependency added.

## Next Phase Readiness

- SIGNOFF-03 and ACCESS-05 are both Complete. The legal review screen now surfaces the pack's review state before sign-off and offers the internal record for download afterwards, with ACCESS-05's HR-absence property proven by an observed scan rather than assumed from the existing structural gaps (`ResultViewLine` having no `lawyerReason` field).
- 07-06 (the final plan in this phase, Wave 3) inherits a fully-wired legal review screen with no remaining placeholder banners or triggers.

---
*Phase: 07-sign-off-outputs-and-edge-states*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: apps/web/src/domain/stale-pack-notice.ts
- FOUND: apps/web/src/domain/stale-pack-notice.test.ts
- FOUND: apps/web/src/ui/review/stale-pack-notice.tsx
- FOUND: apps/web/src/ui/review/stale-pack-notice.test.tsx
- FOUND: apps/web/src/ui/review/internal-record-download.tsx
- FOUND: apps/web/src/ui/review/internal-record-download.test.tsx
- FOUND: tests/boundary/hr-internal-record-absent.test.ts
- FOUND commit b8c383a (Task 1)
- FOUND commit 9c02967 (Task 2)
- FOUND commit 0e3afa0 (Task 3)
