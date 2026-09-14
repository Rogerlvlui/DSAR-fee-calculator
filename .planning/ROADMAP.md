# Roadmap: DSAR Fee Assessment Agent

## Overview

The build starts with the one thing that genuinely blocks everything else — freezing the core types in `packages/schemas` — and proves the layers connect with a deliberately thin walking skeleton. From there four workstreams run with no ordering between them: the deterministic engine against hand-built fixture packs, the rule-pack loader plus the HK and SG authoring that is the real schedule long pole, the guarded workflow and append-only audit backbone, and the HR intake screen inside a disclosure shell. Those four converge at a single hard gate — engine code meeting real authored packs, where AC-09's golden files must pass — and only then can the legal-review screen be built, because a review card is a direct rendering of an `AssessmentLine` that does not exist until `assess()` runs against a real pack. Sign-off and the two generated documents close the determination pipeline. The LLM boundary comes last, as PRD §0 requires, so the deterministic core is proven before a model touches anything.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Schemas Freeze and Walking Skeleton** - Freeze every core type, then prove the layers connect end to end with throwaway-thin scaffolding
- [ ] **Phase 2: Deterministic Fee Engine** - `assess()` against hand-built fixture packs, with purity and money correctness proven by CI
- [ ] **Phase 3: Rule Packs and Pack Admin** - Loader, validator, nine packs with HK and SG authored in full, and the audited activation gate
- [ ] **Phase 4: Workflow and Audit Backbone** - Guarded transitions, immutable sign-off, and the append-only event log every later phase writes to
- [ ] **Phase 5: HR Intake and Disclosure Shell** - HR can itemise a claim inside a shell that states what the tool is and is not
- [ ] **Phase 6: Convergence and Legal Review** - Golden files pass, then the line-by-line review screen with its automation-bias controls
- [ ] **Phase 7: Sign-off, Outputs and Edge States** - The sign-off gate, the internal record, the requestor notice, and every §10.7 state
- [ ] **Phase 8: LLM Job 1 — Category Suggestion** - One advisory suggestion, verbatim-validated, that never moves a verdict or an amount

## Phase Details

### Phase 1: Schemas Freeze and Walking Skeleton

**Goal**: Every core type is frozen so nothing downstream has to re-open it, and a thin route through each role-scoped area proves the layers actually connect
**Depends on**: Nothing (first phase)
**Parallel with**: Nothing — this is hard serialization point #1. No other phase compiles until the core types exist.
**Requirements**: SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04, SCHEMA-05, SCHEMA-06, SCHEMA-07, STATE-01, ACCESS-01, ACCESS-06, ACCESS-08, BOUND-01, BOUND-02, AUDIT-02
**Success Criteria** (what must be TRUE):

  1. A downstream package can import `Matter`, `ExpenseLine`, `RulePack`, `Assessment`, `AssessmentLine`, `AuditEvent` and the seven-value `MatterStatus` and compile without redefining a field — and the frozen `RulePack` schema already carries the HK flat-fee extension, so neither Phase 2 nor Phase 3 has to re-open the freeze
  2. Money cannot go wrong silently: a bare `number` named `*amount|total|rate|fee|cap` inside `packages/engine` or `packages/schemas` fails lint (AC-07a), a 10,000-case property test shows every money field of a returned `Assessment` is an integer (AC-07b), and formatting the same integer as JPY and as SGD produces zero and two decimal places respectively
  3. A seeded HR user reaching `/legal/*` and a seeded lawyer reaching `/admin/*` are both refused server-side, with the refusal asserted on the response body and not only the status code, and replacing the stub identity provider changes no guard
  4. A multipart POST to every route found by glob returns 415, and no Prisma DMMF field name and no rendered form input name matches the personal-data deny-list (AC-05, AC-06) — both tests enumerate generated artifacts, so every route and field added in Phases 3 through 8 is covered without anyone editing the test
  5. One audit event round-trips through the `dsar_runtime` role, and an `UPDATE` against the audit table from that role fails at the database rather than only at the API (AC-34)

**Plans**: 9 plans across 5 waves

Plans:
**Wave 1**

- [ ] 01-01-PLAN.md — Workspace, pinned toolchain, money-branding lint gate and engine purity gate

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 01-02-PLAN.md — Shared primitives, branded money, the currency maps and the closed enums
- [ ] 01-03-PLAN.md — Prisma data-model freeze and the personal-data field deny-list

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 01-04-PLAN.md — Tracer: two Postgres roles, one guarded route, one audited write, end to end
- [ ] 01-05-PLAN.md — Matter, ExpenseLine and AuditEvent zod schemas

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 01-06-PLAN.md — Condition and the RulePack freeze including the HK flat-fee extension
- [ ] 01-08-PLAN.md — Database invariants: currency check constraint, native enum and privilege matrix
- [ ] 01-09-PLAN.md — Walking-skeleton completion and the standing route/role/multipart harnesses

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 01-07-PLAN.md — Assessment, GuardInput, the JSON Schema artifact and the freeze policy

Scope discipline: the walking skeleton is explicitly throwaway-tolerant. It exists to prove that Postgres-in-Docker with the migrator/runtime split, Prisma, the server-side role guard and the audit write all connect — not to deliver engine or review behaviour early. ACCESS-08 ("every endpoint tested against every role, asserting on bodies") starts here as a standing obligation that every later phase inherits.

### Phase 2: Deterministic Fee Engine

**Goal**: `assess()` computes a defensible fee from a rule pack, proven correct against hand-built fixtures before any real pack exists
**Depends on**: Phase 1
**Parallel with**: Phases 3, 4 and 5 — zero ordering between them. This phase deliberately does not wait on real HK/SG pack content; it is built and unit-tested against the fixture pack PRD §14 supplies.
**Requirements**: ENGINE-01, ENGINE-02, ENGINE-03, ENGINE-04, ENGINE-05, ENGINE-06, ENGINE-07, ENGINE-08, ENGINE-09, ENGINE-10, ENGINE-11, ENGINE-12, ENGINE-13, ENGINE-15, ENGINE-16, ENGINE-17
**Success Criteria** (what must be TRUE):

  1. Against fixture packs, `assess()` produces correct verdicts and amounts for all five treatments, with `ALLOW_IF` returning `CONDITIONS_NOT_MET` listing which conditions failed, `applyCap` rounding down across all four cap types (AC-07c), and an aggregate cap applied pro-rata with the residue left unallocated and flagged
  2. The purity boundary is enforced by CI rather than by convention: no `fs`, `fetch`, Prisma or LLM import reaches `packages/engine`, no bare `Date`, `Date.now()` or `Math.random()` appears in its source, and the whole suite passes identically under two timezone/locale combinations
  3. The engine flags rather than decides: `NO_EXPRESS_AUTHORITY` returns every line `FLAG` with reason `NO_FEE_AUTHORITY` and `draftBaseline` zero (AC-14), `PROHIBITED` returns every line `DISALLOW` (AC-13), an `OTHER_UNCLASSIFIED` line is always `FLAG` whatever the pack or description says (AC-19), and every cross-line check raises a flag rather than making a silent adjustment
  4. Totals cannot be read early or inflated: `finalAmount` is `null` and unrepresentable as a number before sign-off (AC-25), `FLAG` lines contribute zero to `draftBaseline` with their claimed value appearing only in `flaggedTotal` (AC-11), and `restingOnUnverifiedRules` is a strict subset of `draftBaseline` (AC-22)
  5. A 50-line assessment completes in under 100ms (§11), a stored `claimedAmount` that does not equal `quantity × unitRate` raises a hard error and blocks submission (AC-08), and for a flat-fee-bearing pack the engine returns both the itemised baseline and the flat figure plus whether the flat figure exceeds itemised direct cost

**Plans**: TBD

### Phase 3: Rule Packs and Pack Admin

**Goal**: Nine jurisdiction packs exist as validated repository JSON, HK and SG are authored in full and can reach ACTIVE, and activation is a gated, audited event
**Depends on**: Phase 1
**Parallel with**: Phases 2, 4 and 5. PACK-09 is legal work by the product owner and the likely schedule long pole — it starts the moment this phase opens and must not sit behind the loader code. The `/admin/rulepacks` screen touches `apps/web` alongside Phase 5's HR shell; both build on the Phase 1 skeleton and add independent routes.
**Requirements**: PACK-01, PACK-02, PACK-03, PACK-04, PACK-05, PACK-06, PACK-07, PACK-09, PACK-10, PACK-11, PACK-12
**Success Criteria** (what must be TRUE):

  1. The build fails — not the runtime — when any pack JSON is invalid, when an ACTIVE pack is missing any of the 21 category rules, when `reviewedBy`/`reviewedOn`/`reviewDueOn` are absent, or when any pack-authored `basis` string contains a banned word (AC-37, AC-10, AC-38, AC-32a)
  2. `HK-PDPO` and `SG-PDPA` are authored across all 21 categories by named counsel and reach ACTIVE, the HK pack carries its flat-fee figure in a schema extension that leaves the other eight packs unchanged, and the seven stubs load as DRAFT with every category rule `FLAG` and every rule `NEEDS_VERIFICATION`
  3. A pack past its `reviewDueOn` is STALE: a new matter in that jurisdiction is refused with 409 naming the reason, while an in-flight review continues under a full-width notice (AC-39)
  4. From `/admin/rulepacks` an author sees live validation, a 21/21 completeness checklist, a diff against the previous version, and an activation gate demanding reviewer identity and a review-due date — and activating a version they last edited is blocked unless they hold `RULEPACK_AUTHOR` and confirm sole authorship, which is audited (AC-41a)
  5. Activating a new version leaves every existing assessment's pinned version, verdicts and amounts untouched (AC-40), and an attempt to rewrite an already-ACTIVE version's content is refused at the database rather than by service-layer discipline

**Plans**: TBD
**UI hint**: yes

PACK-08's sign-off-side block (a user who activated a pack version cannot sign off an assessment pinned to it in the same session) is delivered in Phase 7, where sign-off exists.

### Phase 4: Workflow and Audit Backbone

**Goal**: Matters move only through guarded transitions, signed-off records are immutable at the database, and every consequential act lands in an append-only log
**Depends on**: Phase 1
**Parallel with**: Phases 2, 3 and 5 — the guards are pure functions over the typed `GuardInput` frozen in Phase 1 and need neither the engine nor real packs. Later phases are consumers of this backbone, not re-implementers of it.
**Requirements**: STATE-02, STATE-03, STATE-04, STATE-05, AUDIT-01, AUDIT-03, AUDIT-04, BOUND-05
**Success Criteria** (what must be TRUE):

  1. A matter can be driven DRAFT to COMPUTING to LEGAL_REVIEW to SIGNED_OFF to CLOSED, and through the INFO_REQUEST branch, entirely through the guarded executor, and no code path anywhere writes a status field directly
  2. Recompute before sign-off mutates the existing assessment in place — same `id`, new pack and engine version, every disposition cleared — and never creates a row; a correction after sign-off creates a new assessment and marks the previous one SUPERSEDED, retained verbatim (AC-33)
  3. An `UPDATE` against a SIGNED_OFF assessment fails at the database, and the API surfaces 409 rather than relying on that failure for its message (AC-33)
  4. Every transition, disposition, pack activation and sign-off emits an audit event carrying actor, role, server timestamp, before and after, pack version and engine version, and an event whose payload carries an undeclared key is rejected as a validation error (AC-35, §12.1)
  5. The DPO can export the audit log, and elapsed review time — measured from when the reviewer first opened the assessment — is present on every `LINE_DISPOSITIONED` and `SIGNED_OFF` event

**Plans**: TBD

### Phase 5: HR Intake and Disclosure Shell

**Goal**: HR can itemise a claim against the closed taxonomy, inside an application shell that states plainly what the tool is, which pack is speaking, and what it does not decide
**Depends on**: Phase 1
**Parallel with**: Phases 2, 3 and 4 — intake never calls `assess()` and needs only the frozen schemas plus the pack status the loader exposes. Coordinate lightly with Phase 3 on the shared `apps/web` shell.
**Requirements**: INTAKE-01, INTAKE-02, INTAKE-03, INTAKE-04, INTAKE-05, INTAKE-06, INTAKE-07, INTAKE-08, INTAKE-09, NAV-02, BOUND-03, BOUND-04, DISC-01, DISC-02, DISC-03, DISC-05
**Success Criteria** (what must be TRUE):

  1. HR creates a matter with reference, jurisdiction, legal entity, controller type, received date, currency and requestor class; selecting a jurisdiction shows that pack's status inline immediately, and a `NO_EXPRESS_AUTHORITY` or `PROHIBITED` posture — or no usable pack at all — shows its notice before any expense entry is offered
  2. HR itemises through a category-grouped repeater with units constrained by category, a computed read-only amount, pack-drawn contextual hints, three attestations each carrying a one-line explanation of why it is asked, and a sticky footer showing the running total labelled as the claim and not the fee
  3. A currency that is not the jurisdiction's designated currency is blocked as form validation and again server-side, both naming the two currencies (AC-42); drafts autosave every 10 seconds with save state visible; and `/hr/matters` lists the preparer's own matters and their status as the in-app substitute for the notification NS-3 forbids sending
  4. Every authenticated screen carries the non-dismissible status strip with jurisdiction, pack id and version, reviewing lawyer, reviewed date and review-due state (AC-31), and no user reaches any screen without passing the unskippable capability statement, which re-appears whenever `statementVersion` increments (AC-30)
  5. The personal-data boundary holds at field level: every free-text field enforces its 300/500/200/1000 limit with an explicit warning, the shared pattern detector warns and never blocks, no string in the UI strings file contains a banned word (AC-32a), and every rendered deadline carries "Advisory" inside its own container (AC-15a)

**Plans**: TBD
**UI hint**: yes

The free-text limit constants and the pattern detector are exported once from `packages/schemas` and applied to every free-text field then existing; Phase 6 wires those same two to `lawyerReason` rather than writing its own.

### Phase 6: Convergence and Legal Review

**Goal**: The engine meets real authored packs, and a lawyer can work an assessment line by line with every control that forces genuine engagement
**Depends on**: Phases 2 and 3 (serialization point #2 — engine code and real HK/SG pack JSON must both exist), plus Phase 4 for the transitions it drives and Phase 5 for the shell it renders inside
**Parallel with**: Nothing — this is the second hard gate. A review card is a direct rendering of an `AssessmentLine`, which does not exist until `assess()` runs against a real pack.
**Requirements**: ENGINE-14, REVIEW-01, REVIEW-02, REVIEW-03, REVIEW-04, REVIEW-05, REVIEW-06, REVIEW-07, REVIEW-08, REVIEW-09, REVIEW-10, REVIEW-11, REVIEW-12, NAV-01, NAV-03, ACCESS-02, ACCESS-03, ACCESS-07, DISC-04
**Success Criteria** (what must be TRUE):

  1. AC-09 golden files pass for both the HK and SG packs — expected verdicts, amounts, flags and totals reproduce exactly — and changing either pack breaks its golden files rather than silently passing
  2. Every review card shows its rule ID, pack-authored basis, citation and expense category alongside HR's own description without further interaction (AC-21), every FLAG line states its reasons in words, `NEEDS_VERIFICATION` lines render distinctly with `restingOnUnverifiedRules` indented under `draftBaseline` (AC-22), and every verdict badge carries its verdict in words in its accessible name rather than by colour alone (AC-32b)
  3. The lawyer accepts, reduces, strikes or allows each line and can never raise HR's claimed figure, with a mandatory 10-character reason rejected against a stop-list shared by client and server (AC-23); bulk accept is offered only for ALLOW lines with VERIFIED rules, and the API rejects any batch containing a FLAG, ALLOW_CAPPED or NEEDS_VERIFICATION line (AC-26)
  4. No headline total renders while any line is PENDING, enforced by the server and not only the UI (AC-25); an `HR_PREPARER` requesting an assessment in LEGAL_REVIEW gets 403 with no assessment data in the body (AC-01), and no `verdict`, `engineAmount`, `basis`, `draftBaseline` or `lawyerReason` reaches an HR user through an API response, a server-component payload, or a cached response — each tested as its own leak channel (AC-02)
  5. A 20-line review can be completed from `/legal/queue` with the keyboard alone; the lawyer can raise a query into INFO_REQUEST, recompute against a newer pack after explicitly confirming that all dispositions will be discarded, and — where the pack carries a flat fee — see both figures and choose, with the flat fee blocked where it exceeds itemised direct cost

**Plans**: TBD
**UI hint**: yes

### Phase 7: Sign-off, Outputs and Edge States

**Goal**: A named lawyer signs off under a recorded attestation, and only then does HR receive a figure, an internal record and a notice draft
**Depends on**: Phase 6
**Parallel with**: Nothing on the sign-off gate itself. The PDF and notice templates can be drafted against a fixture `Assessment` alongside late Phase 6 if capacity allows.
**Requirements**: SIGNOFF-01, SIGNOFF-02, SIGNOFF-03, SIGNOFF-04, SIGNOFF-05, SIGNOFF-06, DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, ACCESS-04, ACCESS-05, PACK-08, DISC-06
**Success Criteria** (what must be TRUE):

  1. Sign-off is refused with 409 while any line is PENDING — naming the pending lines (AC-16) — or while any matter-level flag requiring acknowledgement is unacknowledged (AC-24); it is rejected for a user without `LEGAL_REVIEWER` for that jurisdiction (AC-03), and for a user who activated the pinned pack version in the same session, with the block naming the reason and pointing to another reviewer (AC-41b)
  2. Sign-off records the lawyer, name, qualification, timestamp, final amount and pinned pack version, with the attestation stored verbatim by version and the extended wording appended where the pack is STALE
  3. The internal fee assessment record generates as a PDF carrying matter details, pack and engine version, every line with verdict, rule, basis, citation, disposition and the lawyer's reason, matter flags and acknowledgements, and the sign-off block — with the disclosure footer on every page (AC-18, §10.5)
  4. HR sees the signed-off figure, the reviewing lawyer, and both allowed and struck items with their plain-language basis, plus the notice as a copy-to-clipboard block watermarked DRAFT until marked sent — while `lawyerReason` and the internal rationale appear in no `/hr/*` response and no HR-facing document, including after sign-off (AC-04); marking sent records a date only, under a visible note that the tool emails nobody
  5. A zero-allowable outcome produces a valid notice stating that no fee is charged, treated as a normal result (AC-14); regex over the generated notice finds no rule ID, citation, basis string, or mention of AI or of this tool (AC-17); and every row of §10.7's table behaves exactly as specified rather than being improvised

**Plans**: TBD
**UI hint**: yes

DISC-06 sweeps §10.7 end to end here. Individual rows are implemented in their home phases — no usable pack and currency mismatch in Phase 5, pack-activated-mid-review in Phase 6, zero allowable with DOC-04 — and the LLM-unavailable row is delivered with LLM-08 in Phase 8.

### Phase 8: LLM Job 1 — Category Suggestion

**Goal**: The model makes exactly one advisory suggestion, inside a boundary that makes it structurally incapable of moving a verdict or an amount
**Depends on**: Phase 7
**Parallel with**: Nothing — held last deliberately. Job 1 has no hard technical dependency beyond the category taxonomy, but PRD §0's ordering is risk sequencing: prove the deterministic core first, and keep the model's surface minimal while doing it.
**Requirements**: LLM-01, LLM-02, LLM-03, LLM-04, LLM-05, LLM-06, LLM-07, LLM-08, LLM-09, LLM-10
**Success Criteria** (what must be TRUE):

  1. For an `OTHER_UNCLASSIFIED` line the model suggests a category as advisory text only; the line stays FLAG until a lawyer accepts explicitly, accepting re-runs the engine, and no verdict or amount anywhere changes as a result of the model (AC-27)
  2. With the provider unavailable or returning output that fails its zod parse, the assessment completes on deterministic template text with no retry loop, and the UI says the AI-drafted wording was unavailable (AC-28)
  3. Any model string containing a monetary figure or a citation-shaped substring that does not appear verbatim in that assessment's engine output is discarded and replaced with template text (AC-36b, AC-36c), and no file under `packages/agent/prompts/` contains a statutory citation pattern or a `ruleId` pattern (AC-36a)
  4. Every LLM-generated string is stored with an `aiGenerated` marker set at write time and renders with a visible label (AC-29), and confidence is shown only as the three-value categorical label — never a percentage, never a progress bar
  5. `packages/agent` has no tool use, no web access and no retrieval, asserted in CI (NS-8), and `promptVersion` from the versioned prompt files in the repository is recorded on every assessment

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

Where capacity allows, Phases 2, 3, 4 and 5 may run concurrently — they have zero ordering between them once Phase 1's types are frozen. Phase 3's PACK-09 authoring should be kicked off first regardless, as the likely schedule long pole.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Schemas Freeze and Walking Skeleton | 0/9 | Planned | - |
| 2. Deterministic Fee Engine | 0/TBD | Not started | - |
| 3. Rule Packs and Pack Admin | 0/TBD | Not started | - |
| 4. Workflow and Audit Backbone | 0/TBD | Not started | - |
| 5. HR Intake and Disclosure Shell | 0/TBD | Not started | - |
| 6. Convergence and Legal Review | 0/TBD | Not started | - |
| 7. Sign-off, Outputs and Edge States | 0/TBD | Not started | - |
| 8. LLM Job 1 — Category Suggestion | 0/TBD | Not started | - |
