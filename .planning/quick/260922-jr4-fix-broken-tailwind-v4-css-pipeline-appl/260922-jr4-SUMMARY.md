---
phase: 260922-jr4
plan: 01
subsystem: ui
tags: [tailwind-v4, postcss, css-pipeline, nextjs, design-system]

requires: []
provides:
  - A real PostCSS pipeline (apps/web/postcss.config.mjs + @tailwindcss/postcss@4.3.3) that actually
    processes apps/web/app/globals.css — the theme block resolves into real CSS custom properties
    and Tailwind-generated utilities reach the browser, permanently gated by tests/toolchain/css-pipeline.test.ts
  - A frozen-token, additive component layer in globals.css (@layer components) implementing all
    nineteen previously-orphaned class names plus the mockup's card/eyebrow/summary-row/btn/page/
    review-grid patterns, applied to the legal review screen, app chrome, HR intake and HR result
  - The demo Legal reviewer renamed end to end (Marcus Tan -> Roger Lui) across source and six test files
affects: [ui, legal-review-screen, hr-intake-screen, hr-result-screen, toolchain-gates]

actuals:
  tokens: 22183
  tasks: 3
  commits: 4
  plan_head_before: 3e30f29e328eac504b58b9ebfa1ff799c0f55446

tech-stack:
  added:
    - "@tailwindcss/postcss@4.3.3 (root devDependency, exact-pinned, lockstep with tailwindcss@4.3.3)"
    - "postcss@8.5.28 (root devDependency, exact-pinned)"
  patterns:
    - "globals.css's @layer components block: every declaration reads var(--color-*)/var(--spacing-*)/var(--text-*)/var(--font-*) only — the @theme block stays frozen, styling is additive-only from here on"
    - "Verdict-badge (and any future per-state) colour differentiation keyed off an existing data-* attribute (article[data-verdict=...]) rather than new markup, so colour differentiation never requires touching a component's props/testids"

key-files:
  created:
    - apps/web/postcss.config.mjs
    - tests/toolchain/css-pipeline.test.ts
    - apps/web/src/domain/internal-record-content-disposition.ts
  modified:
    - apps/web/app/globals.css
    - apps/web/app/layout.tsx
    - apps/web/src/ui/chrome/app-header.tsx
    - apps/web/src/ui/chrome/demo-banner.tsx
    - apps/web/src/ui/review/assessment-view.tsx
    - apps/web/src/ui/review/matter-rail.tsx
    - apps/web/src/ui/review/pack-rail.tsx
    - apps/web/src/ui/review/line-card.tsx
    - apps/web/src/ui/review/totals-rail.tsx
    - apps/web/src/ui/review/disposition-controls.tsx
    - apps/web/src/ui/review/signoff-panel.tsx
    - apps/web/app/legal/assessments/[id]/page.tsx
    - apps/web/src/ui/capability/capability-statement.tsx
    - apps/web/src/ui/intake/intake-form.tsx
    - apps/web/src/ui/intake/matter-details-fields.tsx
    - apps/web/src/ui/intake/expense-line-repeater.tsx
    - apps/web/src/ui/intake/attestations-panel.tsx
    - apps/web/src/ui/intake/claim-footer.tsx
    - apps/web/src/ui/hr/result-view.tsx
    - apps/web/app/hr/matters/new/page.tsx
    - apps/web/app/hr/matters/[id]/page.tsx
    - apps/web/src/server/data/auth.ts
    - "apps/web/app/api/assessments/[id]/internal-record/route.ts"

key-decisions:
  - "Task 1's real-build proof used `next build --webpack` / `next dev --webpack`, not the default Turbopack path — Turbopack reproducibly segfaults (STATUS_ACCESS_VIOLATION) on this build machine on the first CSS compile with the plugin registered, matching the already-open WINDOWS.md ledger entry 4 exactly. Not fixed here (pre-existing, previously investigated, product-owner-acknowledged machine-level native-binary defect, out of this plan's scope); WINDOWS.md entry 3 (the pipeline itself being dead) is now marked fixed, entry 4 (the Turbopack crash) stays open."
  - "Moved buildInternalRecordContentDisposition out of apps/web/app/api/assessments/[id]/internal-record/route.ts into a new pure module (apps/web/src/domain/internal-record-content-disposition.ts) — a pre-existing, unrelated bug from the immediately-prior commit (bdadc1c) that exported a non-standard member from a route.ts file, which Next's own route-type validation rejects and which blocked `next build`'s typecheck phase regardless of bundler. Rule 3 (blocking-issue) auto-fix; behavior and the one call site's test both unchanged."
  - "Added one small 'pill' class (verdict badge) beyond the plan's own named nineteen-plus-family-two list, since the plan's own action text explicitly calls for 'a pill' shape and no other named class covers it. Colour is never the only signal (VERDICT_LABELS text + aria-label unchanged); the per-verdict tint keys off the line card's existing data-verdict attribute, so no new markup was needed."
  - "review-grid's three column wrappers (review-grid-rails/-main/-totals) are new, minimal, colour-free structural classes not named in the plan's literal list — necessary plumbing to give the plan's three named regions (rails/cards/totals) actual CSS Grid children to place."

patterns-established:
  - "A Tailwind v4 theme namespace (--spacing-*, --text-*, --font-*, --color-*) auto-generates matching utility classes (gap-md, text-heading, font-serif, text-ink-3, ...) the moment the pipeline runs — confirmed by direct postcss compile before relying on it across dozens of call sites."

requirements-completed: [BUGFIX-CSS-PIPELINE, DEMO-IDENTITY-RENAME, UI-VISUAL-SYSTEM]

coverage:
  - id: D1
    description: "The Tailwind v4 CSS pipeline is wired end to end: apps/web/postcss.config.mjs names @tailwindcss/postcss, both new dependencies are exact-pinned and version-lockstepped, and a real compile of globals.css resolves the theme into utilities with no un-expanded @theme at-rule and no network reference."
    requirement: BUGFIX-CSS-PIPELINE
    verification:
      - kind: unit
        ref: "tests/toolchain/css-pipeline.test.ts (CSS-PIPELINE) — 4 cases"
        status: pass
      - kind: integration
        ref: "next build --webpack + next dev --webpack: real compiled CSS bundle inspected directly (--color-seal: #7c2334 resolved, .text-seal / dozens of component-layer classes present as real rules)"
        status: pass
    human_judgment: true
    rationale: "Default `next build`/`next dev` (Turbopack) still segfault on this build machine (WINDOWS.md entry 4, pre-existing, out of scope) — a human should confirm the pipeline also builds cleanly on their own machine/CI, where the Turbopack native-binary crash may not reproduce."
  - id: D2
    description: "The demo Legal reviewer identity reads Roger Lui — Legal, Singapore / roger.lui@example.invalid everywhere in source and tests, with zero surviving occurrences of the prior name or address under apps/, packages/ and tests/."
    requirement: DEMO-IDENTITY-RENAME
    verification:
      - kind: unit
        ref: "full suite (1070/1070 passing) covering the 6 test files that assert on the literal"
        status: pass
      - kind: other
        ref: "repo-wide grep for 'Marcus Tan' / 'marcus.tan' across apps/, packages/, tests/ — zero matches"
        status: pass
    human_judgment: false
  - id: D3
    description: "All nineteen previously-orphaned class names resolve to real rules built from existing tokens, applied to the legal review screen, app chrome, HR intake and HR result screens — card/eyebrow/summary-row/button/callout patterns render consistently, every data-testid/role/aria-*/visible-text string unchanged."
    requirement: UI-VISUAL-SYSTEM
    verification:
      - kind: unit
        ref: "full suite (1070/1070 passing, no test removed or weakened) + globals.css invariant script (48 theme tokens unchanged, @layer components present, no @font-face/url())"
        status: pass
      - kind: integration
        ref: "webpack-backed dev server: compiled CSS bundle inspected for every named rule (card/eyebrow/btn-*/summary-row/summary-total/review-grid/pill/typein/confirmed/page/kicker/hint/claimfoot/fig/wordmark/why/posture/screen/caption/lede — all present); a real matter created and submitted over HTTP, then fetched as Legal Reviewer, showing card/review-grid/eyebrow/pill classes and the renamed reviewer in the actual rendered payload"
        status: pass
    human_judgment: true
    rationale: "The HR intake/result screens and the capability-statement gate that precedes every route are client components gated by browser localStorage, which curl cannot satisfy — a human should complete one real-browser click-through per docs/DEMO-WALKTHROUGH.md to see the full visual system directly, as the orchestrator's own constraints anticipated."

duration: ~70min
completed: 2026-09-22
status: complete
---

# Quick Task 260922-jr4: Fix broken Tailwind v4 CSS pipeline, rename demo reviewer, apply visual system — Summary

**Wired a real PostCSS/Tailwind v4 pipeline into apps/web (the theme was previously inert — every screen rendered in browser defaults), renamed the demo Legal reviewer to Roger Lui across source and six test files, and authored a frozen-token component layer applied to the legal review screen, app chrome, HR intake and HR result screens.**

## Performance

- **Duration:** ~70 min
- **Tasks:** 3 (Task 1 split into 2 commits: pipeline, then rename)
- **Files modified:** 35 (3 created, 32 modified)
- **Commits:** 4

## Accomplishments

- `apps/web/postcss.config.mjs` + `@tailwindcss/postcss@4.3.3`/`postcss@8.5.28` (exact-pinned, lockstepped) wire a real PostCSS pipeline; `tests/toolchain/css-pipeline.test.ts` gates it permanently (config shape, version lockstep, a real compile resolving the theme into utilities, no network reference).
- Demo Legal reviewer renamed `Marcus Tan` → `Roger Lui — Legal, Singapore` / `roger.lui@example.invalid` in `auth.ts` and six test files; zero surviving occurrences repo-wide.
- `globals.css` gained one `@layer components` block: all nineteen previously-orphaned class names (`screen`, `caption`, `kicker`, `lede`, `hint`/`stern`, `row`, `why`/`posture`, `claimfoot`/`lbl`, `fig`/`num`, `wordmark`, `why-layered`, `typein`/`.f`/`.lb`/`.t`) plus the mockup's new patterns (`card`, `card-ok`, `eyebrow`, `confirmed`, `summary-row`/`summary-total`, `btn`/`btn-primary`/`btn-secondary`/`btn-tertiary`, `page`, `review-grid`) — every declaration reads existing tokens only; the `@theme` block is unchanged (48 tokens).
- Applied that layer to the legal review screen (assessment-view/matter-rail/pack-rail/line-card/totals-rail/disposition-controls/signoff-panel), app chrome (layout/app-header/demo-banner), the capability-statement gate, HR intake (intake-form/matter-details-fields/expense-line-repeater/attestations-panel/claim-footer) and the HR result screen — every `data-testid`/`role`/`aria-*`/visible-text string unchanged; only class tokens appended.
- Fixed a pre-existing, unrelated blocking bug (from the immediately-prior commit) that made `next build`'s own typecheck phase fail regardless of bundler.

## Task Commits

1. **Task 1a/1b: Wire the CSS pipeline** — `0f45b8d` (feat)
2. **Task 1c: Rename the demo reviewer** — `6aa2c98` (feat)
3. **Task 2: Component layer + legal review screen + chrome** — `eecd064` (feat)
4. **Task 3: HR intake and HR result screens** — `2cecf44` (feat)

## Files Created/Modified

- `apps/web/postcss.config.mjs` — names `@tailwindcss/postcss`, placed at the Next.js project root
- `tests/toolchain/css-pipeline.test.ts` — the permanent CSS-PIPELINE regression gate (4 cases)
- `apps/web/src/domain/internal-record-content-disposition.ts` — pure helper extracted from the internal-record route (Rule 3 fix)
- `apps/web/app/globals.css` — `@layer components` block; header comment updated to describe the file's two parts
- `apps/web/src/server/data/auth.ts` — `LEGAL_REVIEWER_USER` renamed
- `apps/web/app/layout.tsx`, `app-header.tsx`, `demo-banner.tsx` — chrome styling
- `apps/web/src/ui/review/*.tsx` (assessment-view, matter-rail, pack-rail, line-card, totals-rail, disposition-controls, signoff-panel), `apps/web/app/legal/assessments/[id]/page.tsx` — legal review screen styling
- `apps/web/src/ui/capability/capability-statement.tsx`, `apps/web/src/ui/intake/*.tsx` (intake-form, matter-details-fields, expense-line-repeater, attestations-panel, claim-footer), `apps/web/src/ui/hr/result-view.tsx`, `apps/web/app/hr/matters/new/page.tsx`, `apps/web/app/hr/matters/[id]/page.tsx` — HR intake/result screen styling
- Six test files updated for the reviewer rename (expected-value literals only, no assertion weakened): `apps/web/src/ui/honesty.test.tsx`, `apps/web/src/ui/hr/result-view.test.tsx`, `apps/web/src/ui/review/signoff-panel.test.tsx`, `packages/documents/src/internal-record-document.test.tsx`, `packages/documents/src/internal-record-view.test.ts`, `tests/boundary/ui-banned-words.test.ts`
- `tests/routes/internal-record.test.ts` — import path updated to match the extracted helper's new location

## Decisions Made

See `key-decisions` in frontmatter — summarized: (1) used `--webpack` for the real-build proof since default Turbopack segfaults on this machine (pre-existing, WINDOWS.md entry 4, not fixed here); (2) fixed one pre-existing, unrelated route-export-shape bug that blocked `next build`'s own typecheck; (3) added a small `pill` class and three structural `review-grid-*` wrapper classes beyond the plan's literal name list, both necessary to satisfy the plan's own explicit instructions ("a pill", "the three regions their grid positions").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extracted `buildInternalRecordContentDisposition` out of a route.ts file**
- **Found during:** Task 1, verifying the production build
- **Issue:** `apps/web/app/api/assessments/[id]/internal-record/route.ts` exported a helper function alongside `GET`, which Next.js's generated route-type validation rejects (a route.ts file may only export recognised members) — this blocked `next build`'s typecheck phase under both Turbopack and webpack, unrelated to the CSS pipeline itself. Pre-existing since commit `bdadc1c` (07-review, immediately prior to this plan).
- **Fix:** Moved the pure, no-I/O helper to `apps/web/src/domain/internal-record-content-disposition.ts`; `route.ts` now imports it and exports only `GET`. `tests/routes/internal-record.test.ts`'s import updated to match.
- **Files modified:** `apps/web/app/api/assessments/[id]/internal-record/route.ts`, `apps/web/src/domain/internal-record-content-disposition.ts` (new), `tests/routes/internal-record.test.ts`
- **Verification:** `next build --webpack` completes cleanly end to end (compile, typecheck, static generation); the route's existing behavior and CR-01 test assertions unchanged.
- **Committed in:** `0f45b8d` (Task 1 pipeline commit)

**2. [Rule 3 - Blocking, pre-existing WINDOWS.md entry] Default `next build`/`next dev` (Turbopack) segfault on this machine**
- **Found during:** Task 1, verifying the production build
- **Issue:** Registering `@tailwindcss/postcss` — this plan's entire purpose — reproducibly crashes Turbopack's build/dev process with `STATUS_ACCESS_VIOLATION` on the first CSS compile. This is NOT a new defect: it is the exact, previously-investigated, already-recorded `WINDOWS.md` ledger entry 4 ("Registering @tailwindcss/postcss segfaults 'pnpm dev'..."), where the product owner already decided to proceed rather than block.
- **Fix:** Not fixed (matches the ledger's own prior disposition and this plan's own `T-jr4-04` threat-register "accept" disposition). Verified the pipeline itself works correctly via three independent paths instead: (a) direct `postcss`+`@tailwindcss/postcss` compile in Node/Vitest (the toolchain gate), (b) `next build --webpack`, (c) `next dev --webpack` serving real pages with the compiled CSS. `WINDOWS.md` entry 3 (the pipeline being dead) is now marked `fixed` — the underlying blocker that entry 4 sits on top of no longer exists at the pipeline level, only at the Turbopack-native-binary level, which entry 4 continues to track separately.
- **Files modified:** None (verification-only substitution); `.planning/WINDOWS.md` entry 3 marked fixed via `gsd-tools windows fixed 3`.
- **Verification:** `next build --webpack` exits 0 with a real compiled CSS bundle containing the resolved `--color-seal` token and generated `.text-seal` utility; `next dev --webpack` serves `/`, `/hr/matters/new` and `/legal/assessments/{id}` at HTTP 200 with the compiled stylesheet linked and no "Unknown at rule" warning.
- **Committed in:** N/A (verification substitution, documented here and in the ledger)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking issues that prevented completing this plan's own verification, neither caused by this plan's own styling changes)
**Impact on plan:** No scope creep. Both were necessary to prove the CSS pipeline actually works in a real Next.js build, which is this plan's core deliverable.

## Issues Encountered

- `apps/web/next-env.d.ts` (a Next.js-managed, "do not edit" file) got rewritten twice during verification (`next dev` vs `next dev --webpack` regenerate it with different `.next/types` paths). Reverted with `git checkout -- apps/web/next-env.d.ts` before each commit — not a real change, just build-tool churn from the verification runs.
- The matter created during Task 2's live verification accidentally accumulated 12 lines instead of 6 (an earlier curl attempt's output redirection silently failed, then the same 6 `add_line` calls were re-run) — harmless for a CSS-styling proof (still exercised every verdict/callout/badge treatment), but not a byte-for-byte replay of `docs/DEMO-WALKTHROUGH.md`'s reference fixture.
- Verification could not click through the capability-statement gate (client-side `localStorage`, unreachable from `curl`) to see the intake-form/result-screen content directly rendered — confirmed instead via passing component-level tests (which render each component directly, bypassing the gate) and by inspecting the real compiled CSS bundle for every named rule. Flagged as coverage `D3`'s `human_judgment: true` item above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The CSS pipeline is live for every screen in the app (not just the four priority screens), since the fix is global.
- `WINDOWS.md` open items now: entry 4 (Turbopack-native-binary segfault, machine-specific, tracked not blocking) and entry 9 (unrelated, the pre-existing SUPERSEDED re-entry gap from Phase 04).
- Deferred screens (list/confirmation screens, notice-block, info-request-panel, bulk-accept-bar and siblings, chrome status-strip/shortcut-help-overlay/autosave-indicator, the mockup's "Change" affordance, dark mode) are explicitly out of scope for this pass per the plan's own `<deferred>` section — several already carry working token utilities and will visually improve the moment a reader opens them, since the pipeline fix is global.
- **Recommended before demoing:** one real-browser click-through of `docs/DEMO-WALKTHROUGH.md` end to end, to see the full visual system rendered directly rather than inferred from compiled CSS + component tests, and to confirm no residual Times-New-Roman flash anywhere the pass didn't specifically check.

---
*Phase: 260922-jr4*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: apps/web/postcss.config.mjs
- FOUND: tests/toolchain/css-pipeline.test.ts
- FOUND: apps/web/src/domain/internal-record-content-disposition.ts
- FOUND: apps/web/app/globals.css
- FOUND: apps/web/src/ui/review/line-card.tsx
- FOUND: apps/web/src/ui/hr/result-view.tsx
- FOUND commit: 0f45b8d
- FOUND commit: 6aa2c98
- FOUND commit: eecd064
- FOUND commit: 2cecf44
