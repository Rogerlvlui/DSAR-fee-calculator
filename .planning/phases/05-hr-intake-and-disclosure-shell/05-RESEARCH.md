# Phase 5: HR Intake and Disclosure Shell - Research

**Researched:** 2026-09-19
**Domain:** Next.js 16 App Router UI/UX (form itemisation, layered risk disclosure, personal-data field discipline) on top of an already-working demo pipeline
**Confidence:** HIGH

## Summary

Phase 5 is overwhelmingly a **gap-closing and shell-wiring** phase, not a greenfield build. Phase 3.1 (the demo slice, complete 2026-09-19) already shipped a production-quality HR intake form — `MatterDetailsFields`, `AttestationsPanel`, `ExpenseLineRepeater`, `ClaimFooter` composed by `IntakeForm` — that discharges the substance of INTAKE-01, INTAKE-02, INTAKE-03, INTAKE-04, INTAKE-05, INTAKE-06, INTAKE-07 and the first layer of INTAKE-08 (AC-42) already. Phase 4 separately built a working `CapabilityStatement` and `StatusStrip` component, but **wired them only into the legal-review page and the bare landing page** — neither currently appears anywhere in the `/hr/*` flow. This is the single most important finding: the disclosure-shell components this phase's name promises already exist as code; what's missing is (a) applying them uniformly across every authenticated screen including the HR ones, (b) three requirements with **no code at all yet** (autosave, the personal-data pattern detector, `/hr/matters`), and (c) reconciling the existing `StatusStrip`'s field set (built to a Phase 3.1-specific demo constraint) against DISC-02/AC-31's actual required fields.

Read literally, the ROADMAP's Phase 5 success criteria ask for things that are already true (HR itemises through a category-grouped repeater with computed read-only amounts and pack-drawn hints — done) alongside things that do not exist anywhere in the repository yet (10-second autosave with visible save state, the §12.1 personal-data pattern detector, `/hr/matters` as a list route, and `statementVersion`-driven re-showing of the capability statement). Do not re-plan or re-build the intake form's substance; plan the five genuinely new pieces and the wiring/reconciliation work.

**Primary recommendation:** Treat this phase as five work items — (1) wire `CapabilityStatement` and `StatusStrip` onto every `/hr/*` (and `/legal/*`) screen via the route-group layouts rather than per-page, reconciling `StatusStrip`'s props to AC-31's actual field list; (2) build the client-side autosave hook (`localStorage`, 10s interval, visible save-state indicator) as a new, small, testable module; (3) build the personal-data pattern detector (regex-based, warn-never-block) as one new exported function in `packages/schemas`, wired to `description`, `identityVerifiedNote`, and (in Phase 6) `lawyerReason`; (4) build `/hr/matters` as a new list route following the existing `/assessments` (legal worklist) pattern, filtered by `createdBy`; (5) make `statementVersion` a real, incrementable constant that `CapabilityStatement` reads instead of a single hardcoded acknowledgement key. Everything else is either done or a small, mechanical extension of an existing pattern.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INTAKE-01 | HR creates a matter with reference, jurisdiction, legal entity, controller type, request received date, currency and requestor class | Already built (`MatterDetailsFields`) — no new work |
| INTAKE-02 | Selecting a jurisdiction shows the pack's status inline immediately, including "no usable rule pack" | Partially built for SG only — see Open Question 3; `buildIntakePackView` needs extending to resolve all nine jurisdictions' real stub-pack postures |
| INTAKE-03 | `NO_EXPRESS_AUTHORITY`/`PROHIBITED` heads-up shown before expense entry | Already built (`headsUpMessage`, `MatterDetailsFields`) — depends on Open Question 3's resolution for correctness across all nine jurisdictions |
| INTAKE-04 | Three attestations, each with a one-line explanation | Already built (`AttestationsPanel`) — no new work |
| INTAKE-05 | Category-grouped repeater, units constrained by category, computed read-only amount | Already built (`ExpenseLineRepeater`) — no new work |
| INTAKE-06 | Category-contextual hints drawn from the pack | Already built (`buildIntakePackView`'s `hint` field) — no new work |
| INTAKE-07 | Running claimed total in a sticky footer, labelled as the claim not the fee | Already built (`ClaimFooter`, `CLAIM_NOT_FEE_SENTENCE`) — no new work |
| INTAKE-08 | Currency mismatch blocked client + server, naming both currencies (AC-42) | Already discharged both layers — currency is derived (unreachable mismatch client-side) and `MatterSchema.superRefine` rejects server-side naming both codes; add a route test to prove it, don't re-implement |
| INTAKE-09 | Drafts autosave every 10s with save state shown | Net new — Architecture Patterns, Common Pitfalls; no existing precedent in this codebase |
| NAV-02 | `/hr/matters` lists preparer's own matters and status | Net new route — Pattern 2, mirrors existing `/assessments` legal worklist pattern exactly |
| BOUND-03 | Free-text length limits (300/500/200/1000) with explicit warnings | Server-side already enforced (Phase 1 schemas); client-side `maxLength` + warning text needs reconciling against `FREE_TEXT_LIMITS` (Pattern 3's hardcoded-300 defect) and `hrNote`'s missing UI field (Pitfall 5 / Assumption A1) |
| BOUND-04 | Pattern check warns, never blocks, on likely personal data | Net new — Architecture Patterns Pattern 4; Assumption A3 flags the exact regex shapes need product-owner sign-off |
| DISC-01 | Capability statement, unskippable, re-shown on `statementVersion` increment (AC-30) | `CapabilityStatement` exists but has no `statementVersion` concept and is wired only to `/` and the legal review page — needs wiring to every `/hr/*` screen (Pattern 1) plus the version-increment behaviour (Assumption A5) |
| DISC-02 | Non-dismissible status strip, every authenticated screen (AC-31) | `StatusStrip` exists but is wired only to the legal review page and its field set doesn't match AC-31 exactly — needs wiring (Pattern 1) and reconciliation (Pitfall 4) |
| DISC-03 | No banned word in engine-derived UI strings (AC-32a) | Precedent exists in `packages/engine`'s own banned-word lint (Phase 2) — Validation Architecture flags confirming whether `apps/web` needs an equivalent scan as a Wave 0 gap |
| DISC-05 | Every rendered deadline carries "Advisory" in its own container (AC-15a) | Pattern (`MatterRail`, `computeAdvisoryDeadline`) already exists on the legal-review side; whether Phase 5 needs an HR-side surface for this is Open Question 1 |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Capability statement gate (DISC-01) | Browser / Client | — | Purely client-side acknowledgement UX (already built); no server persistence exists or is asked for in v1 (no user accounts) |
| Status strip (DISC-02) | Frontend Server (SSR) | Browser / Client | Server component computes pack/matter facts server-side (already the pattern in the legal page); the strip itself renders as a plain server-rendered fragment, no client state needed |
| HR intake form (INTAKE-01..09) | Browser / Client + API/Backend | — | Form state lives client-side (`IntakeForm`); every write (`POST /api/matters`, `.../lines`, `.../submit`) is a Route Handler doing the actual persistence and validation — client never computes anything authoritative |
| Autosave (INTAKE-09) | Browser / Client | — | No server-persisted drafts exist by design (PROJECT.md: "Server-persisted review drafts" is explicitly out of scope) — this is a client-local (`localStorage`) save-state indicator, not a real autosave-to-server feature |
| Currency mismatch validation (INTAKE-08/AC-42) | Browser / Client (form) | API/Backend (schema) | Already double-enforced: currency is derived, never freely typed (client), and `MatterSchema.superRefine` rejects any mismatch naming both codes (server, Phase 1) |
| `/hr/matters` list (NAV-02) | Frontend Server (SSR) | Database / Storage (in-memory repo today) | A server component reading through a new role- and ownership-scoped data-layer function, mirroring the existing `/assessments` legal worklist |
| Personal-data pattern detector (BOUND-04) | Browser / Client | — | Warn-only, client-side-only per §12.1 ("Warn, do not block") — no server enforcement is asked for, though the same function should also run server-side defensively since untrusted input reaches the API directly |
| Free-text length limits (BOUND-03) | API/Backend (schema) | Browser / Client (UX) | Already enforced at the zod schema layer (Phase 1); this phase's job is exposing the same limits as client-side `maxLength` + explicit warning text, not re-inventing the limit |

## Standard Stack

No new external packages are needed for this phase. Everything required — form state, autosave timers, regex pattern matching, list rendering — is achievable with React 19 + Next.js 16 App Router primitives and the already-pinned stack (`zod` 4.6.5, `next` 16.3.5, `react` 19.3.0 — confirmed present in `package.json` `[VERIFIED: package.json:1-40]`). Do not add a form library (React Hook Form, Formik, etc.) or a debounce/throttle utility package — the existing `IntakeForm` already manages its own `useState`-based form state by hand, and a 10-second autosave timer is a five-line `useEffect`/`setInterval`, not a library problem.

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.3.0 | Client component state (`IntakeForm`, autosave hook) | Already pinned `[VERIFIED: package.json:1-40]`; no reason to add anything on top for this phase's scope |
| Next.js | 16.3.5 (App Router) | Route-group layouts, server components, Route Handlers | Already pinned `[VERIFIED: package.json:1-40]` |
| zod | 4.6.5 | `FREE_TEXT_LIMITS`, `MatterSchema`/`ExpenseLineSchema` validation, new pattern-detector export | Already the schema layer for every existing check this phase must extend |

### Supporting

None new. Reuse: `formatMinor`/`MINOR_UNIT_DECIMALS` (`@dsar/schemas/money`), `deriveEffectiveStatus`/`daysUntilReviewDue`/`staleReason` (`@dsar/rulepacks/stale`), `computeAdvisoryDeadline`-shaped logic already in `apps/web/src/server/review-view.ts` if `/hr/matters` ends up showing an advisory deadline per matter (see Open Questions).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written `setInterval` autosave hook | A library like `use-debounce` | Unjustified dependency for a 10-second fixed-interval save-state indicator with no actual server round-trip required by v1's scope (drafts are never server-persisted — PROJECT.md decision) |
| Hand-written regex pattern detector | A dedicated PII-detection package (e.g. one of the several npm "PII scanner" packages) | PRD §12.1 asks for exactly three lightweight patterns (long digit strings, ID-number-shaped tokens, email addresses) with a "warn, never block" behaviour — a full PII-detection package is both an unverified new dependency (would need the Package Legitimacy Gate) and overkill for this narrow, product-defined scope |

**Installation:** None required — no `pnpm add` needed for this phase's planned work.

## Package Legitimacy Audit

**Not applicable this phase.** No new external packages are proposed. If a plan later decides it needs one (e.g., for the pattern detector), it must run the Package Legitimacy Gate protocol before that plan is written, and the resulting package must be tagged `[ASSUMED]` in that plan's own research until verified.

## Architecture Patterns

### System Architecture Diagram

```
Browser (HR_PREPARER, cookie-stubbed identity)
   │
   ├─▶ GET /matters/new  ───────────────────────────────────────────────┐
   │        (app/(hr)/matters/new/page.tsx, async server component)     │
   │        buildIntakePackView() reads the real SG-PDPA pack           │
   │        renders <StatusStrip/> [NEW WIRING] + <IntakeForm/>         │
   │                                                                     │
   │   Client: <IntakeForm> (useState form state)                       │
   │     ├─ autosave hook [NEW] → localStorage every 10s, shows saved/  │
   │     │    saving/error state                                        │
   │     ├─ pattern-detector [NEW] on description/identityVerifiedNote  │
   │     │    → inline warning, never blocks submit                     │
   │     └─ on Submit:                                                  │
   │          POST /api/matters          (createMatter, currency check) │
   │          POST /api/matters/:id/lines (×N, addExpenseLine)          │
   │          POST /api/matters/:id/submit (submitForAssessment)        │
   │                                                                     │
   ├─▶ GET /matters            [NEW ROUTE — NAV-02]                     │
   │        listMattersForPreparer(actor) — filters by createdBy        │
   │        renders each matter's reference + status, in-app substitute │
   │        for the NS-3-forbidden email notification                   │
   │                                                                     │
   └─▶ GET /matters/:id/submitted   (existing confirmation page)        │
            "Legal has been notified..." — already correct copy         │
                                                                          │
Every authenticated screen (both /hr/* and /legal/*) ◀────────────────────┘
   wrapped by:
   ├─ <CapabilityStatement> [NEW WIRING — currently only on "/" and legal review]
   │      gates on unacknowledged OR statementVersion increment [NEW]
   └─ <StatusStrip> [NEW WIRING — currently only on legal review]
          reconciled field set: jurisdiction, pack id+version, reviewer,
          reviewed date, review-due state (AC-31) — NOT the Phase-3.1-only
          "Pack status" cell as currently shaped
```

### Recommended Project Structure

No new top-level directories. Extend the existing tree:

```
apps/web/
├── app/(hr)/
│   ├── layout.tsx              # EXTEND: render <CapabilityStatement>+<StatusStrip> here
│   ├── matters/
│   │   ├── page.tsx             # NEW — NAV-02 list route
│   │   ├── new/page.tsx         # existing, unchanged composition
│   │   └── [id]/{page.tsx, submitted/page.tsx}  # existing, unchanged
├── src/
│   ├── ui/
│   │   ├── capability/capability-statement.tsx   # EXTEND: statementVersion prop
│   │   ├── chrome/status-strip.tsx               # RECONCILE: AC-31 field set
│   │   └── intake/
│   │       ├── intake-form.tsx                   # EXTEND: wire autosave + pattern warnings
│   │       ├── autosave-indicator.tsx            # NEW: small presentational save-state UI
│   │       └── use-draft-autosave.ts             # NEW: the localStorage timer hook
│   ├── domain/
│   │   └── (pattern-detector lives in packages/schemas, not here — it's a pure, cross-package rule)
│   └── server/
│       └── data/matters.ts                        # EXTEND: listMattersForPreparer()
packages/schemas/src/
└── personal-data-pattern.ts                        # NEW: exported detectLikelyPersonalData()
```

### Pattern 1: Route-group layout as the disclosure-shell mount point

**What:** Move `<CapabilityStatement>` and `<StatusStrip>` rendering out of individual pages and into `app/(hr)/layout.tsx` (and `app/(legal)/layout.tsx`), so every current and future screen under each role gets both automatically, with no per-page opt-in.
**When to use:** Any cross-cutting chrome required on "every authenticated screen" (DISC-01, DISC-02's literal wording).
**Example:**
```tsx
// Source: existing apps/web/app/(hr)/layout.tsx (currently a pass-through) —
// this is the pattern to extend, not a Context7/external citation.
import type { ReactNode } from "react";
import { CapabilityStatement } from "../../src/ui/capability/capability-statement.tsx";
// StatusStrip needs server-computed props (pack id/version/reviewer/etc.) —
// a layout CAN be an async server component in the App Router, so this is
// not a client/server boundary problem.

export default async function HrLayout({ children }: { children: ReactNode }) {
  const strip = await buildHrStatusStripProps(); // new, thin server helper
  return (
    <CapabilityStatement>
      <StatusStrip {...strip} />
      {children}
    </CapabilityStatement>
  );
}
```
**Caveat verified in this codebase:** `CapabilityStatement` is a `"use client"` component (`apps/web/src/ui/capability/capability-statement.tsx:16`) that internally reads `window.localStorage` — safe to render from a server-component layout (Next.js hydrates the client boundary correctly either way), but the *page* files under `(hr)/` are already marked `async` specifically so `tests/boundary/dom-denylist.test.ts`'s glob half can render them outside a real router context (`apps/web/app/(hr)/matters/new/page.tsx:1-9`, comment explicit about this). Moving the gate into the layout does not remove that need — the layout itself must stay `async` and avoid anything that throws outside a real Next request (e.g. `useRouter()`), matching the precedent already established in `(legal)/assessments/[id]/page.tsx`.

### Pattern 2: `requireRole`-gated data-layer function, never a page-level check

**What:** Every new server-side read this phase adds (`listMattersForPreparer`) must call `requireRole()` as its first statement, following the exact pattern of every existing function in `apps/web/src/server/data/matters.ts`.
**When to use:** Any new function under `apps/web/src/server/data/*`.
**Example:**
```typescript
// Source: apps/web/src/server/data/matters.ts:712-726 (listReviewableMatters),
// the direct precedent to mirror for the new listMattersForPreparer().
export async function listMattersForPreparer(actor: DemoActor): Promise<Matter[]> {
  requireRole(actor, "HR_PREPARER");
  const matters = await memoryMatterRepository.listMatters();
  // "the preparer's own matters" (ROADMAP Phase 5 SC3) — filter by
  // createdBy.id, the field createMatter already stamps on every matter
  // (apps/web/src/server/data/matters.ts:88, MatterSchema's createdBy field).
  return matters.filter((matter) => matter.createdBy.id === actor.user.id);
}
```
Two known findings this exact shape must be checked against during code review, since both bit prior phases: (a) 03.1-REVIEW.md's UNREG-1 finding — a page that reads the repository directly, bypassing the role check, was found twice before (legal worklist page, HR result page) and fixed both times; (b) do not repeat that mistake for the new `/hr/matters` page — it must call `listMattersForPreparer`, never `memoryMatterRepository.listMatters()` directly.

### Pattern 3: Reuse the frozen `FREE_TEXT_LIMITS` constant, never a hardcoded number

**What:** Every `maxLength` attribute and every warning threshold must read from `@dsar/schemas/constants`'s `FREE_TEXT_LIMITS`, never a literal.
**When to use:** Any free-text `<input>`/`<textarea>` in the intake form.
**Found defect to fix in this phase, not carry forward:** `apps/web/src/ui/intake/expense-line-repeater.tsx:363` currently hardcodes `maxLength={300}` on the description field instead of importing `FREE_TEXT_LIMITS.description` — it happens to match today only because nobody has changed the constant since. This is exactly the kind of drift `01-RESEARCH.md`'s own precedent (single source of truth for money/limits) exists to prevent; fix it as part of this phase's BOUND-03 work.
```typescript
// Source: packages/schemas/src/constants.ts:28-33 (already frozen, Phase 1)
export const FREE_TEXT_LIMITS = {
  description: 300,
  hrNote: 500,
  identityVerifiedNote: 200,
  lawyerReason: 1000,
} as const;
```

### Pattern 4: Warn-never-block personal-data pattern check, evaluated on blur/change, not on submit

**What:** A pure function taking a string and returning `{ matched: boolean; reason: string | null }` (or similar), covering §12.1's three named patterns: long digit strings (e.g. NRIC/passport-shaped), ID-number-shaped tokens, and email addresses.
**When to use:** `description` (expense line), `identityVerifiedNote` (attestation) now; `lawyerReason` in Phase 6 (already documented as Phase 6's job in ROADMAP's Phase 5 closing note: "Phase 6 wires those same two to `lawyerReason` rather than writing its own").
**Example (net-new, no existing source to cite from — this is the shape to build):**
```typescript
// packages/schemas/src/personal-data-pattern.ts — NEW
// §12.1: "a lightweight pattern check (long digit strings, ID-number-shaped
// tokens, email addresses) warns before submit. Warn, do not block; false
// positives on invoice numbers would be maddening."
const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const LONG_DIGIT_RUN = /\d{7,}/; // tune against real invoice-number false positives
const ID_NUMBER_SHAPE = /\b[A-Z]\d{7}[A-Z]\b/; // Singapore NRIC/FIN shape, e.g. S1234567A

export interface PersonalDataPatternMatch {
  matched: boolean;
  reason: string | null;
}

export function detectLikelyPersonalData(value: string): PersonalDataPatternMatch {
  if (EMAIL_PATTERN.test(value)) return { matched: true, reason: "looks like an email address" };
  if (ID_NUMBER_SHAPE.test(value)) return { matched: true, reason: "looks like an ID number" };
  if (LONG_DIGIT_RUN.test(value)) return { matched: true, reason: "contains a long run of digits" };
  return { matched: false, reason: null };
}
```
**Pitfall this pattern must avoid:** invoice numbers, DMS references and vendor reference numbers (`evidenceRef`, `vendorName`) are expected to contain long digit runs — §12.1 explicitly calls out this exact false-positive risk. Do not wire the digit-run check to `evidenceRef` — the PRD names `description` and `identityVerifiedNote`/`lawyerReason` as the fields needing the check, not the reference-pointer fields, which are digits-by-design.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Currency-per-jurisdiction mapping | A second lookup table in the intake UI | `JURISDICTION_CURRENCY` (`@dsar/schemas/primitives`) — already imported by `matter-details-fields.tsx` | One source of truth; a second copy is the exact drift class Phase 1's freeze exists to prevent |
| Minor-unit currency formatting | Ad hoc `.toFixed(2)` or hardcoded `/100` | `formatMinor`/`MINOR_UNIT_DECIMALS` (`@dsar/schemas/money`) — already used throughout `expense-line-repeater.tsx`, `claim-footer.tsx` | JPY/KRW/VND are zero-decimal; a hardcoded divisor silently corrupts those three currencies |
| Pack staleness / review-due colour state | Re-deriving "is this pack stale / due soon" from `reviewDueOn` inline in a component | `deriveEffectiveStatus`, `daysUntilReviewDue`, `staleReason` (`@dsar/rulepacks/stale`) — already built, timezone-proven, and reused by the legal review page | A second copy of this date arithmetic is the "two places that must agree" failure class STATE.md's Phase 1 notes explicitly warn about |
| Banned-word / personal-data deny-list checks | A second regex or string list | `LEGAL_CONCLUSION_BANNED_WORDS`, `PERSONAL_DATA_DENY_LIST` (`@dsar/schemas/constants`) | Both already exported once for exactly this reason; a second copy anywhere is a defect per that module's own header comment |
| Role/authorization checks | Middleware, or a check inside a page component | `requireRole()` as the first statement of a `src/server/data/*` function | PRD §0 non-negotiable #2 requires server-side enforcement "not by hiding UI"; middleware is a documented Next.js footgun (CVE-2025-29927-class bypass), already excluded in `.claude/CLAUDE.md`'s "What NOT to Use" table |

**Key insight:** Almost everything this phase might be tempted to "build fresh" (currency logic, money formatting, staleness derivation, banned-word checks, role checks) already exists, frozen and reused elsewhere in this exact codebase. The actual net-new surface is narrow: autosave, the pattern detector, the `/hr/matters` list, and wiring/reconciling the two disclosure components that already exist.

## Common Pitfalls

### Pitfall 1: Next.js route groups contribute no URL segment (already bit this project once)

**What goes wrong:** Code (or a plan) writes/links to `/hr/matters/new` or `/legal/assessments`, treating `(hr)`/`(legal)` as real path segments.
**Why it happens:** The directory name looks like part of the URL; App Router route groups are invisible in the actual path by design.
**How to avoid:** The real paths are `/matters/new`, `/matters`, `/matters/:id`, `/assessments`, `/assessments/:id` — confirmed by WINDOWS.md ledger entry #7, which records this exact defect being found and fixed in Phase 3.1 (`app/page.tsx`, `(legal)/assessments/page.tsx`, `intake-form.tsx`'s `router.push`). Any new link this phase adds (`/hr/matters` navigation from the intake confirmation page, breadcrumbs, etc.) must use the real, group-free path.
**Warning signs:** A link that 404s only when clicked live in a browser but never in a route-handler test (route tests bypass Next's real router entirely, per the ledger entry's own note) — the exact reason no test caught this the first time.

### Pitfall 2: Next.js dynamic-segment params arrive percent-encoded under Turbopack dev

**What goes wrong:** A `[id]` dynamic segment containing colons (this codebase's assessment/matter ids are not colon-joined for `Matter`, but `Assessment`/`AssessmentLine` ids are — `assessment:{matterId}:{packId}:{packVersion}:{timestamp}`) arrives percent-encoded and a raw lookup 404s.
**Why it happens:** WINDOWS.md ledger entry #8 documents this exact live failure, confirmed and fixed with `decodeURIComponent(id)` at four call sites in Phase 3.1/4.
**How to avoid:** `Matter.id` is a plain ULID with no special characters, so `/hr/matters/[id]` is very likely unaffected — but if any Phase 5 route ever threads a colon-bearing id (unlikely for HR-side routes, since HR never sees an `Assessment` id), apply `decodeURIComponent` at the boundary, matching the existing precedent.
**Warning signs:** A route that works in every `tests/routes/*.test.ts` test (which pass params directly, bypassing real URL decoding — same root cause as Pitfall 1) but 500s the first time it's driven from an actual browser link.

### Pitfall 3: `pnpm dev` / `next build` are known to fail on this build machine (two open WINDOWS.md entries)

**What goes wrong:** A plan assumes a live dev server or a production build is available to manually verify the new HR screens.
**Why it happens:** WINDOWS.md entries #3 and #4 (both still `open`) record that `@tailwindcss/postcss` is not registered (so `globals.css`'s `@theme` block is inert) and that registering it segfaults `pnpm dev` on this machine with `STATUS_ACCESS_VIOLATION`, isolated to Tailwind v4's native compiler (`@tailwindcss/oxide`) — a build-machine incompatibility, not a code defect, in the same class as the already-accepted `pnpm` 12.x `SIGILL` issue.
**How to avoid:** Plan verification the same way Phase 4's own phase-goal verification did — via the real route-handler test suite (`tests/routes/*.test.ts`, real `Request` objects through real handlers) and direct code reads, not a live dev-server click-through. Do not spend a plan task trying to "fix" the Tailwind native-binary crash; it is a recorded, accepted, open item, not this phase's job to resolve.
**Warning signs:** A plan task literally titled "manually verify in the browser" with no fallback — flag this at plan-review time.

### Pitfall 4: `StatusStrip`'s existing shape was built for a Phase-3.1-specific demo constraint, not AC-31's real field list

**What goes wrong:** Reusing `apps/web/src/ui/chrome/status-strip.tsx` as-is and declaring DISC-02/AC-31 satisfied.
**Why it happens:** The component's own header comment is explicit: its "Pack status" cell "must never receive the engine-invocation boundary's coerced copy" and "always renders in the warn treatment, never the ok/green one" — a hard constraint invented for Phase 3.1's specific need to disclose that the demo engine computes against an in-memory `ACTIVE`-coerced pack copy while the real pack is `DRAFT`. AC-31's actual text asks for "pack id, version, reviewer, reviewed date and review-due state" — a `reviewedOn` date and a `reviewDueOn`-derived colour state (current / due-within-30-days / stale), neither of which the current component renders as its own cell (it collapses everything into one "Pack status" string plus a disclosure sentence).
**How to avoid:** Extend `StatusStripProps` additively (add `reviewedOn`, `reviewDueState`) rather than repurposing the existing "Pack status" cell, so Phase 3.1's demo-specific disclosure sentence is preserved (it is still true and still needed) alongside the AC-31 fields this phase must add. `deriveEffectiveStatus`/`daysUntilReviewDue` (`@dsar/rulepacks/stale`) already compute everything the new cells need.
**Warning signs:** A plan or diff that deletes `PACK_STATUS_DISCLOSURE` or the warn-only rendering — that text is load-bearing for a already-shipped, tested Phase 3.1 guarantee and must not regress.

### Pitfall 5: `hrNote` (500-char limit) has no UI field anywhere — decide, don't silently drop

**What goes wrong:** BOUND-03 is read as "make sure the 300/500/200/1000 limits are enforced," and the 500 (`hrNote`) is ticked off because the *schema* enforces it, even though no form field lets HR type into it at all.
**Why it happens:** `ExpenseLineSchema.hrNote` is a real, frozen field (Phase 1) and `addExpenseLine`/`replaceExpenseLine` both hardcode `hrNote: null` today — there is no `<textarea name="hrNote">` anywhere in `expense-line-repeater.tsx`.
**How to avoid:** This is a genuine open question for planning (see Open Questions) rather than a research-decidable fact — PRD §10.2's row-field list does not name an "HR note" field explicitly, so it may be intentionally absent from v1's UI even though the schema carries the field for future use (§17's open-questions pattern). Flag it at plan time rather than assuming either "add a field" or "leave it null forever" without a decision.

### Pitfall 6: The stubbed-identity, real-authorization split means `/hr/matters` ownership scoping only means something once more than one real preparer identity exists

**What goes wrong:** `listMattersForPreparer`'s `createdBy.id === actor.user.id` filter is correct code but currently unobservable — the demo has exactly one `HR_PREPARER` identity (`DEMO_USERS.HR_PREPARER`, `apps/web/src/server/data/auth.ts:19-23`), so every matter in the store was created by the same actor and the filter is a no-op in practice.
**Why it happens:** Prototype framing (ACCESS-06) — identity is a stubbed, swappable provider seeded with test users, not a real multi-user directory.
**How to avoid:** Write the filter correctly anyway (it's the honest, forward-compatible implementation, and it costs nothing) and write its test with two distinct `DemoActor` values constructed inline (matching the existing precedent in `bulkAcceptLines`'s optional-pack-override tests) rather than relying on the single seeded `HR_PREPARER` to prove the filter works.

## Code Examples

### Reusing the currency-derivation pattern (already correct, cite for the plan)

```typescript
// Source: apps/web/src/ui/intake/intake-form.tsx:121-126 — currency is a
// pure function of jurisdiction, never independently editable, which is
// why AC-42's "currency mismatch" case is structurally unreachable through
// this UI (a defense stronger than form validation catching a bad input).
const currency: CurrencyCode = JURISDICTION_CURRENCY[matterDetails.jurisdictionCode];
```

### The existing 400-with-both-currencies-named server response (AC-42 layer already live)

```typescript
// Source: packages/schemas/src/matter.ts:45-54 (MatterSchema.superRefine)
// combined with apps/web/src/server/errors.ts:58-61 (ZodError → 400 with
// issues[]). No new work needed for the server-side half of AC-42/INTAKE-08
// — confirm with a route test that POSTing a mismatched currency returns
// 400 and the message names both codes, do not re-implement the check.
```

### The 30-day-warning / stale colour-state building block already exists

```typescript
// Source: packages/rulepacks/src/stale.ts:31-54 — reuse directly for the
// StatusStrip extension and for any /hr/matters advisory-deadline display.
export function deriveEffectiveStatus(pack: LoadableRulePack, now: string): RulePackStatus { /* ... */ }
export function daysUntilReviewDue(pack: LoadableRulePack, now: string): number { /* ... */ }
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `hrNote` field is intentionally absent from the v1 intake UI (PRD §10.2's row-field list does not name it) rather than a build gap | Common Pitfalls #5 | Low — if wrong, a plan simply adds one more repeater field; no architectural rework needed either way |
| A2 | `/hr/matters` (NAV-02) should filter by `Matter.createdBy.id`, treating "the preparer's own matters" as literally the creating user, not a team/department scope | Architectural Responsibility Map, Pattern 2 | Low-medium — if the product intent is "everyone in HR Shared Services sees every matter," the filter should be dropped or changed to a role-wide list; this is a one-line change either way, not a redesign |
| A3 | The personal-data pattern detector's three checks (long digit run, ID-shaped token, email) can be implemented with simple, hand-authored regexes rather than a library, and "long digit run" should NOT apply to `evidenceRef`/`vendorName` | Architecture Patterns Pattern 4 | Medium — an ill-tuned digit-run regex is explicitly called out by the PRD itself as a maddening false-positive risk on invoice numbers; needs product-owner sign-off on the exact patterns before AC-level test assertions are written |
| A4 | `StatusStrip`'s existing Phase-3.1 "Pack status" disclosure cell must be preserved (not replaced) alongside new AC-31 fields, since it discharges a real, still-true, already-tested guarantee | Common Pitfalls #4 | Medium — removing it would silently regress a shipped, tested Phase 3.1 behaviour (the demo-engine-coercion disclosure) that no Phase 5 requirement asks to remove |
| A5 | `statementVersion` can be a single exported integer constant in the codebase (bumped by a future edit whenever the capability-statement copy materially changes) rather than a database-backed, per-user acknowledgement record — consistent with the "no server-persisted state, browser-local acknowledgement" design Phase 3.1 already chose | Summary, Architectural Responsibility Map | Low — AC-30's `userId`/`acknowledgedAt` recording is written against a real user-account system PRD §9.2 assumes; this prototype has no accounts, so a literal reading of AC-30 is already partially unsatisfiable by design, same as `StatusStrip`'s existing approach |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. **Does `/hr/matters` (NAV-02) need to render an advisory deadline per matter?**
   - What we know: `computeAdvisoryDeadline`/`MatterRail`'s "Advisory only" container pattern already exists for the legal-review side (`apps/web/src/server/review-view.ts`, `apps/web/src/ui/review/matter-rail.tsx`), and ROADMAP's Phase 5 success criterion 5 assigns DISC-05 ("every rendered deadline carries Advisory") to this phase — but Phase 5's own requirement list (INTAKE-\*, NAV-02, BOUND-\*, DISC-01/02/03/05) has no explicit PRD citation describing an HR-facing deadline display; PRD §10.2/§10.4 don't mention one.
   - What's unclear: whether DISC-05 is assigned to Phase 5 because `/hr/matters` is expected to show a per-matter advisory response-due date (the natural fit), or because it's a defensive blanket assignment that turns out to have no HR-side surface to satisfy it against in this phase (in which case it is vacuously satisfied — "no deadline is rendered anywhere in `/hr/*`" — and the real discharge is Phase 6's legal-review screen, which already has it).
   - Recommendation: Confirm with the product owner at plan/discuss time. If `/hr/matters` does render a per-matter deadline, reuse `computeAdvisoryDeadline`'s logic (currently server-only, legal-review-scoped) by extracting it to a shared, non-server-only module both `/hr/matters` and the legal review page can import — do not duplicate the date arithmetic.

2. **Does the personal-data pattern detector need a server-side enforcement mirror, or is client-only sufficient?**
   - What we know: §12.1 says "a lightweight pattern check ... warns before submit" in the context of the intake form UI, and separately says `lawyerReason` "runs through the same pattern check on the review screen, not only on intake" — implying the check is meant to run wherever the field is edited, which for the API route (`POST /api/matters/:id/lines`) means a request could bypass client-side detection entirely (e.g., a direct API call, or a future non-browser client).
   - What's unclear: whether BOUND-04's "warns, and never blocks" is scoped to UI-only (a purely client-side affordance, since blocking is explicitly forbidden so there is nothing for the server to *enforce*) or whether the server should also compute the same detection and surface it back to the client (e.g., in the create/update response) so a non-browser caller sees the same warning.
   - Recommendation: Implement `detectLikelyPersonalData` as a plain function in `packages/schemas` (not `apps/web/src/ui`) precisely so it is trivially callable from both tiers later — but scope this phase's actual wiring to client-side-only (matching the PRD's "before submit" framing and the fact that BOUND-04 names no server-side assertion), and record the server-mirroring question as a candidate follow-up rather than in-scope now.

3. **What is the correct behaviour when jurisdiction selection resolves to `NO_EXPRESS_AUTHORITY`/`PROHIBITED` for a jurisdiction the demo has no real pack for (7 of 9 jurisdictions)?**
   - What we know: `matter-details-fields.tsx`'s own comment states every non-SG jurisdiction "resolves to the same 'no express authority' heads-up ... because this demo has no real pack data for them" — this is a Phase 3.1 demo simplification, not a designed behaviour.
   - What's unclear: whether Phase 5 is expected to make this jurisdiction-status lookup "real" (i.e., actually read each of the seven stub packs' own `feePosture`, which Phase 3 already authored per PACK-10) rather than hardcoding the fallback, given ROADMAP's Phase 5 success criterion 1 explicitly says "selecting a jurisdiction shows **that pack's status inline immediately**."
   - Recommendation: This is very likely in-scope — `buildIntakePackView()` (`apps/web/src/server/pack-view.ts`) currently hardcodes loading only the SG pack (`loadDemoPack()`); Phase 5 should extend it (or add a sibling function) to resolve the pack view per-jurisdiction from `@dsar/rulepacks`' loader for all nine, using each stub pack's real (correctly `NO_EXPRESS_AUTHORITY`-defaulted, per D-3's Phase-3 decision) posture rather than a client-side hardcoded fallback. Confirm this reading with the product owner before planning, since it is a meaningfully larger scope than "reuse the existing form."

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/test toolchain | ✓ | ≥20.9.0 per `package.json` engines `[VERIFIED: package.json:1-40]` | — |
| pnpm | Package manager | ✓ (11.27.0 pinned) | 11.27.0 `[VERIFIED: package.json:1-40]` — do not upgrade to 12.x (documented SIGILL crash) | — |
| `pnpm dev` / `next build` (live browser verification) | Manual click-through UAT | ✗ | — | Route-handler test suite (`tests/routes/*.test.ts`) + direct code review, per WINDOWS.md entries #3/#4 (open) and the precedent Phase 4's own phase-goal verification already used successfully |
| Docker / Postgres | N/A this phase | ✗ | — | Not needed — Phase 5 runs entirely against the existing in-memory repository behind the swappable interface; no database work is in scope |

**Missing dependencies with no fallback:** None — the one missing capability (a working live dev server) has an already-proven fallback verification method.

**Missing dependencies with fallback:** `pnpm dev`/`next build` (see above).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.0, `[VERIFIED: vitest.config.ts:1-134]` — root config using `test.projects` (not a separate `vitest.workspace.ts`, per that file's own comment confirming this against installed `vitest@5.0.0` type declarations) |
| Config file | `vitest.config.ts` (repo root) |
| Quick run command | `pnpm vitest run --project web --project routes --project boundary` (fastest relevant subset for this phase's UI/route work) |
| Full suite command | `pnpm test` (`vitest run`, all 9 projects) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INTAKE-01..07 | Existing intake form fields/behaviour | unit (component) | `pnpm vitest run --project web apps/web/src/ui/intake/*.test.tsx` | ✅ (`intake-form.test.tsx`, `expense-line-repeater.test.tsx` already exist) |
| INTAKE-08 (AC-42) | Currency mismatch blocked client + server | integration (route) | `pnpm vitest run --project routes tests/routes/intake.test.ts` | ✅ existing test file — extend, don't create |
| INTAKE-09 | Autosave every 10s with visible save state | unit (hook) | new `apps/web/src/ui/intake/use-draft-autosave.test.ts` | ❌ Wave 0 |
| NAV-02 | `/hr/matters` lists preparer's own matters | integration (route/page) | new `tests/routes/hr-matters-list.test.ts` | ❌ Wave 0 |
| BOUND-03 | Free-text limits + warnings, all four fields | unit (component + schema) | extend `expense-line-repeater.test.tsx`, `attestations-panel` tests | ⚠️ partial — component-level warning-text assertions don't exist yet |
| BOUND-04 | Pattern detector warns, never blocks | unit (pure function) | new `packages/schemas/src/personal-data-pattern.test.ts` | ❌ Wave 0 |
| DISC-01 (AC-30) | Capability statement gate + `statementVersion` re-show | unit (component) | extend `capability-statement.test.tsx` | ⚠️ partial — `statementVersion` behaviour not yet tested |
| DISC-02 (AC-31) | Status strip on every authenticated screen, correct fields | unit + integration (DOM query across routes) | extend `status-strip.test.tsx`; extend `tests/boundary/dom-denylist.test.ts`'s glob to assert strip presence | ⚠️ partial |
| DISC-03 (AC-32a) | No banned word in UI strings | lint/static | pre-existing pattern from Phase 2 (`packages/engine`'s own banned-word lint) — needs an equivalent scan over `apps/web`'s strings | ❌ Wave 0 if no i18n-strings-file convention exists yet in `apps/web` — confirm at plan time |
| DISC-05 (AC-15a) | Every rendered deadline has "Advisory" in its own container | unit (DOM query) | existing pattern in `apps/web/src/ui/review/matter-rail.tsx`'s own tests — extend to any new HR-side surface (see Open Question 1) | ⚠️ contingent on Open Question 1's answer |

### Sampling Rate

- **Per task commit:** `pnpm vitest run --project web --project routes --project schemas` (fast, covers the three affected projects)
- **Per wave merge:** `pnpm test` (full 9-project suite — currently 732/732 green per STATE.md)
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus a manual/scripted curl-driven walkthrough of `/matters/new` → `/matters` → `/matters/:id/submitted` (following the exact precedent WINDOWS.md entries #7/#8 used to catch and fix live-only bugs the route-test suite structurally cannot see)

### Wave 0 Gaps

- [ ] `apps/web/src/ui/intake/use-draft-autosave.test.ts` — covers INTAKE-09
- [ ] `tests/routes/hr-matters-list.test.ts` — covers NAV-02
- [ ] `packages/schemas/src/personal-data-pattern.test.ts` — covers BOUND-04
- [ ] A decision + (if needed) a new test file for DISC-03's "no banned word in UI strings" static check — confirm at plan time whether `apps/web` has (or needs) a centralized strings file, since the existing DISC-03/AC-32a precedent (`packages/engine`) lints source files directly rather than a dedicated i18n file

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (stubbed identity by design, ACCESS-06, prototype framing) | Cookie-based actor switch is explicitly not authentication — caption text already discloses this (`apps/web/src/ui/chrome/app-header.tsx:22-23`) |
| V3 Session Management | No | No sessions exist; the demo role cookie is not a session token |
| V4 Access Control | Yes | `requireRole()` as the first statement of every `src/server/data/*` function (Pattern 2 above) — this phase's new `listMattersForPreparer` must follow it |
| V5 Input Validation | Yes | zod schemas (`MatterSchema`, `ExpenseLineSchema`) at every write boundary — already the pattern; new work (pattern detector) is additive, not a replacement |
| V6 Cryptography | No | Not touched by this phase |
| V7 Error Handling and Logging | Yes (light) | `errorToResponse()`'s existing status-carrying-error convention — new routes/functions must throw the existing `ForbiddenError`/`NotFoundError`/`ConflictError`/`ValidationError` subclasses, never a bare `Error` with an assumed status |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on `/matters/:id` (any HR_PREPARER can view any matter's status by guessing/knowing another preparer's matter id) | Information Disclosure | Currently **not fully mitigated** — `getHrMatterStatus` checks role but not ownership (`apps/web/src/server/data/matters.ts:613-623`). Low real-world risk today (only one seeded `HR_PREPARER` identity exists), but `listMattersForPreparer`'s new ownership filter should not create a false impression that per-matter access is also ownership-scoped — flag this gap explicitly rather than silently leaving it inconsistent between the list view (scoped) and the detail view (not scoped) |
| Personal data typed into free-text fields despite the architectural boundary (§12.1's R9) | Information Disclosure | Length caps (already enforced server-side) + pattern-detector warning (this phase, client-side) + the deny-list for field *names* (already enforced, Phase 1, AC-06) — three independent, complementary layers, none of which alone is sufficient (the PRD's own framing) |
| Reflected/stored XSS via free-text fields rendered back to a user | Tampering | React's default JSX escaping already covers every existing render site (`{line.description}`, etc.) — no `dangerouslySetInnerHTML` exists anywhere in the reviewed files; keep it that way for any new rendering this phase adds (autosave-restored draft text, `/hr/matters` reference/status display) |
| A crafted `POST /api/matters` bypassing the UI's currency-locking to submit a mismatched currency | Tampering | Already mitigated server-side via `MatterSchema.superRefine` (Phase 1) — this phase should add a route test proving it, not re-implement it |

## Sources

### Primary (HIGH confidence — direct codebase reads this session)
- `apps/web/src/ui/intake/{intake-form,matter-details-fields,expense-line-repeater,attestations-panel,claim-footer}.tsx` — the existing, reusable intake form
- `apps/web/src/ui/capability/capability-statement.tsx`, `apps/web/src/ui/chrome/{status-strip,app-header,demo-banner}.tsx` — the existing, partially-wired disclosure components
- `apps/web/src/server/data/matters.ts`, `apps/web/src/server/data/auth.ts`, `apps/web/src/server/errors.ts`, `apps/web/src/server/pack-view.ts`, `apps/web/src/server/review-view.ts` — the existing server-side patterns to extend
- `packages/schemas/src/{constants,matter,expense-line,money}.ts` — the frozen limits, deny-list and currency-map this phase must reuse, not re-derive
- `packages/rulepacks/src/stale.ts` — the review-due/staleness derivation to reuse for `StatusStrip`
- `docs/PRD-dsar-fee-agent.md` §9 (risk disclosure), §10.1/10.2 (cross-cutting + intake UI spec), §12.1 (personal-data boundary), §13 (AC-15, AC-30, AC-31, AC-32, AC-42)
- `docs/dsar-fee-agent-mockup.html` lines 700-902 (Annex A's HR intake screen structure, including the shared `.strip` shell markup above the tab screens)
- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/WINDOWS.md` — phase scope, requirement text, and the project's own recorded defect history

### Secondary (MEDIUM confidence)
- None — no web search was needed; every finding in this document is grounded in a direct read of this repository's own code, tests, PRD or planning artifacts.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Existing-vs-new baseline (what Phase 3.1/4 already built): HIGH — established by direct file reads of every relevant module, not inference from summaries
- Net-new scope (autosave, pattern detector, `/hr/matters`, statementVersion): HIGH on *what* is needed (PRD-grounded), MEDIUM on *exact shape* (no existing precedent in this codebase for any of the three, so the code examples are proposed shapes, not verified-working code)
- Pitfalls: HIGH — every pitfall cited traces to a specific, already-resolved (or still-open) WINDOWS.md ledger entry or a direct code read, not a general Next.js caution

**Research date:** 2026-09-19
**Valid until:** Should be re-checked if Phase 3.2 (database boundary) lands before Phase 5 executes — swapping the in-memory repository for a Prisma-backed one is designed to be invisible to this phase's screens/data-layer functions (per Phase 3.1's own interface-purity guarantee), but any plan should confirm `memoryMatterRepository` is still the correct import at execution time.

## RESEARCH COMPLETE
