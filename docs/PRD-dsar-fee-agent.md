# PRD — DSAR Fee Assessment Agent ("Fee Calculator")
**Product owner:** Roger Lui (Legal)
**Version:** 0.1 (draft for build)
**Date:** 7 September 2026
**Status:** Ready for implementation
**Intended reader:** a coding agent (Claude Code) and the engineer supervising it
---
## 0. How to build from this document
Read this whole file before writing code. Then build in this order:
1. `packages/schemas` — the types and validators in §6 and §7. Nothing else compiles until these exist.
2. `packages/engine` — the deterministic evaluator in §8.1. Pure functions, no I/O, no network, no LLM. Write the golden-file tests in §14 alongside it.
3. `packages/rulepacks` — the rule packs in §7.4, plus the loader and validator.
4. `apps/web` — the four screens in §10 (three role-scoped, plus rule-pack admin), against the HTML mockup supplied as Annex A.
5. `packages/agent` — the LLM boundary in §8.2. **Build this last.** Everything must work with the LLM stubbed out.
Non-negotiables, in priority order, when this document is ambiguous:
- **The LLM never does arithmetic.** All money is computed by `packages/engine`.
- **HR never sees an unreviewed assessment.** Enforced server-side by role, not by hiding UI.
- **No output leaves the system without a named lawyer's sign-off** recorded in the audit log.
- **When in doubt, the engine flags rather than decides.** A flagged line contributes nothing to any total until a lawyer dispositions it.
- **Every agent in the pipeline recommends; only a named lawyer decides.** As identity-verification, correspondence-drafting, and audit agents are added around this one (§16), none of them acts autonomously or notifies HR or the requestor directly. Each hands its output to Legal for review, exactly as the fee engine does now. See §3.1.
If a requirement here conflicts with one of those five, the five win. If you cannot satisfy a requirement, stop and raise it rather than inventing a legal rule.

---
## 1. Problem
When an ex-employee makes a data subject access request ("DSAR"), HR retrieves and collates the personal data, incurring real costs: staff time, photocopying, secure delivery, and third-party charges (typically the payroll vendor, for salary and tax records). Several Asian privacy regimes permit the employer, as controller, to recover some of those costs from the requestor. Others permit nothing. The rules differ by regime on *whether* a fee may be charged, *which* cost items are recoverable, *what standard* applies ("reasonable", "not excessive", "actual cost"), and *when* the fee must be notified.
Today this determination lands on a lawyer every time. It is high-frequency, low-variety legal work: the same statutory analysis re-performed against a new list of line items. The analysis genuinely requires legal judgement — it is the interpretation and application of local law to specific claimed costs — so it cannot be handed to HR. But it is a poor use of billable legal hours.
**Cost of the status quo:** a lawyer spends 45–120 minutes per DSAR reconstructing an analysis they have performed many times, with no reusable work product and no consistency between matters or between lawyers.
**Cost of getting it wrong:** an over-claimed fee invites a regulator complaint, is evidence of obstruction if the DSAR precedes employment litigation, and in some regimes is itself a breach. An under-claimed fee costs the company a few hundred dollars. **The risk is materially asymmetric, and the product must be biased accordingly.**
## 2. Objective and success measures
Build a web tool where HR enters a list of claimed expenses, a deterministic engine applies a versioned, lawyer-authored rule pack for the relevant jurisdiction, and a lawyer reviews and signs off a proposed fee before HR ever sees a figure.
| # | Measure | Baseline | Target (6 months post-launch) |
|---|---|---|---|
| M1 | Median lawyer minutes per fee assessment | 45–120 | ≤ 15 |
| M2 | Assessments where the lawyer changes at least one line | n/a | 20–40% — see note |
| M3 | Assessments signed off within the jurisdiction's fee-notification deadline | unmeasured | ≥ 98% |
| M4 | Fee decisions challenged by a requestor or regulator | unmeasured | no increase vs. baseline |
| M5 | Rule packs within their review-due date at any time | n/a | 100% |
**Note on M2.** A change rate near zero is a failure signal, not a success signal: it means the lawyer is rubber-stamping, or the engine is trivially conservative. A change rate above ~50% means the packs are wrong. Instrument for this and report it monthly (§9.6).
## 3. Users and roles
| Role | Who | Can do | Cannot do |
|---|---|---|---|
| `HR_PREPARER` | HR Shared Services | Create a matter; enter and edit expense lines; submit for legal review; view the **signed-off** assessment and the requestor-facing notice | See any draft assessment, verdict, rationale, or figure before sign-off. See the internal legal rationale ever. |
| `LEGAL_REVIEWER` | Qualified lawyer in the relevant jurisdiction or supervising counsel | View the draft assessment; accept / reduce / strike each line; disposition flagged lines; sign off; return to HR for clarification | Edit HR's underlying claimed figures (they may only reduce the allowed amount, and must record why) |
| `RULEPACK_AUTHOR` | Nominated counsel per jurisdiction | Draft, review and activate rule packs; set review-due dates | Activate a pack they were the last editor of, without an audited sole-authorship confirmation — see AC-41 |
| `DPO_ADMIN` | Data Protection Officer | Read-only across all matters; export audit log; run the QA sample report | Alter any assessment or audit record |
Roles are mutually exclusive per matter. One person may hold `LEGAL_REVIEWER` and `RULEPACK_AUTHOR` globally.
### 3.1 Governance principle: Legal owns the pipeline, HR only feeds it
This product rests on a single, durable design stance, stated here so it survives well past this PRD: **Legal makes every determination that reaches HR or the requestor; HR only supplies inputs for Legal to review.** As more agents are added around this fee-assessment core — identity verification (§16 Phase 3), requestor correspondence drafting (§16 Phase 4), post-hoc audit (§16 Phase 5) — none of them may shortcut this. Each new agent's output is a draft or a recommendation that Legal reviews before anything moves; none of them notifies HR or the requestor on its own.
The analogy worth keeping in mind when scoping future phases: this is an **Airbnb-style** workflow, not a **Booking.com** one. A traveller (HR) can enter a wish list and other inputs freely, but the host (Legal) always makes the final call before a reply goes out — never an instant, discretion-free confirmation. Any future proposal that lets HR or the requestor see or act on an agent's output before Legal has reviewed it is out of scope, however much efficiency it promises, and should be raised with the product owner rather than built.
## 4. Scope
### 4.1 In scope (v1)
- Web UI, three role-scoped screens plus a rule-pack admin screen.
- Nine jurisdiction rule packs (§7.4), of which two are fully worked and seven are stubs pending counsel authoring.
- Deterministic fee computation with per-line legal basis and citation.
- Flag-and-defer behaviour for unsettled rules and thin facts.
- Legal review, per-line override, and mandatory sign-off gate.
- Two generated documents: an internal assessment record and a requestor-facing fee notice draft.
- Append-only audit log.
- Multi-currency, single currency per matter.
### 4.2 Explicitly NOT in scope (v1) — do not build these
Numbered so they can be cited in review. **A coding agent reading this must not helpfully implement any of them.**
- **NS-1** Identity verification of the requestor. Out of scope entirely. The tool assumes verification already happened upstream and records only a boolean attestation.
- **NS-2** Ambiguity/clarification assessment of the requested items. Out of scope. HR and Legal do this outside the tool.
- **NS-3** Automated email to the requestor, or any outbound email at all. The tool produces a draft notice; a human sends it from their own mail client.
- **NS-4** Retrieval, storage, or processing of the requestor's actual personal data. See §12.1 — this is a hard architectural boundary, not a phasing decision.
- **NS-5** DSAR case management, deadline tracking as a system of record, or SLA workflow. Deadlines are displayed as advisory only, with a warning to that effect.
- **NS-6** Post-hoc audit / sampling agent. Contemplated for when volume reaches the hundreds per month; v1 only needs to emit the data that would make it possible.
- **NS-7** Any form of automatic sign-off, "auto-approve if confidence high", or bulk approval of flagged lines.
- **NS-8** Legal research at runtime. The agent does not search the web, read statutes, or reason from first principles about the law. It applies the rule pack. Full stop.
- **NS-9** Invoicing, payment collection, or accounting integration.
- **NS-10** GDPR/EU handling. Noted in §7.4 as a future pack because the group may have EU touchpoints, but not built.
### 4.3 Assumptions
- One jurisdiction per matter. Multi-jurisdiction requests are split into separate matters by HR.
- The employer is a private-sector organisation, not a public agency. Several packs turn on this distinction (§7.4) and the engine must not silently assume it — see AC-12.
- Rule packs are authored and reviewed by qualified counsel. **The product ships with drafts, not with legal advice.**
---
## 5. Workflow and state machine
```
                    ┌──────────────────────────────────────────┐
                    │                                          │
   HR creates       │        HR revises                        │
   ┌─────────┐      │      ┌──────────────┐                    │
   │  DRAFT  │──────┴─────▶│ INFO_REQUEST │◀───────┐           │
   └────┬────┘             └──────┬───────┘        │ Legal      │
        │ submit                  │ resubmit       │ returns    │
        ▼                         ▼                │            │
   ┌──────────────────────────────────────┐        │            │
   │            COMPUTING                 │        │            │
   │  engine evaluates lines vs rule pack │        │            │
   └────────────────┬─────────────────────┘        │            │
                    ▼                              │            │
   ┌──────────────────────────────────────┐         │            │
   │          LEGAL_REVIEW                │─────────┘            │
   │  every line ALLOW / ALLOW_CAPPED /   │                      │
   │  DISALLOW / FLAG                     │                      │
   │  flagged lines block sign-off        │──────────────────────┘
   └────────────────┬─────────────────────┘
                    │ sign off (named lawyer + timestamp)
                    ▼
   ┌──────────────────────────────────────┐
   │            SIGNED_OFF                │  immutable
   │  HR sees figure + notice draft       │
   └────────────────┬─────────────────────┘
                    │ HR marks sent / superseded
                    ▼
        ┌───────────────────────┐
        │  CLOSED / SUPERSEDED  │
        └───────────────────────┘
```
**States.** `MatterStatus` is exactly this closed set — no other status value exists anywhere in the system:
```ts
type MatterStatus =
  | 'DRAFT' | 'COMPUTING' | 'LEGAL_REVIEW' | 'INFO_REQUEST'
  | 'SIGNED_OFF' | 'CLOSED' | 'SUPERSEDED';
```
**Transition rules (implement as a guarded state machine, not as ad-hoc status fields):**
| From | To | Guard |
|---|---|---|
| `DRAFT` | `COMPUTING` | ≥1 expense line; jurisdiction set; active non-stale rule pack exists for that jurisdiction; `matter.currency` equals that jurisdiction's designated currency (§6.0); HR attestations addressed (§10.2) |
| `COMPUTING` | `LEGAL_REVIEW` | engine returned a complete assessment for every line |
| `COMPUTING` | `DRAFT` | engine error, or rule pack failed validation — surface the reason |
| `LEGAL_REVIEW` | `INFO_REQUEST` | lawyer raises a query on ≥1 line |
| `INFO_REQUEST` | `COMPUTING` | HR resubmits (re-runs the engine — the pack may have changed) |
| `LEGAL_REVIEW` | `COMPUTING` | lawyer elects to recompute against a newer pack version (§10.7); **all dispositions are discarded**, confirmed first |
| `LEGAL_REVIEW` | `SIGNED_OFF` | **zero** lines in `PENDING` disposition; every matter-level flag acknowledged; lawyer identity recorded; rule pack version pinned |
| `SIGNED_OFF` | `CLOSED` | HR marks the requestor-facing notice as sent; records the date only (no email — NS-3) |
| `SIGNED_OFF` or `CLOSED` | `SUPERSEDED` | a new assessment is raised on the same matter; the old one is retained verbatim |
**Recompute is a mutation, not a new record.** When a lawyer elects to recompute against a newer pack version (`LEGAL_REVIEW` → `COMPUTING`), the existing `Assessment` row is updated in place — same `id`, new `rulePackVersion`, `engineVersion`, `computedAt`, lines and totals, with all dispositions cleared — rather than a new `Assessment` being created. This is permitted only because the record has not yet reached `SIGNED_OFF`; it has no bearing on `SUPERSEDED`, which exists solely for corrections *after* sign-off (AC-33).
`SIGNED_OFF` records are immutable. A correction is a new assessment that supersedes, never an edit. (AC-33)

---
## 6. Data model
TypeScript / zod. Generate JSON Schema from these for the LLM boundary in §8.2.
### 6.0 Shared primitives — declare these first
Everything below and in §7.2 depends on these. They are listed here so nothing in this PRD references an undeclared type.
```ts
type ULID = string;
type ISODate = string;              // "2026-08-20"
type ISODateTime = string;          // server-generated, UTC
type Minor = number & { __brand: 'Minor' };   // integer minor units; see §15
type JurisdictionCode = 'SG' | 'HK' | 'AU' | 'NZ' | 'JP' | 'KR' | 'CN' | 'IN' | 'VN';
type CurrencyCode = 'SGD' | 'HKD' | 'AUD' | 'NZD' | 'JPY' | 'KRW' | 'CNY' | 'INR' | 'VND';
// Each jurisdiction has exactly one designated currency. A Matter's currency must
// equal this mapping's value for its jurisdictionCode — see §8.1 step 1 and AC-42.
// This is deliberately not a per-pack field: it is a property of the jurisdiction,
// not of any one rule pack version.
const JURISDICTION_CURRENCY: Record<JurisdictionCode, CurrencyCode> = {
  SG: 'SGD', HK: 'HKD', AU: 'AUD', NZ: 'NZD', JP: 'JPY',
  KR: 'KRW', CN: 'CNY', IN: 'INR', VN: 'VND',
};
type ControllerType = 'PRIVATE_ORGANISATION' | 'PUBLIC_AGENCY';
type Role = 'HR_PREPARER' | 'LEGAL_REVIEWER' | 'RULEPACK_AUTHOR' | 'DPO_ADMIN';
type StaffGrade = 'ADMIN' | 'EXECUTIVE' | 'MANAGER' | 'SENIOR_MANAGER' | 'SPECIALIST';
type UserRef = { id: ULID; displayName: string; email: string };
type Instrument = {
  title: string;
  provisions: string[];             // e.g. ["s.28(2)", "s.28(3)", "DPP6"]
  revised?: string;                 // "2020-07"
  url?: string;
};
type Citation = {
  instrument: string;               // short form shown in the UI
  provision: string;
  guidance?: string;
  note?: string;
};
// Machine-evaluable only. No free-text predicates, no expressions to eval.
type Condition =
  | { field: keyof ExpenseLine | keyof Matter; op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'; value: string | number | boolean }
  | { field: keyof ExpenseLine | keyof Matter; op: 'in'; value: (string | number)[] }
  | { field: keyof ExpenseLine | keyof Matter; op: 'isNull' | 'isNotNull' };
type FlagReasonCode =
  | 'NO_FEE_AUTHORITY' | 'CONDITIONS_NOT_MET' | 'POSSIBLE_DUPLICATE'
  | 'RATE_ABOVE_EXPECTED' | 'MATERIALITY' | 'DATA_QUALITY'
  | 'VENDOR_EVIDENCE_MISSING' | 'UNCATEGORISED' | 'AGGREGATE_CAP_APPLIED';
type FlagReason = { code: FlagReasonCode; message: string };   // message ≤ 200 chars
type MatterFlagCode =
  | 'LITIGATION_POSTURE' | 'REPEAT_REQUEST' | 'STALE_PACK_WARNING'
  | 'NO_FEE_AUTHORITY_POSTURE' | 'PACK_FLAG';                  // PACK_FLAG = from matterFlagRules
type MatterFlag = {
  id: string;                       // stable, e.g. "SG.WRITTEN_ESTIMATE"
  code: MatterFlagCode;
  message: string;
  requiresAcknowledgement: boolean;
};
type MatterFlagRule = {
  flagId: string;
  when: { always: true } | Condition | { field: 'lineCount'; op: 'gte' | 'lte'; value: number };
  message: string;
  requiresAcknowledgement?: boolean; // default false
};
type AuditEventType =
  | 'MATTER_CREATED' | 'LINE_ADDED' | 'LINE_EDITED' | 'LINE_DELETED'
  | 'SUBMITTED' | 'COMPUTED' | 'COMPUTE_FAILED'
  | 'LINE_DISPOSITIONED' | 'DISPOSITION_UNDONE' | 'INFO_REQUESTED'
  | 'FLAG_ACKNOWLEDGED' | 'SIGNED_OFF' | 'NOTICE_MARKED_SENT'
  | 'SUPERSEDED' | 'PACK_ACTIVATED' | 'PACK_EDITED'
  | 'CAPABILITY_STATEMENT_ACKNOWLEDGED';
type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
```
### 6.1 Matter
```ts
type Matter = {
  id: string;                       // ULID
  reference: string;                // human ref, e.g. "DSAR-2026-0142"
  jurisdictionCode: JurisdictionCode;
  legalEntity: string;              // employing entity, free text
  controllerType: 'PRIVATE_ORGANISATION' | 'PUBLIC_AGENCY';
  requestReceivedOn: string;        // ISO date
  requestorClass: 'FORMER_EMPLOYEE' | 'CURRENT_EMPLOYEE' | 'OTHER';
  currency: CurrencyCode;           // ISO 4217, one per matter; must equal
                                     // JURISDICTION_CURRENCY[jurisdictionCode] (§6.0, AC-42)
  // Attestations by HR. Booleans only — NEVER the underlying evidence. See §12.1.
  identityVerified: boolean;                // NS-1: attested, not performed here
  identityVerifiedNote: string | null;       // max 200 chars, no personal data
  scopeClarified: boolean;                   // NS-2: attested, not performed here
  isRepeatRequestWithin12Months: boolean;
  isKnownDisputeOrLitigation: boolean;       // drives a mandatory flag, §9.4
  status: MatterStatus;
  createdBy: UserRef;
  createdAt: string;
};
```
`isKnownDisputeOrLitigation` is load-bearing. An ex-employee DSAR is frequently a precursor to a claim, and a fee that is defensible in the abstract can still be a bad idea in that posture. When true, the engine adds a mandatory advisory flag on the assessment as a whole (not on a line), which the lawyer must acknowledge before sign-off. (AC-24)
### 6.2 Expense line (HR's input — the "wish list")
```ts
type ExpenseLine = {
  id: string;
  matterId: string;
  seq: number;
  categoryCode: ExpenseCategoryCode;   // from the closed taxonomy, §6.3
  description: string;                 // max 300 chars, purpose of the cost
  quantity: number;                    // > 0
  unit: 'HOUR' | 'PAGE' | 'ITEM' | 'GIGABYTE' | 'FIXED';
  unitRate: number;                    // in matter currency, minor units (integers)
  claimedAmount: number;               // = quantity * unitRate, computed, never typed
  incurredByGrade: StaffGrade | null;  // for staff-time categories
  isThirdPartyInvoiced: boolean;
  vendorName: string | null;
  evidenceRef: string | null;          // pointer to a doc in the DMS, not the doc
  hrNote: string | null;               // max 500 chars
};
```
`claimedAmount` is derived and stored for audit reproducibility, but recomputed and compared on load; a mismatch is a hard error. (AC-08)
### 6.3 Expense category taxonomy (closed set)
This closed set is the single most important design decision in the product. Because HR picks from a fixed list rather than typing free text, ~95% of lines are classified without any LLM involvement, and the whole calculation becomes deterministic and testable. Do not add a free-text category field. `OTHER_UNCLASSIFIED` is the only escape hatch and it is **always** flagged for legal, never scored. (AC-19)
| Code | Label (shown to HR) |
|---|---|
| `STAFF_TIME_SEARCH` | Staff time — locating and retrieving the data |
| `STAFF_TIME_COLLATE` | Staff time — collating, copying, compiling the response |
| `STAFF_TIME_REDACT_THIRD_PARTY` | Staff time — redacting other people's data |
| `STAFF_TIME_REDACT_EXEMPT` | Staff time — redacting exempt or withheld material |
| `STAFF_TIME_ASSESS_EXEMPTIONS` | Staff time — deciding what may be withheld |
| `STAFF_TIME_LEGAL_REVIEW` | Legal review time (in-house or external) |
| `PROFESSIONAL_REVIEW` | Specialist review necessary to release the data (e.g. clinician for medical records) |
| `PHOTOCOPY_PRINT` | Photocopying and printing |
| `MEDIA_MATERIALS` | Physical media and materials (USB, binders, envelopes) |
| `POSTAGE_COURIER` | Postage, courier, delivery |
| `SECURE_TRANSFER` | Secure electronic transfer or data-room cost |
| `IT_EXTRACTION` | IT extraction / system run time / e-discovery processing |
| `VENDOR_PAYROLL` | Third-party payroll or tax-records vendor charge |
| `VENDOR_ARCHIVE` | Third-party archive or off-site records retrieval |
| `VENDOR_OTHER` | Other third-party charge |
| `TRANSLATION` | Translation |
| `TRANSCRIPTION_CONVERSION` | Transcription or format conversion (e.g. CCTV, audio) |
| `IDENTITY_VERIFICATION` | Cost of verifying the requestor's identity |
| `ADMIN_OVERHEAD` | General administrative overhead / management time |
| `RECORDS_REMEDIATION` | Reconstructing or fixing poorly-kept records |
| `OTHER_UNCLASSIFIED` | Something else (always referred to Legal) |
Several of these exist specifically because they are the ones most often **disallowed** — `STAFF_TIME_ASSESS_EXEMPTIONS`, `STAFF_TIME_LEGAL_REVIEW`, `ADMIN_OVERHEAD`, `RECORDS_REMEDIATION`. Keeping them as first-class categories means HR's optimistic claim is captured, visibly struck, and explained, rather than silently absent. That is what makes the tool defensible if the fee is later challenged. (AC-20)
### 6.4 Assessment and assessment line
```ts
type Verdict =
  | 'ALLOW'          // fully recoverable under the pack
  | 'ALLOW_CAPPED'   // recoverable but reduced to a cap in the pack
  | 'DISALLOW'       // not recoverable under the pack
  | 'FLAG';          // pack cannot decide — lawyer must
type Disposition =
  | 'PENDING'        // lawyer has not acted
  | 'ACCEPTED'       // lawyer accepts the engine verdict
  | 'REDUCED'        // lawyer allows a lower amount
  | 'STRUCK'         // lawyer disallows entirely
  | 'ALLOWED_BY_LAWYER'; // lawyer allows a FLAG or DISALLOW line
type AssessmentLine = {
  id: string;
  expenseLineId: string;
  verdict: Verdict;
  engineAmount: number;              // minor units, 0 for DISALLOW and FLAG
  appliedRuleId: string;             // e.g. "HK-PDPO.PHOTOCOPY_PRINT"
  appliedCap: Cap | null;
  basis: string;                     // pack-authored, ≤ 240 chars, plain language
  citation: Citation;                // pack-authored, never LLM-generated
  flagReasons: FlagReason[];         // non-empty iff verdict === 'FLAG'
  disposition: Disposition;
  lawyerAmount: number | null;       // set for REDUCED / ALLOWED_BY_LAWYER
  lawyerReason: string | null;       // max 1000 chars. REQUIRED for any disposition
                                     // ≠ ACCEPTED, and for ACCEPTED on a FLAG line.
                                     // Privileged: never leaves /legal/* or the
                                     // internal record — see §12.1
  dispositionedBy: UserRef | null;
  dispositionedAt: string | null;
};
type Assessment = {
  id: string;
  matterId: string;
  rulePackId: string;
  rulePackVersion: string;           // pinned at compute time, immutable
  engineVersion: string;             // semver of packages/engine
  computedAt: string;
  lines: AssessmentLine[];
  matterLevelFlags: MatterFlag[];    // e.g. litigation posture, repeat request
  totals: Totals;                    // computed, see §8.1
  signOff: SignOff | null;
};
type SignOff = {
  lawyer: UserRef;
  lawyerName: string;                // printed on both documents
  qualification: string;             // e.g. "Advocate & Solicitor, Singapore"
  signedAt: string;
  finalAmount: number;
  acknowledgedFlags: string[];       // ids of every matter-level flag
  attestation: true;                 // §9.5 wording, recorded verbatim by version
};
```
### 6.5 Audit event
Append-only. No updates, no deletes, at the database level (revoke UPDATE/DELETE on the table for the application role). (AC-34)
```ts
type AuditEvent = {
  id: string;               // monotonic
  matterId: string;
  actor: UserRef;
  actorRole: Role;
  at: string;               // server time, not client
  type: AuditEventType;     // 'LINE_ADDED' | 'SUBMITTED' | 'COMPUTED'
                            // | 'LINE_DISPOSITIONED' | 'SIGNED_OFF' | ...
  payload: Json;            // before/after for any change
  rulePackVersion: string | null;
  engineVersion: string | null;
};
```
Record, on every `LINE_DISPOSITIONED` and `SIGNED_OFF` event, the elapsed time from when the reviewer first opened the assessment. This is not surveillance of the lawyer; it is the only reliable signal of automation bias, and it feeds M2 and the QA sample in §9.6.

---
## 7. Rule packs — rules as versioned data
### 7.1 Why the rules are data, not prompt text
The legal knowhow is the valuable and fragile part of this product. If it lives inside a model prompt it is unauditable, unversionable, untestable, and unfixable without a redeploy — and when a regulator or a requestor's solicitor asks "on what basis did you charge me for redaction time?", the answer cannot be "the model said so."
So: every legal proposition in this system lives in a signed, versioned JSON rule pack authored by a named lawyer. The engine executes packs. The LLM never authors, edits, interprets, or supplements a pack. (AC-36, AC-37)
### 7.2 Rule pack schema
```ts
type RulePack = {
  packId: string;                    // "SG-PDPA"
  jurisdiction: { code: JurisdictionCode; name: string };
  version: string;                   // "2026.09.1", monotonic
  status: 'DRAFT' | 'ACTIVE' | 'STALE' | 'WITHDRAWN';
  authoredBy: UserRef | null;       // both must be non-null before ACTIVE (AC-38)
  reviewedBy: UserRef | null;
  reviewedOn: ISODate | null;
  reviewDueOn: string;               // hard requirement, see §9.3
  instruments: Instrument[];         // statutes/regs/guidance the pack rests on
  // Posture is per controller type, because several regimes permit a private
  // organisation to charge and prohibit a public agency from charging under the
  // same instrument (Australia, New Zealand). A single-valued field cannot
  // express that, so this is a map with an entry for every controller type.
  feePosture: Record<ControllerType, FeePosture>;
  // Derived, not authored: the controller types whose posture is not PROHIBITED.
  // Kept as a field only so the engine's precondition check is a lookup.
  appliesTo: ControllerType[];
  // Staff-time sanity ceilings per grade, in minor units per hour. Exceeding one
  // produces a RATE_ABOVE_EXPECTED flag — never a silent adjustment. Entity-
  // specific; §17 q.4 assigns ownership.
  rateSanityCeiling: Partial<Record<StaffGrade, number>>;
  constraints: {
    noChargeForMakingRequest: boolean;
    estimateRequiredBeforeCharging: boolean;
    feeNotificationDeadlineDays: number | null;
    deadlineBasis: 'CALENDAR_DAYS' | 'WORKING_DAYS';
    responseDeadlineDays: number | null;
    advancePaymentPermitted: boolean;
    mayWithholdDataUntilPaid: boolean;
    profitElementPermitted: boolean;   // always false in every pack we know of
    deterrentUsePermitted: boolean;    // always false
    regulatorMayReviewFee: boolean;
    aggregateCap: Cap | null;
  };
  categoryRules: CategoryRule[];      // one per code in §6.3 — exhaustive
  matterFlagRules: MatterFlagRule[];
  requestorNoticeTemplate: string;    // jurisdiction-correct wording
  openQuestions: string[];            // shown to the lawyer on every review
};
type CategoryRule = {
  ruleId: string;                     // "SG-PDPA.PHOTOCOPY_PRINT"
  categoryCode: ExpenseCategoryCode;
  treatment: 'ALLOW' | 'ALLOW_WITH_CAP' | 'ALLOW_IF' | 'DISALLOW' | 'FLAG';
  cap: Cap | null;
  conditions: Condition[];            // machine-evaluable only
  basis: string;                      // ≤ 240 chars, plain language, lawyer-written
  citation: Citation;
  verificationStatus: 'VERIFIED' | 'NEEDS_VERIFICATION';
  verificationNote: string | null;
};
type Cap =
  | { type: 'PER_UNIT'; amount: number; unit: ExpenseLine['unit'] }
  | { type: 'PER_LINE'; amount: number }
  | { type: 'PER_MATTER'; amount: number }
  | { type: 'PERCENT_OF_CLAIM'; percent: number };
type FeePosture =
  | 'PERMITTED_REASONABLE'          // fee allowed, "reasonable" standard
  | 'PERMITTED_NOT_EXCESSIVE'       // fee allowed, "not excessive" standard
  | 'PERMITTED_ACTUAL_COST'         // fee allowed, capped at actual cost
  | 'PERMITTED_PRESCRIBED_CAP'      // fee allowed up to a prescribed figure
  | 'PERMITTED_NARROW_EXCEPTION'    // no fee as a rule; narrow exceptions only
  | 'NO_EXPRESS_AUTHORITY'          // instrument silent — default to no fee, flag
  | 'PROHIBITED';                   // no fee permitted
```
`PERMITTED_NARROW_EXCEPTION` behaves as `PROHIBITED` in the engine — every line `DISALLOW` — but carries a mandatory matter-level flag naming the exception, so the lawyer can allow lines via `ALLOWED_BY_LAWYER` where one applies. It exists for regimes like the GDPR's further-copies and manifestly-excessive limbs, where "prohibited" would overstate the position.
`verificationStatus` is not decoration. Any line whose applied rule is `NEEDS_VERIFICATION` renders with a distinct visual treatment and its amount is included in the draft baseline but separately subtotalled as "resting on unverified rules", so the lawyer can see exactly how much of the figure is standing on unfinished homework. (AC-22)
### 7.3 Rule pack lifecycle
- A pack cannot go `ACTIVE` without `reviewedBy`, `reviewedOn`, `reviewDueOn`, and an exhaustive `categoryRules` array covering all 21 codes. The validator enforces exhaustiveness — a missing category is a build failure, not a runtime `FLAG`. (AC-38)
- `reviewDueOn` defaults to 12 months from `reviewedOn`. At 30 days out, the admin screen and every review screen show a warning. **Past `reviewDueOn` the pack is `STALE`: new matters in that jurisdiction cannot be submitted, and the UI says why.** This is a deliberate hard stop; a silently stale rule pack is the most likely way this product produces a wrong answer at scale. (AC-39)
- Activating a new version never mutates existing assessments. Every assessment pins `rulePackVersion`. (AC-40)
- Packs are stored as JSON files in the repository (reviewable in pull requests, diffable, attributable) and loaded into the database on deploy. The database copy is a cache; the repository is the source of truth.
### 7.4 The nine v1 jurisdictions
Two packs are worked in detail below as the reference implementations. Seven ship as **stubs**: correct posture, correct constraints skeleton, `status: 'DRAFT'`, every `categoryRule` set to `FLAG` with `verificationStatus: 'NEEDS_VERIFICATION'`. A stub pack is unusable until local counsel authors it — which is the correct behaviour, and demonstrably better than a plausible guess.
**Every entry in this table is a starting point for the authoring lawyer, not a determination.** The `feePosture` column records the posture our reading suggests; the notes record what we understood; and *nothing in this table is activated until local counsel has confirmed or corrected it and is named in the pack.* Where a note states a proposition flatly, read "counsel to confirm" after it — that is the standing instruction for all nine rows, not only the ones where it is spelled out.
| Jurisdiction | Instrument | `feePosture` (private org / public agency) | Notes for the authoring lawyer |
|---|---|---|---|
| **Hong Kong** | PDPO (Cap. 486), ss. 19, 28(2)–(3); DPP6; PCPD guidance note *Proper Handling of Data Access Request and Charging of Data Access Request Fee by Data Users* (rev. July 2020) | `PERMITTED_NOT_EXCESSIVE` / *counsel to determine* | **Worked pack.** Most developed guidance of the nine. See §7.5. Public-sector posture not researched — the pack ships with `PUBLIC_AGENCY: 'NO_EXPRESS_AUTHORITY'` until counsel rules. |
| **Singapore** | PDPA 2012 s. 21, s. 48H; Personal Data Protection Regulations 2021 reg. 7; PDPC *Guide to Handling Access Requests* | `PERMITTED_REASONABLE` / *counsel to determine* | **Worked pack.** Reg. 7 permits "a reasonable fee for services provided to the applicant to enable the organisation to respond". Written estimate before charging. PDPC may review reasonableness. See §7.6. |
| **Australia** | Privacy Act 1988, APP 12.7–12.8; OAIC APP Guidelines ch. 12 | `PERMITTED_NOT_EXCESSIVE` / `PROHIBITED` | The split posture is why `feePosture` is a map. Our reading: an APP **agency** must not charge at all; an **organisation** may charge for *giving* access but never for *making* the request; OAIC treats inefficiency-driven and legal-advice costs as excessive. **Counsel to confirm all three before activation.** |
| **New Zealand** | Privacy Act 2020 ss. 66–67; IPP 6; OPC guidance on charging | `PERMITTED_REASONABLE` / `PROHIBITED` | Our reading: charge must be reasonable; time *assessing whether to withhold* is not chargeable while time *doing* the redaction is; the requestor must be told the amount and any advance-payment requirement, with complaint rights; public sector cannot charge absent Commissioner authorisation; health sector further restricted. **Each of those is a proposition counsel must verify** — the withhold/redact distinction in particular drives four categories in §6.3. |
| **Japan** | APPI, disclosure-request fee provision — **counsel to supply the current article number**, which we have deliberately not guessed | `PERMITTED_ACTUAL_COST` / *counsel to determine* | Our reading of the standard: the fee must be fixed "within a scope that can be considered reasonable in consideration of actual costs". If confirmed, express as a `PERCENT_OF_CLAIM: 100` ceiling with no profit element. |
| **South Korea** | PIPA art. 38(3); Enforcement Decree art. 47 | `PERMITTED_ACTUAL_COST` / *counsel to determine* | Our reading: fee and postage only, "within the actual expenses necessary for the processing of the request". Narrow. **A 2026 PIPA amendment is in play — counsel must check the current text**, and note that a local-government controller is governed by its own ordinance. |
| **China** | PIPL arts. 45, 50; GB/T 35273 | `NO_EXPRESS_AUTHORITY` / `NO_EXPRESS_AUTHORITY` | We found no provision conferring a right to charge for providing a copy, and we are treating that as silence rather than as a prohibition. Default: no fee, every line flagged. **Do not infer a fee right from silence, and do not infer a prohibition from it either** — counsel to characterise. |
| **India** | DPDP Act 2023 s. 11; DPDP Rules 2025 (notified Nov 2025, phased commencement) | `NO_EXPRESS_AUTHORITY` / `NO_EXPRESS_AUTHORITY` | We identified no controller-side access fee. Default: no fee. Commencement is phased — the pack must record which provisions counsel considers in force as at `reviewedOn`. |
| **Vietnam** | Law on Personal Data Protection No. 91/2025/QH15 (in force 1 Jan 2026); Decree 356/2025/ND-CP (Decree 13/2023 repealed) | `NO_EXPRESS_AUTHORITY` / `NO_EXPRESS_AUTHORITY` | Regime changed on 1 Jan 2026. **Response timing under the new law must be confirmed by counsel and not carried over from Decree 13/2023**, whose 72-hour rule no longer applies of its own force. |
| *(future)* EU/EEA | GDPR art. 15(3), art. 12(5) | `PERMITTED_NARROW_EXCEPTION` / `PERMITTED_NARROW_EXCEPTION` | Out of scope per NS-10. Recorded so the schema is not later found to be EU-hostile: our understanding is first copy free, with a reasonable fee only for further copies or manifestly unfounded or excessive requests. |
**Behaviour where the matter's controller type maps to `NO_EXPRESS_AUTHORITY`, `PROHIBITED`, or `PERMITTED_NARROW_EXCEPTION`:** the engine must not produce a figure. Every line returns `FLAG` (authority) or `DISALLOW` (the other two), the draft baseline is zero, and the review screen leads with a full-width notice explaining the posture. A lawyer may still allow a line, but only via `ALLOWED_BY_LAWYER` with a mandatory written reason. (AC-13, AC-14)
### 7.5 Reference pack — Hong Kong (illustrative extract)
Ship this as `packages/rulepacks/HK-PDPO/2026.09.1.json`.
Our reading of the PCPD guidance is that recoverable costs must be **directly related to and necessary for** complying with the request, which appears to be a stricter test than mere reasonableness, and that the fee must not be excessive. **That characterisation is the authoring lawyer's to confirm, and every `"verificationStatus": "VERIFIED"` marking in the extract below is provisional until they do** — ship them as `NEEDS_VERIFICATION` and let counsel promote them, rather than shipping an unnamed lawyer's confidence. The `authoredBy` / `reviewedBy` / `reviewedOn` keys below are placeholders; the pack cannot reach `ACTIVE` while they are (AC-38), which is the intended behaviour on day one.
```json
{
  "packId": "HK-PDPO",
  "jurisdiction": { "code": "HK", "name": "Hong Kong SAR" },
  "version": "2026.09.1",
  "status": "DRAFT",
  "authoredBy": null,
  "reviewedBy": null,
  "reviewedOn": null,
  "reviewDueOn": "2027-09-01",
  "feePosture": {
    "PRIVATE_ORGANISATION": "PERMITTED_NOT_EXCESSIVE",
    "PUBLIC_AGENCY": "NO_EXPRESS_AUTHORITY"
  },
  "appliesTo": ["PRIVATE_ORGANISATION"],
  "rateSanityCeiling": { "ADMIN": 3000, "EXECUTIVE": 5000, "MANAGER": 9000 },
  "instruments": [
    { "title": "Personal Data (Privacy) Ordinance (Cap. 486)", "provisions": ["s.19", "s.28(2)", "s.28(3)", "DPP6"] },
    { "title": "PCPD, Proper Handling of Data Access Request and Charging of Data Access Request Fee by Data Users", "revised": "2020-07" }
  ],
  "constraints": {
    "noChargeForMakingRequest": false,
    "estimateRequiredBeforeCharging": false,
    "feeNotificationDeadlineDays": 40,
    "deadlineBasis": "CALENDAR_DAYS",
    "responseDeadlineDays": 40,
    "advancePaymentPermitted": true,
    "mayWithholdDataUntilPaid": true,
    "profitElementPermitted": false,
    "deterrentUsePermitted": false,
    "regulatorMayReviewFee": true,
    "aggregateCap": null
  },
  "categoryRules": [
    {
      "ruleId": "HK-PDPO.STAFF_TIME_SEARCH",
      "categoryCode": "STAFF_TIME_SEARCH",
      "treatment": "ALLOW",
      "basis": "Direct labour cost of locating and retrieving the requested data is directly related to and necessary for complying with the request.",
      "citation": { "instrument": "PDPO", "provision": "s.28(2)-(3)", "guidance": "PCPD DAR guidance note (rev. 07/2020)" },
      "verificationStatus": "VERIFIED"
    },
    {
      "ruleId": "HK-PDPO.STAFF_TIME_REDACT_THIRD_PARTY",
      "categoryCode": "STAFF_TIME_REDACT_THIRD_PARTY",
      "treatment": "ALLOW",
      "basis": "Time spent redacting third-party identifying particulars is a necessary step in supplying a copy that may lawfully be released.",
      "citation": { "instrument": "PDPO", "provision": "s.28(2)-(3)", "guidance": "PCPD DAR guidance note (rev. 07/2020)" },
      "verificationStatus": "VERIFIED"
    },
    {
      "ruleId": "HK-PDPO.STAFF_TIME_REDACT_EXEMPT",
      "categoryCode": "STAFF_TIME_REDACT_EXEMPT",
      "treatment": "DISALLOW",
      "basis": "Costs of severing data that is exempt from access are not recoverable.",
      "citation": { "instrument": "PDPO", "provision": "s.28(3)", "guidance": "PCPD DAR guidance note (rev. 07/2020)" },
      "verificationStatus": "VERIFIED"
    },
    {
      "ruleId": "HK-PDPO.STAFF_TIME_LEGAL_REVIEW",
      "categoryCode": "STAFF_TIME_LEGAL_REVIEW",
      "treatment": "DISALLOW",
      "basis": "Cost of obtaining legal advice or studying compliance obligations is not a cost of complying with the request.",
      "citation": { "instrument": "PDPO", "provision": "s.28(3)", "guidance": "PCPD DAR guidance note (rev. 07/2020)" },
      "verificationStatus": "VERIFIED"
    },
    {
      "ruleId": "HK-PDPO.ADMIN_OVERHEAD",
      "categoryCode": "ADMIN_OVERHEAD",
      "treatment": "DISALLOW",
      "basis": "General administrative and office overheads are incurred regardless of the request and are not directly related to it.",
      "citation": { "instrument": "PDPO", "provision": "s.28(3)", "guidance": "PCPD DAR guidance note (rev. 07/2020)" },
      "verificationStatus": "VERIFIED"
    },
    {
      "ruleId": "HK-PDPO.PHOTOCOPY_PRINT",
      "categoryCode": "PHOTOCOPY_PRINT",
      "treatment": "ALLOW_WITH_CAP",
      "cap": { "type": "PER_UNIT", "amount": 150, "unit": "PAGE" },
      "conditions": [{ "field": "unit", "op": "eq", "value": "PAGE" }],
      "basis": "Reproduction cost at a standard per-page rate. Cap expressed in minor units (HK$1.50/page) and to be set by counsel against the entity's actual copying cost.",
      "citation": { "instrument": "PDPO", "provision": "s.28(2)", "guidance": "PCPD DAR guidance note (rev. 07/2020)" },
      "verificationStatus": "NEEDS_VERIFICATION",
      "verificationNote": "Per-page cap is an entity-specific figure and must not exceed actual direct cost. Confirm before activation."
    },
    {
      "ruleId": "HK-PDPO.VENDOR_PAYROLL",
      "categoryCode": "VENDOR_PAYROLL",
      "treatment": "ALLOW_IF",
      "conditions": [
        { "field": "isThirdPartyInvoiced", "op": "eq", "value": true },
        { "field": "evidenceRef", "op": "isNotNull" }
      ],
      "basis": "Out-of-pocket charge actually paid to a third party to obtain data the employer does not itself hold, where invoiced and evidenced.",
      "citation": { "instrument": "PDPO", "provision": "s.28(2)", "guidance": "PCPD DAR guidance note (rev. 07/2020)" },
      "verificationStatus": "NEEDS_VERIFICATION",
      "verificationNote": "Recoverable only to the extent necessary; a vendor charge covering more than the requested data should be apportioned. Consider a FLAG treatment instead."
    },
    {
      "ruleId": "HK-PDPO.RECORDS_REMEDIATION",
      "categoryCode": "RECORDS_REMEDIATION",
      "treatment": "DISALLOW",
      "basis": "Costs arising from the data user's own record-keeping deficiencies exceed what would be necessary in normal circumstances.",
      "citation": { "instrument": "PDPO", "provision": "s.28(3)", "guidance": "PCPD DAR guidance note (rev. 07/2020)" },
      "verificationStatus": "VERIFIED"
    },
    {
      "ruleId": "HK-PDPO.OTHER_UNCLASSIFIED",
      "categoryCode": "OTHER_UNCLASSIFIED",
      "treatment": "FLAG",
      "basis": "Uncategorised cost. Legal to determine whether it is directly related to and necessary for compliance.",
      "citation": { "instrument": "PDPO", "provision": "s.28(3)" },
      "verificationStatus": "VERIFIED"
    }
  ],
  "matterFlagRules": [
    { "flagId": "HK.FLAT_FEE_CHECK", "when": { "field": "lineCount", "op": "gte", "value": 8 },
      "message": "A flat fee may be charged for administrative convenience provided it is lower than direct compliance costs and not excessive. Consider whether a flat fee is preferable to this itemisation." },
    { "flagId": "HK.NOTIFY_40_DAYS", "when": { "always": true },
      "message": "The requestor must be told what fee, if any, will be charged as soon as practicable and in any event within 40 days of the request." }
  ],
  "openQuestions": [
    "Apportionment method where a payroll vendor invoice covers more than the requested data.",
    "Whether computer/system run time replacing manual labour is being claimed at cost.",
    "Whether the entity's per-page rate reflects current actual cost.",
    "constraints.noChargeForMakingRequest is set false — confirm there is no separate prohibition on charging for the act of making the request, as distinct from complying with it.",
    "constraints.estimateRequiredBeforeCharging is set false while matterFlagRules requires notification of the fee within 40 days. Confirm whether the 40-day notification is, in substance, an estimate obligation; if so both fields should change together."
  ],
  "requestorNoticeTemplate": "..."
}
```
The remaining categories (`STAFF_TIME_COLLATE`, `STAFF_TIME_ASSESS_EXEMPTIONS`, `PROFESSIONAL_REVIEW`, `MEDIA_MATERIALS`, `POSTAGE_COURIER`, `SECURE_TRANSFER`, `IT_EXTRACTION`, `VENDOR_ARCHIVE`, `VENDOR_OTHER`, `TRANSLATION`, `TRANSCRIPTION_CONVERSION`, `IDENTITY_VERIFICATION`) must be present and authored before this pack is activated. Do not invent them.
### 7.6 Reference pack — Singapore (posture and constraints)
```json
{
  "packId": "SG-PDPA",
  "jurisdiction": { "code": "SG", "name": "Singapore" },
  "version": "2026.09.1",
  "status": "DRAFT",
  "authoredBy": null,
  "reviewedBy": null,
  "reviewedOn": null,
  "reviewDueOn": "2027-03-12",
  "feePosture": {
    "PRIVATE_ORGANISATION": "PERMITTED_REASONABLE",
    "PUBLIC_AGENCY": "NO_EXPRESS_AUTHORITY"
  },
  "appliesTo": ["PRIVATE_ORGANISATION"],
  "rateSanityCeiling": { "ADMIN": 3000, "EXECUTIVE": 5000, "MANAGER": 9000 },
  "instruments": [
    { "title": "Personal Data Protection Act 2012", "provisions": ["s.21", "s.48H"] },
    { "title": "Personal Data Protection Regulations 2021", "provisions": ["reg.7"] },
    { "title": "PDPC, Guide to Handling Access Requests", "revised": "2020-10" }
  ],
  "constraints": {
    "noChargeForMakingRequest": true,
    "estimateRequiredBeforeCharging": true,
    "feeNotificationDeadlineDays": null,
    "deadlineBasis": "CALENDAR_DAYS",
    "responseDeadlineDays": 30,
    "advancePaymentPermitted": true,
    "mayWithholdDataUntilPaid": true,
    "profitElementPermitted": false,
    "deterrentUsePermitted": false,
    "regulatorMayReviewFee": true,
    "aggregateCap": null
  },
  "matterFlagRules": [
    { "flagId": "SG.WRITTEN_ESTIMATE", "when": { "always": true },
      "message": "A written estimate of the fee must be given to the applicant before the fee is charged. If the eventual fee will exceed the estimate, a further written estimate is required." },
    { "flagId": "SG.RESPOND_30_DAYS", "when": { "always": true },
      "message": "Respond within 30 days. If that is not possible, notify the applicant in writing of the time by which a response will be provided." },
    { "flagId": "SG.NOT_A_DETERRENT", "when": { "always": true },
      "message": "The fee must be reasonable and must not be used to discourage the applicant from pursuing the request. The Commission may review the reasonableness of the fee." }
  ],
  "openQuestions": [
    "Whether staff time is being costed at incremental cost or at a loaded charge-out rate. A loaded rate with a profit element is not defensible.",
    "Whether any element of the claim relates to assessing exceptions rather than providing access."
  ]
}
```
**`categoryRules` for Singapore: what to ship, and why the examples in this PRD work.**
All 21 categories must be present (AC-10, AC-38) and all 21 ship as `"verificationStatus": "NEEDS_VERIFICATION"` with a `verificationNote` pointing to reg. 7's *"services provided … to enable the organisation to respond"* limb, which is the operative wording to reason against. Singapore counsel promotes them to `VERIFIED` and may change any treatment.
The `treatment` values ship as our proposed reading, not as `FLAG` across the board. Shipping everything as `FLAG` would be safer in one sense and useless in every other: the lawyer would face 21 undifferentiated flags on every matter, which is the status quo with extra clicks, and the golden-file tests in §14 would have nothing to assert. The `NEEDS_VERIFICATION` marking is what carries the caveat — it drives the `restingOnUnverifiedRules` subtotal (§7.2), the visual marker on every affected line (§10.3), and exclusion from bulk-accept (AC-26). A `NEEDS_VERIFICATION` `ALLOW` is therefore a *visible, quantified, individually-dispositioned* proposal, which is exactly the posture this product is for.
The five treatments used by the examples in §10.3, §14 and Annex A, all `NEEDS_VERIFICATION`:
| Rule | Treatment | Proposed basis (counsel to confirm) |
|---|---|---|
| `SG-PDPA.STAFF_TIME_SEARCH` | `ALLOW` | Locating and retrieving the requested data is a service provided to the applicant to enable the organisation to respond. |
| `SG-PDPA.STAFF_TIME_COLLATE` | `ALLOW` | Compiling and paginating the response is likewise such a service. |
| `SG-PDPA.STAFF_TIME_ASSESS_EXEMPTIONS` | `DISALLOW` | Time assessing whether an exception applies is the organisation's own compliance cost, not a service provided to the applicant. |
| `SG-PDPA.PHOTOCOPY_PRINT` | `ALLOW_WITH_CAP`, `PER_UNIT` 12 minor units / `PAGE` | Reproduction at a standard per-page rate not exceeding the entity's actual direct cost. The figure is entity-specific (§17 q.4). |
| `SG-PDPA.VENDOR_PAYROLL` | `ALLOW_IF` (`isThirdPartyInvoiced` true, `evidenceRef` not null) | Out-of-pocket charge paid to a third party for data the employer does not hold, where invoiced and evidenced. |
`SG-PDPA.OTHER_UNCLASSIFIED` is `FLAG` in every pack (AC-19). The remaining 15 categories ship with a proposed treatment on the same footing and are not reproduced here.

---
## 8. Agent architecture
### 8.1 The engine (deterministic — `packages/engine`)
Pure TypeScript. No network, no LLM, no clock reads outside an injected `now`. This is what actually calculates the fee.
```ts
function assess(input: {
  matter: Matter;
  lines: ExpenseLine[];
  pack: RulePack;
  now: string;
}): Assessment
```
Algorithm:
1. **Preconditions.** Pack `ACTIVE` and not past `reviewDueOn`; `matter.controllerType` ∈ `pack.appliesTo`; `matter.currency === JURISDICTION_CURRENCY[matter.jurisdictionCode]` (§6.0) — a matter cannot be, say, jurisdiction `SG` with currency `JPY`. Any failure → no assessment, typed error surfaced in the UI, naming the expected currency.
2. **Posture gate.** If `feePosture` is `PROHIBITED` → every line `DISALLOW`. If `NO_EXPRESS_AUTHORITY` → every line `FLAG` with reason `NO_FEE_AUTHORITY`. Skip to step 6.
3. **Per-line evaluation.** Find the `CategoryRule` for the line's `categoryCode` (exhaustive, so always found). Evaluate `conditions` against the line and matter. Then:
   - `ALLOW` → `engineAmount = claimedAmount`
   - `ALLOW_WITH_CAP` → `engineAmount = min(claimedAmount, applyCap(cap, line))`; verdict `ALLOW_CAPPED` if reduced
   - `ALLOW_IF` → conditions met ⇒ as `ALLOW`; not met ⇒ `FLAG` with reason `CONDITIONS_NOT_MET` listing which
   - `DISALLOW` → `engineAmount = 0`
   - `FLAG` → `engineAmount = 0`
4. **Cross-line checks**, each producing a `FLAG` or matter flag, never a silent adjustment:
   - duplicate category + near-identical description → `POSSIBLE_DUPLICATE`
   - staff-time rate above the pack's `rateSanityCeiling` for that grade → `RATE_ABOVE_EXPECTED`
   - any line ≥ 40% of the total claim → `MATERIALITY`
   - `unitRate` or `quantity` at an implausible magnitude → `DATA_QUALITY`
   - third-party line with `isThirdPartyInvoiced === false` → `VENDOR_EVIDENCE_MISSING`
5. **Aggregate cap.** Apply `constraints.aggregateCap` if present, pro-rata across allowed lines, and flag that it bit.
6. **Totals.**
   ```ts
   type Totals = {
     claimedTotal: number;          // sum of all claimedAmount
     draftBaseline: number;         // sum of engineAmount for ALLOW + ALLOW_CAPPED
     disallowedTotal: number;
     flaggedTotal: number;          // claimed value of FLAG lines — EXCLUDED from baseline
     restingOnUnverifiedRules: number;  // subset of draftBaseline, §7.2
     finalAmount: number | null;    // null until sign-off
   };
   ```
   `finalAmount` is **null** until sign-off and must be unrepresentable as a number before then. Do not default it to `draftBaseline`. (AC-25)
7. **Matter flags.** Evaluate `matterFlagRules`; add `LITIGATION_POSTURE` if `isKnownDisputeOrLitigation`; add `REPEAT_REQUEST` if applicable; add `STALE_PACK_WARNING` if within 30 days of `reviewDueOn`.
All money is integer minor units. No floats anywhere in the money path. `applyCap` rounds *down*. (AC-07)
### 8.2 The LLM boundary (`packages/agent`)
The LLM has exactly three jobs, each narrow, each schema-constrained, each optional in the sense that the product functions without it.
**Job 1 — Suggest a category for an `OTHER_UNCLASSIFIED` line.** Input: description, quantity, unit, rate, and the taxonomy. Output: `{ suggestedCategoryCode, confidence: 'HIGH'|'MEDIUM'|'LOW', why: string }`. The suggestion is **advisory only**: the line stays `FLAG`, the suggestion is rendered as "the assistant suggests this may be *Staff time — collating…*", and the lawyer must accept it explicitly. Accepting it re-runs the engine. (AC-27)
**Job 2 — Draft the plain-language rationale paragraph** for the internal record, from the engine's structured output. It may only restate what the engine and pack already assert. It may not introduce a legal proposition, a citation, or a number. Post-generation validation: every monetary figure and every citation string in the draft must appear verbatim in the engine output, or the draft is rejected and a template-generated paragraph is used instead. (AC-28)
**Job 3 — Summarise the lawyer's queries into a clarification note for HR.** Cosmetic. No legal content.
Hard constraints on this package:
- No tool use, no web access, no retrieval. (NS-8)
- Output parsed against a zod schema; parse failure → fall back to a deterministic template, never retry-until-plausible.
- Prompts are versioned files in the repository; `promptVersion` is recorded on every assessment.
- Every LLM-touched field is labelled as such in the UI, with the label persisted, not computed at render time. (AC-29)
- The LLM is never given the requestor's personal data, because the system never holds it (§12.1).
### 8.3 Why this split matters
A lawyer can defend "the engine applied rule HK-PDPO.STAFF_TIME_REDACT_EXEMPT, version 2026.09.1, authored by X on date Y, and struck the line". A lawyer cannot defend "the model assessed the claim". The split is not architectural fussiness — it is what makes the output usable as a legal work product.

---
## 9. Risk disclosure and user warnings
This is one of the two questions this PRD exists to answer, so it is specified as literal requirements and literal copy, not as principles.
### 9.1 The risks actually being disclosed
Name them explicitly in the design so the mitigations can be traced to them:
| # | Risk | Primary mitigation |
|---|---|---|
| R1 | Rule pack states the law wrongly | Named author + reviewer, PR-reviewed packs, `verificationStatus`, `openQuestions` shown every review |
| R2 | Rule pack is out of date (law changed) | `reviewDueOn`, hard `STALE` block, 30-day warning banner |
| R3 | Expense misclassified into the wrong category | Closed taxonomy chosen by HR; `OTHER_UNCLASSIFIED` always flagged; category shown alongside HR's own description on **every** review card, including supported ones |
| R4 | Arithmetic or unit error | LLM excluded from the money path; integer minor units; engine unit tests |
| R5 | Wrong jurisdiction or wrong controller type | `appliesTo` gate; jurisdiction shown in the review header and on both documents |
| R6 | **Automation bias — lawyer rubber-stamps** | Flagged lines block sign-off; mandatory reason on every non-trivial disposition; total hidden until all lines dispositioned; M2 monitoring |
| R7 | Over-claim → complaint, regulator review, adverse inference in litigation | Conservative defaults; `LITIGATION_POSTURE` flag; struck items shown to HR so the restraint is visible internally |
| R8 | Under-claim | Accepted. Explicitly the cheaper error. |
| R9 | HR pastes the requestor's personal data into a note field | §12.1 architecture; field-level warnings; length limits; no attachments |
| R10 | Output mistaken for legal advice or used without sign-off | Draft watermark; role-based access; sign-off block naming the lawyer |
| R11 | LLM fabricates a basis or citation | LLM cannot author either; post-generation verbatim validation |
### 9.2 Layered disclosure, not a single modal
A one-time click-through disclaimer is theatre: it is read once, by one person, and never again. Use four layers instead.
**Layer 1 — Capability statement, per user, on first use and after any material change.** Full page, cannot be skipped, requires typing an acknowledgement rather than clicking "OK". Records `userId`, `statementVersion`, `acknowledgedAt`. Re-shown when `statementVersion` increments. (AC-30)
Copy:
> **Before you use this tool**
>
> This tool applies fee rules that our lawyers have written down for each jurisdiction. It is a calculator, not a lawyer.
>
> - It does **not** know the law. It applies a rule pack that a named lawyer authored and dated. If that rule pack is wrong or out of date, this tool will be confidently wrong.
> - It does **not** decide anything. Every figure it produces is a draft until a qualified lawyer reviews it and signs it off by name.
> - It cannot see your matter. It has no access to the request itself, the requestor, or the personal data being retrieved. It sees only the cost lines you type in.
> - Where the rules are unclear, or the information is thin, it will **refuse to decide** and refer the item to Legal. That is the tool working correctly, not failing.
> - Parts of the output are drafted by an AI language model. Those parts are labelled. They may be wrong in wording even where the figures are right.
>
> Type **I understand** to continue.
**Layer 2 — Persistent status strip, on every screen.** Not dismissible. Shows: jurisdiction · rule pack ID and version · reviewing lawyer · reviewed date · review-due date, with a colour state (current / due within 30 days / stale). Clicking it opens the pack's provenance including `openQuestions`. (AC-31)
**Layer 3 — Per-line provenance and per-line risk.** Every assessment line shows, without a click: the rule ID applied, the pack-authored basis, the citation, and a badge if the rule is `NEEDS_VERIFICATION`. Every `FLAG` line shows the flag reason in words. (AC-21)
**Layer 4 — Output-embedded disclosure.** Both generated documents carry it (§10.5), so the warning survives being forwarded, printed, or pasted into an email — which is where documents like this actually go wrong.
### 9.3 Staleness is a block, not a banner
The single highest-probability failure mode for this product in year two is a rule pack that quietly stopped being right. So:
- Within 30 days of `reviewDueOn`: amber status strip, warning on the review screen, notification to the pack author and DPO.
- Past `reviewDueOn`: pack is `STALE`. New matters in that jurisdiction cannot be submitted. In-flight matters can be signed off, but the review screen carries a full-width red notice and the sign-off attestation text changes to require the lawyer to confirm they have checked the position themselves. (AC-39)
### 9.4 Anti-automation-bias requirements
R6 is the risk most likely to make this product actively harmful, because a rubber-stamped output has the appearance of legal review without the substance. Build these deliberately:
- **The total is hidden until every line is dispositioned.** The review screen shows per-line amounts and a "pending" count, but no headline figure, until `PENDING === 0`. This forces line-by-line engagement rather than eyeballing a total. (AC-25)
- **No bulk actions on flagged lines.** "Accept all" may exist for `ALLOW` lines with `VERIFIED` rules only. It must not be available for `FLAG`, `ALLOW_CAPPED`, or `NEEDS_VERIFICATION` lines. (NS-7, AC-26)
- **A mandatory free-text reason** on every `REDUCED`, `STRUCK`, `ALLOWED_BY_LAWYER`, and on `ACCEPTED` where the verdict was `FLAG`. Minimum 10 characters; reject whitespace-only and single-word entries like "ok". (AC-23)
- **Litigation posture acknowledgement.** Where `isKnownDisputeOrLitigation`, sign-off is blocked until the lawyer acknowledges a matter-level flag reading: *"This requestor is in a known dispute with the company. A fee that is defensible in principle may still be unwise here, and may be characterised as obstructive. Confirm you have considered whether to charge at all."* (AC-24)
- **Review duration is recorded** and surfaced in the monthly QA report. A pattern of 40-second sign-offs on 15-line assessments is the signal to intervene.
### 9.5 Sign-off attestation
Recorded verbatim, by version, in the audit log. Not a checkbox with hidden text.
> I am reviewing this fee assessment as a qualified lawyer for **{jurisdiction}**. I have considered each line item and the flagged items individually. I have applied my own judgement to the amounts I have allowed, and I do not rely on the tool's calculation as legal advice. Rule pack **{packId} {version}**, reviewed **{reviewedOn}**.
Where the pack is `STALE`, append: *"I am aware this rule pack is past its review date and I have satisfied myself as to the current position."*
### 9.6 Monitoring — a static report, not the NS-6 agent
To be clear on the boundary: what follows is a scheduled SQL-backed report over the audit log, in scope for v1. NS-6's sampling *agent* — which would re-examine signed-off assessments and form a view on them — is not. This report counts things; it does not assess anything.
Monthly report to the DPO and product owner: assessments by jurisdiction; lawyer change rate (M2) per lawyer and per jurisdiction; median review duration; flag rate by category; `NEEDS_VERIFICATION` exposure as a share of signed-off value; packs approaching review date. If M2 for any lawyer is below 5% over 20+ assessments, that is escalated as a process issue.

---
## 10. UI / UX specification
Web application, desk-first, tablet-tolerable for the review screen. See **Annex A** for the HTML mockup of screens 10.2 and 10.3; match its structure and hierarchy, not necessarily its exact styling.
### 10.1 Cross-cutting
- **Role-scoped routes.** `/hr/*`, `/legal/*`, `/admin/*`. Authorisation is server-side on every request; an `HR_PREPARER` requesting a draft assessment gets a 403, not a hidden div. Test this explicitly. (AC-01, AC-02)
- **Language.** Never any of AC-32's banned words — "compliant", "non-compliant", "legal", "illegal", "lawful", "unlawful", "approved", "safe" — for an engine output. Use "supported by rule X", "not supported", "needs your decision". The engine describes what a rule says; it does not pronounce on legality. (AC-32)
- Status strip (Layer 2) fixed below the header on every screen.
- All money displayed with explicit currency code. No bare numbers.
- Autosave drafts every 10s; show save state.
- Keyboard-first review: `j`/`k` to move between lines, `a` accept, `r` reduce, `s` strike, `?` for help. A lawyer reviewing 20 lines should never need the mouse.
### 10.2 HR intake — `/hr/matters/new`
Three stacked sections, progressively disclosed. Section 2 stays locked until section 1 is valid.
**1. Matter details.** Reference (auto-suggested, editable) · jurisdiction (select; shows the pack status inline the moment it is chosen, including "no usable rule pack — contact Legal") · legal entity · controller type · request received date · currency · requestor class.
On selecting a jurisdiction whose pack is `NO_EXPRESS_AUTHORITY` or `PROHIBITED`, show immediately, before any expense entry:
> **Heads up — {Jurisdiction}.** Our rule pack records no clear legal basis for charging a fee for a data access request in this jurisdiction. You can still record the costs, but the likely outcome is that Legal advises charging nothing. Talk to Legal before spending time on this.
Telling HR this *before* they spend twenty minutes itemising is the single highest-value piece of UX in the intake flow.
**2. Expense lines.** A repeater, not a spreadsheet grid — grids invite paste-bombing and hide validation. Each row:
`Category` (select, grouped: Staff time / Materials & delivery / Third-party charges / Other) · `What this cost was for` (300 chars) · `Quantity` · `Unit` (constrained by category — hours for staff time, pages for photocopying) · `Rate per unit` · `Amount` (computed, read-only, greyed) · `Staff grade` (staff-time categories only) · `Third-party invoiced?` + vendor + evidence reference (third-party categories only) · row menu: duplicate, delete.
Category-contextual hints, shown on selection, drawn from the pack — this is where HR learns the rules over time:
> *Staff time — deciding what may be withheld.* In many jurisdictions this is **not** recoverable, even though the work is real. Record it if you incurred it; Legal will decide.
The claim breakdown separates categorised costs from Other claims, without adding another form step.
**3. Attestations.** Three labelled checkboxes, each with one line of help:
- "The requestor's identity has been verified." Verification happens in the existing process. The intake form has no free-text identity note field; the optional schema value is submitted as `null`.
- "The scope of the request is clear, or clarifications have been resolved."
- "This requestor is, to my knowledge, in a dispute or litigation with the company." (unchecked default; checking it does not stop anything, it triggers §9.4)
Running claimed total in a sticky footer, labelled unambiguously: **"Claimed costs — not the assessed fee."**
Submit is disabled with the reason visible until: ≥1 line, all required fields valid, all attestations addressed, pack usable. On submit: state → `COMPUTING`, lines locked read-only, HR sees a confirmation screen with the matter reference and *"Your claim is in Legal's review queue. HR sees the assessed fee after lawyer sign-off; no draft figure is shown here."* The prototype makes no claim to send an outbound notification.
That last sentence matters. Without it, HR reads the silence as a bug and starts asking Legal for the draft.
### 10.3 Legal review — `/legal/assessments/{id}`
Three regions. Match the mockup.
**Left rail — matter context (sticky).**
Reference · jurisdiction · entity · controller type · request received · advisory deadline display (see below) · requestor class · HR attestations, with the litigation flag prominent if set · rule pack card: ID, version, author, reviewer, reviewed date, review-due with colour state, and `openQuestions` listed in full — not collapsed. If a lawyer sees the pack's own open questions on every review, the pack improves over time.
Advisory deadline display: *"Fee notification due {date} — {n} days. **Advisory only.** This tool is not the deadline system of record."* (NS-5, AC-15)
**Centre — line-by-line review.**
Ordered: `FLAG` first, then `ALLOW_CAPPED`, then `DISALLOW`, then `ALLOW`. Flagged items are the work; put them where the eye lands.
Each line is a card, not a table row — a table row cannot carry a citation, a reason field, and four controls legibly:
```
┌────────────────────────────────────────────────────────────────────────┐
│ [NEEDS YOUR DECISION]  Line 5 · Third-party charge — payroll vendor    │
│                                                                        │
│ HR's description: "Vendor extract of 2019–2022 payslips and IR8A       │
│ records from archive"                                                  │
│ Claimed: 3 items × SGD 150.00 = SGD 450.00                             │
│                                                                        │
│ Why this needs you:                                                    │
│   • Conditions not met: no invoice evidence reference supplied          │
│   • Materiality: this line is 51% of the total claim                    │
│                                                                        │
│ Rule SG-PDPA.VENDOR_PAYROLL · ⚠ unverified rule                        │
│ Basis: Out-of-pocket charge actually paid to a third party to obtain    │
│ data the employer does not itself hold, where invoiced and evidenced.   │
│ Citation: PDPA 2012 s.21; PDP Regulations 2021 reg.7                   │
│                                                                        │
│ [ Allow SGD ____ ]  [ Strike ]  [ Ask HR ]                             │
│ Reason (required): ______________________________________________      │
└────────────────────────────────────────────────────────────────────────┘
```
Design requirements for the card:
- HR's own words are shown verbatim next to the category HR chose. This is how the lawyer catches R3 (misclassification) without re-doing HR's work.
- The basis and citation are always visible, never behind a disclose triangle. A citation you have to click for is a citation nobody reads.
- `NEEDS_VERIFICATION` rules carry a visible marker.
- Any LLM-drafted text is labelled inline: *"AI-drafted wording — figures and rule from the engine."*
- Controls are per-verdict: `ALLOW` lines get Accept / Reduce / Strike; `FLAG` lines get Allow-with-amount / Strike / Ask HR and cannot be "accepted" without a reason; `DISALLOW` lines get Accept / Allow-anyway (reason required).
- Reason field is inline and required for the dispositions listed in AC-23. A routine Accept of a supported, capped, or disallowed verdict may commit without free text. Do not use a modal — modals train people to type "ok".
**Right rail — running totals and sign-off.**
Figures below are the §14 reference fixture, before any disposition. They must reconcile: `Supported + Not supported + Needs your decision = Claimed`.
```
Claimed by HR                SGD 888.00
─────────────────────────────────────────
Supported by rules           SGD 266.40
Not supported                  – 126.60
Needs your decision          SGD 495.00   (2 items)   ← excluded
  ↳ of which, resting on
    unverified rules         SGD 106.40
─────────────────────────────────────────
Recommended fee                — hidden —
                    6 lines still need your decision
─────────────────────────────────────────
      [ Sign off ]  (disabled)
```
Reconciliation: 266.40 + 126.60 + 495.00 = 888.00. `Not supported` is the disallowed line (120.00) plus the cap reduction on photocopying (6.60). `Resting on unverified rules` is a subset of `Supported by rules` (collation 80.00 + photocopying 26.40), displayed indented to make the containment relationship legible — a lawyer who reads it as a fourth top-level figure will think the totals don't add up.
Every line begins `PENDING`, including the ones the engine supports, so the pending count opens at 6 and not at 2. Reviewing a supported line is a decision, not a formality; that is the whole point of §9.4.
When `PENDING === 0`, the headline resolves to **"Recommended fee: SGD X"** and Sign off enables, opening a confirmation panel with: the final figure; a count of what was allowed, reduced and struck; every matter-level flag requiring acknowledgement; and the §9.5 attestation text in full with the lawyer's name and qualification pre-filled. (AC-25, AC-16)
"Ask HR" on any line moves the matter to `INFO_REQUEST` with the lawyer's queries collated, and returns the lawyer to their queue.
### 10.4 HR result — `/hr/matters/{id}`
Visible only once `SIGNED_OFF`:
- Headline: **"Fee assessed: SGD X"**, with the reviewing lawyer's name, qualification, and sign-off date.
- Itemisation: what was allowed and at what amount; what was struck, with the plain-language basis. **Show the struck items.** HR needs to see that its optimistic claim was trimmed and why, or it will make the same claim next month; and the visible restraint is itself the evidence that a human exercised judgement.
- The internal legal rationale is **not** shown here. Privilege and candour both argue for keeping the lawyer's reasoning out of the HR-facing record. (AC-04)
- The requestor-facing notice draft, in a copy-to-clipboard block, using the pack's `requestorNoticeTemplate` with jurisdiction-correct wording (for Singapore, framed as a written estimate; for Hong Kong, framed to satisfy the 40-day notification).
- A boundary note: *"Send this yourself from your own mailbox. This tool does not email anyone."* (NS-3)
- Action: "Mark notice sent" (records the date; no email, no attachment, no tracking).
### 10.5 Generated documents
**(a) Internal fee assessment record (PDF).** Matter details; jurisdiction; rule pack ID, version and review date; engine version; every line with claimed amount, verdict, rule, basis, citation, disposition, lawyer amount and lawyer's reason; matter flags and acknowledgements; sign-off block with name, qualification, timestamp and the verbatim attestation. Footer on every page:
> Prepared with the DSAR Fee Assessment tool. Rule pack {packId} {version}. Figures computed by rule engine {engineVersion}; paragraphs marked *AI-drafted* were generated by a language model from those figures. Reviewed and signed off by {lawyer name}, {qualification}, on {date}. Not legal advice to any third party.
**(b) Requestor-facing fee notice draft (text + PDF).** The amount, a plain itemisation of what it covers, and the jurisdiction-required wording (estimate language, payment terms, complaint rights where applicable). **Contains no legal reasoning, no rule citations, and no reference to any AI tool.** It is a business letter. The requestor has no interest in our internal method, and disclosing it invites argument on our own analysis. Watermarked **DRAFT — for HR to send** until HR marks it sent. (AC-17, AC-18)
### 10.6 Rule pack admin — `/admin/rulepacks`
List with jurisdiction, version, status, author, reviewer, reviewed date, review-due with colour state, and count of `NEEDS_VERIFICATION` rules. Detail view is a form over the §7.2 schema with live validation, a category-completeness checklist (21/21), a diff against the previous version, and an activation gate requiring reviewer identity and a review-due date. Activation is an audited event. A pack cannot be activated by the same user who last edited it unless they hold `RULEPACK_AUTHOR` and explicitly confirm sole authorship. (AC-41)
### 10.7 Empty, error and edge states — specify these, don't improvise
| State | Behaviour |
|---|---|
| No pack for jurisdiction | Intake blocks at jurisdiction selection with a Contact Legal message. No expense entry offered. |
| Pack `STALE` | New matters blocked with the reason. In-flight matters reviewable with red notice and altered attestation. |
| Pack activated mid-review | Assessment keeps its pinned version. Banner: *"A newer rule pack ({v}) is now active. This assessment uses {pinned}. Recompute?"* Recompute resets all dispositions, with confirmation. (AC-40) |
| Engine error | Matter returns to `DRAFT` with the typed error. Never a partial assessment. |
| LLM unavailable | Everything works. Template text used. Note shown: *"AI-drafted wording unavailable; standard wording used."* (AC-28) |
| Zero allowable | Recommended fee SGD 0.00 with a notice draft that says no fee is charged. This is a valid, common outcome — not an error state. (AC-14) |
| Currency mismatch | Blocked at intake, two distinct cases: (a) a matter may only carry one currency across all its expense lines; (b) that currency must equal the jurisdiction's designated currency (§6.0) — HR cannot select `JPY` for an `SG` matter. Both name the expected currency in the error. (AC-42) |
---
## 11. Non-functional requirements
- **Performance.** Engine assessment of 50 lines < 100ms. Review screen interactive < 1.5s on corporate hardware.
- **Availability.** Business hours, both HK and SG. No hard uptime SLA in v1.
- **Browser support.** Current Chrome and Edge. No IE.
- **Localisation.** English UI in v1. `requestorNoticeTemplate` is per-pack and may be non-English; do not machine-translate legal notices.
- **Accessibility.** WCAG 2.1 AA. Verdicts must not be conveyed by colour alone — every badge carries text. (AC-32)
- **Data residency.** Confirm with the DPO before deployment; §12.1 keeps the blast radius small either way.
## 12. Security, privacy and data protection
### 12.1 The system holds no requestor personal data — architectural, not aspirational
This is the most important risk decision in the product, and it is nearly free.
A fee calculator needs cost lines. It does not need the ex-employee's payslips, tax records, name, or identifier. So the system is designed to be incapable of holding them:
- No file upload anywhere. `evidenceRef` is a **pointer** (a DMS reference or invoice number), never a document. (AC-05)
- Free-text fields are short (300/500/200 chars) with explicit warnings against entering personal data.
- `identityVerified` is a boolean plus a reference note. The verification evidence itself lives wherever HR already keeps it. (NS-1)
- No integration reads from payroll, HRIS, or the DSAR mailbox.
- The requestor is never named in the system. Matters are identified by reference only. **The UI has no field for the requestor's name — do not add one, and reject any suggestion to add one for "usability".** (AC-06)
Consequence: even a total compromise of this system exposes internal cost data and legal assessments, not employee personal data. It also means this tool is unlikely to be, itself, in scope of a future DSAR in any painful way.
Where HR does paste personal data into a note field anyway — and it will happen — a lightweight pattern check (long digit strings, ID-number-shaped tokens, email addresses) warns before submit. Warn, do not block; false positives on invoice numbers would be maddening.
Two fields need explicit discipline because they escape the intake form's protections:
- **`lawyerReason`** (§6.4) is capped at 1000 characters and runs through the same pattern check on the review screen, not only on intake.
- **`AuditEvent.payload`** (§6.5) carries before/after values into a table that cannot be deleted from. It stores only the fields that changed, from the closed field set — never a whole request body, never anything the user did not type into a declared field. A payload key not in the schema is a validation error, so a future field cannot quietly start being archived forever.
### 12.2 Other requirements
- SSO via the corporate IdP. No local passwords.
- Role assignment via IdP groups, not in-app.
- TLS in transit, encryption at rest.
- Audit log append-only at the database level; retention aligned to the litigation-hold policy (confirm with DPO; assume 7 years).
- LLM calls: no training on submitted data; zero-retention endpoint where available; log the prompt version and a hash, not the full payload.
- Legal rationale fields carry a privilege marker and are excluded from any HR-facing export or API response. (AC-04)
## 13. Acceptance criteria
Testable. Each maps to at least one automated test.
**Access control and roles**
- **AC-01** A user with only `HR_PREPARER` requesting `GET /api/assessments/{id}` for a matter in `LEGAL_REVIEW` receives 403, and the response body contains no assessment data.
- **AC-02** No API response to an `HR_PREPARER` contains `verdict`, `engineAmount`, `basis`, `draftBaseline`, or `lawyerReason` for a matter not in `SIGNED_OFF`.
- **AC-03** Sign-off by a user without `LEGAL_REVIEWER` for the matter's jurisdiction is rejected.
- **AC-04** `lawyerReason` and the internal rationale never appear in any `/hr/*` response or the HR-facing document, including after sign-off.
**Personal data boundary**
- **AC-05** There is no file-upload endpoint. A multipart POST to any endpoint returns 415.
- **AC-06** No column in the Prisma schema, and no `name`/`id` attribute on any form input, matches the case-insensitive deny-list `["requestorname", "requestername", "datasubjectname", "nric", "fin", "passport", "requestoremail", "dateofbirth", "dob", "employeeid"]` with non-alphanumerics stripped. Enforced by one test over the generated Prisma client's field names and one over the rendered DOM of every form route.
**Engine correctness**
- **AC-07** Three separate assertions. (a) Every money-typed value is the branded `Minor` type, enforced by a typecheck: an ESLint rule bans `number` in any identifier matching `/(amount|total|rate|fee|cap)$/i` within `packages/engine` and `packages/schemas`. (b) A property test over 10,000 random inputs asserts `Number.isInteger()` on every money field of the returned `Assessment`. (c) `applyCap` rounds down: `applyCap({type:'PER_UNIT',amount:12,unit:'PAGE'}, {quantity:7,...})` returns 84, and a `PERCENT_OF_CLAIM` of 33 on 100 returns 33, not 34.
- **AC-08** A stored `claimedAmount` that does not equal `quantity × unitRate` on load raises a hard error and blocks submission.
- **AC-09** Given the **SG** reference pack (§7.6) and the fixture in §14, the engine returns exactly the expected verdicts, amounts, flags and totals (golden file). Repeated for the HK pack with its own fixture.
- **AC-10** Every `ExpenseCategoryCode` resolves to a `CategoryRule` for every `ACTIVE` pack; a missing category fails pack validation at build time.
- **AC-11** `FLAG` lines contribute 0 to `draftBaseline` and their claimed value appears only in `flaggedTotal`.
- **AC-12** A matter with `controllerType: 'PUBLIC_AGENCY'` against a pack whose `appliesTo` excludes it cannot be submitted, and the message names the reason.
- **AC-13** Where the matter's controller type maps to `NO_EXPRESS_AUTHORITY`, every line is `FLAG` with reason `NO_FEE_AUTHORITY` and `draftBaseline === 0`.
- **AC-14** Where it maps to `PROHIBITED` or `PERMITTED_NARROW_EXCEPTION`, every line is `DISALLOW`, and sign-off at 0.00 produces a valid notice draft stating no fee is charged.
- **AC-15** Two assertions. (a) Every rendered deadline figure has the word "Advisory" within its own container, asserted by DOM query. (b) The state-machine guard functions are pure and take a typed `GuardInput` that structurally excludes the advisory deadline fields — a compile error if a guard reaches for one. `reviewDueOn` is a pack-lifecycle date, not a matter deadline, and is deliberately inside `GuardInput`.
**Human-in-the-loop**
- **AC-16** `POST /assessments/{id}/signoff` with any line in `PENDING` returns 409 and names the pending lines.
- **AC-17** The requestor-facing notice contains no rule ID, no citation, no `basis` string, and no mention of AI or of this tool. Asserted by regex over the generated text.
- **AC-18** The internal record contains the rule pack version, engine version, lawyer name, qualification, timestamp, and the verbatim attestation.
- **AC-19** An `OTHER_UNCLASSIFIED` line always returns `FLAG`, regardless of pack, description, or any LLM suggestion — except where the posture gate in §8.1 step 2 has already forced every line to `DISALLOW`, in which case it follows the gate (AC-14).
- **AC-20** A line in a `DISALLOW` category is retained, displayed to Legal, shown to HR after sign-off with its basis, and contributes 0.
- **AC-21** Every rendered assessment line displays rule ID, basis and citation without further interaction.
- **AC-22** `restingOnUnverifiedRules` equals the sum of allowed amounts whose applied rule is `NEEDS_VERIFICATION`, is a subset of `draftBaseline`, and is displayed on the review screen indented under it.
- **AC-23** A disposition of `REDUCED`, `STRUCK`, or `ALLOWED_BY_LAWYER`, or `ACCEPTED` on a `FLAG` line, is rejected without a `lawyerReason` of ≥10 non-whitespace characters that is not in the canonical stop-list. The stop-list lives in one exported constant used by both client and server: `["ok", "okay", "fine", "agreed", "yes", "no", "n/a", "na", "noted", "as above", "same"]`.
- **AC-24** Sign-off is blocked until the id of **every** matter-level flag with `requiresAcknowledgement` appears in `acknowledgedFlags`. `LITIGATION_POSTURE` and `STALE_PACK_WARNING` both carry it; the informational pack flags (estimate wording, response deadline) do not.
- **AC-25** `finalAmount` is `null` and no headline total is rendered while `PENDING > 0`.
- **AC-26** No bulk-accept control is offered for `FLAG`, `ALLOW_CAPPED`, or `NEEDS_VERIFICATION` lines; the API rejects a batch disposition containing one.
**LLM boundary**
- **AC-27** An LLM category suggestion never changes a verdict or an amount; the line remains `FLAG` until a lawyer accepts the suggestion explicitly.
- **AC-28** With the LLM provider unavailable or returning schema-invalid output, the assessment completes using template text and the UI says so. No retry loop.
- **AC-29** Every LLM-generated string is stored with an `aiGenerated: true` marker and rendered with a visible label.
- **AC-30** The capability statement is shown, and an acknowledgement recorded, on first use and whenever `statementVersion` increments.
- **AC-31** The status strip renders on every authenticated screen with pack id, version, reviewer, reviewed date and review-due state.
- **AC-32** Two assertions. (a) No engine-derived UI string, and no pack-authored `basis` string, contains any of the canonical banned words — one exported constant, `["compliant", "non-compliant", "legal", "illegal", "lawful", "unlawful", "approved", "safe"]` — asserted by a lint rule over the i18n strings file and by pack validation over every `basis`. (b) Every verdict badge's accessible name includes its verdict in words, asserted by DOM query over each rendered verdict type; no badge conveys verdict by colour alone.
**Immutability and audit**
- **AC-33** Any write to a `SIGNED_OFF` assessment returns 409. A correction creates a new assessment and marks the old `SUPERSEDED`.
- **AC-34** The application database role has no UPDATE or DELETE on the audit table; an attempted update fails at the database.
- **AC-35** Every state transition, line disposition, pack activation and sign-off emits an audit event with actor, server timestamp, role, before/after, pack version and engine version.
**Rule packs**
- **AC-36** Three assertions replacing an untestable one. (a) No file under `packages/agent/prompts/` matches `/\b(s\.|reg\.|art\.|Article|Regulation|Ordinance|Act)\s*\d/` or contains any `ruleId` pattern `/[A-Z]{2}-[A-Z]+\.[A-Z_]+/` — asserted by a test over the prompt directory. (b) Every monetary figure in LLM-generated text appears verbatim in the engine output for that assessment. (c) Every citation-shaped substring in LLM-generated text appears verbatim in an applied rule's `citation`. Failing (b) or (c) discards the draft and substitutes template text.
- **AC-37** Rule packs load from repository JSON, validate against the schema, and fail the build on any error.
- **AC-38** A pack cannot reach `ACTIVE` without `reviewedBy`, `reviewedOn`, `reviewDueOn`, and all 21 categories authored.
- **AC-39** A pack past `reviewDueOn` is `STALE`: submission in that jurisdiction returns 409 naming the reason; in-flight review shows the red notice and the extended attestation.
- **AC-40** Activating a new pack version does not alter any existing assessment's `rulePackVersion`, verdicts, or amounts.
- **AC-41** Two assertions. (a) Activation is blocked where the activating user is the last editor, unless they hold `RULEPACK_AUTHOR` and confirm sole authorship; the confirmation is audited. (b) A user who activated a pack version cannot sign off an assessment pinned to that version within the same session; the block names the reason and points to another reviewer.
- **AC-42** A matter whose `currency` does not equal `JURISDICTION_CURRENCY[jurisdictionCode]` (§6.0) cannot leave `DRAFT`: `POST /matters/{id}/submit` returns 409, and the typed error names both the selected currency and the expected one. Also enforced at intake as a form-level validation, not only server-side.
## 14. Test strategy
- **Engine unit tests.** Every `treatment` × every `Cap` type × boundary cases (zero quantity, cap exactly equal to claim, cap below claim, negative rate rejected).
- **Golden-file pack tests.** For each pack, a directory of `input.json` / `expected.json` fixtures. Changing a pack must break its golden files — that is the point. Include at minimum, per pack: an all-allowable claim; a claim of only disallowed categories; a mixed claim with one `OTHER`; a claim with a cap biting; a claim tripping duplicate, materiality and rate-sanity flags; and a claim against a `NO_EXPRESS_AUTHORITY` pack.
- **The reference fixture** — build this first; §10.3 and Annex A are both drawn from it. SG matter, private organisation, SGD, `isKnownDisputeOrLitigation: true`, SG-PDPA 2026.09.1:
| # | Category | Qty | Unit | Rate | Claimed | Expected verdict | Engine amount |
|---|---|---|---|---|---|---|---|
| 1 | `STAFF_TIME_SEARCH` | 4 | HOUR | 40.00 | 160.00 | `ALLOW` | 160.00 |
| 2 | `STAFF_TIME_COLLATE` | 2 | HOUR | 40.00 | 80.00 | `ALLOW` (unverified rule) | 80.00 |
| 3 | `STAFF_TIME_ASSESS_EXEMPTIONS` | 3 | HOUR | 40.00 | 120.00 | `DISALLOW` | 0.00 |
| 4 | `PHOTOCOPY_PRINT` | 220 | PAGE | 0.15 | 33.00 | `ALLOW_CAPPED` (cap 0.12/page) | 26.40 |
| 5 | `VENDOR_PAYROLL`, `isThirdPartyInvoiced: false`, `evidenceRef: null` | 3 | ITEM | 150.00 | 450.00 | `FLAG` — `CONDITIONS_NOT_MET`, `MATERIALITY` | 0.00 |
| 6 | `OTHER_UNCLASSIFIED` | 1 | FIXED | 45.00 | 45.00 | `FLAG` — `UNCATEGORISED` | 0.00 |
Expected totals: `claimedTotal` 888.00 · `draftBaseline` 266.40 · `disallowedTotal` 126.60 · `flaggedTotal` 495.00 (2 items) · `restingOnUnverifiedRules` 106.40 · `finalAmount` `null`. Expected matter flags: `LITIGATION_POSTURE` and `STALE_PACK_WARNING` (both requiring acknowledgement) plus the three informational SG pack flags. Line 5's materiality flag fires because 450.00 / 888.00 = 50.7% ≥ 40%.
- **Authorisation tests.** Every endpoint × every role, asserting on response bodies, not just status codes.
- **E2E (Playwright).** Full happy path; sign-off blocked by a pending flag; `INFO_REQUEST` round trip; stale-pack block; LLM-down degradation.
- **LLM evals** (`/evals`): category-suggestion accuracy on ~50 hand-labelled `OTHER` descriptions; rationale-drafting fidelity, asserting zero introduced numbers or citations. These gate deploys of `packages/agent` only.
- **Adversarial pass before launch.** Ask a lawyer who did not build this to try to make the tool produce an indefensible figure. Fix what they find.
## 15. Technical shape
Suggested, not mandatory — but if you deviate, keep the package boundaries.
```
/apps/web                   Next.js (App Router), TypeScript, server actions
  /app/(hr)                 intake, result
  /app/(legal)              queue, review
  /app/(admin)              rule packs, audit export
  /app/api                  route handlers, role guards
/packages/schemas           zod schemas, shared types, generated JSON Schema
/packages/engine            pure evaluator — no I/O, no LLM, no network
/packages/rulepacks         versioned JSON packs + loader + validator
  /HK-PDPO/2026.09.1.json
  /SG-PDPA/2026.09.1.json
  /AU-PRIVACY-ACT/...       stubs
  /NZ-PRIVACY-ACT/...
  /JP-APPI/...
  /KR-PIPA/...
  /CN-PIPL/...
  /IN-DPDP/...
  /VN-PDPL/...
/packages/agent             LLM boundary, versioned prompts, zod-validated output
/packages/documents         PDF generation for both documents
/packages/audit             append-only event writer
/prisma/schema.prisma       Postgres
/tests/{engine,packs,auth,e2e}
/evals
```
Stack: TypeScript throughout, Postgres, Prisma, Next.js, Tailwind, Playwright, Vitest. Money as integer minor units in a branded `Minor` type. No ORM-level cascade deletes anywhere near audit or signed-off records.
## 16. Roadmap
- **Phase 1 (this PRD).** Fee calculator with HK and SG packs authored; seven stubs. Ship to a small group; target 20 matters before widening.
- **Phase 2.** Author the remaining packs jurisdiction by jurisdiction, each gated on named local counsel. No engine change should be needed — if one is, the schema was wrong and that is worth knowing early.
- **Phase 3.** Identity verification agent (NS-1) as a **separate** service that writes an attestation into this one. Keep the personal-data boundary in §12.1 intact: verification handles personal data, the fee calculator still does not. Per §3.1, its output is a fact for the record (verified / not verified) — never itself a data-disclosure decision; that stays with Legal at sign-off.
- **Phase 4.** Scope-ambiguity assistant (NS-2) and requestor correspondence drafting (NS-3), again as separate services. Per §3.1, correspondence drafting produces a draft only; a human — Legal or HR, per §10.4 — still decides whether and when to send it. No phase in this roadmap may let a requestor-facing message go out without that human step.
- **Phase 5.** Post-hoc audit agent (NS-6) once volume justifies it, sampling signed-off assessments for consistency between lawyers and against the packs. v1's audit log is designed to make this possible without retrofitting. Per §3.1, it surfaces patterns for Legal and the DPO; it does not re-open or alter a signed-off assessment — AC-33's immutability guarantee is absolute regardless of which agent is asking.
## 17. Open questions for the product owner
1. **Who is the named authoring counsel per jurisdiction?** Nothing activates without this. It is the critical path, not the code.
2. **Is a flat fee preferable to itemisation in Hong Kong**, given the guidance permits it for administrative convenience where it stays below direct cost? A flat fee would change the intake UX considerably, and might be simpler and safer.
3. **Do we ever charge at all in practice**, or is the honest answer for most jurisdictions "cost recovery is not worth the friction with a departing employee"? If the answer is usually zero, this tool's real value is *documenting the decision not to charge* — which is a different emphasis, and a cheaper build.
4. **Which entity's cost rates** feed the sanity ceilings, and who maintains them?
5. **Retention** for signed-off assessments and audit events — confirm with the DPO.
6. **Does charging a fee affect the response clock** in any of the nine? If it does in some, that belongs in `constraints` as a per-pack field and should be added before build rather than after.

---
## Annex A — UI mockup
Supplied separately as `dsar-fee-agent-mockup.html`: the HR intake screen and the Legal review screen, clickable between states, showing the status strip, verdict cards, flag reasons, mandatory reason fields, hidden-total behaviour and the sign-off gate. Match its information hierarchy; styling is a starting point, not a specification.
## Annex B — Sources consulted
Legal positions in §7.4 were checked against the following on 7 September 2026. **They are the starting point for the authoring lawyer, not a substitute for that lawyer.** Nothing in this PRD is legal advice.
- Office of the Privacy Commissioner for Personal Data (Hong Kong), *Proper Handling of Data Access Request and Charging of Data Access Request Fee by Data Users* (revised July 2020) — https://www.pcpd.org.hk/english/publications/files/DAR_e.pdf
- Personal Data Protection Regulations 2021 (Singapore), reg. 7 — https://sso.agc.gov.sg/SL/PDPA2012-S63-2021
- Personal Data Protection Commission (Singapore), *Guide to Handling Access Requests* — https://www.pdpc.gov.sg/organisations/resources/guidance-by-topic/guide-to-handling-access-requests
- OAIC, *APP Guidelines* ch. 12 (APP 12) — https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-12-app-12-access-to-personal-information
- Office of the Privacy Commissioner (New Zealand), *Charging for access to personal information* — https://www.privacy.org.nz/responsibilities/charging-for-access-to-personal-information/
- Personal Information Protection Commission (Japan), APPI (English translation) — https://www.ppc.go.jp/files/pdf/280222_amendedlaw.pdf
- PIPA Enforcement Decree (Korea), art. 47 — Korea Legislation Research Institute, https://elaw.klri.re.kr
- Digital Personal Data Protection Rules, 2025 (India), notified November 2025 — https://www.dpdpa.com/DPDP_Rules_2025_English_only.pdf
- Law on Personal Data Protection No. 91/2025/QH15 and Decree 356/2025/ND-CP (Vietnam), in force 1 January 2026
