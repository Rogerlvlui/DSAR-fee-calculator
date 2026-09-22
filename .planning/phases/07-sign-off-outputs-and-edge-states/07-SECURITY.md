---
phase: "07"
slug: "sign-off-outputs-and-edge-states"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-09-22"
---

# Phase 07 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser → `/api/assessments/{id}/internal-record` | Untrusted actor identity and an untrusted route param cross into a handler that returns privileged content — the assessment's lawyer rationale and internal reasoning | Assessment record, PDF bytes |
| `apps/web` → `packages/documents` → `@react-pdf/renderer` | A newly added third-party rendering library gains access to already-persisted assessment data in-process | Full `Assessment` object |
| browser → `POST /api/assessments/{id}/signoff` | Untrusted actor identity and an untrusted JSON body cross into the one function that makes a fee final and releases it to HR | Sign-off payload |
| `signOff()` → `packages/audit` pack-lifecycle stream | A provenance record written by one subsystem becomes an authorization input to another | `PACK_ACTIVATED` actor id |
| pinned `RulePack.requestorNoticeTemplate` → generated notice text | Pack-authored content, and HR's own free-text line descriptions, cross into a document intended to leave the organisation | Notice draft text |
| `/hr/*` response → HR preparer | Privileged review content must not cross this boundary in any form, including inside a generated document | HR result payload |
| stored `Assessment` → generated internal record | Privileged content (`lawyerReason`, basis, citations, the attestation) is serialised into a downloadable file that leaves the application's own access-control surface once saved | Internal record PDF |
| `/legal/*` screen → `/hr/*` screen | Privileged review content must not cross between the two role-scoped route trees, by page composition or by any affordance | Download trigger, stale-pack notice |
| browser → internal-record endpoint (client trigger) | A client component becomes the first in-app caller of an endpoint returning privileged binary content | Blob response |
| planning records → the next phase's planner | A requirement marked Complete without a proof behind it silently removes work from every later phase's scope | `.planning/REQUIREMENTS.md` rows |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-07-01-01 | Information Disclosure | internal-record route | high | mitigate | Delegates to `getAssessmentForLegalReview`, whose first statement is `requireRole(actor, "LEGAL_REVIEWER")` — verified in code, 12/12 `internal-record.test.ts` pass | closed |
| T-07-01-02 | Elevation of Privilege | internal-record route (new endpoint) | high | mitigate | Negative-role case (403 + no PDF bytes) asserted directly, not inferred from UI — verified passing | closed |
| T-07-01-03 | Information Disclosure | pre-sign-off record generation | high | mitigate | `ConflictError` (409) thrown before matter/expenseLines/pack are fetched when no sign-off exists — verified in `route.ts` | closed |
| T-07-01-04 | Tampering | `@react-pdf/renderer` supply chain | high | mitigate | Blocking-human checkpoint (approved by product owner), version pinned exactly to 4.9.0, no postinstall script, no font fetch — verified in `packages/documents/package.json` | closed |
| T-07-01-05 | Tampering | bundler config widened for upstream crash workaround | medium | mitigate | Exactly one named `transpilePackages` entry (`@dsar/documents`); no safety check disabled, no unbounded allowlist — verified in `next.config.ts` | closed |
| T-07-01-06 | Denial of Service | unbounded PDF generation on a GET | low | accept | Role-gated to a single demo reviewer identity on a local prototype host with no public exposure; rate limiting out of scope per PROJECT.md's stubbed-identity framing | closed (accepted) |
| T-07-01-SC | Tampering | npm install of `@react-pdf/renderer` | high | mitigate | Package legitimacy audit in 07-RESEARCH.md plus the blocking-human checkpoint — never auto-approvable | closed |
| T-07-02-01 | Elevation of Privilege | `signOff()` role check | high | mitigate | `requireRole(actor, "LEGAL_REVIEWER")` remains the function's first statement; refusal proven against every non-reviewer role on response bodies | closed |
| T-07-02-02 | Repudiation | self-activated pack version signed off by its own activator | high | mitigate | 403 when the latest `PACK_ACTIVATED` actor id matches the signing actor id — verified in `assessments.ts`, 5/5 PACK-ACTIVATION-SIGNOFF tests pass | closed |
| T-07-02-03 | Spoofing | activator identity comparison | medium | mitigate | Exact `UserRef.id` string equality only — no displayName/role/case-fold — verified in code | closed |
| T-07-02-04 | Information Disclosure | refusal messages naming pending lines | low | accept | Names `ExpenseLine.seq` integers only — never description, vendor, evidence ref, or HR note | closed (accepted) |
| T-07-02-05 | Tampering | 409/400 asymmetry being "fixed" by a later contributor | medium | mitigate | Malformed-input cases keep 400; pending-lines/flag-ack keep 409; source comment records intent | closed |
| T-07-02-06 | Denial of Service | repeated refused sign-off attempts | low | accept | A refusal writes nothing — no record, amount, or status change — so repeated attempts leave no residue | closed (accepted) |
| T-07-03-01 | Information Disclosure | generated requestor notice | high | mitigate | `findAc17Violations` asserts no rule id, citation, basis string, or tool/model mention reaches the notice, proven against real packs plus a positive control | closed |
| T-07-03-02 | Information Disclosure | HR result payload | high | mitigate | `ResultViewLine` has no field for the lawyer's own recorded reason — structural, not habitual | closed |
| T-07-03-03 | Spoofing | a sent notice implying the tool transmitted it | medium | mitigate | Boundary note (tool emails nobody) asserted in both sent/unsent states; confirmation renders a date, not a transmission timestamp | closed |
| T-07-03-04 | Tampering | notice text rendered as markup | medium | mitigate | Plain text in a `<pre>`; `buildNoticeDraft` returns a string with no markup assembly, no `dangerouslySetInnerHTML` | closed |
| T-07-03-05 | Repudiation | a zero-fee outcome presented as an error | medium | mitigate | Zero figure renders through the identical headline element/class as any other figure — never visually reclassified as failure | closed |
| T-07-03-06 | Information Disclosure | HR free-text descriptions reaching the requestor | medium | accept | By design (notice reproduces HR's own itemisation); mitigated by Phase 05's pattern-detector/length-cap on `description` | closed (accepted) |
| T-07-04-01 | Repudiation | sign-off block attestation | high | mitigate | Attestation-version mismatch produces an explicit mismatch statement rather than silent restatement — dedicated unit case | closed |
| T-07-04-02 | Tampering | figures recomputed inside the document layer | high | mitigate | `finalAmount` read only from `assessment.signOff.finalAmount`; pure view layer formats once, JSX recomputes nothing | closed |
| T-07-04-03 | Repudiation | footer provenance drifting to the current pack | high | mitigate | Footer pack id/version/engine version read from the assessment's own stored fields; staleness evaluated against the recorded sign-off instant, not the wall clock | closed |
| T-07-04-04 | Information Disclosure | privileged content in a downloadable artefact | high | mitigate | Role gate and pre-sign-off refusal owned by 07-01, unchanged; this plan only widens response content | closed |
| T-07-04-05 | Tampering | colour-coded verdict implying a conclusion the engine didn't reach | medium | mitigate | Greyscale-only palette (exactly 4 hex literals); verdict/disposition carry state in words | closed |
| T-07-04-06 | Denial of Service | a very large assessment rendering an unbounded document | low | accept | 50-line render exercised in the smoke test, matching PRD §11's performance envelope; unbounded input unreachable via the intake surface | closed (accepted) |
| T-07-04-07 | Information Disclosure | a font or asset fetched at render time | low | mitigate | Built-in Helvetica only — no `Font.register` call, no font binary in the package | closed |
| T-07-05-01 | Information Disclosure | download trigger placement | high | mitigate | Reachability scan proves the endpoint path and trigger label are absent from the HR route tree's transitive import graph and serialised payload, with a canary proving the matcher works | closed |
| T-07-05-02 | Information Disclosure | `lawyerReason` in an HR payload | high | mitigate | Distinctive recorded-reason strings absent from the HR result payload, present via canary in the legal-side payload | closed |
| T-07-05-03 | Elevation of Privilege | a page.tsx edit dropping a role-gated call | high | mitigate | Before/after count criterion on `getCurrentActor`/`requireRole`-gated call sites in the legal assessment page — verified unchanged | closed |
| T-07-05-04 | Information Disclosure | a partially-downloaded or error-bodied file saved as a PDF | medium | mitigate | Download wrapper offers nothing download-bearing on a non-ok response; error path renders inline instead | closed |
| T-07-05-05 | Repudiation | a stale pack reviewed without the lawyer being told | high | mitigate | Notice reuses the same `deriveEffectiveStatus` helper the attestation's own stale flag uses — cannot disagree with it | closed |
| T-07-05-06 | Tampering | stale state conveyed by colour alone | low | mitigate | Heading words carry the state, asserted independent of any class assertion (WCAG 2.1 AA) | closed |
| T-07-06-01 | Repudiation | `.planning/REQUIREMENTS.md` Phase 7 rows | high | mitigate | All fifteen rows walked and independently confirmed against a real, currently-passing test | closed |
| T-07-06-02 | Tampering | a §10.7 row silently dropped in a later edit | medium | mitigate | Completeness assertion pins row count at seven, deep-equals describe titles against PRD state cells | closed |
| T-07-06-03 | Repudiation | a skipped test reporting green for the unprovable LLM row | medium | mitigate | Real executing test asserts `packages/agent` absence and the row's outstanding status — not skipped | closed |
| T-07-06-04 | Repudiation | a regression sweep passing because new assertions aren't running | medium | mitigate | Failing direction is an equal-or-lower total, not merely non-zero exit — live-verified at 1066/1066, strictly above the 953 baseline | closed |
| T-07-06-05 | Information Disclosure | none new | low | accept | 07-06 adds no production surface, no endpoint, no rendered content | closed (accepted) |

*Status: open · closed · closed (accepted) — below `high` threshold does not block regardless*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (high) count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Unregistered findings surfaced by code review (not in the plan-time STRIDE register)

The independent code review (`07-REVIEW.md`) found four issues the plan-time threat modeling above did not anticipate — a genuine gap worth recording even though all four are now fixed and independently re-verified against current code:

- **CR-01 (Critical)** — `Content-Disposition` header built from unescaped `matter.reference` (HR-controlled free text), letting a lower-privileged `HR_PREPARER` inject a `filename*` parameter a `LEGAL_REVIEWER`'s browser would honor when saving the evidentiary PDF. Not anticipated by T-07-01-xx or T-07-04-xx despite those rows explicitly discussing "privileged content in a downloadable artefact." **Fixed**: `buildInternalRecordContentDisposition()` (commit `bdadc1c`) — ASCII-sanitized fallback filename + correctly percent-encoded RFC 5987/6266 `filename*`. Verified present in `route.ts`, unit test + full route-level regression test both passing.
- **WR-01** — `String.replace` magic-pattern (`$&`/`$$`) corruption in footer rendering when a lawyer's `qualification` free text contains `$`. **Fixed**: `split`/`join` substitution instead of `String.replace` (commit `aefdd70`). Verified present in `internal-record-view.ts`.
- **WR-02** — `qualification` was the only sign-off free-text field with no length cap. **Fixed**: `FREE_TEXT_LIMITS.qualification = 200`, enforced at both the schema (`SignOffSchema`) and server (`signOff()`) layers (commit `2848660`). Verified present at both.
- **WR-03** (test-coverage gap, not a vulnerability) — internal-record route missing from the percent-encoded-id regression suite that exists specifically because of this project's recurring "colon id 404s under Next's real router" bug class. **Fixed** (commit `8b84735`). Verified present in `live-routing.test.ts`.

All four independently re-verified by the security auditor directly against current code (not merely trusted from the review addendum), full suite green at 1066/1066.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|--------------|------|
| AR-07-01 | T-07-01-06 | Endpoint role-gated, single demo reviewer identity, no public exposure; rate limiting out of scope for this prototype | Claude (security auditor), product owner via CLAUDE.md's prototype-framing constraint | 2026-09-22 |
| AR-07-02 | T-07-02-04 | Refusal names only integer line sequence numbers, never free text | Claude (security auditor) | 2026-09-22 |
| AR-07-03 | T-07-02-06 | Every refusal path writes nothing — no exploitable residue from repetition | Claude (security auditor) | 2026-09-22 |
| AR-07-04 | T-07-03-06 | HR free-text descriptions reaching the requestor notice is by design (itemisation transparency); mitigated upstream by Phase 05's personal-data pattern detector and length caps | Claude (security auditor) | 2026-09-22 |
| AR-07-05 | T-07-04-06 | 50-line render matches PRD §11's stated performance envelope; unbounded input unreachable via the intake surface | Claude (security auditor) | 2026-09-22 |
| AR-07-06 | T-07-06-05 | 07-06 adds no new production surface — its own threat surface is limited to record accuracy | Claude (security auditor) | 2026-09-22 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-22 | 37 | 37 | 0 | gsd-security-auditor (independent subagent) |

---

## Verification method

The independent `gsd-security-auditor` subagent verified all 37 threats across the six plan-time STRIDE registers directly against the final committed implementation — not against the plans' prose claims alone — re-running the specific test files each mitigation cites as evidence (`internal-record.test.ts`, PACK-ACTIVATION-SIGNOFF, ACCESS-05 boundary scan, EDGE-STATE-TABLE, SIGNOFF, `documents` project), plus the full suite (1066/1066 passing) and `depcruise` (clean). This is the first phase in this project where the auditor subagent dispatch succeeded in this worktree (`gsd-tools.cjs` remained unavailable for prior phases 03.1 through 06, which used manual verification instead). All 31 mitigate-disposition threats confirmed present in code; all 6 accept-disposition threats confirmed consistent with their stated rationale and newly logged in the Accepted Risks table above (none existed before this phase, since no `SECURITY.md` had been written for this project prior to this run). threats_open: 0.

---

_Reviewed: 2026-09-22_
_Reviewer: gsd-security-auditor (independent subagent dispatch)_
_ASVS Level: 1 (prototype, matching prior phases' recorded level)_
