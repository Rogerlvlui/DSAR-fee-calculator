# Phase 7: Sign-off, Outputs and Edge States - Context

**Gathered:** 2026-09-20
**Status:** Ready for planning

<domain>
## Phase Boundary

A named lawyer signs off under a recorded attestation, and only then does HR receive a figure, an internal record and a notice draft. Concretely: the sign-off gate (SIGNOFF-01..06, ACCESS-04/05, PACK-08), the two generated documents (DOC-01..05 — internal PDF record and requestor notice text), and proving every row of PRD §10.7's empty/error/edge-state table behaves exactly as specified (DISC-06).

Not this phase's job: LLM Job 1 (Phase 8), the `/admin/rulepacks` activation screen and its live PACK_ACTIVATED writer wiring (PACK-06/PACK-07, Phase 3.2 — still blocked on Docker), database-level audit immutability (STATE-04, Phase 3.2), or re-opening the correction/re-review workflow gap (STATE.md's SUPERSEDED-has-no-outgoing-transition blocker — a pre-existing, separately-tracked spec gap that Phase 7's own requirements do not touch).

</domain>

<decisions>
## Implementation Decisions

All four gray areas below were explicitly delegated ("you decide") by the product owner. Decisions recorded here so the researcher and planner don't re-litigate them.

### Reviewer jurisdiction scoping (ACCESS-04 / AC-03)

- **D-01:** Keep the flat `LEGAL_REVIEWER` role as-is — do not add a jurisdiction-entitlement field to `UserRef`/`DemoActor`. ACCESS-04 is satisfied by the existing `requireRole(actor, "LEGAL_REVIEWER")` check (a user lacking the role entirely is rejected); jurisdiction-scoped entitlement is treated as an out-of-scope refinement under the same "prototype framing" exception PROJECT.md already carves out for ACCESS-06 (SSO/IdP group role assignment). — **Reversibility:** costly — **rationale:** adding jurisdiction entitlement later means reopening `UserRefSchema` (frozen since Phase 1, "nothing downstream has to re-open it") and retrofitting every `requireRole` call site that currently only checks role, not role+jurisdiction. Chosen anyway because reopening the freeze for a single-lawyer prototype buys no real test coverage — there is only one `LEGAL_REVIEWER` demo persona today, so a jurisdiction check would have no genuine negative case to exercise without inventing a second demo lawyer purely to satisfy the schema shape.
- Test ACCESS-04's negative case the same way ACCESS-01/ACCESS-02 already do: an actor with a *different* role (e.g. `HR_PREPARER`) attempting sign-off, not a `LEGAL_REVIEWER` scoped to the wrong jurisdiction.

### PACK-08 / AC-41b (activation-then-signoff block)

- **D-02:** Build the guard now. Call `packages/audit`'s existing memory-backed `PackLifecycleEventWriter` directly from a test to simulate "actor X activated rule-pack version Y", then assert that actor X's sign-off attempt on an assessment pinned to that version is blocked, naming the reason and pointing to another reviewer. This is the same synthetic-fixture technique already established in Phase 6 for REVIEW-10's recompute-confirmation banner (a two-version fixture, since no real committed pack has more than one version). — **Reversibility:** reversible — the guard function itself doesn't change when Phase 3.2's real admin screen eventually starts writing real `PACK_ACTIVATED` events; only the source of truth for "who activated this version" moves from a test-constructed fixture to a live write path, which the guard already reads via the same writer interface.
- Full end-to-end proof (through a live `/admin/rulepacks` activation click) stays blocked on Phase 3.2 (Docker) and is not this phase's job to unblock.
- "Same session" is read as "same actor identity" given the stubbed-identity model (a persistent cookie-selected actor, no real login/logout boundary) — there is no separate session concept to build.

### Requestor notice template content (DOC-02/DOC-03)

- **D-03:** Defer real HK/SG notice authoring. Both real packs (`HK-PDPO`, `SG-PDPA`) still carry the `UNAUTHORED` token in `requestorNoticeTemplate` — this is a legal-content gap, not a mechanism gap, the same shape as PACK-09's deferred category authoring (STATE.md, decided 2026-09-20 before Phase 6). Build and prove the notice-generation mechanism — template substitution, `DRAFT` watermark, the AC-17 banned-word/no-citation regex, the zero-fee case (DOC-04) — against fixture/placeholder template text (e.g. `packages/rulepacks/src/__fixtures__/active-ready.fixture.json`'s existing placeholder, or an equivalent test-only template). — **Reversibility:** reversible — swapping in real authored wording later is a pure data change to the two real pack JSON files; it touches no code this phase writes.
- Track real HK/SG notice-template authoring as a follow-up alongside the remaining PACK-09 categories (STATE.md's existing "Deferred Items" table) — do not invent jurisdiction-correct legal notice wording as part of this phase's own work.

### Internal record PDF layout (DOC-01)

- **D-04:** Dense data table, not a card-per-line mirror of the `/legal/assessments/{id}` review screen. One row per assessment line — verdict, rule ID, basis, citation, disposition, lawyer's reason as columns — plus matter details, pack/engine version, matter flags and acknowledgements, and the sign-off block, per DOC-01/DOC-05's field list. — **Rationale:** this is an internal archival compliance record (DOC-01's own field list is already table-shaped, not narrative), not a document anyone needs to feel good looking at; a dense table also paginates predictably with `@react-pdf/renderer`'s community table support (per `.claude/CLAUDE.md`'s recorded stack decision), which a card-per-line layout with more vertical space per line would strain further on a 50-line assessment.

### Claude's Discretion
- Exact PDF page size, font choices, and column widths within the dense-table layout (D-04) — no vision constraint given beyond "not a card mirror".
- Whether the fixture notice template (D-03) lives as a new committed test fixture or reuses an existing one — pick whichever avoids duplicating fixture-authoring effort already present in `packages/rulepacks/src/__fixtures__/`.
- Exact wording of PACK-08's "points to another reviewer" block message (AC-41b) — follow the project's established message-authoring pattern (`packages/engine/src/messages.ts` precedent: no banned words, specific and actionable).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### PRD — sign-off, disclosure and documents
- `docs/PRD-dsar-fee-agent.md` §9.4 (anti-automation-bias — total-hidden, mandatory reason, litigation-posture acknowledgement) — already built by Phase 3.1/06; Phase 7 only adds the sign-off-time acknowledgement gate for flags requiring it (SIGNOFF-02)
- `docs/PRD-dsar-fee-agent.md` §9.5 — the verbatim sign-off attestation text and its `STALE`-pack extension, recorded by version (SIGNOFF-03)
- `docs/PRD-dsar-fee-agent.md` §10.3 (right rail / sign-off confirmation panel) and §10.4 (HR result screen) — match structure and hierarchy, not exact styling, per Annex A's own framing
- `docs/PRD-dsar-fee-agent.md` §10.5 — the two generated documents, including the internal record's exact page-footer text template (DOC-05) and the notice's exclusions (no rule ID, no citation, no basis string, no mention of AI or this tool — AC-17)
- `docs/PRD-dsar-fee-agent.md` §10.7 — the full empty/error/edge-state table (DISC-06); every row must behave exactly as specified
- `docs/PRD-dsar-fee-agent.md` §12.1 — the no-requestor-personal-data architectural boundary, relevant to both documents' content

### Acceptance criteria
- `docs/PRD-dsar-fee-agent.md` AC-03, AC-14, AC-15, AC-16, AC-17, AC-18, AC-24, AC-25, AC-39, AC-40, AC-41(a/b), AC-42 — the specific criteria this phase's requirements map to (see `.planning/REQUIREMENTS.md` for the requirement→AC cross-reference already in place)

### Project-level constraints
- `.claude/CLAUDE.md` — Non-negotiables (esp. #3 "no output leaves without a named lawyer's sign-off" and #4 "engine flags rather than decides"); the `@react-pdf/renderer` PDF-generation decision and rationale (Q5); the Route-Handler-over-Server-Actions decision (Q8), relevant to the sign-off/notice-sent endpoints this phase adds
- `.planning/PROJECT.md` Key Decisions table — "Internal record as PDF; requestor notice as text" (already settled, do not re-litigate PDF-for-both)
- `.planning/REQUIREMENTS.md` — SIGNOFF-01..06, DOC-01..05, ACCESS-04/05, PACK-08, DISC-06 rows (all currently Pending) and their AC cross-references

### Prior-phase precedent this phase should follow
- `.planning/STATE.md` — Phase 6 planning notes on the REVIEW-10 synthetic-fixture technique (basis for D-02) and the PACK-09 deferral decision, 2026-09-20 (basis for D-03)
- `.planning/STATE.md` — the three-times-repeated authorization-gap bug class (Phase 3.1 UNREG-1, Phase 4 WR-02, Phase 05 addendum CR-01) — any `page.tsx` this phase touches (`/hr/matters/{id}` result page, the sign-off confirmation flow) needs an explicit, named acceptance criterion that `getCurrentActor()`/`requireRole()` survives unchanged, not an assumed convention

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/ui/review/signoff-panel.tsx` — the sign-off confirmation panel UI already exists (built in Phase 3.1), including tallies, per-flag acknowledgement checkboxes, attestation text display, and a qualification text input. Needs wiring against real SIGNOFF-01/02 server responses (currently only role + basic validation checked) and ACCESS-04's rejection path.
- `apps/web/src/ui/hr/result-view.tsx` — HR result screen skeleton already exists; needs the struck-items itemisation, notice draft copy-to-clipboard block, and "Mark notice sent" action per §10.4.
- `apps/web/src/domain/attestation.ts`, `apps/web/src/domain/review-tallies.ts` — pure modules already computing the attestation text and tallies the sign-off panel renders; the same modules `signOff()` itself should read from, per Phase 06's "same pure modules" precedent (`.planning/STATE.md` Phase 03.1 P05 entry).
- `packages/audit/src/memory/pack-lifecycle-event-writer.ts` — the `PackLifecycleEventWriter` interface and memory implementation, callable directly from tests (no admin UI needed) to construct PACK-08's synthetic activation fixture (D-02).
- `packages/schemas/src/rule-pack.ts` — `requestorNoticeTemplate: z.string()` already frozen on `RulePack`; no schema change needed for D-03.
- `packages/schemas/src/assessment.ts` — `SignOffSchema` (lawyer, lawyerName, qualification, signedAt, finalAmount, acknowledgedFlags, attestationVersion) already frozen; Phase 7 populates it, does not extend it.

### Established Patterns
- Every status-changing write goes through `packages/workflow`'s guarded executor (`evaluateTransition`), never a literal `MatterStatus`/status write — enforced by a CI ESLint rule. `signOff()`'s `LEGAL_REVIEW → SIGNED_OFF` transition and `markNoticeSent`'s `SIGNED_OFF → CLOSED` transition already exist in `apps/web/src/server/data/assessments.ts`; new preconditions (SIGNOFF-01/02, ACCESS-04, PACK-08) are additional guard checks inside `signOff()`, not new transitions.
- Route Handlers, not Server Actions, for every state-changing write (`.claude/CLAUDE.md` Q8) — the sign-off and notice-sent endpoints follow the existing `/api/assessments/{id}/signoff`-shaped convention.
- Money formatting via `formatMinor` from `@dsar/schemas/money`, never inline currency logic — used identically in both the sign-off panel and the PDF/notice generation.
- One function/module boundary per commit where risk is separable, full suite green after each (Phase 04 P04's precedent) — likely applies to PDF generation (a new `packages/documents` package) landing separately from notice-text generation.

### Integration Points
- `packages/documents` (per `.claude/CLAUDE.md`'s architecture table) does not exist yet — this phase creates it, for the internal-record PDF only (the notice stays text, per the settled Key Decision).
- `signOff()` in `apps/web/src/server/data/assessments.ts` (currently ~line 400) is the single call site for SIGNOFF-01 through 04, ACCESS-04, and PACK-08's new preconditions — all additive to its existing guard sequence (PENDING check → flag acknowledgement → attestation → qualification), not a rewrite.
- `getSignedOffAssessmentForHr` (Phase 04 P05) already permits `SIGNED_OFF`/`CLOSED` reads for the HR result page — SIGNOFF-05/06 build the actual result view against it.

</code_context>

<specifics>
## Specific Ideas

No particular visual or interaction references beyond what's captured in Decisions above — the product owner delegated all four open gray areas to Claude's judgement. Follow Annex A's structure/hierarchy for the confirmation panel and result screen (already mostly built); the PDF has no existing mockup to match (D-04 settles its shape).

</specifics>

<deferred>
## Deferred Ideas

- **Real HK/SG requestor-notice legal content** — tracked as a follow-up alongside the remaining PACK-09 category authoring (`.planning/STATE.md` Deferred Items table). Not this phase's job to author.
- **Jurisdiction-scoped `LEGAL_REVIEWER` entitlement** — a genuine future refinement if this project moves past the single-lawyer-per-role prototype stage; explicitly not built now (D-01).
- **Correction re-review after `SUPERSEDED`** — `.planning/STATE.md`'s standing blocker (checkpoint 04-05-CP, Option A): PRD §5's state table gives `SUPERSEDED` no outgoing transition, so there is still no route for a lawyer to review and re-sign a correction raised after sign-off. This surfaced again while reading Phase 7's scope but remains outside SIGNOFF-01..06/DOC-01..05/PACK-08/DISC-06 as written — needs a product-owner decision (a PRD amendment or equivalent) before any phase builds it. Flagging it here so it isn't silently re-discovered mid-Phase-7-planning.
- **`/admin/rulepacks` activation screen (PACK-06/PACK-07)** — stays with Phase 3.2, still blocked on Docker.

### Reviewed Todos (not folded)
None — `todo.match-phase 7` returned zero matches.

</deferred>

---

*Phase: 7-Sign-off, Outputs and Edge States*
*Context gathered: 2026-09-20*
