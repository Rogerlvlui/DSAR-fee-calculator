---
phase: 260922-jr4-fix-broken-tailwind-v4-css-pipeline-appl
reviewed: 2026-09-22T00:00:00Z
depth: fix-pass
status: resolved
findings:
  critical: 2
  warning: 4
  info: 0
  total: 6
  resolved: 6
  deferred: 0
---

# Phase 260922-jr4: Review Addendum — Fix Pass on 260922-jr4-REVIEW.md's Findings

**Reviewed:** 2026-09-22
**Do not edit `260922-jr4-REVIEW.md`** — it remains the historical record of the original code-review pass. This addendum documents what was fixed afterward, following the `05-REVIEW-ADDENDUM.md` / `06-REVIEW-ADDENDUM.md` / `07-REVIEW-ADDENDUM.md` precedent.

## Scope

All 6 findings (2 Critical, 4 Warnings) were in scope and all 6 are resolved this pass.

## Findings and Fixes

### CR-01 (Critical) — The confirmed-tint selector applied unconditionally, including to still-PENDING lines

**Issue:** `apps/web/app/globals.css:305-311`'s `article.card[data-disposition]:not([data-disposition=""])` is always true — `disposition` is a closed enum (`PENDING`, `ACCEPTED`, `REDUCED`, `STRUCK`, `ALLOWED_BY_LAWYER`) and `PENDING` is a non-empty string, never `""`. Every line card — dispositioned or not — received the "already confirmed" green background tint the moment it rendered, contradicting the rule's own stated purpose and PRD §0 non-negotiable #4.

**Fix:** Keyed the rule off the four decided values explicitly (`ACCEPTED`, `REDUCED`, `STRUCK`, `ALLOWED_BY_LAWYER`) instead of testing for attribute presence/non-emptiness.

**Regression test:** New file `apps/web/app/globals.css.test.ts` (GLOBALS-CSS project, jsdom environment) — extracts the rule's own selector from source and runs it through jsdom's real `document.querySelectorAll` against five sample `<article>` elements (one per disposition value), asserting `PENDING` is never matched and all four decided values are. This proves the fix against a real CSS selector engine, not a string match on the source.

**Commit:** `55da7bb`

---

### CR-02 (Critical) — totals-rail's "load-bearing" sub-row indentation was never implemented in CSS

**Issue:** `totals-rail.tsx`'s own header comment calls the two `data-indent="true"` sub-rows' indentation "load-bearing, not decorative" (PRD §10.3) — a lawyer who reads "resting on unverified rules" as a fourth top-level figure will think the totals don't add up. No selector in `globals.css` ever targeted `[data-indent]`, so the two sub-rows rendered flush with every top-level row.

**Fix:** Added `.summary-row[data-indent="true"] { padding-inline-start: var(--spacing-lg); }` to the `@layer components` block, consuming only an existing spacing token (no new literal).

**Regression test:** Extended `apps/web/app/globals.css.test.ts` — compiles `globals.css` through the real PostCSS/Tailwind pipeline (same technique `tests/toolchain/css-pipeline.test.ts` already uses) and asserts the compiled rule exists and declares a non-zero `padding-inline-start: var(--spacing-*)`; also confirms the selector matches only the indented sub-row via jsdom. `totals-rail.test.tsx` already asserted the `data-indent` attribute and `ink-3` className reach the markup — this closes the remaining gap (that a CSS rule actually consumes the attribute).

**Commit:** `ab9636e`

---

### WR-01 (Warning) — Dead CSS: `.card-ok`/`.card-ok-label` never referenced by any component

**Issue:** Defined (border tint + label color) but no `className` in the current component tree references either selector.

**Fix:** Removed. No obvious near-term consumer was found in `signoff-panel.tsx` or `result-view.tsx` (the two candidates checked for a "confirmed"/"signed-off" visual state) — the project's own established pattern (per prior review addenda) is to remove rather than leave dead code with a misleading comment.

**Commit:** `46b7577`

---

### WR-02 (Warning) — Dead CSS: `.confirmed` never referenced by any component

**Issue:** Same pattern as WR-01 — `.confirmed` (ok-wash background + padding + radius) has no consuming `className` anywhere in the reviewed component tree.

**Fix:** Removed.

**Commit:** `876d159`

---

### WR-03 (Warning) — `.pill`'s default (deny-tinted) background is unreachable dead code

**Issue:** `.pill`'s base rule set a deny tint as a "fallback," but `Verdict` is a closed four-value enum fully covered by the three `article[data-verdict="..."] .pill` override rules below it — the fallback can never be the winning rule for a real line card, and would silently read as "not supported" for any future fifth verdict added without a matching override.

**Fix:** Removed the redundant base `background-color`/`color` declarations, keeping only `.pill`'s structural properties (display, font, padding, border-radius).

**Commit:** `071c439`

---

### WR-04 (Warning) — `.fig.num` compound selector is redundant with `.fig`

**Issue:** `.fig, .fig.num { ... }` shared an identical declaration block — any element using `className="fig num"` (e.g. `claim-footer.tsx`'s `claim-total`) got nothing from the `.num` half that `.fig` alone didn't already provide, implying a meaningful visual distinction that doesn't exist.

**Fix:** Dropped `.fig.num` from the selector list; `.fig` alone still applies to any element carrying both classes.

**Commit:** `bd7be38`

---

## Final Verified State

All 6 findings resolved this pass.

| Finding | Severity | Status | Commit |
|---------|----------|--------|--------|
| CR-01 | Critical | Fixed | `55da7bb` |
| CR-02 | Critical | Fixed | `ab9636e` |
| WR-01 | Warning | Fixed | `46b7577` |
| WR-02 | Warning | Fixed | `876d159` |
| WR-03 | Warning | Fixed | `071c439` |
| WR-04 | Warning | Fixed | `bd7be38` |

**Test suite:** 128 files / 1070 tests (start of this pass) → 129 files / 1072 tests (after all fixes: 1 new colocated file, `apps/web/app/globals.css.test.ts`, with 2 new tests — one per Critical finding). `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, and `pnpm run depcruise` all clean after the final commit (`bd7be38`).

---

_Reviewed: 2026-09-22_
_Fixes applied by: Claude Sonnet 5 (gsd-code-fixer), verified against the full test/typecheck/lint/depcruise suite_
