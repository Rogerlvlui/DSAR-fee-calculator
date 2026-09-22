---
phase: 07-sign-off-outputs-and-edge-states
plan: 03
subsystem: notice-generation
tags: [notice-draft, ac-17, watermark, zero-fee, regex-scan, hr-result]

# Dependency graph
requires:
  - phase: 07-sign-off-outputs-and-edge-states
    provides: "07-02's corrected signOff() gate (409 refusals, PACK-08 guard) — this plan signs off through the same real endpoint, unchanged"
  - phase: 03.1-hr-intake-and-review-slice
    provides: "NoticeBlock/ResultView/buildNoticeDraft/markNoticeSent — the already-built mechanism this plan proves and closes two gaps in"
provides:
  - "NoticeBlockView's DRAFT watermark gated on noticeSentAt === null (DOC-02), and a date-only sent confirmation via the new noticeSentDate() helper (SIGNOFF-06)"
  - "AC17_FORBIDDEN_PATTERNS/findAc17Violations (apps/web/src/domain/notice-draft.ts) — the DOC-03/AC-17 regex scan, proven against real HK-PDPO/SG-PDPA content and a positive control"
  - "A proven no-express-authority zero-fee path (DOC-04/AC-14) through the real route stack, using JP-APPI rather than the plan's originally-named SG-PDPA (see Deviations)"
  - "SIGNOFF-05 route-level and component-level proof: distinguishable struck/allowed zero-amount outcome markers, stable assessment.lines ordering, identical zero/non-zero headline element"
affects: [07-04-dense-line-item-table, 07-05-download-trigger-placement, 07-06]

# Actuals (#2632)
actuals:
  tokens: 10700
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AC17_FORBIDDEN_PATTERNS as a named {label, RegExp} array beside the assembler it scans (notice-draft.ts), with findAc17Violations() constructing a fresh RegExp per call so a shared g-flagged pattern's lastIndex never leaks state across invocations"
    - "Basis-string leak check performed as a direct substring assertion against the pinned pack's own categoryRules[].basis values at the route-test call site, not folded into the static regex array — the check is pack-content-dependent and the static patterns are not"
    - "Test-level replication of a server component's own derivation logic (buildResultLines/buildRealNoticeForMatter in tests/routes/notice-outputs.test.ts mirror apps/web/app/hr/matters/[id]/page.tsx line-for-line) to prove route-level behaviour with no new JSON endpoint, matching this project's established pattern for proving a page's own read path"

key-files:
  created: []
  modified:
    - apps/web/src/ui/hr/notice-block.tsx
    - apps/web/src/ui/hr/notice-block.test.tsx
    - apps/web/src/domain/notice-draft.ts
    - apps/web/src/domain/notice-draft.test.tsx
    - apps/web/src/ui/hr/result-view.test.tsx
    - tests/routes/notice-outputs.test.ts
    - .planning/REQUIREMENTS.md

key-decisions:
  - "DOC-04/AC-14's fixture jurisdiction changed from the plan's named SG-PDPA to JP-APPI — SG-PDPA's own appliesTo is [\"PRIVATE_ORGANISATION\"] only (packages/rulepacks/SG-PDPA/2026.09.1.json), so a SG matter mutated to PUBLIC_AGENCY trips checkPreconditions' CONTROLLER_TYPE_NOT_IN_SCOPE (an engine precondition failure, a 500 that rolls the matter back to DRAFT) before assess() ever reaches the per-line posture gate — exactly what tests/routes/audit-trail.test.ts's own pre-existing 'when the engine throws' test already proves for that identical combination. HK-PDPO has the same appliesTo restriction. JP-APPI's appliesTo includes both controller types and its feePosture.PUBLIC_AGENCY is NO_EXPRESS_AUTHORITY, so it is the jurisdiction that actually reaches the branch AC-14 describes. No production code changed; this is a test-fixture correction to a factually-mismatched plan assumption, not a feature gap."
  - "The AC-17 basis-string check is NOT part of AC17_FORBIDDEN_PATTERNS's regex array — it is a direct substring assertion against the pinned pack's own categoryRules[].basis values, performed at the route-test call site. A static regex cannot express 'none of THIS pack's own basis strings', and notice-draft.ts is a pure module with no pack of its own to read."
  - "The tool-or-model-mention pattern bans the full product-title phrase \"DSAR Fee Assessment\" (apps/web/app-header.tsx/layout.tsx), never the bare \"DSAR\" token alone — bare DSAR is also this system's own matter-reference prefix (\"DSAR-2026-0142\"), which appears in the Reference line of every legitimate notice; banning it would false-positive on the notice's own structural content."

patterns-established:
  - "A scan proven to catch what it claims to catch: every new banned-content regex in this codebase (this plan's AC-17 scan, following Phase 2's engine-language matcher precedent) ships with a positive-control test asserting it fires on deliberately dirty input, not only that it stays silent on clean input."

requirements-completed: [SIGNOFF-05, SIGNOFF-06, DOC-02, DOC-03, DOC-04]

coverage:
  - id: D1
    description: "The DRAFT watermark renders while noticeSentAt is null and is absent once it is set; the draft text and the tool-emails-nobody boundary note remain queryable in both states; the mark-sent button disappears once sent"
    requirement: DOC-02
    verification:
      - kind: unit
        ref: "apps/web/src/ui/hr/notice-block.test.tsx#HR-RESULT (5 new cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "markNoticeSent's stored full ISO instant is unchanged; the preparer-facing confirmation renders only the calendar-date prefix via the new noticeSentDate() helper, with no colon-separated clock time"
    requirement: SIGNOFF-06
    verification:
      - kind: unit
        ref: "apps/web/src/ui/hr/notice-block.test.tsx#HR-RESULT: the sent confirmation carries only the calendar date, with no colon-separated clock time"
        status: pass
      - kind: integration
        ref: "tests/routes/notice-outputs.test.ts#NOTICE-OUTPUTS: marking the notice sent as HR on a signed-off matter returns 200, closes the matter, and records a valid ISO instant"
        status: pass
    human_judgment: false
  - id: D3
    description: "The notice-sent endpoint returns 200 and CLOSES the matter for HR on a SIGNED_OFF matter, and returns 403 for a LEGAL_REVIEWER cookie — marking sent is the preparer's act"
    requirement: SIGNOFF-06
    verification:
      - kind: integration
        ref: "tests/routes/notice-outputs.test.ts#NOTICE-OUTPUTS (2 cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "AC17_FORBIDDEN_PATTERNS/findAc17Violations catch a rule identifier, a real citation shape, and a tool/model mention on a deliberately dirty positive control, and return empty across three notice variants (authored template, unauthored-marker template, zero allowed lines)"
    requirement: DOC-03
    verification:
      - kind: unit
        ref: "apps/web/src/domain/notice-draft.test.tsx#HR-RESULT (4 new cases)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The real SG-PDPA- and HK-PDPO-derived notices (driven end to end through submit/disposition/sign-off) each score zero AC-17 violations, and contain no substring from either pinned pack's own categoryRules[].basis values"
    requirement: DOC-03
    verification:
      - kind: integration
        ref: "tests/routes/notice-outputs.test.ts#NOTICE-OUTPUTS (2 cases, SG and HK)"
        status: pass
    human_judgment: false
  - id: D6
    description: "A public-agency matter under a NO_EXPRESS_AUTHORITY posture (JP-APPI, substituted for the plan's SG-PDPA — see Deviations): every assessment line is FLAG with the NO_FEE_AUTHORITY reason, draftBaseline is zero, the signed-off finalAmount is zero (not null), and the generated notice carries the no-chargeable-items sentence plus its reference and amount lines, clean of AC-17 violations"
    requirement: DOC-04
    verification:
      - kind: integration
        ref: "tests/routes/notice-outputs.test.ts#NOTICE-OUTPUTS: a public-agency matter with no express fee authority produces a complete zero-fee notice and an ordinary HR result, end to end (DOC-04/SIGNOFF-05)"
        status: pass
    human_judgment: false
  - id: D7
    description: "HR's result payload carries the lawyer name, qualification and sign-off date, and one entry per assessment line — struck lines included, each with a non-empty pack-authored basis; a struck zero-amount line and an allowed zero-amount line carry different outcome markers, not distinguished by amount; result lines hold assessment.lines order stably across repeated derivation"
    requirement: SIGNOFF-05
    verification:
      - kind: integration
        ref: "tests/routes/notice-outputs.test.ts#NOTICE-OUTPUTS (both new cases)"
        status: pass
    human_judgment: false
  - id: D8
    description: "The result headline element's testid and className are byte-identical between a zero-amount and a non-zero-amount render; a struck and an allowed zero-amount line render with different data-outcome markers"
    requirement: SIGNOFF-05
    verification:
      - kind: unit
        ref: "apps/web/src/ui/hr/result-view.test.tsx#HR-RESULT (2 new cases)"
        status: pass
    human_judgment: false

duration: ~45min
completed: 2026-09-21
status: complete
---

# Phase 7 Plan 3: Notice Watermark, AC-17 Scan, and the Zero-Fee Path Summary

**NoticeBlock's DRAFT watermark now stops at the moment the notice is marked sent, the sent confirmation reads a date rather than a timestamp, a real AC-17 regex scan exists and is proven against both authored packs plus a positive control, and a no-express-authority public-agency matter produces a complete zero-fee notice and an ordinary HR result end to end.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3 (all executed, no checkpoints)
- **Files modified:** 6 code/test files + REQUIREMENTS.md

## Accomplishments
- `NoticeBlockView`'s DRAFT watermark is gated on `noticeSentAt === null` — it renders while the notice is a draft and disappears the instant it is marked sent (DOC-02), while the boundary note ("this tool does not email anyone") continues rendering in both states
- A new pure `noticeSentDate()` helper slices the calendar-date prefix off `markNoticeSent`'s stored ISO instant; the preparer reads a date, never a wall-clock time that would read like a transmission timestamp (SIGNOFF-06) — the stored instant itself is untouched
- `AC17_FORBIDDEN_PATTERNS`/`findAc17Violations` (`apps/web/src/domain/notice-draft.ts`) — three named regex patterns derived directly from the real HK-PDPO/SG-PDPA packs' own `ruleId`/`citations[]` shapes plus a case-insensitive tool-or-model-mention pattern, proven against three notice variants and a deliberately dirty positive control that names all three violation kinds
- The real SG-PDPA- and HK-PDPO-derived notices, built by driving a matter through the actual route stack to sign-off, both score zero AC-17 violations and contain no substring of either pack's own `categoryRules[].basis` values
- A no-express-authority public-agency zero-fee outcome proven end to end: every line FLAG with the `NO_FEE_AUTHORITY` reason, `draftBaseline` zero, sign-off, `finalAmount` zero (not null), and a complete notice carrying the no-chargeable-items sentence alongside its reference and amount lines — using JP-APPI rather than the plan's originally-named SG-PDPA (see Deviations for why)
- SIGNOFF-05 proven at both the route level (lawyer/qualification/date present, struck vs. allowed zero-amount lines distinguishable by outcome marker not amount, stable `assessment.lines` ordering) and the component level (`result-view.tsx`'s headline element/class byte-identical between zero and non-zero renders, distinct `data-outcome` markers for a struck vs. an allowed zero-amount line)
- Full suite 976 (post-07-02) → 993 passing; `pnpm run typecheck`, `pnpm run lint`, `pnpm run depcruise` all clean after every task

## Task Commits

1. **Task 1: DOC-02 and SIGNOFF-06 — the watermark stops when the notice is sent, and the record is a date** - `8422bab` (fix, tdd)
2. **Task 2: DOC-03 — the AC-17 scan, over every reachable notice variant** - `3388367` (test, tdd)
3. **Task 3: DOC-04 and SIGNOFF-05 — a zero-allowable outcome as an ordinary result, end to end** - `89a4a9c` (test)

**Plan metadata:** commit pending (this SUMMARY + STATE.md/ROADMAP.md update)

## Files Created/Modified
- `apps/web/src/ui/hr/notice-block.tsx` - watermark gated on `noticeSentAt === null`; new exported `noticeSentDate()`
- `apps/web/src/ui/hr/notice-block.test.tsx` - 5 new cases: watermark presence/absence, draft-text persistence, date-only confirmation, boundary-note persistence, mark-sent-button absence
- `apps/web/src/domain/notice-draft.ts` - `AC17_FORBIDDEN_PATTERNS`, `findAc17Violations`
- `apps/web/src/domain/notice-draft.test.tsx` - 4 new cases: 3 clean-variant proofs + 1 positive control
- `apps/web/src/ui/hr/result-view.test.tsx` - 2 new cases: identical zero/non-zero headline tag, distinct struck/allowed zero-amount outcome markers
- `tests/routes/notice-outputs.test.ts` - new file (created in Task 1, extended by Tasks 2 and 3), tagged NOTICE-OUTPUTS: 8 route-level cases across SIGNOFF-06, DOC-03 (SG+HK), and DOC-04/SIGNOFF-05
- `.planning/REQUIREMENTS.md` - SIGNOFF-05, SIGNOFF-06, DOC-02, DOC-03, DOC-04 marked Complete

## Decisions Made
- DOC-04/AC-14's fixture jurisdiction changed from SG-PDPA (as the plan named) to JP-APPI — see Deviations below for the full reasoning; recorded here as a decision because it changes which pack the DOC-04 proof actually rests on.
- The AC-17 basis-string check lives as a direct substring assertion in the route test, not inside `AC17_FORBIDDEN_PATTERNS` — the static pattern array cannot express "none of THIS pack's basis strings" since `notice-draft.ts` is pure and has no pack of its own.
- The tool-or-model-mention pattern bans the full product-title phrase "DSAR Fee Assessment", never the bare "DSAR" token — bare DSAR is also this system's own matter-reference prefix and appears legitimately in every notice's Reference line.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in the plan's own fixture design] DOC-04/AC-14's named jurisdiction (SG-PDPA) cannot reach the NO_EXPRESS_AUTHORITY branch the task's own assertions require**
- **Found during:** Task 3, before writing the fixture (confirmed via direct reads of `packages/rulepacks/SG-PDPA/2026.09.1.json`, `packages/engine/src/preconditions.ts`, and `packages/engine/src/assess.ts`)
- **Issue:** The plan's read_first and action text name SG-PDPA for the AC-14 fixture ("feePosture.PUBLIC_AGENCY is NO_EXPRESS_AUTHORITY — the posture AC-14 describes"), using the same post-creation controllerType-mutation technique `tests/routes/audit-trail.test.ts` already uses. But SG-PDPA's own `appliesTo` is `["PRIVATE_ORGANISATION"]` only — `checkPreconditions()` throws `CONTROLLER_TYPE_NOT_IN_SCOPE` for any `PUBLIC_AGENCY` matter against this pack, unconditionally, BEFORE the posture gate (`evaluate-line.ts`) ever runs. This is a hard engine precondition failure (a 500 that rolls the matter back to `DRAFT`), not a per-line FLAG outcome — exactly what `tests/routes/audit-trail.test.ts`'s own pre-existing "when the engine throws" test already proves for this identical SG+PUBLIC_AGENCY combination. HK-PDPO has the same `appliesTo` restriction. Executing the plan's fixture literally would either fail immediately (500 instead of 200) or require misrepresenting what the test proves.
- **Fix:** Surveyed all nine committed packs' `appliesTo`/`feePosture` combinations. JP-APPI (and equivalently KR-PIPA) has `appliesTo: ["PRIVATE_ORGANISATION", "PUBLIC_AGENCY"]` with `feePosture.PUBLIC_AGENCY: "NO_EXPRESS_AUTHORITY"` and `feePosture.PRIVATE_ORGANISATION: "PERMITTED_ACTUAL_COST"` (non-blocking, so lines can be added before the controllerType mutation) — the jurisdiction that actually reaches the branch AC-14 describes. Used JP-APPI for the fixture; its stub-generated 21/21 category rules are irrelevant to the outcome since the posture gate (`posture-gate.ts`) forces every line to FLAG with `NO_FEE_AUTHORITY` regardless of the category's own treatment. No production code changed — this is a test-fixture correction to a factually mismatched plan assumption.
- **Files modified:** `tests/routes/notice-outputs.test.ts` (the fixture itself, with an explanatory header comment recording this substitution inline for the next reader)
- **Verification:** `pnpm vitest run --project routes -t "NOTICE-OUTPUTS"` — all 8 cases pass; `pnpm test` — 993/993.
- **Committed in:** `89a4a9c` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (a plan-fixture-design correction, not a production bug)
**Impact on plan:** Necessary to make the DOC-04/AC-14 assertions actually true rather than vacuously green or immediately failing. No production code touched by this deviation — `packages/engine`, `packages/rulepacks`, and every already-committed pack file are unchanged. No scope creep.

## Issues Encountered
- The plan's own `<verify>` commands `pnpm vitest run --project web -t "notice-block"` and `-t "result-view"` filter by literal string, but both files' `describe()` blocks are tagged `"HR-RESULT"` (matching every other component test in this codebase), not `"notice-block"`/`"result-view"` — the filters match zero tests and vacuously report `0 skipped` rather than failing. Verified correctness instead via `pnpm vitest run --project web <file-path>` directly and via the tag-accurate `-t "HR-RESULT"` filter; both used throughout. No code implication — a stale verify-command string in the plan, not a test-naming defect.

## Known Stubs
None — every task's production code and its own tests landed together; no placeholder or deferred data path was introduced.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SIGNOFF-05, SIGNOFF-06, DOC-02, DOC-03 and DOC-04 all discharged and marked Complete in REQUIREMENTS.md.
- `packages/engine`, `packages/schemas`, `packages/workflow` and every committed rule-pack JSON file remain unchanged by this plan.
- `tests/routes/notice-outputs.test.ts` now carries fixture-building helpers (`buildFixtureMatterAndAssessment`, `buildSignedOffMatter`, `buildRealNoticeForMatter`, `buildResultLines`) that 07-04/07-05 can extend rather than re-invent if either plan needs a signed-off matter or a rebuilt notice/result-lines view for its own assertions.
- DOC-01/DOC-05 (the PDF's remaining field list) and ACCESS-05 (the download-trigger UI placement) remain correctly Pending — untouched by this plan, owned by 07-04/07-05 per 07-01-SUMMARY.md's own split-requirement note.

---
*Phase: 07-sign-off-outputs-and-edge-states*
*Completed: 2026-09-21*

## Self-Check: PASSED

- FOUND: apps/web/src/ui/hr/notice-block.tsx (modified)
- FOUND: apps/web/src/ui/hr/notice-block.test.tsx (modified)
- FOUND: apps/web/src/domain/notice-draft.ts (modified)
- FOUND: apps/web/src/domain/notice-draft.test.tsx (modified)
- FOUND: apps/web/src/ui/hr/result-view.test.tsx (modified)
- FOUND: tests/routes/notice-outputs.test.ts (created)
- FOUND: .planning/REQUIREMENTS.md (modified)
- FOUND commit 8422bab (Task 1)
- FOUND commit 3388367 (Task 2)
- FOUND commit 89a4a9c (Task 3)
