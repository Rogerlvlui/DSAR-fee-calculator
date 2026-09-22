---
phase: "04"
slug: "workflow-and-audit-backbone"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-09-19"
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| HTTP route → data layer | Untrusted request body and cookie-borne role cross here; the role check is the first statement of every data-layer function | Matter/expense-line/disposition input, role cookie |
| data layer → workflow guard | The only place a status change is decided; a call site that decides for itself has escaped the boundary | `GuardInput`, transition event name |
| data layer → audit writer | A write that is dropped, swallowed or best-effort converts a defensible record into an undetectable gap | Audit event payload, actor, server timestamp |
| caller → audit store | Handing out a live reference to a stored event makes an append-only store editable by accident | `AuditEvent` records (deep-copied both ways) |
| payload construction → frozen payload schema | The one validation point standing between a five-key declared set and a table that cannot be deleted from | Audit payload keys |
| PRD transition table → declared array | A row omitted here is a precondition silently never checked anywhere in the system | `TRANSITIONS` array |
| guard package → the rest of the repository | The purity claim that makes a guard reviewable in isolation; an import across this line voids it | (none — the boundary is the absence of I/O) |
| declared gate → CI | A gate nobody proved fires is indistinguishable from no gate | dependency-cruiser / ESLint rule output |
| cookie value → resolved identity | The only place a role is asserted in this prototype; an unrecognised value must fall back to the least-privileged identity, never the most | `dsar_demo_role` cookie |
| any caller → the audit export | The single call that returns every recorded act across every matter; the widest read in the system | Full matter-scoped + pack-lifecycle event log |
| matter-scoped stream ↔ pack-lifecycle stream | Two record shapes deliberately kept apart because merging them would require reopening a frozen non-nullable field | `AuditEvent` vs pack-lifecycle event |
| data-layer function → stored matter status | Six remaining places a status reached storage without a guard's answer behind it (04-04) | `MatterStatus` literal vs executor-returned destination |
| lawyer's decision → audit record | The point where an act becomes defensible or becomes deniable | Disposition/sign-off payload |
| refusal path → audit record | A record written on a path that wrote no state would be a decision the log claims happened and the data denies | (absence of a write) |
| legal review → recompute | A path that can multiply assessment records, or carry a cleared decision forward, if it creates rather than replaces | `Assessment` identity |
| review screen open → elapsed figure | The origin of the only automation-bias signal the system produces | First-opened timestamp |
| signed assessment → correction | The immutability boundary the product's whole defensibility claim rests on; a write across it destroys the evidence rather than correcting it | Signed `Assessment` record (read-only) |
| engine-derived identifier → stored identifier | A derived identifier that collides with an existing one silently overwrites the record it collided with | `Assessment.id` |
| signed-off → closed | A status change that, left unaccompanied, would hide a figure the preparer is entitled to see | `MatterStatus` |
| intake acts → the log | A log covering decisions but not the claims they decided on cannot reconstruct how a fee was reached | `MATTER_CREATED`/`LINE_ADDED`/`LINE_EDITED`/`LINE_DELETED` events |
| phase claim → requirement ledger | A requirement marked complete on a structural proof, with no live caller, is a gap that later phases will skip | REQUIREMENTS.md status text |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | Tampering | `matters.ts` submitForAssessment | high | mitigate | `status: submitOutcome.to` (matters.ts:309), never a literal; conflict-refusal path (:304-306) writes nothing | closed |
| T-04-02 | Repudiation | `audit-trail.ts` | critical | mitigate | Server-stamps `new Date().toISOString()` (audit-trail.ts:29); caller awaits the write before returning success | closed |
| T-04-03 | Tampering | `audit-event-writer.ts` | high | mitigate | `structuredClone` on write and both read paths (audit-event-writer.ts:44-61) | closed |
| T-04-04 | Information Disclosure | audit payload | high | mitigate | `z.strictObject` with a closed key set (audit-event.ts:44-50); typed builders in `payload-builders.ts` | closed |
| T-04-05 | Elevation of Privilege | new data-layer surface | high | mitigate | `requireRole()` confirmed the first statement in every function across `data/matters.ts`, `data/assessments.ts`, `data/audit.ts` | closed |
| T-04-06 | Spoofing | guard input assembly | medium | mitigate | `guard-input.ts` built entirely from fetched matter/lines/assessment/pack/actor; `lawyerIdentity` server-resolved | closed |
| T-04-07 | Denial of Service | unbounded in-memory audit store | low | accept | Single-process demo, append-only, cleared by process restart | closed (accepted) |
| T-04-08 | Tampering | `transitions.ts` | high | mitigate | Whole-array `toEqual` completeness test (transitions.test.ts:35) against the PRD table | closed |
| T-04-09 | Elevation of Privilege | sign-off row's guard | critical | mitigate | Four ordered, independently-refusing conditions (transitions.ts:159-170) | closed |
| T-04-10 | Tampering | guard package imports | high | mitigate | `no-io-in-workflow`/`no-infra-in-workflow` dependency-cruiser rules, fixture-proven, plus the by-name 8-rule assertion (purity-gate.test.ts:172-191) | closed |
| T-04-11 | Repudiation | non-deterministic guard evaluation | medium | mitigate | Clock/randomness/locale/Intl bans scoped to `packages/workflow` (eslint.config.js:166-195), each with a distinct message and fixture | closed |
| T-04-12 | Spoofing | resubmit row reusing a cached pack answer | medium | mitigate | RESUBMIT row (transitions.ts:128-140) re-evaluates pack-usability and currency independently | closed |
| T-04-13 | Elevation of Privilege | `audit.ts` export | critical | mitigate | `requireRole(actor, "DPO_ADMIN")` literal first statement (audit.ts:30) | closed |
| T-04-14 | Information Disclosure | whole-log export | high | mitigate | No route or screen exists this phase (verified by grep); DPO absent from the demo role switcher | closed |
| T-04-15 | Spoofing | cookie-resolved identity | high | mitigate | Unrecognised/absent cookie falls back to `HR_PREPARER`, the least-privileged identity (auth.ts:57,62) | closed |
| T-04-16 | Tampering | pack-lifecycle payload | high | mitigate | Validated against the same `AuditPayloadSchema` as the matter-scoped stream; no second schema | closed |
| T-04-17 | Tampering | returned event objects | medium | mitigate | Deep copy on write/list/export in `pack-lifecycle-event-writer.ts:41-58` | closed |
| T-04-18 | Repudiation | stream separation | medium | mitigate | Cross-stream separation test (pack-lifecycle-event-writer.test.ts:139-156) | closed |
| T-04-19 | Tampering | every remaining status write | critical | mitigate | ESLint literal-status-write gate; widened to `.tsx` and to `AssignmentExpression` (eslint.config.js:196-236, WR-03 post-review fix); stand-in module deleted; `lint-status-write.test.ts` 7/7 including the new bypass cases | closed |
| T-04-20 | Repudiation | disposition and sign-off records | critical | mitigate | Full-provenance records written only after successful state writes; refusal paths verified to write nothing (AUDIT-TRAIL suite, 14/14) | closed |
| T-04-21 | Tampering | the recompute path | high | mitigate | Shared `computeInPlaceOrRollback` (matters.ts:397-452) + `recomputeAssessment` (recompute.ts:46-51) preserve identity, clear every disposition, never touch SUPERSEDED | closed |
| T-04-22 | Repudiation | elapsed review time across a recompute | high | mitigate | `clearAssessmentOpened(existing.id)` runs inside the same shared mutation (recompute.ts:49) | closed |
| T-04-23 | Elevation of Privilege | the recompute entry point | high | mitigate | `requireRole(actor, "LEGAL_REVIEWER")` first; RECOMPUTE guard refuses outside LEGAL_REVIEW | closed |
| T-04-24 | Denial of Service | a matter stranded mid-computation by a failed audit write | medium | mitigate | **Post-review fix (CR-01):** `computeInPlaceOrRollback`'s catch block writes the rollback status before its own audit record; verified via real routes forcing a live engine throw (audit-trail.test.ts CR-01 tests) — this closed a genuine, dated gap (resubmit/recompute previously had no rollback at all) | closed |
| T-04-25 | Tampering | the sign-off gate's existing refusals | medium | mitigate | Pre-existing sign-off/disposition refusals untouched; SIGNOFF/DISPOSITION suites pass with no assertion edited | closed |
| T-04-26 | Tampering | signed assessment during a correction | critical | mitigate | `raiseCorrection` reads the signed assessment and never writes it again; deep-equal snapshot test in `correction.test.ts` | closed |
| T-04-27 | Tampering | engine-derived identifier collision | critical | mitigate | `newUlid()` explicit fresh identifier, commented (assessments.ts:594); test asserts two distinct ids and exactly two records | closed |
| T-04-28 | Elevation of Privilege | the correction entry point | high | mitigate | Role check first; SUPERSEDE guard refuses outside SIGNED_OFF/CLOSED | closed |
| T-04-29 | Information Disclosure | preparer-facing read after closure | medium | mitigate | `HR_VISIBLE_MATTER_STATUSES` widened to `{SIGNED_OFF, CLOSED}` only (assessments.ts:72) | closed |
| T-04-30 | Repudiation | intake acts absent from the log | medium | mitigate | `createMatter`/`addExpenseLine`/`replaceExpenseLine`/`deleteExpenseLine` each record an event; refusals write nothing | closed |
| T-04-31 | Repudiation | a requirement marked complete on a structural proof | high | mitigate | `lifecycle.test.ts` coverage test enumerates every audit event type as written or deferred-with-owner against the closed enum | closed |
| T-04-32 | Spoofing | in-memory stand-in presented as a database guarantee | high | mitigate | The STATE-04 row in `04-VALIDATION.md` stays manual-only, unmarked, pointing at Phase 3.2 | closed |
| T-04-SC (×5) | Tampering | npm/pip/cargo installs | low | accept | No external package installed across any of the five plans in this phase — only first-party workspace packages | closed (accepted) |
| UNREG-1 | — (robustness, not a flag) | `getNoticeSentAt` (`apps/web/src/server/data/matters.ts:681`) | low | accept | Exported with no `requireRole()` of its own — relies on statement order in the HR result page (called after three role-gated reads already succeed), the same class of fragility WR-02 fixed for `listExpenseLines`. Confirmed via `git log -S` to predate this phase (introduced in 03.1-04), not new attack surface; returns only a date-or-null with no PII/financial content. Not counted as a new open threat — noted for a future pass. | closed (accepted) |

*Status: open · closed · open — below block_on threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-04-07 | Single-process, append-only in-memory audit store with no eviction policy; a Postgres-backed writer with real retention is Phase 3.2's to build. | Phase 04 planning | 2026-09-19 |
| AR-04-02 | T-04-SC (×5) | No external package installed in any of the five plans — the risk class this threat covers never had an occasion to fire this phase. | Phase 04 planning | 2026-09-19 |
| AR-04-03 | UNREG-1 | `getNoticeSentAt` has no role check of its own and relies on call-order safety in the HR result page, the same fragility class WR-02 fixed elsewhere. Pre-dates this phase (03.1-04), returns no PII/financial data, and is below `block_on: high`. Tracked for a future pass rather than fixed here. | Security audit, 2026-09-19 | 2026-09-19 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-19 | 32 | 32 | 0 | gsd-security-auditor |

**Independently re-verified by the auditor:** `pnpm test` 732/732 passing; `pnpm run lint`, `pnpm run typecheck`, `pnpm run depcruise` all clean; targeted re-runs of `STATUS-WRITE-GATE` (7/7), `RECOMPUTE` (8), `AUDIT-TRAIL` (14/14, including both CR-01 rollback tests and the CR-02 test), `HR-RESULT` (6, including the WR-02 regression test), the `workflow`+`audit` projects (55/55), and the `purity-gate` 8-rule assertion.

This audit ran against the working tree *after* `04-REVIEW.md`'s five findings (CR-01, CR-02, WR-01, WR-02, WR-03) were fixed — T-04-19, T-04-21 and T-04-24 in particular were re-verified against the post-fix code, since the fixes landed directly in the functions those threats cover.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-19
