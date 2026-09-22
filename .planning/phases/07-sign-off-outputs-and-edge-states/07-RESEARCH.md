# Phase 7: Sign-off, Outputs and Edge States - Research

**Researched:** 2026-09-20
**Domain:** Server-side sign-off gating (Next.js App Router Route Handlers over an in-memory demo store), PDF generation (new `packages/documents` package), and requestor-notice text generation — all within an already-built TypeScript/Next.js/zod monorepo (Phases 1–6 complete).
**Confidence:** HIGH for the sign-off-gate and existing-mechanism findings (all verified by direct code read this session); MEDIUM for the PDF-generation stack findings (verified via `npm view` this session, cross-checked against 3+ web sources, but `gsd-tools.cjs` is unavailable in this worktree so the automated `package-legitimacy check` seam could not run — see Package Legitimacy Audit).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (ACCESS-04 / AC-03):** Keep the flat `LEGAL_REVIEWER` role as-is — do NOT add a jurisdiction-entitlement field to `UserRef`/`DemoActor`. ACCESS-04 is satisfied by the existing `requireRole(actor, "LEGAL_REVIEWER")` check. Test ACCESS-04's negative case the same way ACCESS-01/ACCESS-02 already do: an actor with a *different* role (e.g. `HR_PREPARER`) attempting sign-off, not a `LEGAL_REVIEWER` scoped to the wrong jurisdiction.
- **D-02 (PACK-08 / AC-41b):** Build the guard now. Call `packages/audit`'s existing memory-backed `PackLifecycleEventWriter` directly from a test to simulate "actor X activated rule-pack version Y", then assert that actor X's sign-off attempt on an assessment pinned to that version is blocked, naming the reason and pointing to another reviewer. Full end-to-end proof through a live `/admin/rulepacks` activation click stays blocked on Phase 3.2 (Docker). "Same session" is read as "same actor identity" given the stubbed-identity model — there is no separate session concept to build.
- **D-03 (DOC-02/DOC-03):** Defer real HK/SG notice authoring. Both real packs still carry the `UNAUTHORED` token in `requestorNoticeTemplate`. Build and prove the notice-generation mechanism against fixture/placeholder template text. Track real HK/SG notice-template authoring as a follow-up — do not invent jurisdiction-correct legal notice wording.
- **D-04 (DOC-01):** Internal record PDF is a dense data table, not a card-per-line mirror of the review screen. One row per assessment line — verdict, rule ID, basis, citation, disposition, lawyer's reason as columns — plus matter details, pack/engine version, matter flags and acknowledgements, and the sign-off block.

### Claude's Discretion

- Exact PDF page size, font choices, and column widths within the dense-table layout (D-04) — settled by 07-UI-SPEC.md: landscape, Helvetica (no `Font.register`), point-based spacing/typography scale (see below).
- Whether the fixture notice template (D-03) lives as a new committed test fixture or reuses an existing one — pick whichever avoids duplicating fixture-authoring effort already present in `packages/rulepacks/src/__fixtures__/`.
- Exact wording of PACK-08's "points to another reviewer" block message (AC-41b) — settled by 07-UI-SPEC.md's Copywriting Contract (see Code Examples below); follow `packages/engine/src/messages.ts` precedent: no banned words, specific and actionable.

### Deferred Ideas (OUT OF SCOPE)

- **Real HK/SG requestor-notice legal content** — tracked as a follow-up alongside the remaining PACK-09 category authoring. Not this phase's job to author.
- **Jurisdiction-scoped `LEGAL_REVIEWER` entitlement** — explicitly not built now (D-01).
- **Correction re-review after `SUPERSEDED`** — `.planning/STATE.md`'s standing blocker (checkpoint 04-05-CP, Option A): PRD §5's state table gives `SUPERSEDED` no outgoing transition. Needs a product-owner decision before any phase builds it. Not this phase's job.
- **`/admin/rulepacks` activation screen (PACK-06/PACK-07)** — stays with Phase 3.2, still blocked on Docker.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SIGNOFF-01 | Sign-off with any line `PENDING` returns 409 and names the pending lines (AC-16) | **Gap found**: `signOff()` currently throws `ValidationError` (400) for this case, not `ConflictError` (409), and names no lines. See Common Pitfalls #1 and Code Examples #1. |
| SIGNOFF-02 | Sign-off blocked until every acknowledgement-requiring matter flag is in `acknowledgedFlags` (AC-24) | Mechanism already built and working (`signOff()` + `checkFlagsAcknowledged` guard); only the *status code* is questionable — currently 400, arguably should be 409 for consistency with SIGNOFF-01/the SIGN_OFF guard row. Flagged as an Open Question. |
| SIGNOFF-03 | Attestation recorded verbatim by version, extended wording where `STALE` (§9.5) | Already fully built (`renderAttestation()`, `ATTESTATION_TEMPLATE_VERSION`). Genuinely new sub-piece: the full-width red "stale pack" banner on the *review screen itself* (AC-39's other half) — copy is in 07-UI-SPEC.md. |
| SIGNOFF-04 | Sign-off records lawyer, name, qualification, timestamp, final amount, pinned pack version (§6.4) | Already fully built (`SignOffSchema`, `signOff()`). No further work needed beyond the status-code fix above. |
| SIGNOFF-05 | HR sees signed-off figure, reviewing lawyer, allowed+struck items with basis (§10.4) | Already fully built (`ResultView`, wired in `apps/web/app/hr/matters/[id]/page.tsx`). Verify against real pack content only. |
| SIGNOFF-06 | HR can mark notice sent, date only, "tool emails nobody" note (§10.4, NS-3) | Already fully built (`markNoticeSent`, `NoticeBlock`). Verify against real pack content only. |
| DOC-01 | Internal fee assessment record generates as PDF, dense table (AC-18) | **Net-new.** No `packages/documents` package exists. See Architecture Patterns and Code Examples. |
| DOC-02 | Requestor notice as copy-to-clipboard text, DRAFT watermark until sent (§10.4/§10.5) | Mechanism already built (`buildNoticeDraft()`, `NoticeBlock`). Watermark/sent-state need confirming against `NoticeBlock`'s existing implementation. |
| DOC-03 | Notice contains no rule ID/citation/basis/AI mention, asserted by regex (AC-17) | Mechanism already structurally safe (`buildNoticeDraft()` only ever touches `template`/`amount`/`allowedLines`/`matterReference` — never a rule ID or citation). Needs the actual AC-17 regex test written. |
| DOC-04 | Zero-allowable produces valid "no fee charged" notice, not an error (AC-14) | Already handled: `notice-draft.ts`'s `itemisation()` returns `"This covers no chargeable items — no fee is charged."` when `allowedLines` is empty. Needs an explicit test against a real `PROHIBITED`/`NO_EXPRESS_AUTHORITY` fixture through the full route stack. |
| DOC-05 | Every PDF page carries the disclosure footer (§10.5) | **Net-new**, part of the PDF package. Footer text is PRD §10.5(a) verbatim; template values come from `pack.packId`/`pack.version`/`ENGINE_VERSION`/`signOff.lawyerName`/`signOff.qualification`/`signOff.signedAt`. |
| ACCESS-04 | Sign-off by a user without `LEGAL_REVIEWER` rejected (AC-03) | **Effectively already covered** — `signOff()` calls `requireRole(actor, "LEGAL_REVIEWER")` as its first statement, and `tests/routes/signoff.test.ts` already has an HR-cookie-refused-403 test. Per D-01, this discharges ACCESS-04 as scoped; mark it as complete once confirmed, no new production code needed. |
| ACCESS-05 | `lawyerReason` never in any `/hr/*` response or HR document (AC-04) | Already structurally enforced: `ResultViewLine` has no field for it, `result-view.tsx` never reads `line.lawyerReason`. **New this phase**: the "Download internal record (PDF)" trigger must be placed ONLY on `/legal/*` routes (never `/hr/*`) since the PDF DOES carry `lawyerReason` — see 07-UI-SPEC.md's placement rule. |
| PACK-08 | Activator cannot sign off own activated pack version, same session (AC-41b) | **Net-new guard.** Needs `memoryPackLifecycleEventWriter.listByPack(rulePackId, rulePackVersion)` queried inside `signOff()`, comparing the latest `PACK_ACTIVATED` event's `actor.id` to the current actor's `user.id`. See Code Examples #2. |
| DISC-06 | Every row of PRD §10.7's edge-state table behaves exactly as specified | Cross-cutting verification requirement — see Architecture Patterns' "§10.7 row-by-row" table below. Most rows are already built in earlier phases; this phase's own job is proving them, not building new ones (per Phase Boundary in 07-CONTEXT.md), except the "Zero allowable" row which needs the DOC-04 test named above. |

</phase_requirements>

## Summary

Phase 7 is mostly a **gap-closing and proving phase**, not a greenfield build. Direct reads of the codebase (this session) confirm 07-UI-SPEC.md's own scope note: the sign-off panel, the HR result screen, the notice-draft mechanism, and the state-machine transitions for `SIGN_OFF`/`MARK_SENT` were already built in Phases 3.1/4/6. What remains genuinely undone breaks into three buckets:

1. **A real, verified bug in `signOff()`'s status codes.** `assessments.ts`'s `signOff()` throws `ValidationError` (HTTP 400) for both the "lines still PENDING" case and the "flags not acknowledged" case — but AC-16 explicitly requires **409** for the PENDING case, and `tests/routes/signoff.test.ts:183` currently asserts `400`, which must change to `409` as part of implementing SIGNOFF-01 correctly. This is not a new feature; it's fixing an existing, tested-wrong behavior. `SIGNOFF-01` also requires naming which lines are pending (by sequence number, via `ExpenseLine.seq`), which nothing today does — the current message is a bare count ("Every line must be dispositioned before sign-off").

2. **A genuinely new guard (PACK-08 / AC-41b).** No code anywhere checks whether the actor about to sign off is the same actor who last activated the assessment's pinned pack version. The mechanism to build this already exists (`packages/audit`'s `memoryPackLifecycleEventWriter`), and per D-02 it's testable today via a synthetic fixture — no admin UI is needed.

3. **A genuinely new package: PDF generation (`packages/documents`).** No PDF generation exists anywhere in this codebase. `.claude/CLAUDE.md`'s Q5 decision locks `@react-pdf/renderer` (verified via `npm view` this session: current version 4.9.0, ~8 years old, ~2.2M weekly downloads, MIT, no postinstall script, github.com/diegomura/react-pdf). **A real, currently-open (Jan 2026) upstream bug** (diegomura/react-pdf#3285) affects exactly this project's monorepo shape — `@react-pdf/renderer` imported through an external workspace package from a Next.js App Router Route Handler can throw `TypeError: Cannot read properties of undefined (reading 'S')`. This is the single highest-risk technical unknown in this phase and should be de-risked with a Wave 0 smoke test before the full dense-table layout is built. See Common Pitfalls #4.

**Primary recommendation:** Treat this phase as three independent, separately-committable work items — (a) fix `signOff()`'s status codes and add line-naming, (b) add the PACK-08 guard, (c) build `packages/documents` — landing (a) and (b) first since they are low-risk, then de-risking (c) with an early cross-package `renderToBuffer()` smoke test before investing in the dense-table layout.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sign-off precondition gating (SIGNOFF-01/02, PACK-08) | API / Backend (`apps/web/src/server/data/assessments.ts`) | Database / Storage (guard reads `packages/audit`'s in-memory store) | State-transition guards are a backend responsibility per PRD §5; `packages/workflow`'s guard table already owns the structural half, `signOff()` owns the message-naming half (frozen `GuardInput` cannot carry per-line identifiers). |
| Internal record PDF generation (DOC-01/DOC-05) | API / Backend (new `packages/documents` + a new Route Handler) | — | A PDF is generated server-side, on request, from already-fetched `Assessment`/`Matter`/`RulePack` data — no client-side PDF library, no browser rendering. |
| Requestor notice text (DOC-02/03/04) | API / Backend (`apps/web/src/domain/notice-draft.ts`, already built) | Frontend Server / SSR (`NoticeBlock` renders it) | Pure text assembly happens server-side; the copy-to-clipboard interaction is a thin client component with no server logic of its own. |
| HR result display (SIGNOFF-05/06) | Frontend Server / SSR (`apps/web/app/hr/matters/[id]/page.tsx`) | API / Backend (`getSignedOffAssessmentForHr`, `markNoticeSent`) | Already built; this phase only re-verifies against real pack content. |
| "Download internal record" placement (ACCESS-05) | Frontend Server / SSR (`/legal/assessments/{id}` only) | API / Backend (the new PDF route must itself `requireRole(actor, "LEGAL_REVIEWER")`, never `HR_PREPARER`) | Privileged content (`lawyerReason`) must never be reachable from an `/hr/*` route OR from an unauthenticated/wrong-role request to the PDF endpoint directly — both the page composition AND the route's own role check matter (defense in depth, matching this project's standing "role check lives in the data layer, never only in the page" convention). |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@react-pdf/renderer` | 4.9.0 [VERIFIED: npm registry — `npm view @react-pdf/renderer version`, run this session] | Internal fee assessment record PDF generation (DOC-01/DOC-05) | Already locked in `.claude/CLAUDE.md`'s Q5 stack decision (a prior research phase's output, not a fresh discovery this session); confirmed still current and maintained: first published 2018-08-04 [VERIFIED: npm registry — `npm view @react-pdf/renderer time.created`], ~2.2M weekly downloads [CITED: npmtrends.com/socket.dev via WebSearch], MIT license [VERIFIED: npm registry — `npm view @react-pdf/renderer license`], repo `github.com/diegomura/react-pdf` [VERIFIED: npm registry — `npm view @react-pdf/renderer repository.url`], peer dependency `react: ^16.8.0 \|\| ^17.0.0 \|\| ^18.0.0 \|\| ^19.0.0` [VERIFIED: npm registry — `npm view @react-pdf/renderer peerDependencies`], covering this repo's installed `react@19.3.0` [VERIFIED: apps/web/package.json:18 — `"react": "19.3.0",`]. |

### Package Legitimacy Audit

> `gsd-tools.cjs` is not present anywhere in this worktree (`find . -iname "gsd-tools.cjs"` returns nothing) — the same recurring gap recorded in every prior phase's STATE.md entry since Phase 3. The automated `gsd_run query package-legitimacy check` seam could not be invoked. The table below substitutes the manual `npm view` verification this project has used in every prior phase for the same reason.

| Package | Registry | Age | Downloads | Source Repo | Postinstall script | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------------------|---------|-------------|
| `@react-pdf/renderer` | npm | ~8 years (first published 2018-08-04) | ~2.2M/week | `github.com/diegomura/react-pdf` | none found (`npm view @react-pdf/renderer scripts.postinstall` returns empty) | OK — long-established, high-download, MIT, no supply-chain red flags | Approved |

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** none.

*The package name `@react-pdf/renderer` itself is not a fresh discovery from this session's WebSearch — it was already locked in by `.claude/CLAUDE.md`'s own Q5 stack-decision research (a prior, already-approved research phase). This session independently re-verified its registry facts (version, age, downloads, license, repo, postinstall) via `npm view`, which is an authoritative source for those specific facts. Recommend the planner insert a `checkpoint:human-verify` before `pnpm add @react-pdf/renderer` regardless, consistent with this project's own established pattern for every prior new-dependency addition (e.g. the `ulid` package's Task 0 checkpoint in Phase 03.1).*

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@react-pdf/renderer` | `pdfkit` | Lower-level, more code, more predictable pagination control — already recorded as the documented fallback in `.claude/CLAUDE.md` if react-pdf's table support proves too limited. Given the open monorepo bug (#3285) found this session, this fallback is now more concretely relevant than the original research assumed — see Common Pitfalls #4. |
| `@react-pdf/renderer` | Puppeteer/Playwright print-to-PDF | Already rejected in `.claude/CLAUDE.md` — ~50MB Chromium dependency, serverless-hostile, disproportionate for a tabular document. |

**Installation:**
```bash
pnpm add @react-pdf/renderer --filter @dsar/documents
```
(assuming the new package is named `@dsar/documents`, matching the `@dsar/*` naming convention every other package in this monorepo already uses — `@dsar/engine`, `@dsar/rulepacks`, `@dsar/workflow`, `@dsar/audit`, `@dsar/schemas`.)

## Architecture Patterns

### System Architecture Diagram

```
                         LEGAL REVIEWER (browser)
                                  │
                                  ▼
            GET /legal/assessments/{id}  (existing, unchanged)
                                  │
                    ┌─────────────┴─────────────┐
                    │   signOff() precondition   │
                    │   chain (assessments.ts)   │
                    │  1. requireRole            │
                    │  2. matter in LEGAL_REVIEW │
                    │  3. NEW: no PENDING lines, │
                    │     name them (409)        │
                    │  4. NEW: flags acked (409) │
                    │  5. NEW: PACK-08 guard —   │
                    │     query packages/audit's │
                    │     PackLifecycleEventWriter│
                    │     for this pinned pack   │
                    │     version's last activator│
                    │  6. attestation/qualif.    │
                    │  7. evaluateTransition()   │
                    │     (packages/workflow)    │
                    └─────────────┬───────────────┘
                                  │ writes SignOff, finalAmount,
                                  │ matter.status = SIGNED_OFF
                                  ▼
                    ┌─────────────────────────────┐
                    │  NEW: GET /api/assessments/  │
                    │  {id}/internal-record.pdf    │
                    │  (LEGAL_REVIEWER only)       │
                    │  packages/documents builds   │
                    │  the row/section data model, │
                    │  renders via @react-pdf/     │
                    │  renderer, returns a PDF     │
                    │  Response                    │
                    └─────────────────────────────┘
                                  │
                                  ▼
                     "Download internal record (PDF)"
                     — /legal/* ONLY, never /hr/*

                                  │
                  ┌───────────────┴────────────────┐
                  ▼                                 ▼
     HR_PREPARER reads /hr/matters/{id}    (existing, unchanged)
     getSignedOffAssessmentForHr()
     → ResultView (figure, lawyer, itemisation
       — struck items WITH basis, never lawyerReason)
     → buildNoticeDraft() (existing, unchanged)
       → NoticeBlock (copy-to-clipboard, DRAFT watermark)
     → "Mark notice sent" → markNoticeSent()
       → MARK_SENT transition → matter.status = CLOSED
```

### PRD §10.7 row-by-row — what this phase must PROVE, not build

| §10.7 Row | Where it's actually implemented | This phase's job |
|---|---|---|
| No pack for jurisdiction | Phase 5 (`jurisdiction-packs.ts`, intake) | Verify unchanged — not this phase's code |
| Pack `STALE` | Guard (`checkPackUsable`) blocks new matters; `signOff()` already computes `packIsStale` for the attestation text extension | **Genuinely missing piece**: the full-width RED banner on the review screen itself (07-UI-SPEC.md's "Stale-pack review notice", AC-39's in-flight-review half) — `packIsStale` is computed but never rendered as a banner today |
| Pack activated mid-review | Phase 6 (`RecomputeConfirm`, `shouldRenderRecomputeBanner`) | Verify unchanged |
| Engine error | Phase 4 (`submitForAssessment` rollback to `DRAFT`) | Verify unchanged |
| LLM unavailable | Phase 8 (not built yet — `packages/agent` doesn't exist) | Not testable this phase; template-text fallback path already exists structurally (`notice-draft.ts`'s UNAUTHORED handling is the closest analog) |
| Zero allowable | `notice-draft.ts`'s `itemisation()` already returns the correct sentence when `allowedLines` is empty | **This phase's job**: write the DOC-04 test proving this through the full route stack against a real `PROHIBITED`/`NO_EXPRESS_AUTHORITY`-postured matter, and confirm `ResultView`/PDF both render `SGD 0.00` as an ordinary headline, never an error state (per `result-view.tsx`'s own header comment: "A zero fee renders with the same headline element and class as any other figure") |
| Currency mismatch | Phase 5 (intake) + Phase 1/2 (engine precondition) | Verify unchanged |

### Recommended Project Structure (new package only)

```
packages/documents/
├── package.json            # "@dsar/documents", exports "./*": "./src/*.ts"
├── tsconfig.json            # extends ../../tsconfig.base.json, composite:true
└── src/
    ├── internal-record-view.ts      # PURE data-shaping: Assessment/Matter/
    │                                 # RulePack/SignOff -> a plain row/section
    │                                 # object. No React import. Unit-testable
    │                                 # exactly like review-tallies.ts/notice-draft.ts.
    ├── internal-record-view.test.ts
    ├── internal-record-document.tsx  # The @react-pdf/renderer <Document> JSX
    │                                 # tree, consuming ONLY the plain object
    │                                 # internal-record-view.ts produces.
    └── internal-record-document.test.tsx  # Smoke test: renders without
                                             # throwing, produces a non-empty
                                             # buffer, footer text present on
                                             # page 2+ of a multi-page fixture.
```

Also required (NOT inside `packages/documents`):
```
apps/web/app/api/assessments/[id]/internal-record/route.ts   # NEW Route Handler
                                                                # GET, requireRole LEGAL_REVIEWER
```

Plus two small, easily-missed scaffold edits — see Common Pitfalls #5 and #6.

### Pattern 1: Pure data-shaping module, separate from the JSX renderer

**What:** Exactly the same split this codebase already uses for `notice-draft.ts` (pure text assembly) vs. `NoticeBlock` (the client component that renders it) and `review-tallies.ts` (pure arithmetic) vs. `SignOffPanel` (the component that displays it). Apply the identical split to the PDF: one pure function `buildInternalRecordView(assessment, matter, pack, expenseLines): InternalRecordView` that returns a plain, deeply-comparable object (no React nodes), and a separate `<InternalRecordDocument view={...} />` component that is the only thing importing `@react-pdf/renderer`'s JSX primitives.

**When to use:** Always, for this PDF. It is the only way to unit-test DOC-01's field list (every line's verdict/rule/basis/citation/disposition/lawyer's-reason, matter flags+acknowledgements, sign-off block) without instantiating `@react-pdf/renderer` at all — matching this project's own established "pure module + thin renderer" convention and sidestepping most of the monorepo-import risk in Common Pitfalls #4 (the pure module has zero exposure to the bug; only the thin JSX layer does).

**Example (shape only, not literal code from this repo — this pattern does not exist yet):**
```typescript
// packages/documents/src/internal-record-view.ts
export interface InternalRecordLineRow {
  seq: number;
  categoryLabel: string;
  verdict: Verdict;
  ruleId: string;
  basis: string;
  citation: string;    // pre-formatted "instrument s.provision"
  disposition: Disposition;
  claimedAmount: Minor;
  lawyerAmount: Minor | null;
  lawyerReason: string; // "—" em dash when absent (non-FLAG ACCEPTED line)
}

export interface InternalRecordView {
  matterReference: string;
  jurisdictionName: string;
  packId: string;
  packVersion: string;
  engineVersion: string;
  lines: InternalRecordLineRow[];
  flags: { message: string; acknowledgedBy: string | null; acknowledgedAt: string | null }[];
  signOff: { lawyerName: string; qualification: string; signedAt: string; finalAmount: Minor; attestationText: string };
  footer: { packId: string; packVersion: string; engineVersion: string; lawyerName: string; qualification: string; date: string };
}
```

### Pattern 2: The two-check split for PACK-08 (mirrors this file's own precedent)

`signOff()` already has a precedent for "a specific, human-readable early refusal, backed by a second STRUCTURAL guard" (its own comment at `apps/web/src/server/data/assessments.ts:474-477`: *"The guard is a second, STRUCTURAL check — every refusal above stays exactly where it is and in the same order... This does not replace them."*). PACK-08 should follow the same shape: an early, specific check inside `signOff()` (querying `memoryPackLifecycleEventWriter`) that throws with the exact UI-SPEC copy, rather than trying to thread pack-activation-actor data through the frozen 11-member `GuardInput` (`packages/schemas/src/guard-input.ts:27-43`) — which structurally cannot carry it without an intentional freeze escalation this phase's own CONTEXT.md does not authorize.

### Anti-Patterns to Avoid

- **Widening `GuardInput` to carry pending-line identifiers or pack-activation-actor data:** `GuardInput` is deliberately a hand-authored, literal 11-member type (`packages/schemas/src/guard-input.ts:1-10`'s own header: *"never derived via Omit\<Matter, ...\> or Pick\<Matter, ...\>... so a guard function reading a matter-level advisory deadline field is a compile error"*). SIGNOFF-01's line-naming and PACK-08's activator-identity check both belong in `signOff()` itself (which already has the full `Assessment`/actor context), not in the guard.
- **Re-deriving the final-amount or attestation logic inside `packages/documents`:** the PDF must read `assessment.signOff.finalAmount` and the attestation text as ALREADY COMPUTED and stored by `signOff()` — never recompute either independently. `signOff()`'s own comment is explicit that `computeFinalAmount` is "the only module in the codebase that writes `finalAmount`" (`apps/web/src/server/data/assessments.ts:440-445`).
- **Calling `@react-pdf/renderer`'s `renderToBuffer`/render functions with a fresh `Date.now()` or `new Date()` read inside the JSX tree:** every date/figure in the PDF must come from the already-persisted `Assessment`/`SignOff` record, both for determinism/testability and because the record must be reproducible byte-for-byte from the same input (matching this codebase's existing "the engine reads no clock outside an injected `now`" discipline, extended by analogy).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF page layout, pagination, font embedding | A manual PDF byte-stream writer, or a canvas-based screenshot pipeline | `@react-pdf/renderer`'s `<Document>`/`<Page>`/`<View>`/`<Text>` primitives, already locked in by `.claude/CLAUDE.md` Q5 | Multi-page pagination with a repeating header/footer band is exactly what `fixed` props and the library's own layout engine solve; a hand-rolled writer would need to reimplement text wrapping, page-break logic, and font metrics from scratch |
| Extracting rendered PDF text for test assertions | Parsing the generated PDF binary (e.g. via a PDF-text-extraction library) to assert footer/column content in tests | Test the pure `buildInternalRecordView()` data-shaping function directly (Pattern 1) for all content assertions; reserve a thin smoke test (renders without throwing, buffer non-empty) for the actual `<Document>` JSX layer | PDF binary parsing is fragile, slow, and adds a second dependency purely for testing; this codebase's own established convention (`notice-draft.ts`, `review-tallies.ts`, `attestation.ts`) is "pure function does the assembly, is what tests assert against" |
| "Which actor last activated this pack version" | A bespoke query against `AuditEvent`'s matter-scoped stream, or a new field bolted onto `RulePack` | `memoryPackLifecycleEventWriter.listByPack(packId, version)` (`packages/audit/src/memory/pack-lifecycle-event-writer.ts`), already built in Phase 4 for exactly this purpose (D-21's separate pack-lifecycle stream) | Building a second, parallel way to answer "who last touched this pack version" would fork provenance data that already has one canonical writer |

**Key insight:** every "Don't Hand-Roll" item above already has a working, tested precedent somewhere in this codebase (Phases 1–6). The discipline this phase most needs is *reuse*, not invention — the CONTEXT.md decisions (D-01 through D-04) all point the same direction: build the smallest new surface that closes the actual gap, and lean on what Phases 3.1/4/6 already proved.

## Common Pitfalls

### Pitfall 1: `signOff()`'s PENDING-lines and flag-ack checks throw the WRONG status code today

**What goes wrong:** AC-16 is explicit: `POST /assessments/{id}/signoff` with any line in `PENDING` **returns 409** [VERIFIED: docs/PRD-dsar-fee-agent.md:903 — "`POST /assessments/{id}/signoff` with any line in `PENDING` returns 409 and names the pending lines."]. The current code throws `ValidationError`, whose `status` field is `400` [VERIFIED: apps/web/src/server/errors.ts:37-43 — `export class ValidationError extends Error {\n  readonly status = 400;`], at `apps/web/src/server/data/assessments.ts:412-414` [VERIFIED: apps/web/src/server/data/assessments.ts:412-414 — `if (assessment.lines.some((line) => line.disposition === "PENDING")) {\n    throw new ValidationError("Every line must be dispositioned before sign-off");\n  }`]. The existing test locks in the wrong behavior: `tests/routes/signoff.test.ts:183` [VERIFIED: tests/routes/signoff.test.ts:183 — `expect(response.status).toBe(400);`] inside the test titled "sign-off with any line still pending is refused" (line 176).

**Why it happens:** The early check predates AC-16 being enforced end-to-end (it was written to give the sign-off panel a specific, human-readable message, ahead of the guard-table's own `checkNoLinesPending` — see `packages/workflow/src/guards.ts:108-117`, which already returns the right *kind* of refusal, a `GuardResult` consumed via `ConflictError` at `apps/web/src/server/data/assessments.ts:489-491`, but is never reached because the early check throws first).

**How to avoid:** Change `ValidationError` to `ConflictError` for the PENDING-lines branch, and extend the message to name the actual pending lines (by `ExpenseLine.seq`, via `memoryMatterRepository.listExpenseLines(matter.id)` — already called later in the same function at line 478, so this needs reordering or a second lookup). Update `tests/routes/signoff.test.ts:183`'s assertion from `400` to `409` as part of the same change — this is an intentional, documented correction of a previously-wrong test, matching this project's own precedent (e.g. Phase 04 P05's SUPERSEDED-related test updates, STATE.md).

**Warning signs:** Any new SIGNOFF-01 test that asserts `409` will fail against today's code with `400` — do not "fix the test to match the code"; the PRD is authoritative (CLAUDE.md: "PRD is the source of truth").

### Pitfall 2: The flag-acknowledgement check has the identical status-code question, but AC-24 doesn't name a code

**What goes wrong:** `apps/web/src/server/data/assessments.ts:416-422` throws `ValidationError` (400) when a required flag isn't acknowledged, same as Pitfall 1. AC-24's text [VERIFIED: docs/PRD-dsar-fee-agent.md:911] does not specify an HTTP status. But it is the *same guard-table row* (`SIGN_OFF`) as the PENDING-lines check, and the guard itself (`checkFlagsAcknowledged`, `packages/workflow/src/guards.ts:92-106`) already returns a `GuardResult` that, if reached, would surface as `ConflictError` (409) via the same code path as Pitfall 1.

**Why it happens:** Same root cause as Pitfall 1 — an early, human-readable check that fires before the guard is ever consulted.

**How to avoid:** For consistency (both are preconditions on the identical state transition, and a caller should not need to remember "PENDING is 409 but flags are 400"), recommend changing this to `ConflictError` too. Flagged as an Open Question below since the PRD does not force this reading as unambiguously as it forces Pitfall 1.

**Warning signs:** A planner who "fixes" only the PENDING case and leaves this one at 400 creates an inconsistent API surface for two preconditions on the same transition.

### Pitfall 3: Only ONE `LEGAL_REVIEWER` demo persona exists — PACK-08's test design must account for this

**What goes wrong:** `apps/web/src/server/data/auth.ts:44-48` [VERIFIED: apps/web/src/server/data/auth.ts:44-48 — `export const DEMO_USERS: Record<"HR_PREPARER" | "LEGAL_REVIEWER" | "DPO_ADMIN", DemoActor> = {`] defines exactly one `LEGAL_REVIEWER` (Marcus Tan). A test that tries to prove PACK-08's *positive* case (activator IS blocked) by signing in as the real demo `LEGAL_REVIEWER` cookie and a *negative* case (a different reviewer is NOT blocked) using a second real demo persona cannot work — there is no second one.

**Why it happens:** D-01's own rationale (07-CONTEXT.md) already names this exact limitation for ACCESS-04's jurisdiction scoping; it applies identically here.

**How to avoid:** Per D-02, write the `PackLifecycleEvent` fixture directly via `memoryPackLifecycleEventWriter.append(...)` (bypassing any UI/role check on that writer — it has none) with an `actor` field that EQUALS `DEMO_USERS.LEGAL_REVIEWER.user` for the positive (blocked) test, and an arbitrary distinct `UserRef` (any well-formed fixture user, not a real demo persona) for the negative (not-blocked) test. Sign-off itself is still attempted through the real `LEGAL_REVIEWER` cookie in both cases — only the *pack-activation event's* actor varies.

**Warning signs:** A test that tries to instantiate a second `DemoActor` with role `LEGAL_REVIEWER` by hand, outside `DEMO_USERS`, is fighting the auth module's own closed set unnecessarily — the fixture only needs a `UserRef`, not a second full `DemoActor`.

### Pitfall 4: `@react-pdf/renderer` has a real, currently-open (Jan 2026) bug for exactly this monorepo shape

**What goes wrong:** GitHub issue `diegomura/react-pdf#3285` [CITED: github.com/diegomura/react-pdf/issues/3285, filed 2026-01-23], titled "`@react-pdf/renderer` crashes when used via external package in Next.js App Router (monorepo)", reports `TypeError: Cannot read properties of undefined (reading 'S')` thrown from `renderToStream`/`renderToBuffer` **specifically** when `@react-pdf/renderer` is imported through an external workspace package rather than installed directly in the Next.js app — the reporter confirms identical JSX/runtime code works when `@react-pdf/renderer` is a direct dependency of the app itself. As of this research (2026-09-20), the issue has **no confirmed resolution or maintainer response** [CITED: github.com/diegomura/react-pdf/issues/3285]. This is exactly this phase's planned architecture: `packages/documents` (a workspace package) rendered from `apps/web`'s Route Handler.

**Why it happens:** Suspected root cause per the issue thread is duplicate/mismatched React reconciler instances across package boundaries in a monorepo, or React element identity assumptions inside `@react-pdf/renderer` breaking under Next.js's RSC bundling. Not confirmed by the maintainers.

**How to avoid:**
1. **De-risk first, build second.** Before writing the full dense-table layout, write the smallest possible smoke test: a trivial `<Document><Page><Text>x</Text></Page></Document>` component inside `packages/documents`, rendered via `renderToBuffer()` from an `apps/web` Route Handler (not from a Vitest unit test alone — the bug is reported specifically under Next.js's bundler, so a Vitest-only smoke test may not reproduce it). If it throws, this confirms the bug applies here.
2. **If it reproduces**, the safest fix given an unresolved upstream issue is to keep `packages/documents` as the PURE data-shaping layer only (Pattern 1 above), and move the actual `@react-pdf/renderer` JSX tree + `renderToBuffer()` call directly into `apps/web` (e.g. `apps/web/src/server/documents/internal-record-pdf.tsx`), which then imports `@react-pdf/renderer` as `apps/web`'s own **direct** dependency (not solely `packages/documents`'s). This keeps `.claude/CLAUDE.md`'s package-boundary intent mostly intact (the pure logic still lives in `packages/documents`) while sidestepping the specific "external package" failure mode the open issue describes.
3. Also check `next.config.ts`/`next.config.js` for `serverExternalPackages` (the current Next.js 16 name for the former `experimental.serverComponentsExternalPackages`) — some reports found adding `@react-pdf/renderer` there resolved an earlier (pre-14.1.1), related but distinct crash [CITED: react-pdf.org/compatibility, via WebSearch this session]. Confirm the current Next.js 16 config key name against the installed version's docs before using it (this project's own `.claude/CLAUDE.md` Vitest note already flags that config-surface names move between minors and must be checked at scaffold time).

**Warning signs:** `renderToBuffer`/`renderToStream` throwing `TypeError: Cannot read properties of undefined (reading 'S')` (or any similarly opaque minified-property-access error) specifically when called from a Route Handler but not from a standalone Node script.

### Pitfall 5: A new package that isn't added to `vitest.config.ts`'s `projects` array silently never runs

**What goes wrong:** `vitest.config.ts`'s root config declares one `projects` entry per existing package (`schemas`, `engine`, `rulepacks`, `workflow`, `audit`, plus `routes`/`boundary`/`db`/`toolchain`/`web`) [VERIFIED: vitest.config.ts — read in full this session, projects array enumerated]. There is currently **no** `documents` entry. A `packages/documents/src/*.test.ts` file will simply never be picked up by `pnpm test` unless a new project entry is added.

**Why it happens:** Vitest 5's `test.projects` field is an explicit allowlist, not a glob over every workspace package.

**How to avoid:** Add a new project block for `documents` (plain `node` environment for `internal-record-view.test.ts`, but the `internal-record-document.test.tsx` file needs the same `oxc: { jsx: { runtime: "automatic", importSource: "react" } }` override the `web`/`routes`/`boundary` projects already carry, per Common Pitfall 6).

### Pitfall 6: PDF JSX test files need the same `oxc.jsx` override the `web`/`routes`/`boundary` projects already needed

**What goes wrong:** `apps/web/tsconfig.json` sets `"jsx": "preserve"` (Next's required mode), which leaves JSX untransformed for a plain Vitest run — this project has already hit this exact problem three times (`web`, `routes`, `boundary` projects, per their own comments in `vitest.config.ts`). `packages/documents`'s `.tsx` files (the `<Document>` JSX tree) will hit the identical problem unless its own `tsconfig.json` sets a JSX mode Vite/Oxc can transform natively, OR its Vitest project entry carries the same `oxc.jsx` override.

**Why it happens:** `@react-pdf/renderer`'s JSX is plain React JSX (its own custom reconciler, but the syntax and transform requirements are standard React JSX) — this is unrelated to `apps/web`'s Next-specific `"preserve"` requirement, but a naive `packages/documents/tsconfig.json` that simply copies `packages/rulepacks/tsconfig.json` (which has no `jsx` field at all, since that package has no `.tsx` files) will fail to compile/transform the new `.tsx` file.

**How to avoid:** Give `packages/documents/tsconfig.json` an explicit `"jsx": "react-jsx"` (the standard automatic-runtime setting, not "preserve" — this package is never bundled by Next itself, so `"preserve"` is unnecessary and wrong here), and add the matching `oxc.jsx` override to its `vitest.config.ts` project entry regardless, following the `web` project's own precedent exactly.

## Code Examples

### Example 1: SIGNOFF-01's corrected refusal (status code + line naming)

Shape of the fix — not verbatim code (this does not exist in the repo yet), derived directly from the existing function's own structure at `apps/web/src/server/data/assessments.ts:410-414`:

```typescript
// BEFORE (apps/web/src/server/data/assessments.ts:412-414, verified this session):
//   if (assessment.lines.some((line) => line.disposition === "PENDING")) {
//     throw new ValidationError("Every line must be dispositioned before sign-off");
//   }

// AFTER (shape):
const lines = await memoryMatterRepository.listExpenseLines(matter.id); // move this fetch earlier
const expenseLineById = new Map(lines.map((line) => [line.id, line]));
const pendingLines = assessment.lines.filter((line) => line.disposition === "PENDING");
if (pendingLines.length > 0) {
  const seqList = pendingLines
    .map((line) => expenseLineById.get(line.expenseLineId)?.seq)
    .filter((seq): seq is number => seq !== undefined)
    .sort((a, b) => a - b)
    .map((seq) => `line ${seq}`)
    .join(", ");
  throw new ConflictError(
    `Sign-off refused — ${pendingLines.length} line(s) still need a decision: ${seqList}.`
  );
}
```
Copy matches 07-UI-SPEC.md's Copywriting Contract verbatim: *"Sign-off refused — {n} line(s) still need a decision: {list of line sequence numbers, e.g. 'lines 3, 7, 12'}."*, rendered inside the existing `signoff-error` slot with its existing `Sign-off failed — {detail}. No changes were made...` prefix/suffix — see `apps/web/src/ui/review/signoff-panel.tsx:29-34` [VERIFIED: apps/web/src/ui/review/signoff-panel.tsx:29-34 — `const SIGN_OFF_FAILURE_PREFIX = "Sign-off failed — ";\nconst SIGN_OFF_FAILURE_SUFFIX = ". No changes were made; the assessment is still in Legal Review.";`], which is unchanged by this phase.

### Example 2: PACK-08 guard, using the D-02 synthetic-fixture technique

```typescript
// New import in assessments.ts:
import { memoryPackLifecycleEventWriter } from "@dsar/audit/memory/pack-lifecycle-event-writer";

// Inside signOff(), after resolving `pack` (assessment.rulePackId/rulePackVersion)
// and before computing finalAmount:
const lifecycleEvents = await memoryPackLifecycleEventWriter.listByPack(
  assessment.rulePackId,
  assessment.rulePackVersion
);
const lastActivation = [...lifecycleEvents].reverse().find((event) => event.type === "PACK_ACTIVATED");
if (lastActivation && lastActivation.actor.id === actor.user.id) {
  throw new ConflictError(
    `Blocked — you activated rule pack ${assessment.rulePackId} ${assessment.rulePackVersion} in this session. ` +
    `Sign-off by the same person who activated the pack is not permitted; ask another reviewer with the ` +
    `Legal Reviewer role to sign off this assessment instead.`
  );
}
```
Copy is 07-UI-SPEC.md's Copywriting Contract verbatim for the PACK-08 block. `listByPack` and its result shape are the real, already-implemented interface — see `packages/audit/src/memory/pack-lifecycle-event-writer.ts:36-52` and `packages/audit/src/interface.ts:34-51` [VERIFIED: packages/audit/src/interface.ts:34-43 — `export interface PackLifecycleEvent {\n  id: string;\n  packId: string;\n  packVersion: string;\n  actor: UserRef;\n  actorRole: Role;\n  at: string;\n  type: Extract<AuditEventType, "PACK_ACTIVATED" | "PACK_EDITED">;\n  payload: AuditEvent["payload"];\n}`].

Test fixture technique (D-02), using real imports already used elsewhere in this codebase:
```typescript
import { memoryPackLifecycleEventWriter } from "../../packages/audit/src/memory/pack-lifecycle-event-writer.ts";
import { DEMO_USERS } from "../../apps/web/src/server/data/auth.ts";
import { packActivatedPayload } from "../../packages/audit/src/payload-builders.ts";

// Positive case: the demo LEGAL_REVIEWER is blocked signing off a version they "activated".
await memoryPackLifecycleEventWriter.append({
  packId: assessment.rulePackId,
  packVersion: assessment.rulePackVersion,
  actor: DEMO_USERS.LEGAL_REVIEWER.user, // same actor who will attempt sign-off
  actorRole: "RULEPACK_AUTHOR",
  at: new Date().toISOString(),
  type: "PACK_ACTIVATED",
  payload: packActivatedPayload("DRAFT", "ACTIVE"),
});
// ... then POST /assessments/{id}/signoff with the LEGAL_REVIEWER cookie — expect 409/403, naming the pack.
```

### Example 3: Route Handler returning a binary PDF (no precedent in this codebase yet)

Every existing Route Handler returns `Response.json(...)` — none return binary content, so this is a genuinely new pattern for this codebase:

```typescript
// apps/web/app/api/assessments/[id]/internal-record/route.ts
import { getAssessmentForLegalReview } from "../../../../../src/server/data/assessments.ts";
// ... resolve matter/pack/lines exactly as the legal review page already does ...
import { buildInternalRecordView } from "@dsar/documents/internal-record-view";
import { renderInternalRecordPdf } from "@dsar/documents/internal-record-document"; // wraps renderToBuffer

export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    // ... requireRole(actor, "LEGAL_REVIEWER") via the existing data-layer function ...
    const view = buildInternalRecordView(assessment, matter, pack, expenseLines);
    const buffer = await renderInternalRecordPdf(view);
    return new Response(buffer, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${matter.reference}-internal-record.pdf"`,
      },
    });
  } catch (error) {
    return errorToResponse(error); // existing shared error mapper, unchanged
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `experimental.serverComponentsExternalPackages` (Next.js config key) | `serverExternalPackages` (top-level, non-experimental) | Next.js 15+ [CITED: react-pdf.org/compatibility via WebSearch this session; verify exact key name against the actually-installed Next.js 16.3.x docs at implementation time, since `.claude/CLAUDE.md`'s own Next.js entry already flags this surface as having moved between minors] | If Pitfall 4's monorepo crash reproduces and the external-packages config workaround is needed, use the current key name, not the deprecated experimental one. |

**Deprecated/outdated:** None else identified as directly relevant to this phase's new surfaces.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The flag-acknowledgement early check (Pitfall 2) should also change from 400 to 409, for consistency with the PENDING-lines check | Common Pitfalls #2, Open Questions | Low — either code satisfies AC-24's literal (code-silent) text; only an API-consistency argument, not a spec violation, is at stake. Planner/product-owner should confirm before implementing. |
| A2 | The PACK-08 block (AC-41b) should return HTTP 409 (`ConflictError`), not 403 (`ForbiddenError`) | Code Examples #2, Open Questions | Medium — AC-41b names no status code. A 403 reading (treating this as an authorization refusal, matching `ACCESS-04`'s `requireRole` pattern) is equally defensible. Wrong choice means a route test asserts the wrong code, caught immediately by the test itself — low blast radius, but worth settling in planning rather than executor's guess. |
| A3 | `@react-pdf/renderer`'s known monorepo crash (issue #3285) will actually reproduce in THIS repo's specific pnpm-workspace + Next.js 16.3.x + Turbopack setup | Common Pitfalls #4 | Medium — the issue is reported against an unspecified Next.js version and could be specific to a config this repo doesn't share. If it does NOT reproduce, the extra de-risking step (Wave 0 smoke test) costs a small amount of time but causes no harm; if it DOES reproduce and is not de-risked early, the full dense-table PDF implementation could need late, costly rework. |
| A4 | A GET request is the right HTTP method for the new "Download internal record (PDF)" endpoint (Code Examples #3) | Architecture Patterns, Code Examples #3 | Low — this is a non-mutating read; every precedent in this codebase for reads (`GET /api/assessments/{id}`) uses GET. A POST would also work but breaks with this codebase's own REST convention for non-mutating actions. |
| A5 | `packages/documents`'s package name should be `@dsar/documents`, matching every existing package's `@dsar/*` convention | Standard Stack, Recommended Project Structure | Low — this is the obvious, only-consistent choice; no other package in this monorepo uses a different naming scheme. |

**If this table is empty:** N/A — see above.

## Open Questions

1. **Should the flag-acknowledgement precondition (SIGNOFF-02/AC-24) return 409, matching the PENDING-lines fix, or stay at 400?**
   - What we know: Both are preconditions on the identical `SIGN_OFF` guard-table row; the guard's own `checkFlagsAcknowledged` would produce a `ConflictError` (409) if the guard were reached first, exactly as `checkNoLinesPending` would.
   - What's unclear: AC-24's text is silent on the HTTP status code, unlike AC-16 which is explicit.
   - Recommendation: Change it to 409 for API consistency, and update `tests/routes/signoff.test.ts:203` (currently asserting 400) accordingly. Flag as a discretionary call for the plan, not a hard requirement.

2. **Should PACK-08's block (AC-41b) be `ConflictError` (409) or `ForbiddenError` (403)?**
   - What we know: AC-41b's text does not name a status code. The block is about the ACTOR's identity relative to the pack's history, not about the matter's state per se — closer in spirit to `ACCESS-04`'s role-based `ForbiddenError` (403) than to a state-machine guard failure.
   - What's unclear: `PACK-08` is grouped under "Rule packs" acceptance criteria in the PRD, not "Access control", which weakly suggests the PRD's own authors thought of it as a business-rule conflict rather than an authorization failure.
   - Recommendation: Either is defensible; recommend `ForbiddenError` (403) since the refusal reason is "who you are", matching `ACCESS-04`'s existing pattern for the same class of refusal, but note this is a judgment call for the plan to make explicitly and test consistently.

3. **Does `@react-pdf/renderer`'s monorepo crash (issue #3285) actually reproduce in this repo?**
   - What we know: The bug is real, filed against a matching monorepo architecture, and unresolved as of this research date.
   - What's unclear: Whether this repo's specific Next.js 16.3.x + Turbopack + pnpm-workspace combination triggers it.
   - Recommendation: A Wave 0 (or first-task) smoke test — the trivial `<Document>` example in Common Pitfalls #4 — should run BEFORE investing in the full dense-table layout. This is cheap insurance against a late, expensive discovery.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / pnpm | All work this phase | ✓ (repo already builds/tests under it) | pnpm 11.27.0 per `.claude/CLAUDE.md`'s recorded decision | — |
| `gsd-tools.cjs` | Automated `package-legitimacy check`, `research-plan` seam, `classify-confidence` seam | ✗ — not found anywhere in this worktree (confirmed via `find` this session) | — | Manual `npm view` verification (used throughout this research), matching every prior phase's documented workaround (STATE.md, recurring note since Phase 3) |
| Docker / Postgres | NOT required this phase — all data access is the existing in-memory demo repositories | N/A | N/A | N/A (STATE-04/ACCESS-01/ACCESS-06/ACCESS-08/AUDIT-02/BOUND-01 remain correctly deferred to Phase 3.2, unaffected by this phase) |
| `@react-pdf/renderer` | DOC-01/DOC-05 | ✗ — not yet installed anywhere in the repo (confirmed via `grep -n "react-pdf" package.json apps/web/package.json packages/*/package.json` returning nothing this session) | Target: 4.9.0 | None needed — this is the phase's job to install, gated by the Package Legitimacy Audit above |

**Missing dependencies with no fallback:** none — `@react-pdf/renderer` is this phase's own job to add, not a blocker.

**Missing dependencies with fallback:** `gsd-tools.cjs` — manual verification substitutes throughout, as it has in every prior phase.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.0, `test.projects` field, single root `vitest.config.ts` [VERIFIED: vitest.config.ts — read in full this session] |
| Config file | `vitest.config.ts` (repo root) |
| Quick run command | `pnpm vitest run --project routes` (or the relevant project name — `documents` once added) |
| Full suite command | `pnpm test` (confirm exact script name in root `package.json` at execution time — not re-verified this session, but this is the command every prior phase's STATE.md entry references, most recently "full suite 949/949 → 953/953") |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SIGNOFF-01 | 409 + named pending lines | route (real Request objects through real handlers, this codebase's established pattern) | `pnpm vitest run --project routes -t SIGNOFF` | ✅ `tests/routes/signoff.test.ts` exists, needs the PENDING-case assertion corrected from 400→409 plus a new line-naming assertion |
| SIGNOFF-02 | flags-ack precondition, status code TBD (Open Question 1) | route | same file | ✅ exists, needs possible status-code correction |
| PACK-08 | activator blocked from own pack-version sign-off | route + a synthetic `PackLifecycleEvent` fixture | new test in `tests/routes/signoff.test.ts` or a new `tests/routes/pack-lifecycle-signoff.test.ts` | ❌ Wave 0 gap |
| DOC-01/DOC-05 | PDF field-completeness, footer-on-every-page, pagination | unit (pure `internal-record-view.ts`) + smoke (`internal-record-document.tsx`) + a Route-Handler-level integration test for the actual `renderToBuffer()` call under Next's bundler | `pnpm vitest run --project documents` (new) | ❌ Wave 0 gap — package doesn't exist |
| DOC-03 | notice contains no rule ID/citation/basis/AI mention (AC-17 regex) | unit, over `buildNoticeDraft()`'s output | new test in `apps/web/src/domain/notice-draft.test.ts` (check if this file already exists — not found in this session's `Glob` of `apps/web/src/domain/*.ts`, so likely does not) | ❌ Wave 0 gap — no `notice-draft.test.ts` was found among the domain module list this session |
| DOC-04 | zero-allowable produces valid "no fee charged" notice through the full route stack | route, against a real `PROHIBITED`/`NO_EXPRESS_AUTHORITY` fixture matter | new test, likely in `tests/routes/signoff.test.ts` or a new `tests/routes/zero-fee.test.ts` | ❌ Wave 0 gap |
| ACCESS-05 | PDF trigger absent from every `/hr/*` route; PDF route itself refuses `HR_PREPARER` | route (role-matrix, this codebase's ACCESS-08 established pattern) + a DOM-level scan (`tests/boundary/dom-denylist.test.ts`-style) confirming no "Download internal record" affordance renders on any `/hr/*` page | new tests | ❌ Wave 0 gap |

### Sampling Rate

- **Per task commit:** the relevant project's quick run (`--project routes`, `--project documents`, etc.)
- **Per wave merge:** `pnpm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`, matching every prior phase's own discipline

### Wave 0 Gaps

- [ ] `packages/documents/` — the entire package, including its own `vitest.config.ts` project entry (Common Pitfall 5) and `.tsx` JSX transform override (Common Pitfall 6)
- [ ] `tests/routes/pack-lifecycle-signoff.test.ts` (or extend `signoff.test.ts`) — PACK-08
- [ ] `apps/web/src/domain/notice-draft.test.ts` — DOC-03's AC-17 regex assertion; confirm this file genuinely does not exist yet before creating it (not found via this session's `Glob apps/web/src/domain/*.ts`, but worth a final `ls` check at execution time since domain test files are sometimes colocated under a slightly different name)
- [ ] Root `tsconfig.json`'s `references` array — needs `{ "path": "./packages/documents" }` added [VERIFIED: tsconfig.json — read in full this session, `references` array enumerated, no `documents` entry present]
- [ ] `.dependency-cruiser.cjs` — no new rule is needed (it already anticipates `packages/documents` in its `no-infra-in-engine`/`no-infra-in-workflow` forbidden-target lists — [VERIFIED: .dependency-cruiser.cjs — read this session, both rules' `to.path` arrays already include `packages/(agent|audit|documents)`]), but confirm no NEW purity rule is required for `packages/documents` itself (this research found none — it's not a "pure" package like `engine`/`workflow`, it legitimately needs I/O-adjacent Node Buffer/Stream APIs from `@react-pdf/renderer`)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (unchanged — this project's stubbed-identity model, ACCESS-06, is out of this phase's scope) | — |
| V3 Session Management | No (no real session concept — D-02 explicitly reads "session" as "actor identity") | — |
| V4 Access Control | **Yes** | `requireRole()` called as the first statement of every new/changed data-layer function (existing convention, `apps/web/src/server/data/auth.ts:69-73`); the new PDF Route Handler MUST call `requireRole(actor, "LEGAL_REVIEWER")` and must never be reachable from an `/hr/*` page — this is this phase's single highest-value security control (ACCESS-05) |
| V5 Input Validation | Yes | Existing `zod` schemas (`SignOffSchema`, `AssessmentSchema`) already validate all persisted shapes; no new user-supplied input surface is introduced by DOC-01/PACK-08 (the PDF endpoint takes only a route param, no body) |
| V6 Cryptography | No | Not applicable — no new secrets, tokens, or crypto operations this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A page-level check that isn't backed by a data-layer role check (this project's own recurring, three-times-repeated bug class — Phase 3.1 UNREG-1, Phase 4 WR-02, Phase 05 CR-01, all documented in STATE.md) | Elevation of Privilege | Every new function this phase adds to `apps/web/src/server/data/*` must call `requireRole()` as its first statement, exactly as `signOff()`, `getSignedOffAssessmentForHr()`, etc. already do; any new `page.tsx` this phase touches needs an explicit acceptance criterion (matching STATE.md's own standing instruction) that `getCurrentActor()`/`requireRole()` survives unchanged |
| Privileged content (`lawyerReason`) leaking into an HR-reachable channel via a NEW document/export surface that predates this phase's own ACCESS-03/04 test coverage | Information Disclosure | The PDF Route Handler is a genuinely new information-disclosure surface this phase introduces — treat it with the same rigor as `getSignedOffAssessmentForHr`'s own existing tests: a positive test that `HR_PREPARER` gets 403 from the PDF endpoint directly (not just "the button doesn't render"), matching ACCESS-08's "every endpoint tested against every role" standing requirement |
| `@react-pdf/renderer`'s open monorepo bug (#3285) being worked around by a wrong-seeming fix (e.g. disabling a bundler safety check to make it "just work") | Tampering (indirect — a workaround that widens what gets bundled/externalized) | If the `serverExternalPackages` config workaround (Common Pitfall 4 / State of the Art) is used, scope it precisely to `@react-pdf/renderer` — do not broaden it to an unbounded external-packages allowlist |

## Sources

### Primary (HIGH confidence — direct code reads this session)
- `apps/web/src/server/data/assessments.ts` — `signOff()`, `dispositionLine()`, `bulkAcceptLines()`, `askHr()`, `raiseCorrection()`
- `apps/web/src/server/errors.ts` — status-code-carrying error classes
- `packages/workflow/src/{guards.ts,transitions.ts}` — the guard table and shared predicates
- `packages/schemas/src/{guard-input.ts,assessment.ts,rule-pack.ts,primitives.ts,expense-line.ts}` — frozen types
- `packages/audit/src/{interface.ts,memory/pack-lifecycle-event-writer.ts,memory/pack-lifecycle-event-writer.test.ts}` — PACK-08's mechanism
- `apps/web/src/domain/{attestation.ts,notice-draft.ts,review-tallies.ts}` — already-built pure modules
- `apps/web/src/ui/{review/signoff-panel.tsx,hr/result-view.tsx}` — already-built UI
- `apps/web/app/{legal/assessments/[id]/page.tsx,hr/matters/[id]/page.tsx}` — already-built composition
- `apps/web/app/api/assessments/[id]/signoff/route.ts`, `tests/routes/signoff.test.ts` — the route and its (currently-wrong) tests
- `vitest.config.ts`, `tsconfig.json`, `.dependency-cruiser.cjs`, `packages/rulepacks/{package.json,tsconfig.json}` — scaffold precedent
- `docs/PRD-dsar-fee-agent.md` §0, §5, §6.4, §8.1, §9.3-9.5, §10.1-10.7, §12.1, §13 (AC-01..42), §14 — read in full this session
- `.planning/phases/07-sign-off-outputs-and-edge-states/{07-CONTEXT.md,07-UI-SPEC.md}`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`

### Secondary (MEDIUM confidence — WebSearch/WebFetch, cross-checked)
- [@react-pdf/renderer npm package page](https://www.npmjs.com/package/@react-pdf/renderer) and registry lookups via `npm view` (this session)
- [diegomura/react-pdf#3285 — monorepo crash](https://github.com/diegomura/react-pdf/issues/3285) — filed 2026-01-23, unresolved as of this research
- [diegomura/react-pdf#2460](https://github.com/diegomura/react-pdf/issues/2460) — earlier (v3.1.14, 2023) Next.js App Router crash, superseded by newer Next.js versions per community reports
- [react-pdf.org/compatibility](https://react-pdf.org/compatibility) — `serverExternalPackages` / Next.js 14.1.1+ compatibility notes
- [react-pdf.org/node](https://react-pdf.org/docs/v4/node) — Node API (`renderToBuffer`, `renderToStream`)
- npmtrends.com / socket.dev — weekly download figures for `@react-pdf/renderer`

### Tertiary (LOW confidence — flagged for validation)
- None used without at least one cross-check above.

## Metadata

**Confidence breakdown:**
- Sign-off gate fixes (SIGNOFF-01/02, PACK-08): HIGH — every claim verified by direct code read this session, including exact file:line citations and verbatim quotes for every discrete value asserted.
- PDF generation stack: MEDIUM — the package choice itself traces to a prior, already-approved research phase (`.claude/CLAUDE.md`), independently re-verified via `npm view` this session (an authoritative source), but the automated `package-legitimacy check` seam could not run (`gsd-tools.cjs` unavailable) and the monorepo-crash risk (Pitfall 4) is a real, currently-unresolved unknown this research surfaced but cannot fully resolve without executing code in this repo.
- Pitfalls: HIGH for the status-code/test-drift findings (direct code+test read); MEDIUM for the `@react-pdf/renderer` monorepo bug (a specific, dated, matching GitHub issue found and read, but not independently reproduced in this repo this session).

**Research date:** 2026-09-20
**Valid until:** 30 days for the sign-off-gate findings (stable, internal code); 7 days for the `@react-pdf/renderer` open-issue finding specifically (an actively-discussed, unresolved upstream bug — re-check the issue thread immediately before starting `packages/documents` work, since a fix could land at any time).
