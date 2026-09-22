---
phase: 05-hr-intake-and-disclosure-shell
verified: 2026-09-20T02:30:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 5/5
  gaps_closed:
    - "CR-01 (Critical): matters/[id]/submitted/page.tsx had zero authorization"
    - "WR-01 (Warning): canOfferExpenseEntry did not gate on STALE"
    - "WR-02 (Warning): raw displayStatus enum values could reach StatusStrip"
    - "WR-03 (Warning): the autosaved intake draft was never cleared after submit"
    - "Security (low): addExpenseLine had no server-side posture gate"
  gaps_remaining: []
  regressions: []
covered_files:
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/phases/05-hr-intake-and-disclosure-shell/05-REVIEW-ADDENDUM.md
  - .planning/phases/05-hr-intake-and-disclosure-shell/05-REVIEW.md
  - .planning/phases/05-hr-intake-and-disclosure-shell/05-SECURITY.md
  - .planning/phases/05-hr-intake-and-disclosure-shell/05-01-PLAN.md
  - .planning/phases/05-hr-intake-and-disclosure-shell/05-01-SUMMARY.md
  - .planning/phases/05-hr-intake-and-disclosure-shell/05-02-PLAN.md
  - .planning/phases/05-hr-intake-and-disclosure-shell/05-02-SUMMARY.md
  - .planning/phases/05-hr-intake-and-disclosure-shell/05-03-PLAN.md
  - .planning/phases/05-hr-intake-and-disclosure-shell/05-03-SUMMARY.md
  - .planning/phases/05-hr-intake-and-disclosure-shell/05-04-PLAN.md
  - .planning/phases/05-hr-intake-and-disclosure-shell/05-04-SUMMARY.md
  - .planning/phases/05-hr-intake-and-disclosure-shell/05-05-PLAN.md
  - .planning/phases/05-hr-intake-and-disclosure-shell/05-05-SUMMARY.md
  - .planning/phases/05-hr-intake-and-disclosure-shell/05-06-PLAN.md
  - .planning/phases/05-hr-intake-and-disclosure-shell/05-06-SUMMARY.md
  - "apps/web/app/(hr)/matters/[id]/submitted/page.tsx"
  - "apps/web/app/(hr)/matters/[id]/page.tsx"
  - "apps/web/app/(hr)/matters/page.tsx"
  - "apps/web/app/(hr)/matters/new/page.tsx"
  - "apps/web/app/(legal)/assessments/[id]/page.tsx"
  - "apps/web/app/api/matters/[id]/lines/route.ts"
  - apps/web/src/server/data/matters.ts
  - apps/web/src/server/current-actor.ts
  - apps/web/src/ui/intake/intake-form.tsx
  - apps/web/src/ui/intake/intake-form.test.tsx
  - apps/web/src/ui/intake/matter-details-fields.tsx
  - apps/web/src/ui/intake/matter-details-fields.test.tsx
  - apps/web/src/ui/chrome/status-strip.tsx
  - tests/routes/matter-submitted-authorization.test.ts
  - tests/routes/add-expense-line-posture-gate.test.ts
  - tests/routes/audit-trail.test.ts
covered_digest: "v1:sha256-manual:gsd-tools-unavailable"
digest_note: >
  gsd-tools.cjs (the verification.fingerprint verb) is not present in this
  worktree (`gsd-core/bin/gsd-tools.cjs` does not exist; searched the
  filesystem root, not found within the session), the same recurring,
  documented environmental gap recorded for every prior phase's verification
  in this project (03-03 onward, including the prior 05-VERIFICATION.md this
  file replaces). No digest was computed by any canonical tool; the
  covered_files list above is the authoritative record of what this
  verification pass actually read and independently re-ran, plus the five
  fix commits (59d8c18, 38678a1, 0662ee9, 6dc8abd, 31c3edb) confirmed present
  in `git log`.
---

# Phase 5: HR Intake and Disclosure Shell — Re-Verification Report

**Phase Goal:** HR can itemise a claim against the closed taxonomy, inside an application shell that states plainly what the tool is, which pack is speaking, and what it does not decide
**Verified:** 2026-09-20T02:30:00Z
**Status:** passed
**Re-verification:** Yes — after independent-review gap closure (`05-REVIEW-ADDENDUM.md`)

## Why this re-verification exists

The original `05-VERIFICATION.md` (2026-09-20T01:32:00Z, `passed`, 5/5) predated `05-REVIEW-ADDENDUM.md`. That addendum records that two independent subagents (a fresh code-reviewer and a fresh security-auditor, neither of whom wrote the code) found one Critical authorization gap, three Warnings, and one low-severity security gap that the original self-review (`05-REVIEW.md`, `05-SECURITY.md`) — and, by extension, the original verification pass built on top of it — missed entirely. This report independently re-verifies the current source against each of the addendum's five claimed fixes, rather than trusting the addendum's own "all resolved" framing, and re-confirms all five ROADMAP success criteria and all 16 requirement IDs against the code as it now stands.

## Independent Fix Verification (05-REVIEW-ADDENDUM.md)

| # | Finding | Claimed Fix | Independently Verified | Evidence |
|---|---------|-------------|------------------------|----------|
| 1 | CR-01 (Critical) — `matters/[id]/submitted/page.tsx` had zero authorization | Routes through `getHrMatterStatus(actor, id)` | ✓ CONFIRMED | Direct read of the current file: imports `getCurrentActor` from `src/server/current-actor.ts`, calls `await getCurrentActor()`, then `await getHrMatterStatus(actor, id)` — no direct `memoryMatterRepository` import remains anywhere in the file. `getHrMatterStatus` (`apps/web/src/server/data/matters.ts:654`) has `requireRole(actor, "HR_PREPARER")` as its first statement and throws `NotFoundError` for a missing matter. Ran `tests/routes/matter-submitted-authorization.test.ts` directly (part of the full suite below) — 3/3 pass, asserting a `LEGAL_REVIEWER`/`DPO_ADMIN` actor is refused with `/HR_PREPARER role/`, an `HR_PREPARER` succeeds, and a nonexistent id throws `NotFoundError`. |
| 2 | WR-01 — `canOfferExpenseEntry` did not gate on `STALE` | Added `STALE` branch returning `false`; threaded into Submit's disabled-reason ladder | ✓ CONFIRMED | `matter-details-fields.tsx:141` — `if (jurisdictionPack.displayStatus === "STALE") return false;`. `intake-form.tsx:101` — `computeIntakeDisabledReason` returns a disabling reason when `canOfferExpenseEntry === false`; `intake-form.tsx:166` calls `canOfferExpenseEntry(currentJurisdictionPack, matterDetails.controllerType)` and feeds the result in; `claim-footer.tsx:30` — `const disabled = disabledReason !== null \|\| submitting` disables the actual `<button>`. Repeater gating at `intake-form.tsx:274` uses the same predicate. Both the repeater-hiding and the Submit-disabling paths are wired to the same real function, not two independently-drifting checks. |
| 3 | WR-02 — raw `displayStatus` could reach `StatusStrip` as plain text | Added `humanizePackDisplayStatus()`, routed all HR call sites through it | ✓ CONFIRMED | `grep packStatus=` across `apps/web` finds exactly 4 real JSX call sites: `intake-form.tsx`, `matters/[id]/page.tsx`, and `matters/[id]/submitted/page.tsx` all pass `humanizePackDisplayStatus(jurisdictionPack.displayStatus)`; the legal review page (`assessments/[id]/page.tsx`) passes `pack.status` (the real `RulePackStatus` enum, e.g. `"ACTIVE"` — already a short human word, not the derived `displayStatus` enum WR-02 was about). No HR call site passes a raw `displayStatus` value. |
| 4 | WR-03 — autosaved draft never cleared after submit | `localStorage.removeItem(INTAKE_DRAFT_STORAGE_KEY)` before navigating away | ✓ CONFIRMED | `intake-form.tsx:238` — the `removeItem` call sits inside the `try` block, after all three fetches (`POST /api/matters`, per-line `POST .../lines`, `POST .../submit`) have succeeded and immediately before `router.push(...)`; it is unreachable from the `catch` block, so a failed submission correctly leaves the draft intact for retry. |
| 5 | Security (low) — `addExpenseLine` had no server-side posture gate | Added `assertJurisdictionAllowsExpenseEntry(matter)`, called as the second statement | ✓ CONFIRMED | `matters.ts:178` — `assertJurisdictionAllowsExpenseEntry(matter)` is the second statement of `addExpenseLine`, immediately after the not-found check, before any `ExpenseLineSchema.parse`. The function (`matters.ts:59-72`) throws `ConflictError` for `NO_USABLE_PACK`/`STALE` display status or a `BLOCKING_FEE_POSTURES` posture (`NO_EXPRESS_AUTHORITY`/`PROHIBITED`) for the matter's actual `controllerType`. Traced for bypass paths: `grep` finds exactly one call site of `memoryMatterRepository.addExpenseLine` in non-test code — inside the gated `addExpenseLine` function itself. The API route (`api/matters/[id]/lines/route.ts`) POST handler calls only `addExpenseLine`, never the repository directly. `replaceExpenseLine` (used by the route's PUT handler) does not independently re-check posture, but it can only ever operate on a line that already passed through the gated `addExpenseLine`, and no user-reachable endpoint exists to change a matter's `jurisdictionCode` or `controllerType` after creation — so there is no live path for a permissive-posture line to later be edited under a blocking posture. Not a gap in this phase's scope. |

**All 5 independently-found issues are genuinely fixed in the current source, not merely claimed fixed.**

## Regression Check (Item 8 — audit-trail.test.ts adaptation)

The addendum claims the pre-existing test `"when the engine throws, the matter lands back in draft..."` in `tests/routes/audit-trail.test.ts` was adapted using the same post-creation-mutation technique its sibling resubmit/recompute rollback tests already use (originally at lines 472 and 499, now at 487 and 514).

Read the test directly: the matter and its one line are now created as `PRIVATE_ORGANISATION` (passing the new posture gate), then `memoryMatterRepository.updateMatter({ ...draftMatter, controllerType: "PUBLIC_AGENCY" })` mutates the controller type directly on the repository, bypassing the API layer entirely — identical to the technique used at lines 148 (this test), 487, and 514 (siblings) in the same file. The test's assertions are unchanged: submit still returns 500, the matter still reverts to `DRAFT`, no assessment is stored, and exactly one `COMPUTE_FAILED` audit event is recorded with `before: "COMPUTING"` and a non-empty `after` reason. **The test still exercises the same rollback path (the engine's own `appliesTo` precondition failure) — only the mechanism for reaching a `PUBLIC_AGENCY` matter changed, not what is being tested.** No weakening found.

## Command Verification (run directly in this session, not copied from any report)

| Command | Result | Status |
|---------|--------|--------|
| `pnpm test` | 98 test files, 838 tests passed / 838 total | ✓ PASS (matches addendum's claimed 821→838) |
| `pnpm run lint` | `eslint .` — exit 0, no output | ✓ PASS |
| `pnpm run typecheck` | `tsc --build tsconfig.json && tsc -p apps/web/tsconfig.json` — exit 0, no output | ✓ PASS |
| `pnpm run depcruise` | `no dependency violations found (218 modules, 538 dependencies cruised)` | ✓ PASS |

Commit existence independently confirmed via `git show -s --format="%H %s"` for all five: `59d8c18` (require-role gate on the submitted-matter page), `38678a1` (gate canOfferExpenseEntry and Submit on STALE packs), `0662ee9` (humanize displayStatus before it reaches StatusStrip), `6dc8abd` (clear the autosaved draft from localStorage on submit), `31c3edb` (server-side posture gate on addExpenseLine) — all present in `git log` with messages matching the addendum's descriptions.

## Goal Achievement — ROADMAP Success Criteria (re-confirmed against current source)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | HR creates a matter with reference, jurisdiction, legal entity, controller type, received date, currency and requestor class; selecting a jurisdiction shows that pack's status inline immediately, and a `NO_EXPRESS_AUTHORITY`/`PROHIBITED` posture — or no usable pack at all — shows its notice before any expense entry is offered | ✓ VERIFIED | Unchanged substance from the original verification, re-confirmed present; `canOfferExpenseEntry` now additionally correctly excludes `STALE` (WR-01 fix), strengthening rather than weakening this criterion. |
| 2 | HR itemises through a category-grouped repeater with units constrained by category, a computed read-only amount, pack-drawn contextual hints, three attestations each carrying a one-line explanation of why it is asked, and a sticky footer showing the running total labelled as the claim and not the fee | ✓ VERIFIED | Unchanged by the addendum's fixes; re-confirmed present by direct code read and passing `REPEATER`/`ATTESTATIONS` tests within the full 838-test run. |
| 3 | A currency mismatch is blocked as form validation and again server-side, naming both currencies; drafts autosave every 10 seconds with save state visible; and `/hr/matters` lists the preparer's own matters and status | ✓ VERIFIED | Currency/autosave/list mechanisms unchanged by the addendum. The autosave draft is now additionally cleared on successful submit (WR-03), which strengthens rather than weakens the personal-data boundary this criterion sits inside. |
| 4 | Every authenticated screen carries the non-dismissible status strip with jurisdiction, pack id and version, reviewing lawyer, reviewed date and review-due state (AC-31), and no user reaches any screen without passing the unskippable capability statement | ✓ VERIFIED | All 4 real `StatusStrip` JSX call sites confirmed present and now uniformly humanized on the HR side (WR-02 fix); `CapabilityStatement` mounting unchanged from original verification. `matters/[id]/submitted/page.tsx` is now also properly authorization-gated before it ever renders its `StatusStrip` (CR-01 fix) — closing what was, until this addendum, an unauthenticated read reaching an authenticated-screen chrome component. |
| 5 | The personal-data boundary holds at field level: free-text limits, warn-only pattern detector, no banned words in UI strings, "Advisory" on every rendered deadline | ✓ VERIFIED | Unchanged by the addendum's fixes; independently re-confirmed via the passing `UI-BANNED-WORDS` and personal-data-pattern tests inside the full suite run. |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified)

## Requirements Coverage (re-confirmed)

All 16 requirement IDs mapped to Phase 5 in `.planning/REQUIREMENTS.md` are marked `[x]` Complete: INTAKE-01 through INTAKE-09, NAV-02, BOUND-03, BOUND-04, DISC-01, DISC-02, DISC-03, DISC-05. None of the addendum's five fixes touch a requirement's substance in a way that would regress a prior "Complete" — CR-01 and the security fix are authorization/boundary hardening underneath INTAKE-01/DISC-02, WR-01/WR-02 are correctness fixes underneath INTAKE-03/DISC-02, and WR-03 is a boundary-hardening fix underneath BOUND-03/BOUND-04. No orphaned requirements found — the same 16 IDs map to Phase 5 in REQUIREMENTS.md as in every plan's `requirements:` frontmatter combined.

## Anti-Patterns Found

None blocking. Scanned all files touched by the five fix commits (`git diff --name-only` across `59d8c18..31c3edb`) for `TBD`/`FIXME`/`XXX`/`PLACEHOLDER`/"not yet implemented" markers — none found. No stub return patterns (`return null`, empty handlers, hardcoded empty arrays feeding rendered output) found in any of the changed files.

## Human Verification Required

None. Every claim re-verified in this pass was resolvable by direct code read plus an independently-run automated test (not copied from SUMMARY/REVIEW/addendum text) — the full 838-test suite, plus targeted re-reads of the specific fix commits and their regression tests. No visual, real-time, or external-service behavior is newly introduced by these fixes.

## Gaps Summary

No gaps. All 5 independently-found issues (1 Critical, 3 Warnings, 1 low-severity security gap) from `05-REVIEW-ADDENDUM.md` are confirmed genuinely fixed in the current source — not merely claimed fixed in a document. All 5 ROADMAP success criteria hold true against the current codebase. All 16 requirement IDs remain genuinely Complete. `pnpm test` (838/838), `pnpm run lint`, `pnpm run typecheck`, and `pnpm run depcruise` are all clean, run directly in this session. The one adapted pre-existing test (`audit-trail.test.ts`) still tests exactly what it originally tested — only its setup mechanism changed, matching its own documented sibling technique. No regression found anywhere in the fix set. Phase 5's goal — "HR can itemise a claim against the closed taxonomy, inside an application shell that states plainly what the tool is, which pack is speaking, and what it does not decide" — is achieved, and the one gap that would have undermined it (an unauthenticated read reaching an authenticated HR screen) is now closed.

---

_Verified: 2026-09-20T02:30:00Z_
_Verifier: Claude (gsd-verifier) — manual verification, gsd-tools.cjs unavailable in this worktree (same recurring environmental gap documented for every prior phase)_
