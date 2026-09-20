# Phase 6: Convergence and Legal Review - Research

**Researched:** 2026-09-20
**Domain:** Next.js 16 App Router legal-review UI over a deterministic engine; real (partially-authored) rule packs; role-scoped access control; keyboard-first review UX
**Confidence:** HIGH on what-exists-vs-what's-missing (verified by direct file reads and one executed Node probe against the real pack JSON); MEDIUM on the specific implementation shape for the two structural gaps (route prefixing, pack-status coercion generalization), which are technical-approach decisions this document recommends but the planner should confirm; LOW on nothing load-bearing — no external package research was needed, this phase is 100% internal wiring.

> No `CONTEXT.md` exists yet for this phase (checked: `.planning/phases/06-convergence-and-legal-review/` did not exist before this research ran). No user constraints to copy verbatim. The `<user_constraints>` block is therefore omitted per the "if CONTEXT.md exists" condition in this agent's contract.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENGINE-14 | Golden-file fixtures for SG/HK packs reproduce exact verdicts/amounts/flags/totals; changing a pack breaks its golden files (AC-09) | **Re-scoped per product-owner decision, confirmed sound below.** Golden files must assert against the pack's real, currently-authored content (verified by direct read of both pack JSON files this session), engine-invoked through a generalized version of the existing `coercePackForDemoEngine` mechanism — there is no other way to run `assess()` against either pack, because both are permanently `DRAFT` until PACK-09 is finished |
| REVIEW-01 | Rule ID, basis, citation shown without interaction (AC-21) | Already fully built — `LineCard` renders `appliedRuleId`, `basis`, `citation` unconditionally, no `<details>`. Reusable as-is |
| REVIEW-02 | FLAG lines show reasons in words | Already built — `LineCard`'s "Why this needs you" block |
| REVIEW-03 | `NEEDS_VERIFICATION` distinct treatment; `restingOnUnverifiedRules` indented under `draftBaseline` (AC-22) | Already built — `TotalsRail`'s `data-indent="true"` row and `LineCard`'s `unverified-marker` span. Verify the visual (not just DOM) treatment reads as distinct — currently text-only, no colour/icon differentiation confirmed |
| REVIEW-04 | Accept/Reduce/Strike/Allow; never raise HR's claim | Already built — `dispositionLine()` hard-caps `REDUCE`/`ALLOW_*` at `expenseLine.claimedAmount` and (for `REDUCE`) at `line.engineAmount` |
| REVIEW-05 | Mandatory ≥10-char reason, stop-list shared client/server (AC-23) | **Half built, half missing.** Length check exists (`hasSufficientReason`, `MIN_REASON_NON_WHITESPACE_CHARS`); the stop-list half is explicitly flagged `NOT YET BUILT` in `disposition-actions.ts`'s own comment. PRD gives the literal list (verified below) |
| REVIEW-06 | No headline total while any line PENDING, server-enforced (AC-25) | UI half done (`TotalsRail`). Server-enforcement half is *implicit* today (there's no GET route that returns a rendered total at all — the page computes server-side and the client never fetches an early total) but has no explicit test proving it; needs a positive test, not new production code |
| REVIEW-07 | Bulk-accept only for `ALLOW`+`VERIFIED`; API rejects batches with FLAG/ALLOW_CAPPED/NEEDS_VERIFICATION (AC-26) | **Already built and already correct** — `listBulkAcceptableLineIds` filters on `verdict === "ALLOW"` AND `verificationStatus === "VERIFIED"` AND `PENDING`; `bulkAcceptLines` validates every submitted id against that same eligible set, all-or-nothing. Needs wiring to the real per-jurisdiction pack (today hardcoded to the SG demo pack) and a positive-path test fixture, since neither real pack has more than one `VERIFIED` rule (HK has exactly one; SG has zero) |
| REVIEW-08 | Keyboard-first: j/k/a/r/s/? | **Net-new.** No keyboard handling of any kind exists in the codebase (`grep` for `keydown`/`keyboard`/`shortcut` found zero implementation, only two unrelated comment hits) |
| REVIEW-09 | Raise query -> `INFO_REQUEST` | Already built — `askHr()` + `/api/matters/[id]/info-request` + `DispositionControlsView`'s "Ask HR" button, already wired on the review page |
| REVIEW-10 | Recompute against newer pack after explicit confirm-discard | **Half built.** `recomputeAgainstCurrentPack()` (data layer) + `/api/assessments/[id]/recompute` (route) exist and are tested — but the code's own comment says "No screen drives this yet (Phase 6 owns the legal review screen's recompute affordance)". Confirmation-of-discard UI is entirely net-new |
| REVIEW-11 | Flat-fee vs itemised choice where pack carries one (blocked if flat > itemised) | Engine half fully built (`computeFlatFeeComparison`, `Totals.flatFeeComparison`) and already returns `flatFeeAmount`/`flatFeeExceedsItemisedCost`. UI half is 100% net-new — zero references to `flatFee` anywhere in `apps/web` |
| REVIEW-12 | Category shown alongside HR's description on every card, including supported lines | Already built — `LineCard`'s `card-title`/`categoryLabel`, unconditional |
| NAV-01 | `/legal/queue` lists LEGAL_REVIEW + INFO_REQUEST matters, sortable | **Route does not exist.** Only `/assessments` exists today (see routing gap below), and it lists only `LEGAL_REVIEW`-eligible matters with no sort, no `INFO_REQUEST` inclusion confirmed, no advisory-deadline/age sort |
| NAV-03 | Queue/list keyboard navigable, "extending the existing shortcut help overlay" | **The premise is false — no shortcut help overlay exists anywhere in the codebase.** This must be built from scratch alongside REVIEW-08, not "extended" |
| ACCESS-02 | HR_PREPARER requesting LEGAL_REVIEW assessment -> 403, no data in body (AC-01) | Underlying mechanism exists (`requireRole` throws `ForbiddenError`, `errorToResponse` returns `{error: message}` only) but **there is no `GET /api/assessments/{id}` route at all today** — the assessment is fetched only inside the server-component page via `getAssessmentForLegalReview`. AC-01's literal route target doesn't exist; needs either the route or an equivalent test surface decision (see Open Questions) |
| ACCESS-03 | No API response to HR_PREPARER leaks verdict/engineAmount/basis/draftBaseline/lawyerReason for a non-SIGNED_OFF matter | No known current violation (grep found no HR-facing code path importing `Assessment`'s privileged fields), but **no test proves this as its own assertion** — this is new test-writing work over existing code, not new production code, except where the missing `GET` route above is built |
| ACCESS-07 | No leak via server-component payload or cached response, tested as its own channel | Same as above — this is specifically the Next.js RSC-payload class of leak (a Client Component receiving the full `Assessment` object as a prop serialises the whole thing into the page's flight payload even if unrendered). Current legal-review page passes only narrow scalar props into `DispositionControls`/`BulkAcceptBar`/`SignOffPanel` (verified by direct read) — but this is an implicit property of today's code, not a proven, tested one, and the pattern must be *actively preserved*, not assumed, as Phase 6 adds more client components |
| DISC-04 | Verdict badge accessible name includes verdict in words, not colour-only (AC-32b) | **Likely present visually but not proven accessible.** `VERDICT_LABELS[line.verdict]` is placed as the text content of a plain `<span>` (default ARIA role `generic`). The `generic` role does not support "name from content" in the accessible-name computation algorithm, so a `toHaveAccessibleName()`-style assertion may return an empty string even though the text is visibly present. This is a concrete, specific risk worth flagging in Pitfalls |

</phase_requirements>

## Summary

Phase 6 is overwhelmingly a **wiring and completion** phase, not a from-scratch build. Phases 3.1 and 4 already delivered a materially complete legal-review UI (`assessment-view.tsx`, `line-card.tsx`, `disposition-controls.tsx`, `bulk-accept-bar.tsx`, `signoff-panel.tsx`, `totals-rail.tsx`) plus the full guarded state machine and audit backbone this screen drives through. Direct inspection of every file in `apps/web/src/ui/review/`, `apps/web/src/server/`, `packages/engine/`, and `packages/workflow/` confirms that 8 of the 12 REVIEW-\* requirements are either fully or half discharged already, and REVIEW-07's bulk-accept eligibility logic (AC-26's exact rule — `ALLOW` verdict, `VERIFIED` rule, `PENDING` disposition, all-or-nothing batch) is already correct without modification.

The real work in this phase clusters into four areas: (1) **generalizing `engine-invocation.ts`'s demo-pack coercion mechanism** away from its current SG-only hardcoding so it resolves whichever jurisdiction's real pack a matter actually needs, and reusing that same mechanism for the ENGINE-14 golden-file tests, because — this is the single most important finding of this research — **neither the real HK nor the real SG committed pack can ever legitimately reach `ACTIVE` status without full 21-category authoring (`assertActiveReady` in `packages/rulepacks/src/validate.ts` requires non-null `authoredBy`/`reviewedBy`/`reviewedOn` and zero `UNAUTHORED_TOKEN` markers, and both packs fail every one of those checks today, verified by direct read)**. The PACK-09 deferral framing given in this phase's brief is therefore not just reasonable, it is the *only* framing under which Phase 6 can proceed at all — golden files, review screen, everything downstream must exercise the pack through the same non-`ACTIVE`-status-override path the demo already uses, because a legitimately-`ACTIVE` real pack literally does not and cannot exist yet; (2) **building the keyboard-first review UX and its help overlay from scratch** (REVIEW-08, NAV-03) — no keyboard handling of any kind exists in this codebase today, so "extending the existing shortcut help overlay" in NAV-03's own wording is inoperative and must be read as "build one"; (3) **building the `/legal/queue` route and confronting a real routing-architecture gap** — the app today has no `/legal/*` or `/hr/*` URL prefix at all (Next.js route groups `(hr)`/`(legal)` organize files but do not add URL segments; the live paths are `/matters` and `/assessments`, not the PRD's literal `/hr/matters/{id}` and `/legal/assessments/{id}`), a gap nominally owned by Phase 3.2's still-incomplete ACCESS-01 and now unavoidable because NAV-01 names `/legal/queue` literally; and (4) **closing the four access-control/accessibility leak-and-badge gaps** (REVIEW-05's stop-list, ACCESS-02/03/07's leak-channel tests, DISC-04's accessible name), each small in code size but each a defensibility-critical guarantee this product's whole premise rests on.

**Primary recommendation:** Treat this phase as "finish and hard-verify what exists, then add the four genuinely new surfaces (golden files against real packs, keyboard nav + help overlay, `/legal/queue`, flat-fee choice UI)" rather than a review-screen build from zero. Generalize `engine-invocation.ts` before writing golden files, decide the route-prefix question explicitly in planning (recommended: extend the `/legal/` and `/hr/` prefixes now, since NAV-01 forces the question anyway and a half-prefixed app is worse than a fully unprefixed or fully prefixed one), and write the stop-list constant in `packages/schemas/src/constants.ts` following the exact precedent of `LEGAL_CONCLUSION_BANNED_WORDS`/`PERSONAL_DATA_DENY_LIST` already in that file.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pack resolution per matter's jurisdiction (generalizing `DEMO_PACK_ID`) | API/Backend (`apps/web/src/server`) | Rule-pack package (`@dsar/rulepacks/loader`) | Loader is pure I/O-at-the-edge; the app-side wrapper (`engine-invocation.ts`) decides *which* pack to load and how to coerce it for the engine boundary — that policy belongs at the app's server layer, not inside the shared package |
| Golden-file assertions against real pack content | Engine package (`packages/engine`) | — | `assess()` is pure; golden tests belong beside the engine's existing `reference-fixture.golden.test.ts`, not in `apps/web` |
| Line-by-line disposition UI (cards, controls, badges) | Browser/Client (interactive controls) + Frontend Server (SSR page assembling props) | — | Already correctly split: server component fetches/authorizes/assembles, client components (`"use client"`) own only the interactive state (reason text, in-flight flag) |
| Reason stop-list + length validation | API/Backend (`apps/web/src/server/data/assessments.ts`) | Browser/Client (`disposition-actions.ts`, shared) | AC-23 requires the SAME check on both sides from ONE exported constant — this is a shared-domain-module pattern, not a tier split |
| Keyboard shortcut handling (`j`/`k`/`a`/`r`/`s`/`?`) | Browser/Client | — | Pure DOM keydown handling scoped to the review screen; no server involvement |
| `/legal/queue` listing + sort | Frontend Server (SSR page) | API/Backend (data-layer query) | Matches the existing `listReviewableMatters`/`(legal)/assessments/page.tsx` pattern — a server component reading through a role-checked DAL function |
| Access-control leak-channel guarantees (ACCESS-02/03/07) | API/Backend (route handlers, DAL) | Frontend Server (props narrowing into Client Components) | The DAL's `requireRole` calls are the enforcement point; the RSC-payload leak channel is a Frontend Server concern (what a server component chooses to pass into a `"use client"` boundary) |
| Verdict badge accessible name (DISC-04) | Browser/Client (rendered markup) | — | Pure markup/ARIA concern inside `LineCard` |
| Flat-fee choice (REVIEW-11) | Browser/Client (choice control) | API/Backend (must record the lawyer's choice on disposition/sign-off) | Engine already computed `flatFeeComparison`; the *choice* the lawyer makes needs a place to be recorded, which touches the API tier, not just rendering |

## Standard Stack

No new external packages are required for this phase. Every capability above is built on infrastructure already present: React 19 / Next.js 16 App Router (`"use client"` boundaries already established), zod (for the new stop-list constant's shape, if any), and the project's existing Vitest + Testing Library setup. `packages.json`'s pinned toolchain (`pnpm@11.27.0`, confirmed via `package.json`'s `packageManager` field) is unaffected.

**Version verification:** N/A — no new dependency is being added. `node -v` on this machine returned `v24.19.0` `[VERIFIED: local shell]`.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled `useKeyboardShortcuts` hook (single review screen, ~6 key bindings) | A library such as `react-hotkeys-hook` | Rejected — six key bindings scoped to one screen is well inside "don't hand-roll" territory being reversed: a library adds a dependency, a new API surface, and SSR/hydration edge cases for a problem this small. `[ASSUMED]` — not verified against the package registry since it is being rejected, not adopted |
| Rewriting `engine-invocation.ts`'s coercion mechanism entirely | Introducing a "pack review lifecycle simulator" that fabricates full 21-category content | Rejected — fabricating category content to make a pack legitimately `ACTIVE` would violate the product owner's explicit 2026-09-18 decision (recorded in `engine-invocation.ts`'s own module comment) not to edit the committed pack files to force a number; the coercion-at-the-engine-boundary approach is the sanctioned pattern and should be generalized, not replaced |

## Package Legitimacy Audit

Not applicable — no external packages are proposed for installation in this phase.

## Architecture Patterns

### System Architecture Diagram

```
 Lawyer's browser
      │
      │ GET /legal/queue  (NET-NEW route)
      ▼
 (legal) queue page  [Frontend Server]
      │ listReviewableMatters()+sort  →  data-layer DAL (role-checked)
      ▼
 Lawyer clicks a matter
      │ GET /legal/assessments/{id}  (route-prefix decision needed — see Open Questions)
      ▼
 LegalAssessmentPage  [Frontend Server, async server component]
      │
      ├─ getCurrentActor() → resolveActorFromCookieHeader()  [stubbed identity]
      ├─ getAssessmentForLegalReview(actor, id)  → requireRole(LEGAL_REVIEWER) [ACCESS-02 enforcement point]
      ├─ resolveJurisdictionOrDemoPack(matter.jurisdictionCode)  (GENERALIZED from loadDemoPack — net-new)
      ├─ buildReviewView(assessment, matter, lines)  → per-line provenance
      └─ renders:
            AssessmentView [Server Component]
              ├─ MatterRail / PackRail            (read-only context, already built)
              ├─ LineCard × N (sorted FLAG→CAPPED→DISALLOW→ALLOW)
              │     └─ DispositionControls [Client] ← receives ONLY {lineId, verdict, currency, matterId}
              │           keyboard nav (j/k/a/r/s/?)   NET-NEW, scoped to this list
              │           reason textarea → length + STOP-LIST check (client, mirrors server)
              │           POST /api/assessment-lines/{id}/disposition
              │                 → dispositionLine()  [server]: requireRole, isActionPermitted,
              │                   assertSufficientReason (LENGTH + NET-NEW STOP-LIST CHECK),
              │                   cap at claimedAmount/engineAmount, recordAuditEvent
              ├─ BulkAcceptBar [Client] ← eligibleLineIds from listBulkAcceptableLineIds()
              │           POST /api/assessments/{id}/bulk-accept → bulkAcceptLines() [already AC-26-correct]
              ├─ FlatFeeChoice [Client]  NET-NEW — only rendered if assessment.totals.flatFeeComparison present
              │           records lawyer's itemised-vs-flat choice
              ├─ TotalsRail [Server Component] — headline suppressed while any PENDING (already built)
              └─ SignOffPanel [Client] — rendered only once pendingCount === 0 (already built, Phase 7 wires the gate itself)

 Recompute affordance (NET-NEW UI; data layer + route already exist)
      │ lawyer clicks "Recompute against current pack"
      ▼
 Confirm-discard dialog (NET-NEW) → POST /api/assessments/{id}/recompute
      → recomputeAgainstCurrentPack() [already tested] → mutates same Assessment id, clears dispositions
```

### Recommended Project Structure

No new top-level directories. Additions land inside the existing structure:

```
apps/web/
├── app/
│   ├── (legal)/
│   │   ├── legal/queue/page.tsx          # NET-NEW — NAV-01
│   │   └── assessments/[id]/page.tsx     # existing — extend with recompute + flat-fee wiring
│   └── api/
│       └── assessments/[id]/route.ts     # DECISION NEEDED — does AC-01's literal GET route get built?
├── src/
│   ├── domain/
│   │   ├── disposition-actions.ts        # extend: import + apply the new stop-list constant
│   │   └── keyboard-shortcuts.ts         # NET-NEW — pure key→action map, testable without DOM
│   ├── server/
│   │   ├── engine-invocation.ts          # GENERALIZE — resolvePackForMatter(jurisdictionCode), not DEMO_PACK_ID
│   │   └── jurisdiction-packs.ts         # already jurisdiction-general; extend reuse here
│   └── ui/review/
│       ├── flat-fee-choice.tsx           # NET-NEW — REVIEW-11
│       ├── recompute-confirm.tsx         # NET-NEW — REVIEW-10
│       ├── shortcut-help-overlay.tsx     # NET-NEW — REVIEW-08/NAV-03
│       └── line-card.tsx                 # small fix — verdict badge accessible name (DISC-04)
packages/
├── schemas/src/constants.ts              # extend: REASON_STOP_LIST, following LEGAL_CONCLUSION_BANNED_WORDS precedent
└── engine/src/
    └── real-pack-fixture.golden.test.ts  # NET-NEW — ENGINE-14 against real HK/SG JSON, coerced to engine-eligible
```

### Pattern 1: Generalizing the pack-coercion boundary

**What:** `engine-invocation.ts` today hardcodes `DEMO_PACK_ID = "SG-PDPA"` and `DEMO_PACK_VERSION = "2026.09.1"`. Every call site (`assessMatter`, `review-view.ts`, `data/assessments.ts`'s `signOff`/`bulkAcceptLines`/`recomputeAgainstCurrentPack`) resolves the SAME pack regardless of the matter's actual jurisdiction.
**When to use:** Phase 6 must resolve the pack for a matter's *actual* `jurisdictionCode` (HK or SG, since those are the only two with any authored content) and still apply the same `coercePackForDemoEngine`-style status override, because `assertActiveReady` will reject both real packs as shown above.
**Example (the mechanism to preserve and generalize):**
```typescript
// Source: apps/web/src/server/engine-invocation.ts (existing, verified read this session)
export function coercePackForDemoEngine(loaded: LoadableRulePack): RulePack {
  return {
    ...loaded,
    status: "ACTIVE",
    constraints: loaded.constraints as RulePack["constraints"],
  };
}
```
Recommended generalization keeps this exact function (it is not "demo-only" logic in substance — it is "the only way an engine-eligible pack of this project's current authoring state can exist" — even though its name and comments say otherwise) but parameterizes pack selection by `matter.jurisdictionCode` via the existing `resolveRulePack`/`loadAllRulePacks` from `@dsar/rulepacks/loader`, using the same jurisdiction table `jurisdiction-packs.ts` already builds (`PACK_JURISDICTIONS`). Rename is a documentation/clarity decision for the planner, not a functional requirement — but the module's own header comment ("DEMO-ONLY TRANSFORM — never used by a real ACTIVE-pack workflow (Phase 6+)") is now factually false the moment Phase 6 reuses it, and should be corrected in the same change that generalizes it, or a future reader will delete the mechanism believing Phase 6 replaced it.

### Pattern 2: Shared stop-list constant (AC-23)

**What:** One exported constant, imported by both the client-side reason-length UI feedback and the server-side `assertSufficientReason` gate.
**When to use:** REVIEW-05.
**Example:**
```typescript
// Source: packages/schemas/src/constants.ts (existing file, read this session — verbatim precedent to follow)
export const LEGAL_CONCLUSION_BANNED_WORDS = [
  "compliant", "non-compliant", "legal", "illegal",
  "lawful", "unlawful", "approved", "safe",
] as const;
```
The new constant should be added to this exact module, in this exact style (`as const` array, module comment naming which AC it satisfies and which call sites must import it — never a second copy). PRD's own §13 AC-23 text (`docs/PRD-dsar-fee-agent.md:910`, read this session) gives the literal list verbatim:
> "The stop-list lives in one exported constant used by both client and server: `["ok", "okay", "fine", "agreed", "yes", "no", "n/a", "na", "noted", "as above", "same"]`."

This is a `[VERIFIED: docs/PRD-dsar-fee-agent.md:910]` claim — the PRD line was opened and read directly this session, and the array above is quoted verbatim from it.

### Anti-Patterns to Avoid

- **Editing the committed HK/SG pack JSON to force `ACTIVE` status or fabricate category content for golden-file convenience:** explicitly rejected by the product owner (2026-09-18, recorded in `engine-invocation.ts`). The golden files must prove correctness for the *actually authored* subset (9/21 HK categories, 6/21 SG categories, both verified by direct read this session), not invent content to make the test simpler.
- **Passing the full `Assessment` object into a `"use client"` component "for convenience":** this is the exact Next.js RSC-payload leak class ACCESS-07 exists to catch. Every existing client component in `apps/web/src/ui/review/` already takes only narrow scalar props (verified by direct read of `disposition-controls.tsx`, `bulk-accept-bar.tsx`, `signoff-panel.tsx`) — new components (flat-fee choice, recompute confirm) must follow the same discipline, not regress it.
- **A shortcut help overlay that only lists keys with no visible affordance to open it (`?`) discoverable by mouse:** PRD §10.1 says "`?` for help" as a keyboard trigger, but a screen reader / non-keyboard user still needs a discoverable, focusable trigger, not a keystroke-only entry point, per WCAG 2.1 AA operability.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reason validation (length + stop-list) | A second copy of the check inside `disposition-controls.tsx` or a new server-only variant | The single shared `hasSufficientReason`-style function in `apps/web/src/domain/disposition-actions.ts`, extended with the new stop-list import from `@dsar/schemas/constants` | AC-23 explicitly requires ONE constant used by both sides — the codebase already has this exact pattern proven twice (`LEGAL_CONCLUSION_BANNED_WORDS`, `PERSONAL_DATA_DENY_LIST`) |
| Pack resolution by jurisdiction | A second jurisdiction→pack lookup table inside `engine-invocation.ts` | `jurisdiction-packs.ts`'s existing `PACK_JURISDICTIONS` + `@dsar/rulepacks/loader`'s `loadAllRulePacks`/`resolveRulePack` | Exactly one place in the codebase should ever answer "what pack does jurisdiction X use" — `jurisdiction-packs.ts` already is that place for display purposes; the engine-invocation boundary should call into the same source, not re-derive it |
| Accessible verdict badges | A custom ARIA live-region announcer or a colour-contrast checker script | `aria-label` (or visually-hidden text) directly on the existing `<span data-testid="verdict-badge">`, tested with Testing Library's `toHaveAccessibleName()` | The fix is a one-line markup change; building tooling around it would be solving a problem that doesn't exist |

**Key insight:** Nearly everything this phase needs a "don't hand-roll" table for is actually "don't build a second copy of a shared module that already exists in this codebase" — the risk in this specific phase is duplication and drift, not missing library research.

## Common Pitfalls

### Pitfall 1: Both real packs are permanently `DRAFT` — `checkPreconditions` will throw if this is forgotten
**What goes wrong:** A plan that writes "wire the engine to the real ACTIVE HK/SG packs" literally, without the coercion mechanism, will hit `AssessPreconditionFailure` with code `PACK_NOT_ACTIVE` on every single call, because `packages/engine/src/preconditions.ts:50-55` throws immediately if `pack.status !== "ACTIVE"`, and both real pack JSON files have `"status": "DRAFT"` (confirmed by direct read/probe this session: `HK-PDPO/2026.09.1.json` and `SG-PDPA/2026.09.1.json` both carry `authoredBy: null, reviewedBy: null, reviewedOn: null`).
**Why it happens:** PACK-03/`assertActiveReady` requires ALL 21 categories free of the `UNAUTHORED_TOKEN` marker and non-null reviewer fields before a pack may legitimately claim `ACTIVE` — and PACK-09's full authoring is explicitly deferred past this phase (D-16). There is currently no route by which either real pack becomes legitimately `ACTIVE` before Phase 6 ships.
**How to avoid:** Generalize (don't remove) `coercePackForDemoEngine`; every engine call site in Phase 6 (golden files, review page, disposition/bulk-accept/signoff/recompute data-layer functions) must go through the same override.
**Warning signs:** Any new test that calls `assess()` directly against a `loadRulePackFile`/`resolveRulePack` result without an intervening status override will fail with `PACK_NOT_ACTIVE` — this is expected and correct; the fix is the coercion call, never editing the pack's `status` field on disk.

### Pitfall 2: `DEMO_PACK_ID` is hardcoded to SG — every current call site silently ignores the matter's actual jurisdiction
**What goes wrong:** A matter created for Hong Kong today, if run through the current pipeline, would still be assessed against the SG-PDPA pack (`engine-invocation.ts`'s `DEMO_PACK_ID = "SG-PDPA"` is a module-level constant with no jurisdiction parameter anywhere in its call chain — verified by direct read of `assessMatter`, `review-view.ts`, `data/assessments.ts`).
**Why it happens:** Phase 3.1 only needed to demo one jurisdiction end-to-end, so hardcoding was the correct scope call at the time (and is documented as such in the module's own comments).
**How to avoid:** Any Phase 6 plan touching `engine-invocation.ts` must thread `matter.jurisdictionCode` through to pack resolution, and the golden-file tests must exercise BOTH HK and SG explicitly (not just re-run the SG path twice).
**Warning signs:** A golden-file test suite that only imports `SG-PDPA/2026.09.1.json` and never touches `HK-PDPO/2026.09.1.json` has silently failed to satisfy ENGINE-14/AC-09's explicit "repeated for the HK pack" requirement (PRD §13, verified: `docs/PRD-dsar-fee-agent.md:895`).

### Pitfall 3: The verdict badge's accessible name may compute to empty despite visible text
**What goes wrong:** `<span data-testid="verdict-badge">{VERDICT_LABELS[line.verdict]}</span>` (`line-card.tsx:96`, read this session) is a plain `<span>` with default ARIA role `generic`. The W3C accessible-name-computation algorithm's "name from content" step applies only to roles that explicitly support it (e.g. `button`, `link`, `heading`, `cell`) — `generic` is not one of them. A test using Testing Library's `toHaveAccessibleName()` (the natural way to assert AC-32b) may report an empty accessible name even though the text is visually present and passes a plain `getByText()` query.
**Why it happens:** Visible text content and "accessible name" are not the same thing once a non-naming role is involved; this is a common, easy-to-miss WCAG gotcha, not a hypothetical one for this exact markup shape.
**How to avoid:** Add an explicit `aria-label={VERDICT_LABELS[line.verdict]}` (or use a role that supports name-from-content, e.g. `role="status"` if the badge should also announce dynamically) on the badge element itself, and write the AC-32b test with `toHaveAccessibleName()` rather than `toHaveTextContent()` — the latter would pass today even if the accessible name is broken, giving false confidence.
**Warning signs:** `toHaveTextContent()` passes but `toHaveAccessibleName()` fails on the same element.

### Pitfall 4: Route URLs do not match the PRD's own named paths — a structural decision, not a bug fix
**What goes wrong:** `docs/PRD-dsar-fee-agent.md` names literal paths `/hr/matters/new` (§10.2, line 756), `/hr/matters/{id}` (§10.4, line 829), `/legal/assessments/{id}` (§10.3, line 773), and `/admin/rulepacks` (§10.6, line 841). The live app's actual URLs, confirmed by reading `apps/web/app`'s directory structure directly, are `/matters`, `/matters/new`, `/matters/[id]`, `/assessments`, `/assessments/[id]` — the `(hr)` and `(legal)` folders are Next.js **route groups**, which are excluded from the URL by design; they do not add a `/hr/` or `/legal/` segment. `ACCESS-01` ("Role-scoped routes... `/hr/*`, `/legal/*`, `/admin/*`") is the requirement that would fix this, and it is assigned to Phase 3.2, which is not yet complete (blocked on Docker/Postgres per `ROADMAP.md`'s `[ ]` marker) — verified by reading the roadmap and `apps/web/next.config.ts` (no rewrites) directly.
**Why it happens:** Route groups are easy to mistake for URL namespacing when skimming the file tree; they are a layout-organization primitive only.
**How to avoid:** NAV-01 explicitly names `/legal/queue` as a literal path — this phase cannot avoid the question. Decide explicitly in planning whether to (a) introduce real `legal/` and `hr/` URL segments now (recommended — the alternative leaves the app in a permanently inconsistent state where one route is prefixed and none of the others are), or (b) build `/legal/queue` as an isolated exception and defer the rest of ACCESS-01 to Phase 3.2 (creates a confusing, inconsistent URL space in the interim). See Open Questions.
**Warning signs:** A plan that says "add `app/(legal)/queue/page.tsx`" will produce `/queue`, not `/legal/queue` — this is a one-character-looking mistake (`(legal)` vs `legal`) with a real behavioral consequence.

### Pitfall 5: There is only one version file per pack — REVIEW-10's "recompute against a newer version" has nothing to recompute against yet
**What goes wrong:** `packages/rulepacks/HK-PDPO/` and `packages/rulepacks/SG-PDPA/` each contain exactly one file, `2026.09.1.json` (confirmed by directory listing this session). `recomputeAgainstCurrentPack()` always calls `loadDemoPack()`, which always resolves the same single version — there is currently no "newer" version anywhere in the repository to recompute against.
**Why it happens:** No prior phase needed a second pack version; the multi-version test fixtures that DO exist (`packages/rulepacks/src/__fixtures__/versions/ACME-FIXTURE/{2026.01.1,2026.06.1}.json`) are synthetic test-only fixtures, not real packs.
**How to avoid:** Either add a second, minor-differing real pack version file to exercise REVIEW-10 meaningfully in an integration/E2E test, or scope the E2E proof to the ACME-FIXTURE-style synthetic fixture pattern and unit-test the confirm-discard UI in isolation from a real second version. Flag this explicitly in the plan rather than silently only unit-testing the confirmation dialog's copy/behavior with mocks.
**Warning signs:** A "recompute" E2E test that can't actually observe a changed verdict/amount after recomputing, because it recomputed against the identical file.

### Pitfall 6: Turbopack dev-mode `import.meta.dirname` is unreliable (already discovered, documented, and worked around)
**What goes wrong:** `packages/rulepacks/src/loader.ts`'s own comment (read this session) documents that "Turbopack's dev-mode module evaluation leaves `import.meta.dirname` undefined in some import contexts" and the fix already in place is to use `import.meta.url` + `fileURLToPath` instead.
**Why it happens:** A known Next.js 16 dev-server (Turbopack) quirk, already hit and fixed once in this codebase.
**How to avoid:** Any new module in Phase 6 that needs a filesystem-relative path (unlikely, since `apps/web` never reads `RULEPACKS_ROOT` directly — it walks up from `process.cwd()` via `resolveRulepacksRoot()`) must follow the same `import.meta.url` pattern, never `import.meta.dirname`.
**Warning signs:** A `TypeError` at import time inside a Turbopack dev session specifically (not `next build`, not `vitest`) is the tell.

### Pitfall 7: Assessment/expense-line ids are colon-joined and must be decoded twice at the routing boundary
**What goes wrong:** Both `apps/web/app/(legal)/assessments/[id]/page.tsx` and `apps/web/app/api/assessment-lines/[id]/disposition/route.ts` carry explicit comments (read this session) that dynamic-segment params arrive percent-encoded under this app's Turbopack dev setup and must be run through `decodeURIComponent` before being used as a lookup key, because ids are colon-joined (`assessment:{matterId}:{packId}:{packVersion}:{timestamp}`, `${assessmentId}:line:${expenseLineId}`).
**Why it happens:** Colons in a dynamic route segment get percent-encoded by the browser/router; Next's own decoding of the param is documented in these comments as NOT reliably happening before the handler sees it.
**How to avoid:** Any new route Phase 6 adds (the `GET /api/assessments/{id}` route if built, the `/legal/queue` page, the recompute-confirmation flow) that receives one of these composite ids as a route param must apply the same `decodeURIComponent` pattern.
**Warning signs:** A 404 on a lookup that should exist, specifically when the id contains a colon.

## Code Examples

### The exact pack-eligibility gate a golden-file test must clear (verified this session)
```typescript
// Source: packages/engine/src/preconditions.ts:50-55 (read this session)
if (pack.status !== "ACTIVE") {
  throw new AssessPreconditionFailure(
    { code: "PACK_NOT_ACTIVE", detail: { actualStatus: pack.status } },
    packNotActiveMessage(pack.status)
  );
}
```

### The exact real-pack authoring state a golden-file test is asserting against (verified this session via Node probe against the committed JSON)
```
HK-PDPO/2026.09.1.json: status DRAFT, authoredBy null, reviewedBy null, reviewedOn null
  categoryRules: 21 total, 12 still carrying the UNAUTHORED_TOKEN marker (9 authored)
  verificationStatus tally: { NEEDS_VERIFICATION: 20, VERIFIED: 1 }
  treatment tally: { ALLOW: 2, FLAG: 13, DISALLOW: 4, ALLOW_WITH_CAP: 1, ALLOW_IF: 1 }
  flatFee: amount 10000 (HK$100.00), NEEDS_VERIFICATION

SG-PDPA/2026.09.1.json: status DRAFT, authoredBy null, reviewedBy null, reviewedOn null
  categoryRules: 21 total, 15 still carrying the UNAUTHORED_TOKEN marker (6 authored)
  verificationStatus tally: { NEEDS_VERIFICATION: 21 }
  treatment tally: { ALLOW: 2, FLAG: 16, DISALLOW: 1, ALLOW_WITH_CAP: 1, ALLOW_IF: 1 }
  flatFee: none
```
This is `[VERIFIED: packages/rulepacks/HK-PDPO/2026.09.1.json, packages/rulepacks/SG-PDPA/2026.09.1.json]` — produced by a Node script that `JSON.parse`'d both files directly and tallied their fields this session (not a training-data claim, not a grep). Both packs have at least one `ALLOW`, at least one `FLAG`, at least one `DISALLOW`, and at least one `ALLOW_WITH_CAP`/`ALLOW_IF` category rule already authored — meaning a golden-file fixture built from either pack's *authored* categories alone can exercise the full range of verdict types the reference-fixture test (`packages/engine/src/reference-fixture.golden.test.ts`) already proves against the synthetic fixture pack, just with real citations/basis text instead of fixture ones.

### The existing bulk-accept eligibility gate — already AC-26-correct, needs no logic change
```typescript
// Source: apps/web/src/server/data/assessments.ts:259-269 (read this session)
export function listBulkAcceptableLineIds(
  assessment: Assessment,
  pack: ReturnType<typeof loadDemoPack> = loadDemoPack()
): string[] {
  const ruleById = new Map(pack.categoryRules.map((rule) => [rule.ruleId, rule]));
  return assessment.lines
    .filter((line) => line.verdict === "ALLOW" && line.disposition === "PENDING")
    .filter((line) => ruleById.get(line.appliedRuleId)?.verificationStatus === "VERIFIED")
    .map((line) => line.id);
}
```
Because HK has exactly one `VERIFIED` rule and SG has zero (verified above), a positive-path test for this function against the *real* pack needs the HK pack specifically (or a fixture pack with a `VERIFIED` rule, which `bulkAcceptLines`'s own `pack` override parameter already supports and is already used this way in its existing tests).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Recommending the `/legal/`/`/hr/` URL-prefix restructuring happen *within* Phase 6 (rather than waiting for Phase 3.2) is the right call | Pitfall 4 / Open Questions | If the product owner wants Phase 3.2's Docker-gated ACCESS-01 to be the sole owner of route prefixing, Phase 6 should build `/legal/queue` as a scoped, explicitly-flagged exception instead, leaving `/assessments` etc. untouched until Phase 3.2 lands — a materially different, smaller diff |
| A2 | `coercePackForDemoEngine`'s mechanism should be generalized/renamed in place rather than replaced with a new module | Pattern 1 | If the planner instead wants a clean-slate "real pack invocation" module (leaving the demo one untouched for historical/demo-mode purposes), the file organization differs, though the underlying status-override logic is unavoidable either way |
| A3 | A second, real pack version file (vs. a synthetic fixture) is the right way to exercise REVIEW-10's "recompute against a newer pack" meaningfully | Pitfall 5 | If synthetic-fixture-only testing is acceptable to the team, no new pack version file needs authoring, saving scope |
| A4 | `react-hotkeys-hook` (or any keyboard-shortcut library) is unnecessary for six key bindings on one screen | Alternatives Considered | If the planner anticipates the shortcut scope growing significantly (e.g., across `/legal/queue` AND the review screen with overlapping/conflicting bindings), a small library might reduce edge-case bugs (focus-trap interactions, input-field exclusion) that a hand-rolled hook would need to solve itself |

**Assumption A1 in particular is flagged for discuss-phase/planner confirmation** — it is a structural decision with a real chance of surprising the user, since it touches a requirement (ACCESS-01) nominally owned by a different, currently-incomplete phase.

## Open Questions

1. **Does Phase 6 build the literal `GET /api/assessments/{id}` route AC-01 names, or satisfy AC-01/ACCESS-02 through the existing server-component-only fetch path plus an equivalent test?**
   - What we know: PRD §13's AC-01 text literally says `GET /api/assessments/{id}` (`docs/PRD-dsar-fee-agent.md:885`, read this session). No such route exists today — the assessment is fetched only inside `LegalAssessmentPage`'s server-component body via a direct data-layer call, never through a fetchable API endpoint.
   - What's unclear: Whether AC-01's specific route shape is a literal contract test target (in which case the route must be built, even if `apps/web` itself never calls it, purely so the test can) or whether it can be discharged by testing the equivalent authorization boundary at the DAL/data-layer level plus a same-effect page-request test.
   - Recommendation: Build the route. It costs little (a thin GET handler mirroring the existing `disposition`/`bulk-accept`/`recompute`/`signoff` POST handlers' established shape), it is explicitly literal in the PRD, and CLAUDE.md's own stack notes (Q8, Route Handlers section) already argue the whole codebase should prefer Route Handlers specifically because "AC-01 tests `GET /api/assessments/{id}`... as plain HTTP endpoints with status codes and response bodies" — treat that as a standing project decision, not a fresh one for this research to re-litigate.

2. **Route-prefix restructuring: does Phase 6 introduce real `/legal/*` and `/hr/*` URL segments now, or scope `/legal/queue` as an isolated exception?**
   - What we know: NAV-01 names `/legal/queue` literally, forcing at least one real prefixed route to exist. ACCESS-01 (the requirement that would prefix everything) is assigned to Phase 3.2, not yet complete, blocked on Docker.
   - What's unclear: Whether the product owner wants route-prefix consistency now (touching `/matters` → `/hr/matters`, `/assessments` → `/legal/assessments`, which changes existing tested URLs across Phases 3.1/4/5) or a scoped addition.
   - Recommendation (see A1 in Assumptions Log): restructure now, since NAV-01 already forces the underlying question and a partially-prefixed app is a worse state than either extreme. Flag explicitly in `/gsd-discuss-phase` or the plan itself so the user can veto if Phase 3.2's Docker unlock is imminent and they'd rather do it once.

3. **Where does the lawyer's flat-fee-vs-itemised CHOICE get recorded (REVIEW-11)?**
   - What we know: The engine already computes `Totals.flatFeeComparison` (`flatFeeAmount`, `flatFeeExceedsItemisedCost`) — this is a read-only computed fact, not a decision. The *decision* of which figure to use is the lawyer's, per PRD's design intent, and nothing on the `Assessment`/`SignOff` schema currently has a field for it (not verified as absent by exhaustive schema read this session — flagged as a gap to confirm, not a verified omission).
   - What's unclear: Whether this choice is best modeled as a new field on `SignOffInput`/`SignOff` (Phase 7's territory) or as a disposition-adjacent decision recorded earlier, in Phase 6.
   - Recommendation: Since sign-off itself is Phase 7's gate, Phase 6 should render the choice UI and hold the selection in review-time state (not yet persisted) unless the planner determines a persisted field is needed before Phase 7 can consume it — this boundary should be an explicit planning decision, not an implicit one.

## Environment Availability

Skipped — this phase has no new external service/tool dependency. The app continues to run entirely in-memory (no Docker, no Postgres, matching Phase 3.1/4/5's existing setup); Phase 3.2 remains the phase that introduces the database dependency, and Phase 6 does not depend on it.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (root `vitest.config.ts` present, confirmed by direct file listing) |
| Config file | `vitest.config.ts` (repo root) |
| Quick run command | `pnpm test -- <pattern>` (repo's `package.json` `"test": "vitest run"`, confirmed) |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENGINE-14 | HK/SG golden files against authored categories | unit | `pnpm test -- packages/engine/src/real-pack-fixture.golden.test.ts` | ❌ Wave 0 |
| REVIEW-05 | Stop-list rejects listed phrases, both sides | unit | `pnpm test -- packages/schemas/src/constants.test.ts` and `apps/web/src/domain/disposition-actions.test.ts` | ❌ Wave 0 (constants test net-new; disposition-actions test file may already exist and need extension — confirm at plan time) |
| REVIEW-07 | Bulk-accept rejects a batch containing FLAG/ALLOW_CAPPED/NEEDS_VERIFICATION | unit | `pnpm test -- apps/web/src/server/data/assessments.test.ts` | Existing test file location unconfirmed this session — grep at plan time; logic itself already correct per direct code read |
| REVIEW-08 / NAV-03 | j/k/a/r/s/? keyboard nav + help overlay | unit + smoke | `pnpm test -- apps/web/src/domain/keyboard-shortcuts.test.ts` | ❌ Wave 0 |
| NAV-01 | `/legal/queue` lists LEGAL_REVIEW + INFO_REQUEST, sortable | route/integration | `pnpm test -- tests/routes/legal-queue.test.ts` | ❌ Wave 0 |
| ACCESS-02/03 | HR_PREPARER 403, no leaked fields | route/integration | `pnpm test -- tests/routes/access-control-review.test.ts` | ❌ Wave 0 |
| ACCESS-07 | No RSC-payload/cached-response leak | integration | Needs a real Next.js render-and-inspect-payload test — no existing project pattern for this class of test found this session; flag for Wave 0 investigation of testing approach itself | ❌ Wave 0 — approach undecided |
| DISC-04 | Verdict badge accessible name | unit | `pnpm test -- apps/web/src/ui/review/line-card.test.tsx` (existing file — extend, don't create) | ✅ file exists, extend |

### Sampling Rate
- **Per task commit:** `pnpm test -- <touched package/dir>`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `packages/engine/src/real-pack-fixture.golden.test.ts` — covers ENGINE-14/AC-09 against real HK+SG content
- [ ] `packages/schemas/src/constants.test.ts` extension (or new test) — covers the new `REASON_STOP_LIST` export
- [ ] `apps/web/src/domain/keyboard-shortcuts.ts` + test — covers REVIEW-08/NAV-03
- [ ] `tests/routes/legal-queue.test.ts` — covers NAV-01
- [ ] `tests/routes/access-control-review.test.ts` — covers ACCESS-02/ACCESS-03 as their own explicit assertions (distinct from ACCESS-08's broader Phase 3.2 standing obligation)
- [ ] **Investigate and decide the ACCESS-07 (RSC-payload leak) test approach before Wave 0 closes** — no existing pattern in this codebase tests for this leak class; Next.js does not currently ship a first-party "inspect the flight payload" test utility, so this likely needs either a Playwright-driven inspection of the raw response body for privileged-field substrings, or a lint/static-analysis rule constraining which props may cross a `"use client"` boundary. This is a genuine open technical question, not a known gap with a known fix.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Stubbed identity by design this milestone (ACCESS-06, Phase 3.2) — out of this phase's scope |
| V3 Session Management | No | Cookie-based demo actor resolution already built (`resolveActorFromCookieHeader`), unchanged this phase |
| V4 Access Control | **Yes** | `requireRole()` called as the first statement of every data-layer function (existing, established pattern — verified across `getAssessmentForLegalReview`, `dispositionLine`, `bulkAcceptLines`, `signOff`, `askHr`, `recomputeAgainstCurrentPack`). Phase 6 must extend this same pattern to any new data-layer function (e.g., `/legal/queue`'s listing function, a flat-fee-choice recorder) — never a route- or page-level-only check |
| V5 Input Validation | **Yes** | zod schemas at the data boundary (existing); REVIEW-05's stop-list is itself a V5 control — reject-list validation on free text before it is persisted into an audit-adjacent field (`lawyerReason`) |
| V6 Cryptography | No | Not touched this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| RSC-payload over-fetching (passing a full privileged object into a Client Component boundary) | Information Disclosure | Narrow, scalar-only props into every `"use client"` component — established pattern in this codebase, must be actively preserved as new components are added (ACCESS-07) |
| Role check performed only at the page/route level, not the underlying data function | Elevation of Privilege | `requireRole()` inside the data-layer function itself, per this project's existing `apps/web/src/server/data/auth.ts` convention and its own module comment ("never in middleware.ts... never only at the page level") |
| Reason-field bypass via a technically-≥10-character but semantically-empty stop-list phrase (e.g. "as above") | Repudiation (a disposition recorded with no real accountability trail) | The PRD's literal 11-item stop-list (verified above), checked server-side as the authoritative gate — client-side check is UX-only and must not be trusted as the enforcement point |
| Bulk-accept batch smuggling an ineligible line id past client-side filtering | Tampering | `bulkAcceptLines`'s existing all-or-nothing server-side re-validation against `listBulkAcceptableLineIds` (already correct, verified this session) — no client-supplied eligibility list is ever trusted |

## Sources

### Primary (HIGH confidence — direct file reads and one executed probe, this session)
- `apps/web/src/server/engine-invocation.ts` — the pack-coercion mechanism and its module comments
- `apps/web/src/server/jurisdiction-packs.ts` — the existing jurisdiction-general pack-view pattern
- `apps/web/src/server/review-view.ts`, `apps/web/src/server/data/assessments.ts` — data-layer behavior for disposition, bulk-accept, sign-off, recompute, ask-HR
- `apps/web/src/ui/review/*.tsx` (assessment-view, line-card, disposition-controls, bulk-accept-bar, signoff-panel, totals-rail) — current UI state
- `apps/web/app/(legal)/assessments/[id]/page.tsx`, `apps/web/app/(legal)/assessments/page.tsx` — current routing and page composition
- `apps/web/src/server/data/auth.ts`, `apps/web/src/server/errors.ts` — role/error handling
- `packages/engine/src/preconditions.ts`, `packages/engine/src/reference-fixture.golden.test.ts` — the ACTIVE-status gate and existing golden-file pattern
- `packages/rulepacks/src/loader.ts`, `packages/rulepacks/src/validate.ts` — pack loading and the `assertActiveReady` gate
- `packages/rulepacks/HK-PDPO/2026.09.1.json`, `packages/rulepacks/SG-PDPA/2026.09.1.json` — read AND probed via an executed Node script this session (tallies quoted above are the script's actual output, not an estimate)
- `packages/schemas/src/constants.ts`, `packages/schemas/src/rule-pack.ts`, `packages/engine/src/flat-fee.ts` — existing shared-constant pattern and flat-fee engine support
- `docs/PRD-dsar-fee-agent.md` lines 740-932 — §9.5-10.7 UI spec and full AC-01..AC-42 text, read directly
- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — phase status, requirement text, and prior-phase decision log
- `apps/web/next.config.ts`, `apps/web/app` directory listing — confirmed no middleware, no rewrites, route groups do not prefix URLs

### Secondary (MEDIUM confidence)
- None used — this research required no external web search; every claim is either read directly from this repository or from the PRD already in it.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- What exists vs. what's missing: HIGH — every claim backed by a direct `Read` of the actual file, not a summary or a prior SUMMARY.md's characterization
- The PACK-09 deferral framing / pack-eligibility finding: HIGH — backed by an executed probe against the real committed JSON plus a direct read of the exact code path (`assertActiveReady`, `checkPreconditions`) that would reject an insufficiently-authored pack
- Route-prefix gap and its resolution: MEDIUM — the gap itself is HIGH confidence (verified directly), but the recommended resolution (restructure now vs. defer) is a product decision, not a technical fact, hence flagged in Open Questions/Assumptions rather than asserted
- Keyboard-shortcut and flat-fee-choice UI shape: MEDIUM — the absence of existing code is HIGH confidence; the specific implementation pattern recommended is this document's design judgment, to be confirmed at plan time

**Research date:** 2026-09-20
**Valid until:** Effectively until the next commit to `packages/rulepacks/HK-PDPO/` or `SG-PDPA/` (which would change the authored/unauthored tallies quoted above) or to `apps/web/src/server/engine-invocation.ts`/routing structure — recommend re-verifying the pack-content tallies specifically if more than a few days pass before planning executes, since PACK-09 authoring work could plausibly resume in parallel.

## RESEARCH COMPLETE
