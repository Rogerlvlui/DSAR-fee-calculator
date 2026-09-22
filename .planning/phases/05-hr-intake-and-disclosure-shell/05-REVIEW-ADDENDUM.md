---
phase: 05-hr-intake-and-disclosure-shell
reviewed: 2026-09-20T02:05:00Z
depth: independent-followup
status: all_resolved
findings:
  critical: 1
  warning: 3
  security: 1
  total: 5
  resolved: 5
  open: 0
---

# Phase 05: Review Addendum — Independent Follow-up Findings

**Reviewed:** 2026-09-20
**Reviewer:** Two independent subagents (a fresh code-reviewer and a fresh security-auditor, neither of which had written the code), dispatched by the product owner because self-review (`05-REVIEW.md`, `05-SECURITY.md`) had repeatedly missed real issues in this project before.

**Do not edit `05-REVIEW.md` or `05-SECURITY.md`** — both remain as historical record of the original self-review pass. This addendum documents what the independent pass found, what was fixed, and the final verified state. `05-SECURITY.md`'s threat register should be read alongside this addendum for the phase's full, current security picture — the gap this addendum closes (T-05-New below) supersedes that document's earlier "0 open" claim, which did not anticipate a direct-API bypass of a client-side-only gate.

## Why this addendum exists

`05-REVIEW.md` and `05-SECURITY.md` were both written by the same agent that executed Phase 5 — a self-review. Despite recording "0 open" and "no Critical findings," an independent code-reviewer and an independent security-auditor, given the same final phase diff with no prior involvement in writing it, found one Critical authorization gap, three Warnings, and one low-severity unregistered attack surface that the self-review missed entirely. This is the same authorization-gap bug class (a page reading data with no role check) that has now recurred three times in this project (Phase 3.1's UNREG-1, Phase 4's WR-02, and CR-01 below) — each time caught only by a review pass independent of the code's author, never by self-review. That pattern is itself worth recording: self-review of this specific bug class has a demonstrated blind spot in this project.

## Findings and Fixes

### CR-01 (Critical) — `matters/[id]/submitted/page.tsx` had zero authorization

**Found by:** independent code-reviewer.

**Issue:** `apps/web/app/(hr)/matters/[id]/submitted/page.tsx` read any matter id directly via `memoryMatterRepository.getMatter(id)`, with no `getCurrentActor()` call and no `requireRole()` gate anywhere on the page — the exact bug class already found and fixed twice before in this project (Phase 3.1's UNREG-1, Phase 4's WR-02). Every other page/data-layer function in this codebase resolves the actor and calls a `requireRole()`-gated function in `apps/web/src/server/data/*` before touching the repository; this page was the one remaining exception, and it had zero test coverage.

**Fix:** Routes through `getHrMatterStatus(actor, id)` — the same `requireRole(actor, "HR_PREPARER")`-gated, `NotFoundError`-throwing read the sibling `matters/[id]/page.tsx` already uses. `getCurrentActor()` imported from `apps/web/src/server/current-actor.ts`; the direct `memoryMatterRepository` import removed entirely.

**Regression test:** `tests/routes/matter-submitted-authorization.test.ts` (new) — proves a `LEGAL_REVIEWER` or `DPO_ADMIN` actor is refused (`/HR_PREPARER role/`), an `HR_PREPARER` actor succeeds, and a nonexistent matter id throws `NotFoundError` even for the correct role.

**Commit:** `59d8c18`

---

### WR-01 (Warning) — `canOfferExpenseEntry` did not gate on `STALE`

**Found by:** independent code-reviewer.

**Issue:** `canOfferExpenseEntry` in `apps/web/src/ui/intake/matter-details-fields.tsx` returned `true` for a `STALE` jurisdiction pack, even though `jurisdictionStatusLabel()` in the same file renders "New matters in this jurisdiction cannot be submitted" for that exact state. Currently latent — no committed pack is ever `STALE` yet — but a real, reachable bug once one is.

**Fix:** Added a `STALE` branch to `canOfferExpenseEntry` (returns `false`). Threaded the predicate's result into `computeIntakeDisabledReason`'s reason ladder (`intake-form.tsx`) via a new optional `canOfferExpenseEntry` field, so a `STALE` (or otherwise unusable) jurisdiction disables Submit, not only the cost-line repeater. The new field defaults to usable (`undefined` !== `false`) so every pre-existing call site is unaffected.

**Regression tests:** `matter-details-fields.test.tsx` — `canOfferExpenseEntry` returns `false` for a hand-built `STALE` fixture. `intake-form.test.tsx` — the repeater does not render for a `STALE` current jurisdiction; `computeIntakeDisabledReason` names the correct unmet condition when `canOfferExpenseEntry: false`; an omitted field behaves exactly as before.

**Commit:** `38678a1`

---

### WR-02 (Warning) — raw `displayStatus` enum values could reach `StatusStrip` as plain text

**Found by:** independent code-reviewer.

**Issue:** Three HR-facing call sites (`intake-form.tsx`, `matters/[id]/page.tsx`, and `matters/[id]/submitted/page.tsx` — the last one relocated by CR-01's fix, addressed after CR-01 landed) passed the derived UI enum `displayStatus` (e.g. `"ACTIVE_REVIEW_DUE_SOON"`) straight into `StatusStrip`'s `packStatus` prop, which renders it as plain text. HR would eventually see a raw underscored enum string once any pack left `DRAFT`. The parallel legal-review page passes the real `RulePackStatus` (`pack.status`, e.g. `"ACTIVE"`) instead — already a short, human word.

**Fix:** Added `humanizePackDisplayStatus()` (exported from `matter-details-fields.tsx`) mapping all five `displayStatus` values to short human labels (`"Active"`, `"Active — review due soon"`, `"Stale"`, `"Draft"`, `"—"`). All three call sites now route through it.

**Regression test:** `matter-details-fields.test.tsx` — a parametrized test asserts `humanizePackDisplayStatus` never returns a string containing an underscore, for all five `displayStatus` values; plus two targeted assertions (`NO_USABLE_PACK` → `"—"`, `ACTIVE_REVIEW_DUE_SOON` → the short label).

**Commit:** `0662ee9`

---

### WR-03 (Warning) — the autosaved intake draft was never cleared after submit

**Found by:** independent code-reviewer.

**Issue:** `intake-form.tsx`'s `handleSubmit` never removed the autosaved draft (`INTAKE_DRAFT_STORAGE_KEY`, `use-draft-autosave.ts`) from `localStorage` after a successful submission. Since the draft can carry exactly the personal-data-shaped free text the pattern detector (`detectLikelyPersonalData`) exists to warn about, it should not persist indefinitely once the matter it was drafting is already submitted.

**Fix:** `window.localStorage.removeItem(INTAKE_DRAFT_STORAGE_KEY)` called immediately before the post-submit `router.push(...)`.

**Regression test:** `intake-form.test.tsx` — a full interactive test (`createRoot` + `act` + native `dispatchEvent`, the same technique `capability-statement.test.tsx` already establishes for this codebase) fills the form, stubs `fetch`, clicks Submit, and asserts the draft key is `null` afterward. Verified during this fix that the test genuinely fails (asserting the stale draft is still present) when the `removeItem` call is disabled, before restoring the fix — proving the test is non-vacuous.

**Commit:** `6dc8abd`

---

### Security finding (low severity) — `addExpenseLine` had no server-side posture gate

**Found by:** independent security-auditor.

**Issue:** `canOfferExpenseEntry`'s jurisdiction-posture gate (the mechanism WR-01 also touches) was enforced client-side only. `apps/web/app/api/matters/[id]/lines/route.ts` → `addExpenseLine` in `apps/web/src/server/data/matters.ts` had no precondition rejecting a cost line added to a matter whose jurisdiction has no usable pack, a `STALE` pack, or a blocking posture (`NO_EXPRESS_AUTHORITY`/`PROHIBITED`). A direct POST bypassing the UI could still add such a line. Severity assessed as low because Phase 2's engine posture gate (ENGINE-03, already shipped) independently forces any such line to `DISALLOW`/`FLAG` with zero draft baseline regardless of how it arrived — no money-integrity violation results — but it was real, unregistered attack surface (the line could exist on the matter, be visible pre-assessment, and generate an audit `LINE_ADDED` event for a claim the pack already says cannot be charged).

**Fix:** Added `assertJurisdictionAllowsExpenseEntry(matter)` in `apps/web/src/server/data/matters.ts`, called as the second statement of `addExpenseLine` (after the existing not-found check). Mirrors `canOfferExpenseEntry`'s logic rather than importing it — `apps/web/src/server` must not depend on a `"use client"` UI module (the `no-server-imports-in-ui` dependency-cruiser rule is the one-way build-time half of that boundary; importing the other direction would be architecturally backwards even though the rule itself does not forbid it). Throws `ConflictError` (409) with a message naming the jurisdiction and controller type.

**Test-suite side effect:** One pre-existing test in `tests/routes/audit-trail.test.ts` (`"when the engine throws, the matter lands back in draft..."`) relied on adding a cost line to a `PUBLIC_AGENCY`-controller-type matter in SG (`NO_EXPRESS_AUTHORITY` posture) to reach the engine's own `appliesTo`-precondition failure path. That line-add is now correctly refused at the API layer before this fix, so the test was adapted (not weakened) to create the matter and its line as `PRIVATE_ORGANISATION` first, then mutate `controllerType` to `PUBLIC_AGENCY` directly on the repository afterward — the identical post-creation-mutation technique this same test file already uses for its two sibling resubmit/recompute rollback tests (lines 472 and 499 pre-fix). The test's assertions and purpose are unchanged; only how the `PUBLIC_AGENCY` state is reached changed.

**Regression test:** `tests/routes/add-expense-line-posture-gate.test.ts` (new) — a real HTTP-level test through the actual route handlers (`createMatterRoute`, `addLineRoute`) proving (1) a `PUBLIC_AGENCY` matter in SG is refused with 409 and a clear error message, and (2) the identical jurisdiction with a `PRIVATE_ORGANISATION` controller type is allowed (201) — proving the gate discriminates rather than blocking everything.

**Commit:** `31c3edb`

---

## Final Verified State

All 5 independently-found issues (1 Critical, 3 Warnings, 1 low-severity security gap) are resolved — none deferred, none accepted-risk.

| Finding | Severity | Status | Commit |
|---------|----------|--------|--------|
| CR-01 | Critical | Fixed | `59d8c18` |
| WR-01 | Warning | Fixed | `38678a1` |
| WR-02 | Warning | Fixed | `0662ee9` |
| WR-03 | Warning | Fixed | `6dc8abd` |
| Security (addExpenseLine posture gate) | Low | Fixed | `31c3edb` |

**Test suite:** 821/821 at baseline (start of this addendum's work) → 838/838 after all five fixes (17 new tests added across `matter-submitted-authorization.test.ts`, `matter-details-fields.test.tsx`, `intake-form.test.tsx`, and `add-expense-line-posture-gate.test.ts`; one pre-existing test in `audit-trail.test.ts` adapted, not weakened). `pnpm run lint`, `pnpm run typecheck`, and `pnpm run depcruise` all clean after every commit.

**Threat register update (supersedes `05-SECURITY.md`'s "0 open" for this one item):** the security finding above corresponds to a new threat not present in `05-SECURITY.md`'s original register:

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-05-14 | Elevation of Privilege (bypassing a client-side-only business gate) | `addExpenseLine` | low | mitigate | `assertJurisdictionAllowsExpenseEntry` rejects (409) a cost line whose jurisdiction has no usable pack, a STALE pack, or a blocking fee posture, mirroring `canOfferExpenseEntry`'s client-side predicate server-side; proven by a real HTTP-level test through the actual route handlers (`add-expense-line-posture-gate.test.ts`) | closed |

**Recorded observation for future phases:** three of this project's authorization gaps (Phase 3.1 UNREG-1, Phase 4 WR-02, this addendum's CR-01) have now each been the same bug class — a page or data-read added late in a plan that skipped the `requireRole()`-first convention every other call site follows — and each was caught only by a review pass independent of the code's own author, never by self-review. If this recurs in Phase 6 or later, it is worth treating as a process signal (e.g., mandating independent review by default for any phase touching `apps/web/app/**/page.tsx`) rather than a one-off.

---

_Reviewed: 2026-09-20_
_Independent reviewers: fresh code-reviewer and security-auditor subagents, dispatched by the product owner specifically because self-review has repeatedly missed issues in this project_
_Fixes applied by: Claude (this session), verified against the full test/lint/typecheck/depcruise suite after each commit_
