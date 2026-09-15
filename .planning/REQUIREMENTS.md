# Requirements: DSAR Fee Assessment Agent

**Defined:** 2026-09-13
**Core Value:** A lawyer can defend the output by saying "the engine applied rule HK-PDPO.STAFF_TIME_REDACT_EXEMPT, version 2026.09.1, authored by X on date Y, and struck the line" — never "the model assessed the claim."

**Source of truth:** `docs/PRD-dsar-fee-agent.md`. Every requirement below traces to a PRD section or numbered acceptance criterion, shown in parentheses. Where a requirement has no PRD reference it came from research or from a scoping decision recorded in PROJECT.md, and is marked accordingly.

---

## v1 Requirements

### Schemas and shared primitives

- [x] **SCHEMA-01**: Every core type — `Matter`, `ExpenseLine`, `RulePack`, `Assessment`, `AssessmentLine`, `AuditEvent` — is defined as a zod schema with an inferred TypeScript type (§6, §7.2)
- [x] **SCHEMA-02**: Money is a branded integer `Minor` type, and a lint rule rejects a bare `number` for any identifier matching `/(amount|total|rate|fee|cap)$/i` inside `packages/engine` and `packages/schemas` (AC-07a)
- [x] **SCHEMA-03**: A `MINOR_UNIT_DECIMALS` map records decimal places per currency, and every conversion and formatting helper is currency-aware — correct for zero-decimal JPY, KRW and VND as well as two-decimal SGD and HKD *(research: not in the PRD)*
- [x] **SCHEMA-04**: `JURISDICTION_CURRENCY` maps each of the nine jurisdictions to exactly one currency, and a matter's currency must equal its jurisdiction's (§6.0)
- [x] **SCHEMA-05**: JSON Schema is generated from the zod schemas for use at the LLM boundary (§6)
- [x] **SCHEMA-06**: State-machine guards are pure functions over a typed `GuardInput` that structurally excludes advisory deadline fields — a guard reaching for one is a compile error (AC-15b)
- [x] **SCHEMA-07**: A property test over 10,000 random inputs asserts every money field of a returned `Assessment` is an integer (AC-07b)

### State machine

- [x] **STATE-01**: `MatterStatus` is a closed set of seven states, and no other status value exists anywhere in the system (§5)
- [ ] **STATE-02**: Every transition is evaluated by a guarded state machine implementing §5's guard table, not by ad-hoc status writes (§5)
- [ ] **STATE-03**: Recompute before sign-off (`LEGAL_REVIEW` → `COMPUTING`) mutates the existing `Assessment` in place — same `id`, new pack and engine version, all dispositions cleared — rather than creating a new row (§5)
- [ ] **STATE-04**: A write to a `SIGNED_OFF` assessment fails at the database, not only at the API, which returns 409 (AC-33)
- [ ] **STATE-05**: A correction after sign-off creates a new assessment and marks the previous one `SUPERSEDED`, retaining it verbatim (AC-33)

### Engine

- [x] **ENGINE-01**: `assess()` is pure — no I/O, no network, no LLM import, and no clock read outside the injected `now` (§8.1)
- [x] **ENGINE-02**: Preconditions reject a stale or non-active pack, a controller type outside `appliesTo`, and a currency that is not the jurisdiction's — each as a typed error naming the reason and the expected value (AC-12, AC-42)
- [x] **ENGINE-03**: The posture gate returns every line `DISALLOW` for `PROHIBITED` and `PERMITTED_NARROW_EXCEPTION`, and every line `FLAG` with reason `NO_FEE_AUTHORITY` for `NO_EXPRESS_AUTHORITY`, with `draftBaseline` zero (AC-13, AC-14)
- [x] **ENGINE-04**: Per-line evaluation handles all five treatments — `ALLOW`, `ALLOW_WITH_CAP`, `ALLOW_IF`, `DISALLOW`, `FLAG` — with `ALLOW_IF` producing `CONDITIONS_NOT_MET` listing which conditions failed (§8.1)
- [x] **ENGINE-05**: `applyCap` supports `PER_UNIT`, `PER_LINE`, `PER_MATTER` and `PERCENT_OF_CLAIM`, and always rounds down (AC-07c)
- [x] **ENGINE-06**: Cross-line checks raise a flag and never a silent adjustment — duplicate category with near-identical description, staff rate above the pack ceiling, any line at 40% or more of the claim, implausible magnitude, and a third-party line not marked invoiced (§8.1)
- [x] **ENGINE-07**: An aggregate cap is applied pro-rata with each line rounded down and the residue left unallocated, and the assessment flags that the cap bit *(decision: PROJECT.md — the PRD does not specify residue allocation)*
- [x] **ENGINE-08**: Totals are computed per §8.1 step 6, and `finalAmount` is `null` until sign-off — unrepresentable as a number before then, never defaulted to `draftBaseline` (AC-25)
- [x] **ENGINE-09**: `FLAG` lines contribute zero to `draftBaseline`, and their claimed value appears only in `flaggedTotal` (AC-11)
- [x] **ENGINE-10**: `restingOnUnverifiedRules` equals the sum of allowed amounts whose applied rule is `NEEDS_VERIFICATION`, and is a subset of `draftBaseline` (AC-22)
- [x] **ENGINE-11**: Matter-level flags are evaluated from `matterFlagRules`, plus `LITIGATION_POSTURE`, `REPEAT_REQUEST` and `STALE_PACK_WARNING` (§8.1)
- [x] **ENGINE-12**: An `OTHER_UNCLASSIFIED` line always returns `FLAG`, regardless of pack, description or LLM suggestion, except where the posture gate has already forced every line to `DISALLOW` (AC-19)
- [x] **ENGINE-13**: A stored `claimedAmount` that does not equal `quantity × unitRate` on load raises a hard error and blocks submission (AC-08)
- [ ] **ENGINE-14**: Golden-file fixtures for the SG and HK packs reproduce exactly the expected verdicts, amounts, flags and totals, and changing a pack breaks its golden files (AC-09, §14)
- [x] **ENGINE-15**: Engine tests pass identically under at least two timezone and locale combinations, proving no hidden locale or clock dependence *(research)*
- [x] **ENGINE-16**: For a pack carrying a flat fee, the engine computes both the itemised baseline and the flat figure, and reports whether the flat figure exceeds itemised direct cost *(decision: PROJECT.md, PRD §17 q.2)*
- [x] **ENGINE-17**: An assessment of 50 lines completes in under 100ms (§11)

### Rule packs

- [ ] **PACK-01**: Packs load from repository JSON, validate against the schema, and fail the build on any error (AC-37)
- [ ] **PACK-02**: Every `ExpenseCategoryCode` resolves to a `CategoryRule` for every `ACTIVE` pack, and a missing category fails pack validation at build time rather than flagging at runtime (AC-10)
- [ ] **PACK-03**: A pack cannot reach `ACTIVE` without `reviewedBy`, `reviewedOn`, `reviewDueOn`, and all 21 categories authored (AC-38)
- [ ] **PACK-04**: A pack past `reviewDueOn` is `STALE` — new matters in that jurisdiction are refused with 409 naming the reason, while in-flight review continues under a full-width notice and the extended attestation (AC-39)
- [ ] **PACK-05**: Activating a new pack version does not alter any existing assessment's pinned version, verdicts or amounts (AC-40)
- [ ] **PACK-06**: A pack version's content is frozen once `ACTIVE`; any change requires a new version, enforced at the database rather than by service-layer discipline *(decision: PROJECT.md — gap AC-40 does not cover)*
- [ ] **PACK-07**: Activation is blocked where the activating user was the last editor, unless they hold `RULEPACK_AUTHOR` and confirm sole authorship, and the confirmation is audited (AC-41a)
- [ ] **PACK-08**: A user who activated a pack version cannot sign off an assessment pinned to that version within the same session, and the block names the reason and points to another reviewer (AC-41b)
- [ ] **PACK-09**: `HK-PDPO` and `SG-PDPA` are authored in full across all 21 categories and can reach `ACTIVE` (§7.5, §7.6)
- [ ] **PACK-10**: Seven stub packs ship as `DRAFT` with correct posture and constraints, every category rule `FLAG`, and every rule `NEEDS_VERIFICATION` (§7.4)
- [ ] **PACK-11**: No pack-authored `basis` string contains any canonical banned word, asserted by pack validation (AC-32a)
- [ ] **PACK-12**: The HK pack expresses its flat-fee figure alongside its category rules, in a schema extension that leaves the other eight packs unchanged *(decision: PROJECT.md)*

### Access control

- [ ] **ACCESS-01**: Routes are role-scoped `/hr/*`, `/legal/*`, `/admin/*`, with authorisation evaluated server-side on every request rather than by hiding UI (§10.1)
- [ ] **ACCESS-02**: An `HR_PREPARER` requesting an assessment for a matter in `LEGAL_REVIEW` receives 403, and the response body contains no assessment data (AC-01)
- [ ] **ACCESS-03**: No API response to an `HR_PREPARER` contains `verdict`, `engineAmount`, `basis`, `draftBaseline` or `lawyerReason` for a matter not in `SIGNED_OFF` (AC-02)
- [ ] **ACCESS-04**: Sign-off by a user without `LEGAL_REVIEWER` for the matter's jurisdiction is rejected (AC-03)
- [ ] **ACCESS-05**: `lawyerReason` and the internal rationale never appear in any `/hr/*` response or HR-facing document, including after sign-off (AC-04)
- [ ] **ACCESS-06**: Identity comes from a swappable provider seeded with test users, and no guard depends on which provider is in use *(decision: PROJECT.md — prototype framing)*
- [ ] **ACCESS-07**: No unreviewed assessment data reaches an HR user through a server-component payload or a cached response, tested as its own leak channel distinct from the API tests *(research)*
- [ ] **ACCESS-08**: Every endpoint is tested against every role, asserting on response bodies and not only status codes (§14)

### Personal-data boundary

- [ ] **BOUND-01**: No file-upload endpoint exists, and a multipart POST to any endpoint returns 415 (AC-05)
- [x] **BOUND-02**: No Prisma field and no form input name matches the personal-data deny-list, asserted over the generated client's field names and over the rendered DOM of every form route (AC-06)
- [ ] **BOUND-03**: Free-text fields enforce their length limits — 300, 500, 200, 1000 characters — and carry explicit warnings against entering personal data (§12.1)
- [ ] **BOUND-04**: A pattern check warns, and never blocks, on likely personal data in intake notes and in `lawyerReason` on the review screen (§12.1)
- [ ] **BOUND-05**: `AuditEvent.payload` stores only changed fields from the closed declared set, and an undeclared key is a validation error (§12.1)

### HR intake

- [ ] **INTAKE-01**: HR creates a matter with reference, jurisdiction, legal entity, controller type, request received date, currency and requestor class (§10.2)
- [ ] **INTAKE-02**: Selecting a jurisdiction shows the pack's status inline immediately, including "no usable rule pack — contact Legal" (§10.2)
- [ ] **INTAKE-03**: A jurisdiction whose posture is `NO_EXPRESS_AUTHORITY` or `PROHIBITED` shows the heads-up notice before any expense entry is offered (§10.2)
- [ ] **INTAKE-04**: Three attestations are captured as booleans, each with a one-line explanation of why it is being asked (§10.2)
- [ ] **INTAKE-05**: Expense lines are entered through a repeater with category-grouped selection, units constrained by category, and a computed read-only amount (§10.2)
- [ ] **INTAKE-06**: Category-contextual hints drawn from the pack are shown on category selection (§10.2)
- [ ] **INTAKE-07**: A running claimed total sits in a sticky footer labelled as the claim and not the fee (§10.2)
- [ ] **INTAKE-08**: A currency that is not the jurisdiction's designated currency is blocked as form-level validation and again server-side, naming both currencies (AC-42)
- [ ] **INTAKE-09**: Drafts autosave every 10 seconds with save state shown (§10.1)

### Navigation

- [ ] **NAV-01**: `/legal/queue` lists matters in `LEGAL_REVIEW` and `INFO_REQUEST` for the lawyer's jurisdiction, sortable by advisory deadline and age, with no SLA colouring or escalation that would make it case management *(research; bounded by NS-5)*
- [ ] **NAV-02**: `/hr/matters` lists the preparer's own matters and their status, serving as the in-app substitute for the notification NS-3 forbids sending *(research)*
- [ ] **NAV-03**: Queue and list are keyboard navigable, extending the existing shortcut help overlay *(research)*

### Legal review

- [ ] **REVIEW-01**: Every rendered assessment line displays its rule ID, pack-authored basis and citation without further interaction (AC-21)
- [ ] **REVIEW-02**: Every `FLAG` line shows its flag reasons in words (§9.2)
- [ ] **REVIEW-03**: `NEEDS_VERIFICATION` lines render with a distinct treatment, and `restingOnUnverifiedRules` is displayed indented under `draftBaseline` (AC-22)
- [ ] **REVIEW-04**: The lawyer can accept, reduce, strike, or allow each line, and may reduce but never edit HR's claimed figure (§3, §10.3)
- [ ] **REVIEW-05**: A mandatory reason of at least 10 non-whitespace characters, rejected against a shared stop-list used by both client and server, is required on `REDUCED`, `STRUCK`, `ALLOWED_BY_LAWYER`, and on `ACCEPTED` where the verdict was `FLAG` (AC-23)
- [ ] **REVIEW-06**: No headline total is rendered while any line is `PENDING`, enforced server-side and not only in the UI (AC-25)
- [ ] **REVIEW-07**: A bulk-accept control is offered only for `ALLOW` lines with `VERIFIED` rules, and the API rejects a batch disposition containing a `FLAG`, `ALLOW_CAPPED` or `NEEDS_VERIFICATION` line (AC-26)
- [ ] **REVIEW-08**: Review is keyboard-first — `j`/`k` to move, `a` accept, `r` reduce, `s` strike, `?` for help — so a 20-line review needs no mouse (§10.1)
- [ ] **REVIEW-09**: The lawyer can raise a query on one or more lines, moving the matter to `INFO_REQUEST` (§5)
- [ ] **REVIEW-10**: The lawyer can recompute against a newer pack version after an explicit confirmation that all dispositions will be discarded (§10.7)
- [ ] **REVIEW-11**: Where the pack carries a flat fee, the lawyer sees both figures and chooses, with the flat fee blocked where it exceeds itemised direct cost *(decision: PROJECT.md)*
- [ ] **REVIEW-12**: The expense category is shown alongside HR's own description on every review card, including supported lines (§9.1 R3)

### Sign-off

- [ ] **SIGNOFF-01**: Sign-off with any line in `PENDING` returns 409 and names the pending lines (AC-16)
- [ ] **SIGNOFF-02**: Sign-off is blocked until every matter-level flag requiring acknowledgement appears in `acknowledgedFlags` (AC-24)
- [ ] **SIGNOFF-03**: The attestation is recorded verbatim by version, with the extended wording appended where the pack is `STALE` (§9.5)
- [ ] **SIGNOFF-04**: Sign-off records the lawyer, name, qualification, timestamp, final amount and pinned pack version (§6.4)
- [ ] **SIGNOFF-05**: HR sees the signed-off figure, the reviewing lawyer, and both allowed and struck items with their plain-language basis (§10.4)
- [ ] **SIGNOFF-06**: HR can mark the notice sent, recording the date only, with a visible note that the tool emails nobody (§10.4, NS-3)

### Documents

- [ ] **DOC-01**: The internal fee assessment record generates as a PDF carrying matter details, pack and engine version, every line with verdict, rule, basis, citation, disposition and lawyer's reason, matter flags, and the sign-off block with verbatim attestation (AC-18)
- [ ] **DOC-02**: The requestor-facing notice generates as copy-to-clipboard text from the pack's template, watermarked DRAFT until HR marks it sent (§10.4, §10.5)
- [ ] **DOC-03**: The requestor notice contains no rule ID, no citation, no basis string and no mention of AI or of this tool, asserted by regex over the generated text (AC-17)
- [ ] **DOC-04**: A zero-allowable outcome produces a valid notice stating that no fee is charged, treated as a normal result rather than an error (AC-14)
- [ ] **DOC-05**: Every page of the internal record carries the disclosure footer naming pack version, engine version, AI-drafted paragraphs and the signing lawyer (§10.5)

### Audit

- [ ] **AUDIT-01**: Every state transition, line disposition, pack activation and sign-off emits an audit event with actor, role, server timestamp, before and after, pack version and engine version (AC-35)
- [ ] **AUDIT-02**: The application database role has no UPDATE, DELETE or TRUNCATE on the audit table, and an attempted update fails at the database (AC-34, extended per research)
- [ ] **AUDIT-03**: Elapsed review time is recorded on every `LINE_DISPOSITIONED` and `SIGNED_OFF` event, measured from when the reviewer first opened the assessment (§6.5)
- [ ] **AUDIT-04**: The DPO can export the audit log (§3)

### Risk disclosure

- [ ] **DISC-01**: The capability statement is a full page that cannot be skipped, requires typing an acknowledgement, and is re-shown whenever `statementVersion` increments (AC-30)
- [ ] **DISC-02**: A non-dismissible status strip renders on every authenticated screen with jurisdiction, pack id and version, reviewing lawyer, reviewed date and review-due state (AC-31)
- [ ] **DISC-03**: No engine-derived UI string contains any canonical banned word, asserted by a lint rule over the strings file (AC-32a)
- [ ] **DISC-04**: Every verdict badge's accessible name includes its verdict in words, and no badge conveys verdict by colour alone (AC-32b)
- [ ] **DISC-05**: Every rendered deadline figure carries the word "Advisory" within its own container (AC-15a)
- [ ] **DISC-06**: Empty, error and edge states behave exactly as specified in §10.7 rather than being improvised (§10.7)

### LLM boundary

- [ ] **LLM-01**: Job 1 suggests a category for an `OTHER_UNCLASSIFIED` line as advisory text only, never changing a verdict or an amount, with the line remaining `FLAG` until a lawyer accepts explicitly (AC-27)
- [ ] **LLM-02**: Accepting a suggestion re-runs the engine (§8.2)
- [ ] **LLM-03**: Output is parsed against a zod schema, and a parse failure falls back to deterministic template text with no retry loop (AC-28)
- [ ] **LLM-04**: Prompts are versioned files in the repository, and `promptVersion` is recorded on every assessment (§8.2)
- [ ] **LLM-05**: Every LLM-generated string is stored with an `aiGenerated` marker persisted at write time and rendered with a visible label (AC-29)
- [ ] **LLM-06**: No file under `packages/agent/prompts/` contains a statutory citation pattern or a `ruleId` pattern (AC-36a)
- [ ] **LLM-07**: Every monetary figure and every citation-shaped substring in LLM text must appear verbatim in the engine output for that assessment, or the draft is discarded and template text substituted (AC-36b, AC-36c)
- [ ] **LLM-08**: With the provider unavailable or returning invalid output, the assessment completes on template text and the UI says so (AC-28)
- [ ] **LLM-09**: The package has no tool use, no web access and no retrieval (NS-8)
- [ ] **LLM-10**: Confidence is rendered as the three-value categorical label only, never as a percentage or a progress bar *(research: anti-feature)*

---

## v2 Requirements

Acknowledged and deliberately deferred. Not in the current roadmap.

### Navigation and review quality-of-life

- **V2-NAV-01**: Matter history timeline — a plain-language rendering of the `AuditEvent` stream, redacting `lawyerReason` outside `/legal/*`. Data is already captured; this is a rendering layer
- **V2-NAV-02**: Client-side persistence of a lawyer's half-typed reason text across navigation. Must stay client-side, or partially-formed reasoning enters the audit-adjacent model before a disposition is committed
- **V2-NAV-03**: Search and filter across matters by reference, jurisdiction, status and date range
- **V2-NAV-04**: Metadata-only "start similar matter" — pre-fills jurisdiction, entity, controller type and requestor class, and excludes expense-line copying at the code level rather than by UI convention

### Instrumentation

- **V2-MON-01**: The §9.6 monthly QA report as a scheduled SQL-backed report to the DPO and product owner
- **V2-MON-02**: Private self-monitoring view showing a lawyer their own change rate and median review duration — visible only to themselves, never ranked or compared

### LLM

- **V2-LLM-01**: Job 2 — plain-language rationale drafting for the internal record, under the verbatim-validation guard
- **V2-LLM-02**: Job 3 — summarising the lawyer's queries into a clarification note for HR

### Deployment and coverage

- **V2-DEP-01**: Corporate SSO via the IdP, with role assignment by IdP group
- **V2-DEP-02**: Data residency and retention confirmed with the DPO
- **V2-PACK-01**: Authoring the remaining seven packs, each gated on named local counsel
- **V2-DOC-01**: Requestor-facing notice as a PDF in addition to text

---

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

### From the PRD (§4.2)

| Feature | Reason |
|---------|--------|
| Identity verification of the requestor (NS-1) | Assumed to have happened upstream; the tool records a boolean attestation only |
| Ambiguity/clarification assessment of requested items (NS-2) | HR and Legal do this outside the tool |
| Outbound email of any kind (NS-3) | The tool produces a draft notice; a human sends it from their own mail client |
| Retrieval, storage or processing of the requestor's personal data (NS-4) | An architectural boundary, not a phasing decision — §12.1 |
| DSAR case management, deadline tracking as a system of record, SLA workflow (NS-5) | Deadlines are advisory display only |
| Post-hoc audit or sampling agent (NS-6) | v1 emits the data that would make it possible; the agent waits for volume |
| Automatic sign-off, confidence-gated approval, bulk approval of flagged lines (NS-7) | A rubber-stamped output has the appearance of legal review without the substance |
| Legal research at runtime (NS-8) | No web search, no reading statutes, no first-principles reasoning. The agent applies the rule pack |
| Invoicing, payment collection, accounting integration (NS-9) | Not the tool's job |
| GDPR/EU pack (NS-10) | Recorded in the schema so it is not later found to be EU-hostile; not built |

### Anti-features identified by research

| Feature | Reason |
|---------|--------|
| Numeric confidence score shown to the lawyer | The engine is deterministic — there is no statistical confidence to report. Rendering LLM Job 1's categorical label as a percentage manufactures false precision and invites anchoring, which is the vigilance decrement §9.4 exists to prevent |
| "Similar past matters" / precedent-matching during review | One short step from NS-8's barred runtime legal research, and it undercuts the §9.5 attestation by anchoring the lawyer on an outcome that is not the versioned pack speaking |
| Reviewer leaderboards or throughput metrics visible to reviewers | The fastest way to manufacture the exact failure M2 exists to catch — the PRD is explicit that a low change rate is a failure signal, not a success one |
| Confidence-gated review routing or risk-scored fast-paths | NS-7 wearing different clothes. AC-26's bulk-accept carve-out is drawn precisely and must not be widened under any framing |
| Open-ended AI chat over the matter | Conflicts with the three-job schema-constrained boundary and with NS-8, and risks an unconstrained prompt pulling in privileged `lawyerReason` |
| Auto-population of expense lines from a prior matter or template | Claimed amounts must reflect what was actually incurred for this DSAR. Pre-filling normalises copy-paste claiming and erodes the intake friction that is doing real work |
| Matter cloning that duplicates expense lines | The same failure in a different UI wrapper, and a far more common feature request — worth naming separately so it cannot arrive unnoticed |

### From scoping decisions

| Feature | Reason |
|---------|--------|
| Flat-fee-only intake for HK | You cannot show a flat fee stays below direct cost without itemising the direct cost — PRD §17 q.2 |
| Flat fee as an aggregate ceiling | Already expressible as `constraints.aggregateCap` with type `PER_MATTER`, and it can only ever reduce a fee, never set one |
| Server-persisted review drafts | Would put partially-formed legal reasoning into the audit-adjacent data model before a disposition is committed |
| Turborepo or Nx for boundary enforcement | Neither can express "no I/O in `packages/engine`" — that is an import-target question, which `dependency-cruiser` answers and a task graph does not |

---

## Traceability

Every v1 requirement maps to exactly one phase in `.planning/ROADMAP.md`.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHEMA-01 | Phase 1 | Complete |
| SCHEMA-02 | Phase 1 | Complete |
| SCHEMA-03 | Phase 1 | Complete |
| SCHEMA-04 | Phase 1 (schema) + 3.2 (database) | Complete |
| SCHEMA-05 | Phase 1 | Complete |
| SCHEMA-06 | Phase 1 | Complete |
| SCHEMA-07 | Phase 1 | Complete |
| STATE-01 | Phase 1 (schema) + 3.2 (database) | Complete |
| STATE-02 | Phase 4 | Pending |
| STATE-03 | Phase 4 | Pending |
| STATE-04 | Phase 4 | Pending |
| STATE-05 | Phase 4 | Pending |
| ENGINE-01 | Phase 2 | Complete |
| ENGINE-02 | Phase 2 | Complete |
| ENGINE-03 | Phase 2 | Complete |
| ENGINE-04 | Phase 2 | Complete |
| ENGINE-05 | Phase 2 | Complete |
| ENGINE-06 | Phase 2 | Complete |
| ENGINE-07 | Phase 2 | Complete |
| ENGINE-08 | Phase 2 | Complete |
| ENGINE-09 | Phase 2 | Complete |
| ENGINE-10 | Phase 2 | Complete |
| ENGINE-11 | Phase 2 | Complete |
| ENGINE-12 | Phase 2 | Complete |
| ENGINE-13 | Phase 2 | Complete |
| ENGINE-14 | Phase 6 | Pending |
| ENGINE-15 | Phase 2 | Complete |
| ENGINE-16 | Phase 2 | Complete |
| ENGINE-17 | Phase 2 | Complete |
| PACK-01 | Phase 3 | Pending |
| PACK-02 | Phase 3 | Pending |
| PACK-03 | Phase 3 | Pending |
| PACK-04 | Phase 3 | Pending |
| PACK-05 | Phase 3 | Pending |
| PACK-06 | Phase 3 | Pending |
| PACK-07 | Phase 3 | Pending |
| PACK-08 | Phase 7 | Pending |
| PACK-09 | Phase 3 | Pending |
| PACK-10 | Phase 3 | Pending |
| PACK-11 | Phase 3 | Pending |
| PACK-12 | Phase 3 | Pending |
| ACCESS-01 | Phase 3.2 | Pending |
| ACCESS-02 | Phase 6 | Pending |
| ACCESS-03 | Phase 6 | Pending |
| ACCESS-04 | Phase 7 | Pending |
| ACCESS-05 | Phase 7 | Pending |
| ACCESS-06 | Phase 3.2 | Pending |
| ACCESS-07 | Phase 6 | Pending |
| ACCESS-08 | Phase 3.2 | Pending |
| BOUND-01 | Phase 3.2 | Pending |
| BOUND-02 | Phase 1 | Complete |
| BOUND-03 | Phase 5 | Pending |
| BOUND-04 | Phase 5 | Pending |
| BOUND-05 | Phase 4 | Pending |
| INTAKE-01 | Phase 5 | Pending |
| INTAKE-02 | Phase 5 | Pending |
| INTAKE-03 | Phase 5 | Pending |
| INTAKE-04 | Phase 5 | Pending |
| INTAKE-05 | Phase 5 | Pending |
| INTAKE-06 | Phase 5 | Pending |
| INTAKE-07 | Phase 5 | Pending |
| INTAKE-08 | Phase 5 | Pending |
| INTAKE-09 | Phase 5 | Pending |
| NAV-01 | Phase 6 | Pending |
| NAV-02 | Phase 5 | Pending |
| NAV-03 | Phase 6 | Pending |
| REVIEW-01 | Phase 6 | Pending |
| REVIEW-02 | Phase 6 | Pending |
| REVIEW-03 | Phase 6 | Pending |
| REVIEW-04 | Phase 6 | Pending |
| REVIEW-05 | Phase 6 | Pending |
| REVIEW-06 | Phase 6 | Pending |
| REVIEW-07 | Phase 6 | Pending |
| REVIEW-08 | Phase 6 | Pending |
| REVIEW-09 | Phase 6 | Pending |
| REVIEW-10 | Phase 6 | Pending |
| REVIEW-11 | Phase 6 | Pending |
| REVIEW-12 | Phase 6 | Pending |
| SIGNOFF-01 | Phase 7 | Pending |
| SIGNOFF-02 | Phase 7 | Pending |
| SIGNOFF-03 | Phase 7 | Pending |
| SIGNOFF-04 | Phase 7 | Pending |
| SIGNOFF-05 | Phase 7 | Pending |
| SIGNOFF-06 | Phase 7 | Pending |
| DOC-01 | Phase 7 | Pending |
| DOC-02 | Phase 7 | Pending |
| DOC-03 | Phase 7 | Pending |
| DOC-04 | Phase 7 | Pending |
| DOC-05 | Phase 7 | Pending |
| AUDIT-01 | Phase 4 | Pending |
| AUDIT-02 | Phase 3.2 | Pending |
| AUDIT-03 | Phase 4 | Pending |
| AUDIT-04 | Phase 4 | Pending |
| DISC-01 | Phase 5 | Pending |
| DISC-02 | Phase 5 | Pending |
| DISC-03 | Phase 5 | Pending |
| DISC-04 | Phase 6 | Pending |
| DISC-05 | Phase 5 | Pending |
| DISC-06 | Phase 7 | Pending |
| LLM-01 | Phase 8 | Pending |
| LLM-02 | Phase 8 | Pending |
| LLM-03 | Phase 8 | Pending |
| LLM-04 | Phase 8 | Pending |
| LLM-05 | Phase 8 | Pending |
| LLM-06 | Phase 8 | Pending |
| LLM-07 | Phase 8 | Pending |
| LLM-08 | Phase 8 | Pending |
| LLM-09 | Phase 8 | Pending |
| LLM-10 | Phase 8 | Pending |

**Coverage:**

- v1 requirements: 109 total
- Mapped to phases: 109
- Unmapped: 0 ✓
- Duplicated across phases: 0 ✓

**Phase totals:** Phase 1 — 14 · Phase 2 — 16 · Phase 3 — 11 · Phase 4 — 8 · Phase 5 — 16 · Phase 6 — 19 · Phase 7 — 15 · Phase 8 — 10

---
*Requirements defined: 2026-09-13*
*Last updated: 2026-09-13 after roadmap creation*
