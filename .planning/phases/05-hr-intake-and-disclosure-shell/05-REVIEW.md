---
phase: 05-hr-intake-and-disclosure-shell
reviewed: 2026-09-20T01:26:00Z
depth: standard
files_reviewed: 44
files_reviewed_list:
  - apps/web/app/(hr)/layout.test.tsx
  - apps/web/app/(hr)/layout.tsx
  - apps/web/app/(hr)/matters/[id]/page.tsx
  - apps/web/app/(hr)/matters/[id]/submitted/page.tsx
  - apps/web/app/(hr)/matters/new/page.tsx
  - apps/web/app/(hr)/matters/page.tsx
  - apps/web/app/(legal)/assessments/[id]/page.tsx
  - apps/web/app/(legal)/layout.test.tsx
  - apps/web/app/(legal)/layout.tsx
  - apps/web/src/domain/advisory-deadline.test.ts
  - apps/web/src/domain/advisory-deadline.ts
  - apps/web/src/domain/hr-matter-status-label.test.ts
  - apps/web/src/domain/hr-matter-status-label.ts
  - apps/web/src/server/data/matters.ts
  - apps/web/src/server/jurisdiction-packs.test.ts
  - apps/web/src/server/jurisdiction-packs.ts
  - apps/web/src/server/pack-view.ts (deleted)
  - apps/web/src/server/review-view.ts
  - apps/web/src/ui/capability/capability-statement.test.tsx
  - apps/web/src/ui/capability/capability-statement.tsx
  - apps/web/src/ui/chrome/status-strip.test.tsx
  - apps/web/src/ui/chrome/status-strip.tsx
  - apps/web/src/ui/honesty.test.tsx
  - apps/web/src/ui/intake/attestations-panel.test.tsx
  - apps/web/src/ui/intake/attestations-panel.tsx
  - apps/web/src/ui/intake/autosave-indicator.test.tsx
  - apps/web/src/ui/intake/autosave-indicator.tsx
  - apps/web/src/ui/intake/expense-line-repeater.test.tsx
  - apps/web/src/ui/intake/expense-line-repeater.tsx
  - apps/web/src/ui/intake/intake-form.test.tsx
  - apps/web/src/ui/intake/intake-form.tsx
  - apps/web/src/ui/intake/matter-details-fields.test.tsx
  - apps/web/src/ui/intake/matter-details-fields.tsx
  - apps/web/src/ui/intake/use-draft-autosave.test.ts
  - apps/web/src/ui/intake/use-draft-autosave.ts
  - apps/web/src/ui/review/matter-rail.tsx
  - packages/engine/src/engine-language.test.ts
  - packages/schemas/src/personal-data-pattern.test.ts
  - packages/schemas/src/personal-data-pattern.ts
  - tests/boundary/banned-word-matcher.ts
  - tests/boundary/dom-denylist.test.ts
  - tests/boundary/ui-banned-words.test.ts
  - tests/fixtures/banned-word-canary.fixture.tsx
  - tests/routes/hr-matters-list.test.ts
  - tests/routes/list-matters-for-preparer.test.ts
findings:
  critical: 0
  warning: 1
  info: 0
  total: 1
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-09-20
**Depth:** standard
**Files Reviewed:** 44
**Status:** issues_found (the one Warning below was fixed inline during this review, commit `0d8afbc`)

## Summary

This phase's headline architectural move — replacing Phase 3.1's SG-only hardcoded jurisdiction-status fallback with `jurisdiction-packs.ts`'s real, individually-resolved status for all nine committed rule packs — is implemented correctly and is exercised by a genuinely convincing test (`jurisdiction-packs.test.ts`'s defensive `NO_USABLE_PACK` case, proven against a hand-built pack list missing one jurisdiction, with every other jurisdiction's entry asserted unaffected via a deep-equal comparison). `canOfferExpenseEntry` is a single, cleanly exported gating predicate with its own dedicated test coverage across all five display states plus both heads-up postures — the actual INTAKE-03 fix, since the expense-line repeater previously rendered regardless of the resolved posture.

The personal-data pattern detector (`detectLikelyPersonalData`) and the draft-autosave hook (`useDraftAutosave`) are both narrow, well-tested, and correctly wired with no gating side effects — a grep-based acceptance check on each plan's own SUMMARY.md confirms neither ever reaches submit-disabling logic. The DISC-03 banned-word scan (`tests/boundary/ui-banned-words.test.ts`) is a genuinely non-vacuous gate: it was shown, during this review's own verification pass, to catch a real, temporarily-injected violation in a production component (`claim-footer.tsx`, reverted before commit), and it correctly identified and scoped out a real, pre-existing PRD-verbatim exception (`headsUpMessage()`'s "no clear legal basis" text) rather than either weakening the scanner or silently dropping the case — this is exactly the kind of finding a render-and-scan gate is supposed to surface, and it was handled correctly by documenting the exception with its own test rather than either fix (over-flagging or under-flagging).

Only one issue surfaced across all 44 files, a code-quality Warning found and fixed during this same review pass — no Critical or unfixed Warning-level issues remain.

## Critical Issues

None.

## Warnings

### WR-01 (fixed): A fragile `.split(". ")` string reconstruction in `matter-rail.tsx`'s advisory-deadline rendering

**File:** `apps/web/src/ui/review/matter-rail.tsx` (as committed in `8c89a18`, Plan 05-04 Task 1)

**Issue:** When `05-04`'s advisory-deadline extraction moved `ADVISORY_QUALIFIER` out of `matter-rail.tsx` into the new shared `apps/web/src/domain/advisory-deadline.ts` module, the JSX that previously hardcoded the qualifier's two sentences separately (one bolded, one plain) was rewritten to reconstruct the same visual split from the imported constant at render time: `<b>{ADVISORY_QUALIFIER.split(". ")[0]}.</b> {ADVISORY_QUALIFIER.split(". ")[1]}`. This is correct today (the constant happens to contain exactly one `". "` separator), but it is a silent trap: if the qualifier's wording is ever edited to have zero or two `". "` occurrences, the split silently produces `undefined` in the rendered output rather than failing to compile or throwing at runtime — a change to a string literal in one file quietly breaking the rendered text of a completely different file, with no test that would catch it (no dedicated test file exists for `matter-rail.tsx`, confirmed during this review).

**Fix:** Render the whole qualifier as one bolded unit — `<b>{ADVISORY_QUALIFIER}</b>` — matching how the `/matters` list page (`apps/web/app/(hr)/matters/page.tsx`, Plan 05-04 Task 3) already renders the identical constant. No test asserted the previous partial-bold visual split, so this is a pure simplification with no behavior worth preserving.

**Status:** Fixed directly during this review — commit `0d8afbc`. `pnpm test` (821/821), `pnpm run typecheck` and `pnpm run lint` all re-verified green after the fix.

## Info

None.

## Notable correct decisions (not findings, recorded for context)

- **`headsUpMessage()` correctly excluded from the DISC-03 banned-word corpus.** DISC-03's own definition in `.planning/REQUIREMENTS.md` scopes the ban to "No **engine-derived** UI string" — `headsUpMessage()` is static, PRD §10.2-verbatim UI copy, unchanged since Phase 3.1 per `05-UI-SPEC.md`'s own Copywriting Contract. Altering this text to satisfy a broader scan than the requirement itself asks for would have violated this codebase's own no-extrapolation discipline (D-14). The exclusion is proven deliberate by a dedicated test (`tests/boundary/ui-banned-words.test.ts`'s "headsUpMessage — a documented, out-of-scope exception" describe block) rather than silently dropped.
- **The engine-language.test.ts / ui-banned-words.test.ts matcher duplication is a correct, documented workaround**, not an oversight — `packages/engine`'s composite tsconfig `rootDir` genuinely cannot reach a file under `tests/`, and both copies are the identical one-line `\b${word}\b` construction.
- **`resolveJurisdictionPackViews`'s pure/IO split** cleanly isolates the one behavior (a missing pack file) that would otherwise require deleting a committed fixture to test.

---

_Reviewed: 2026-09-20_
_Reviewer: Claude (manual review — gsd-tools.cjs / gsd-code-reviewer subagent dispatch unavailable in this worktree, the same recurring gap documented for every prior phase; review performed directly by the execute-phase agent against the full phase diff)_
_Depth: standard_
