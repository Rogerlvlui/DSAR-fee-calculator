---
phase: 260920-kmd
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/src/domain/pack-display-status.ts
  - apps/web/src/domain/pack-display-status.test.ts
  - apps/web/src/domain/recompute-banner.ts
  - apps/web/src/domain/recompute-banner.test.ts
  - apps/web/src/ui/intake/matter-details-fields.tsx
  - apps/web/src/ui/intake/matter-details-fields.test.tsx
  - apps/web/src/ui/intake/intake-form.tsx
  - apps/web/src/ui/review/recompute-confirm.tsx
  - apps/web/src/ui/review/recompute-confirm.test.tsx
  - apps/web/app/hr/matters/[id]/page.tsx
  - apps/web/app/hr/matters/[id]/submitted/page.tsx
  - apps/web/app/legal/assessments/[id]/page.tsx
  - tests/boundary/server-client-boundary.test.ts
autonomous: true
requirements: [BUGFIX-RSC-BOUNDARY]

estimate:
  tokens: 46000
  raw_tokens: 23000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "/hr/matters/{id}/submitted renders without the 'Attempted to call humanizePackDisplayStatus() from the server' error"
    - "/legal/assessments/{id} renders without the same class of error for its own gating call"
    - "All five display-status output strings are byte-identical to today's"
    - "Both recompute-gate directions still behave as before (mismatch true, identical false)"
    - "Every existing import site still compiles and its existing tests still pass"
    - "A regression gate fails when any Server Component under apps/web/app imports a non-component value from a \"use client\" module"
  artifacts:
    - apps/web/src/domain/pack-display-status.ts
    - apps/web/src/domain/pack-display-status.test.ts
    - apps/web/src/domain/recompute-banner.ts
    - apps/web/src/domain/recompute-banner.test.ts
    - tests/boundary/server-client-boundary.test.ts
  key_links:
    - "apps/web/app/hr/matters/[id]/submitted/page.tsx imports humanizePackDisplayStatus from apps/web/src/domain/, not from a \"use client\" module"
    - "apps/web/app/hr/matters/[id]/page.tsx imports it from the same domain module"
    - "apps/web/app/legal/assessments/[id]/page.tsx imports shouldRenderRecomputeBanner from apps/web/src/domain/"
    - "apps/web/src/ui/intake/matter-details-fields.tsx re-types MatterDetailsJurisdictionPack.displayStatus from the relocated type, so the interface stays in one place"
---

<objective>
Fix the live server/client boundary crash on `/hr/matters/[id]/submitted` by relocating the pure
display-label helper `humanizePackDisplayStatus` out of a `"use client"` module into a plain shared
module under `apps/web/src/domain/`, mirroring the existing `hr-matter-status-label.ts` precedent.

**Second violation found during planning (not in the bug report, same bug class, currently live):**
`apps/web/app/legal/assessments/[id]/page.tsx:73` calls `shouldRenderRecomputeBanner(...)`
unconditionally, imported from `apps/web/src/ui/review/recompute-confirm.tsx` — which carries
`"use client"` at line 23. That is the identical defect on the legal review screen and would throw
the identical error the first time that page is opened. Task 2 fixes it the same way; leaving it
would mean shipping a known crash on the phase's own main screen.

Purpose: a Server Component may render a client component, but it may never *call* a function that
lives on the client side of the boundary. Both functions are pure string/boolean mappers with no
hooks, no DOM, no browser API — they only ended up on the client side because their file also hosts
real client components.

Output: two new pure modules under `apps/web/src/domain/` with their tests moved alongside, every
import site updated, and one regression gate that catches this whole bug class at the source level
(the class has now produced two live crashes from one careless export location).

Non-goals: no change to any output string, no change to either function's logic, no rename of any
exported identifier, no change to `packages/*` (engine, schemas, money path all untouched), and no
change to the `MatterDetailsJurisdictionPack` interface's own home.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@.claude/CLAUDE.md

Read-first sources (all small, read once, extract everything in one pass):
@apps/web/src/domain/hr-matter-status-label.ts
@apps/web/src/ui/intake/matter-details-fields.tsx
@apps/web/src/ui/review/recompute-confirm.tsx
@apps/web/app/hr/matters/[id]/submitted/page.tsx
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Relocate humanizePackDisplayStatus to apps/web/src/domain/pack-display-status.ts and repoint all five import sites</name>
  <files>
    apps/web/src/domain/pack-display-status.ts (new),
    apps/web/src/domain/pack-display-status.test.ts (new),
    apps/web/src/ui/intake/matter-details-fields.tsx,
    apps/web/src/ui/intake/matter-details-fields.test.tsx,
    apps/web/src/ui/intake/intake-form.tsx,
    apps/web/app/hr/matters/[id]/page.tsx,
    apps/web/app/hr/matters/[id]/submitted/page.tsx
  </files>
  <read_first>
    apps/web/src/domain/hr-matter-status-label.ts (shape and header-comment convention to mirror),
    apps/web/src/ui/intake/matter-details-fields.tsx lines 24-39 and 85-111 (the type, the interface that uses it, the function and its existing explanatory comment),
    apps/web/src/ui/intake/matter-details-fields.test.tsx lines 1-16 and 128-157 (the import clause and the three tests that move)
  </read_first>
  <behavior>
    Preserved exactly, no new expectations:
    - ACTIVE returns "Active"
    - ACTIVE_REVIEW_DUE_SOON returns "Active — review due soon"
    - STALE returns "Stale"
    - DRAFT returns "Draft"
    - NO_USABLE_PACK returns the em-dash placeholder already used at every call site
    - no returned label contains an underscore, for all five values
  </behavior>
  <action>
Create `apps/web/src/domain/pack-display-status.ts` — a plain module with NO `"use client"` directive
and no imports from `apps/web/src/server` or `apps/web/src/ui`. Move into it, verbatim: the exported
type `MatterDetailsJurisdictionPackDisplayStatus` (the five-member union) and the exported function
`humanizePackDisplayStatus`, including its existing explanatory comment, unchanged. Keep both
exported names exactly as they are — renaming adds churn and breaks grep continuity with the
05-REVIEW-ADDENDUM record that introduced them; note in the new file's header comment that the type
name still reads correctly because the value it describes is `MatterDetailsJurisdictionPack.displayStatus`.
Follow `hr-matter-status-label.ts`'s shape: file-path first line, a short comment saying why this
module exists (it is called from Server Components, so it must not sit on the client side of the
React Server Components boundary), then the code. Keep the exhaustive `switch` with no `default`
branch so TypeScript still refuses to compile if the union grows.

In `matter-details-fields.tsx`: delete the moved type and the moved function, and add
`import type { MatterDetailsJurisdictionPackDisplayStatus } from "../../domain/pack-display-status.ts";`
so the `MatterDetailsJurisdictionPack` interface (which stays in this file, per its own header note
about dependency-cruiser specifier matching) keeps its `displayStatus` field typed. Do NOT leave a
re-export shim behind — this project's recorded precedent is to delete the stand-in and update
callers (Phase 04 P04's `state.ts`, Phase 05's `pack-view.ts`). `jurisdictionStatusLabel` and
`canOfferExpenseEntry` stay exactly where they are.

Repoint the four remaining import sites to `apps/web/src/domain/pack-display-status.ts`:
- `apps/web/app/hr/matters/[id]/submitted/page.tsx` line 21 → `"../../../../../src/domain/pack-display-status.ts"` (the reported crash)
- `apps/web/app/hr/matters/[id]/page.tsx` line 20 → `"../../../../src/domain/pack-display-status.ts"` (same depth as its existing `notice-draft.ts` import on line 23 — copy that path prefix)
- `apps/web/src/ui/intake/intake-form.tsx` — drop `humanizePackDisplayStatus` from the `./matter-details-fields.tsx` clause on lines 21-26 and add a separate import from `"../../domain/pack-display-status.ts"`; this file is a client component and works either way, but it must not keep importing a name that no longer lives there
- `apps/web/src/ui/intake/matter-details-fields.test.tsx` — drop `humanizePackDisplayStatus` and `type MatterDetailsJurisdictionPackDisplayStatus` from its `./matter-details-fields.tsx` clause

Move the three existing tests (the parametrized no-underscore check, the NO_USABLE_PACK assertion and
the ACTIVE_REVIEW_DUE_SOON assertion — currently the last `describe` block of
`matter-details-fields.test.tsx`) into a new `apps/web/src/domain/pack-display-status.test.ts`,
retagged `PACK-DISPLAY-STATUS:` on both the `describe` and every `it` name, following
`hr-matter-status-label.test.ts`'s tagging convention. Carry the explanatory comment above that
`describe` block across with them. Delete that block and its now-unused imports from
`matter-details-fields.test.tsx`; everything else in that file stays.

No tsconfig change is needed: `tests/tsconfig.json` already includes `../apps/web/src/domain/**/*.ts`
(line 48) and the new domain test runs under `vitest.config.ts`'s existing `web` project, whose
include glob already admits `apps/web/**/*.test.ts`.
  </action>
  <verify>
    <automated>pnpm vitest run --project web -t "PACK-DISPLAY-STATUS"</automated>
    <automated>pnpm vitest run --project web -t "MATTER-DETAILS"</automated>
    <automated>pnpm vitest run --project web -t "INTAKE-FORM"</automated>
    <automated>pnpm typecheck</automated>
  </verify>
  <reversibility rating="reversible">Pure relocation of two exported names with no logic change — a single git revert restores the prior state.</reversibility>
  <done>
`apps/web/src/domain/pack-display-status.ts` exists, contains no `"use client"` directive, and is the
only definition of `humanizePackDisplayStatus` in the repository. No file under `apps/web/app/`
imports that name from `apps/web/src/ui/intake/matter-details-fields.tsx` any more. The five returned
strings are unchanged. `pnpm typecheck` is clean and the three named vitest filters are green.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Relocate shouldRenderRecomputeBanner to apps/web/src/domain/recompute-banner.ts (same defect, legal review screen)</name>
  <files>
    apps/web/src/domain/recompute-banner.ts (new),
    apps/web/src/domain/recompute-banner.test.ts (new),
    apps/web/src/ui/review/recompute-confirm.tsx,
    apps/web/src/ui/review/recompute-confirm.test.tsx,
    apps/web/app/legal/assessments/[id]/page.tsx
  </files>
  <read_first>
    apps/web/src/ui/review/recompute-confirm.tsx lines 1-43 (header note, the directive, the function),
    apps/web/src/ui/review/recompute-confirm.test.tsx lines 1-12 and 69-78 (import clause and the two gating tests that move),
    apps/web/app/legal/assessments/[id]/page.tsx lines 30-40 and 64-75 (import clause and the unconditional call site)
  </read_first>
  <behavior>
    Preserved exactly, both directions, no new expectations:
    - shouldRenderRecomputeBanner("2026.09.1", "2026.10.1") is true
    - shouldRenderRecomputeBanner("2026.09.1", "2026.09.1") is false
  </behavior>
  <action>
Create `apps/web/src/domain/recompute-banner.ts` — plain module, no `"use client"`, no imports at all.
Move `shouldRenderRecomputeBanner` into it verbatim along with its existing doc comment, and add a
header comment recording why it lives here: its only production caller is
`apps/web/app/legal/assessments/[id]/page.tsx`, a Server Component, so it cannot live in a module
that carries the client directive. `recompute-confirm.tsx` never calls this function itself (its own
header says so), so removing the export from that file changes nothing about the component.

In `recompute-confirm.tsx`: delete the function, and update the header comment's parenthetical so it
names the function's new home rather than implying it is exported from this file. `RecomputeConfirm`
and `RecomputeConfirmView` and everything else in that file are untouched.

Repoint `apps/web/app/legal/assessments/[id]/page.tsx` line 37: keep
`import { RecomputeConfirm } from "../../../../src/ui/review/recompute-confirm.tsx";` (a component —
legitimately rendered across the boundary) and add
`import { shouldRenderRecomputeBanner } from "../../../../src/domain/recompute-banner.ts";`. The call
on line 73 and the comment block above it stay as they are.

Move the two gating tests (the `RECOMPUTE-CONFIRM: shouldRenderRecomputeBanner (gating, both
directions)` describe block, currently the last block of `recompute-confirm.test.tsx`) into
`apps/web/src/domain/recompute-banner.test.ts`, retagged `RECOMPUTE-BANNER:` on the describe and both
`it` names, and drop the name from that file's import clause. The `RecomputeConfirmView` render tests
stay in `recompute-confirm.test.tsx` and keep their `RECOMPUTE-CONFIRM` tag.
  </action>
  <verify>
    <automated>pnpm vitest run --project web -t "RECOMPUTE-BANNER"</automated>
    <automated>pnpm vitest run --project web -t "RECOMPUTE-CONFIRM"</automated>
    <automated>pnpm typecheck</automated>
  </verify>
  <done>
`apps/web/src/domain/recompute-banner.ts` exists with no client directive and is the only definition of
`shouldRenderRecomputeBanner`. The legal assessment page imports it from there while still importing
`RecomputeConfirm` from the client module. Both gating directions still assert true/false as before.
`pnpm typecheck` clean, both named filters green.
  </done>
</task>

<task type="auto">
  <name>Task 3: Regression gate — no Server Component under apps/web/app imports a non-component value from a "use client" module</name>
  <files>tests/boundary/server-client-boundary.test.ts (new)</files>
  <read_first>
    tests/boundary/dom-denylist.test.ts (this project's existing convention for walking apps/web/app and for the boundary project's node environment),
    vitest.config.ts lines 67-87 (the boundary project's include glob)
  </read_first>
  <action>
Write a source-scanning gate, tagged `SERVER-CLIENT-BOUNDARY:` on the describe and every `it` name so
`-t` filtering works. It runs under the existing `boundary` vitest project (node environment,
`tests/boundary/**/*.test.ts`) and needs no `vitest.config.ts` or `tests/tsconfig.json` change —
`tests/tsconfig.json`'s include already covers `**/*.ts` under `tests/`.

Export a pure function from the test file, e.g. `findBoundaryViolations(appDir: string): string[]`, so
the detector itself is testable rather than only being exercised against real source:

1. Walk `appDir` recursively with `node:fs` `readdirSync({ withFileTypes: true })`, collecting
   `.ts`/`.tsx` files.
2. Treat a file as server-side when its source has no client directive before its first `import`
   statement (compute the index of the first `import` occurrence; look for the directive only in the
   text before it — this avoids matching the string inside a comment further down the file).
3. For each server-side file, match static import statements with a regex over the source, capturing
   the clause and the module specifier. Skip non-relative specifiers (packages and `next/*` are not
   in scope for this gate) and side-effect-only imports with no clause.
4. Resolve each relative specifier against the importing file's directory; skip it when the resolved
   path does not exist on disk. Read the target and decide whether IT carries the client directive,
   using the same rule as step 2.
5. When the target is a client module, inspect each named binding in the clause. A binding is allowed
   when the whole clause is a type-only import, when that individual specifier carries the per-item
   `type` keyword, or when the binding's local name begins with an uppercase letter (a React
   component — the one thing a Server Component may legitimately pass across the boundary). Anything
   else is a violation: push a message naming the importing file, the binding and the target module.

Two assertions:
- Real-source assertion: `findBoundaryViolations` over `apps/web/app` returns an empty array. Assert
  on the array itself (not its length) so a failure message prints which binding in which file.
- Positive control, proving the detector detects: create a throwaway directory with `mkdtempSync` in
  `node:os`'s tmpdir containing two files — a fake client module exporting a lowercase-named helper
  and a fake server page importing that helper by a relative specifier — run the same function over
  it, and assert it returns exactly one violation naming that helper. Clean the directory up
  afterwards. Without this control the gate would pass just as happily if the walker silently found
  no files at all.

Add a header comment recording what this gate exists for: one pure helper exported from a client
module produced two live crashes on two different screens on the same day (the HR submitted screen,
reported; the legal review screen, found while planning the fix), and neither `pnpm typecheck` nor any
existing test could see it, because the boundary is enforced by the Next.js compiler at runtime and
not by the type system.
  </action>
  <verify>
    <automated>pnpm vitest run --project boundary -t "SERVER-CLIENT-BOUNDARY"</automated>
  </verify>
  <done>
`tests/boundary/server-client-boundary.test.ts` exists and is green: zero violations across
`apps/web/app`, and exactly one violation detected in its own synthetic fixture. Re-introducing either
Task 1's or Task 2's original import would turn this gate red.
  </done>
</task>

</tasks>

<source_coverage_audit>

| # | Source | Item | Status | Where covered |
|---|--------|------|--------|----------------|
| 1 | BUG | `/hr/matters/[id]/submitted` crash on `humanizePackDisplayStatus` | COVERED | Task 1 |
| 2 | BUG | `app/hr/matters/[id]/page.tsx` call site (also a Server Component — confirmed by direct read: `async` default export, no client directive) | COVERED | Task 1 |
| 3 | BUG | `matter-details-fields.tsx` itself must still import it correctly | COVERED | Task 1 |
| 4 | BUG | `matter-details-fields.test.tsx` import path updated | COVERED | Task 1 (tests move to the new module's own test file) |
| 5 | CONSTRAINT | Plain module, no `"use client"`, mirroring `apps/web/src/domain/hr-matter-status-label.ts` | COVERED | Task 1 |
| 6 | CONSTRAINT | Relocate the exported type too | COVERED | Task 1 (moved with the function; `matter-details-fields.tsx` imports it back as a type) |
| 7 | CONSTRAINT | No behavior or output-string change | COVERED | Tasks 1-2 `<behavior>` blocks; the moved tests assert the literal strings |
| 8 | CONSTRAINT | Verify by re-running touched tests plus typecheck/lint | COVERED | Per-task `<verify>` + `<verification>` |
| 9 | CONSTRAINT | apps/web only, no engine/schemas/money-path change | COVERED | `files_modified` touches only `apps/web/**` and `tests/boundary/` |
| 10 | CONSTRAINT | 1-3 focused tasks | COVERED | 3 tasks |
| 11 | PLANNING FIND | Fifth import site `apps/web/src/ui/intake/intake-form.tsx:24`, not named in the bug report | COVERED | Task 1 |
| 12 | PLANNING FIND | Identical live defect: `shouldRenderRecomputeBanner` called from the legal Server Component | COVERED | Task 2 |
| 13 | PLANNING FIND | Nothing in the toolchain can currently see this bug class | COVERED | Task 3 |

No item is MISSING. Nothing is deferred.

</source_coverage_audit>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| server → client (RSC) | Module graph split. Anything reachable from a `"use client"` module is shipped to the browser; anything a Server Component calls must execute on the server. This plan moves code across it. |
| HR ↔ Legal role split | Unchanged by this plan, but both touched pages sit behind it. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-kmd-01 | Information disclosure | New `apps/web/src/domain/*` modules become importable by client code | low | accept | Both relocated units are pure mappers over an enum and two version strings — no secrets, no queries, no actor data. Nothing server-only moves. Both were already client-reachable before this change. |
| T-kmd-02 | Tampering | Accidental drift in the five HR-facing labels while moving them | medium | mitigate | The three existing assertions move with the function and are re-run; two of them pin exact literals. |
| T-kmd-03 | Denial of service | The unfixed boundary error renders two screens permanently unusable | high | mitigate | Tasks 1-2 remove both call sites from the boundary; Task 3 prevents the class recurring. |
| T-kmd-04 | Elevation of privilege | A page edit silently drops its `getCurrentActor()` / `requireRole()`-gated read (this project's thrice-repeated bug class: 3.1 UNREG-1, 04 WR-02, 05 CR-01) | high | mitigate | Named acceptance criterion in `<success_criteria>`: all three touched `page.tsx` files keep their existing actor resolution and gated data call, line for line. Only import lines change in those files. |

No package-manager installs occur in this plan, so no supply-chain legitimacy gate applies.
</threat_model>

<verification>
Run from the worktree root after all three tasks:

```
pnpm typecheck
pnpm lint
pnpm depcruise
pnpm vitest run
```

All four must be clean. `pnpm depcruise` matters here specifically: the new modules live under
`apps/web/src/domain/`, which is neither a `src/server` nor a `src/ui` prefix, so no existing
`no-server-imports-in-ui` rule applies — confirm that stays true rather than assuming it.

Optional live re-confirmation (not required — the crash was already reproduced in the browser by the
reporting session, and the executor's contract is to re-run the touched tests): `pnpm dev`, submit an
intake form, land on `/hr/matters/{id}/submitted`, then open `/legal/assessments/{id}`. Neither should
raise a server/client boundary error.
</verification>

<success_criteria>
- [ ] `humanizePackDisplayStatus` and `MatterDetailsJurisdictionPackDisplayStatus` are defined once, in `apps/web/src/domain/pack-display-status.ts`, a file with no client directive
- [ ] `shouldRenderRecomputeBanner` is defined once, in `apps/web/src/domain/recompute-banner.ts`, a file with no client directive
- [ ] All six import sites (two HR pages, the legal page, `matter-details-fields.tsx`, `intake-form.tsx`, `recompute-confirm.test.tsx`) resolve to the new modules
- [ ] No re-export shim is left behind in either client module
- [ ] All five display-status strings and both recompute-gate directions are unchanged, asserted by the relocated tests
- [ ] `apps/web/app/hr/matters/[id]/page.tsx`, `apps/web/app/hr/matters/[id]/submitted/page.tsx` and `apps/web/app/legal/assessments/[id]/page.tsx` each still call `getCurrentActor()` and their existing `requireRole()`-gated read, unchanged — only their import lines differ from HEAD
- [ ] `tests/boundary/server-client-boundary.test.ts` is green on both its real-source assertion and its synthetic positive control
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm depcruise` and `pnpm vitest run` all clean
</success_criteria>

<output>
Create `.planning/quick/260920-kmd-fix-server-client-boundary-violation-hum/260920-kmd-SUMMARY.md` when done.
Record in it: the second violation found during planning (the legal review screen), and whether the
Task 3 gate found anything beyond the two known cases.
</output>
