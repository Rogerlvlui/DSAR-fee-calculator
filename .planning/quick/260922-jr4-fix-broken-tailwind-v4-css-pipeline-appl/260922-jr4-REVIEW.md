---
phase: 260922-jr4-fix-broken-tailwind-v4-css-pipeline-appl
reviewed: 2026-09-22T00:00:00Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - apps/web/app/api/assessments/[id]/internal-record/route.ts
  - apps/web/app/globals.css
  - apps/web/app/hr/matters/[id]/page.tsx
  - apps/web/app/hr/matters/new/page.tsx
  - apps/web/app/layout.tsx
  - apps/web/app/legal/assessments/[id]/page.tsx
  - apps/web/postcss.config.mjs
  - apps/web/src/domain/internal-record-content-disposition.ts
  - apps/web/src/server/data/auth.ts
  - apps/web/src/ui/capability/capability-statement.tsx
  - apps/web/src/ui/chrome/app-header.tsx
  - apps/web/src/ui/chrome/demo-banner.tsx
  - apps/web/src/ui/honesty.test.tsx
  - apps/web/src/ui/hr/result-view.test.tsx
  - apps/web/src/ui/hr/result-view.tsx
  - apps/web/src/ui/intake/attestations-panel.tsx
  - apps/web/src/ui/intake/claim-footer.tsx
  - apps/web/src/ui/intake/expense-line-repeater.tsx
  - apps/web/src/ui/intake/intake-form.tsx
  - apps/web/src/ui/intake/matter-details-fields.tsx
  - apps/web/src/ui/review/assessment-view.tsx
  - apps/web/src/ui/review/disposition-controls.tsx
  - apps/web/src/ui/review/line-card.tsx
  - apps/web/src/ui/review/matter-rail.tsx
  - apps/web/src/ui/review/pack-rail.tsx
  - apps/web/src/ui/review/signoff-panel.test.tsx
  - apps/web/src/ui/review/signoff-panel.tsx
  - apps/web/src/ui/review/totals-rail.tsx
  - package.json
  - packages/documents/src/internal-record-document.test.tsx
  - packages/documents/src/internal-record-view.test.ts
  - tests/boundary/ui-banned-words.test.ts
  - tests/routes/internal-record.test.ts
  - tests/toolchain/css-pipeline.test.ts
findings:
  critical: 2
  warning: 4
  info: 0
  total: 6
status: issues_found
---

# Phase 260922-jr4: Code Review Report

**Reviewed:** 2026-09-22
**Depth:** standard
**Files Reviewed:** 33 (pnpm-lock.yaml excluded as a generated artifact)
**Status:** issues_found

## Summary

Reviewed the PostCSS pipeline fix, the Marcus Tan → Roger Lui identity rename, and the new `@layer components` block plus its application across HR/legal review markup. The PostCSS wiring itself is sound (`apps/web/postcss.config.mjs` is correctly placed and pinned in lockstep with `tailwindcss` per `tests/toolchain/css-pipeline.test.ts`), and the identity rename is complete and consistent — no orphaned "Marcus" references remain in source or tests. No `display:none`/`visibility:hidden`/zero-opacity styling was found on any honesty marker, disclosure, or watermark, and no `data-testid`/`role`/`aria-*`/visible text was altered by the styling pass — the class-append-only constraint held everywhere checked.

However, the new component-layer CSS itself contains two real behavioural bugs, both of which undermine the specific visual-honesty guarantees this phase's own code comments claim to provide:

1. A CSS selector that is supposed to distinguish "lawyer has dispositioned this line" from "still pending" actually matches **every** line card, because the `disposition` field is never an empty string (`PENDING` is a non-empty enum value).
2. A `data-indent="true"` attribute that the totals-rail component's own header comment calls "load-bearing, not decorative" — specifically to stop a lawyer from misreading a sub-total as a fourth top-level total — has no corresponding CSS rule anywhere in `globals.css`, so no indentation is actually rendered.

Both are genuine regressions in intent vs. implementation, not merely cosmetic gaps, given this is a legal-compliance review screen where visual state must not mislead a reviewing lawyer. Also flagging several pieces of dead CSS from the new component layer.

## Critical Issues

### CR-01: The "line has been dispositioned" background tint applies unconditionally — including to still-PENDING lines

**File:** `apps/web/app/globals.css:305-311`

**Issue:** The rule reads:

```css
/* AC-39/PRD §0 non-negotiable #4: the decided state is already expressed
   in the line card's own data-disposition attribute — the confirmation
   ground needs no new markup, only a rule keyed to it. Never applies
   while data-disposition is empty (a still-PENDING line). */
article.card[data-disposition]:not([data-disposition=""]) {
  background-color: var(--color-ok-wash);
}
```

The comment's premise — that a still-PENDING line renders `data-disposition=""` — is false. `packages/schemas/src/assessment.ts`'s `DispositionSchema` enumerates `PENDING`, `ACCEPTED`, `REDUCED`, `STRUCK`, `ALLOWED_BY_LAWYER`; `PENDING` is a non-empty string, and `line-card.tsx` always sets `data-disposition={line.disposition}` (never omits the attribute, never sets `""`). No code path in this codebase constructs an `AssessmentLine` with an empty-string disposition (confirmed by search).

Consequence: `:not([data-disposition=""])` is always true, so **every** line card — dispositioned or not — receives the "already confirmed" green (`--color-ok-wash`) background tint the moment it renders. There is no visual distinction on the review screen between a line the lawyer has already accepted/reduced/struck/allowed and a line still awaiting a decision. This directly contradicts the rule's own stated purpose ("the decided state is already expressed... never applies while... still-PENDING") and PRD §0 non-negotiable #4 ("a flagged line contributes nothing to any total until a lawyer dispositions it" — the UI should not visually imply it already has).

**Fix:** Key the rule off the actual "decided" states, not off attribute presence:

```css
article.card[data-disposition="ACCEPTED"],
article.card[data-disposition="REDUCED"],
article.card[data-disposition="STRUCK"],
article.card[data-disposition="ALLOWED_BY_LAWYER"] {
  background-color: var(--color-ok-wash);
}
```

(or equivalently `:not([data-disposition="PENDING"])`).

### CR-02: Totals-rail's "load-bearing" sub-row indentation was never implemented in CSS

**File:** `apps/web/src/ui/review/totals-rail.tsx:78,96` / `apps/web/app/globals.css` (no matching rule anywhere)

**Issue:** `totals-rail.tsx`'s own header comment states:

```
// The seven UI-SPEC rows (two of them sub-rows of their parent, rendered
// indented — that indentation is load-bearing, not decorative: PRD §10.3
// warns that a lawyer who reads "resting on unverified rules" as a fourth
// top-level figure will think the totals don't add up)
```

and the two sub-rows carry `data-indent="true"`:

```tsx
<div data-testid="total-row-resting-unverified" data-indent="true" className="text-ink-3 summary-row">
...
<div data-testid="total-row-excluded" data-indent="true" className="text-ink-3 summary-row">
```

`globals.css`'s new `@layer components` block was authored in this same phase and covers every other class/attribute this screen uses (`.summary-row`, `.summary-total`, `.card`, `.pill`, etc.), but there is no selector anywhere in the file for `[data-indent]` or `[data-indent="true"]`. `data-indent` is consumed only by `totals-rail.test.tsx`'s markup assertions (it checks the attribute is present in the HTML string), never by any CSS rule. The two sub-rows therefore render with the exact same left edge as every top-level total row — the specific misreading PRD §10.3 is quoted as warning against is left unguarded.

**Fix:** Add an indentation rule to the component layer, e.g.:

```css
.summary-row[data-indent="true"] {
  padding-inline-start: var(--spacing-lg);
}
```

## Warnings

### WR-01: Dead CSS — `.card-ok` / `.card-ok-label` are never referenced by any component

**File:** `apps/web/app/globals.css:296-303`

**Issue:** `.card-ok` and `.card-ok-label` are defined (border tint + label color) but a repo-wide search of every `.tsx` under `apps/web` finds no `className` containing either string. This is unreachable styling shipped in the same commit that authored it.

**Fix:** Either wire it to the component it was meant for (if one exists in a later, uncommitted step) or remove it until a consumer exists.

### WR-02: Dead CSS — `.confirmed` is never referenced by any component

**File:** `apps/web/app/globals.css:355-360`

**Issue:** Same pattern as WR-01 — `.confirmed` (ok-wash background + padding + radius) has no consuming `className` anywhere in the reviewed component tree.

**Fix:** Remove, or wire it to its intended element.

### WR-03: `.pill`'s default (deny-tinted) background is unreachable dead code

**File:** `apps/web/app/globals.css:318-327`

**Issue:** `.pill`'s base rule sets `background-color: var(--color-deny-wash)` / `color: var(--color-deny)`, intended as a fallback tint. But `Verdict` (`@dsar/schemas/assessment`) is a closed four-value enum (`FLAG`, `ALLOW`, `ALLOW_CAPPED`, `DISALLOW`), and the three `article[data-verdict="..."] .pill` rules immediately below cover all four values (`ALLOW`/`ALLOW_CAPPED` share one rule). Since `line-card.tsx` always sets `data-verdict={line.verdict}` to one of the four covered values, the base `.pill` deny-tint declaration can never actually be the winning rule for any real line card — it's dead code that will silently mask a real bug if a fifth verdict is ever added without a matching override (it will fall back to "deny" styling, incorrectly implying "not supported").

**Fix:** Low priority — either remove the redundant base color declarations (keep only structural `.pill` properties) or leave a comment explaining the fallback is deliberate and untested.

### WR-04: `.fig.num` compound selector is redundant with `.fig` (no distinct declarations)

**File:** `apps/web/app/globals.css:238-243`

**Issue:** `.fig, .fig.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; color: var(--color-ink); }` — `.fig.num` shares an identical declaration block with `.fig`. Any element using `className="fig num"` (e.g. `claim-footer.tsx`'s `<div className="fig num" data-testid="claim-total">`) gets nothing from the `.num` half of the class list that `.fig` alone didn't already provide. Minor code smell, not a behavioural bug.

**Fix:** Drop `.fig.num` from the selector list unless a distinct treatment is planned for it, to avoid implying a meaningful visual difference that doesn't exist.

---

_Reviewed: 2026-09-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
