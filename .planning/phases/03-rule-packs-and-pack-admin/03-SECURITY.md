---
phase: "03"
slug: "rule-packs-and-pack-admin"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-09-18"
---

# Phase 3 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| committed repository JSON → loader | Pack files are untrusted input at load time even though they are repository-controlled: a merged authoring mistake is the realistic attack, not an adversary | Rule-pack JSON (jurisdiction, categoryRules, constraints, flatFee) |
| loader/validator → `packages/engine` | Only a pack that has crossed the parse boundary and the ACTIVE narrowing may reach `assess()` | Narrowed `RulePack` (no nulls) |
| PRD §7.4/§7.5/§7.6 text → committed pack JSON | Transcription is where an unauthored legal position can enter the repository disguised as counsel's determination | Legal rule content (treatment, basis, citation) |
| generator → committed JSON | The generator is the only writer; a hand-edit is a tampering event the drift test must catch | Placeholder categoryRules text |
| pack JSON `status` field → ACTIVE gate | `status: "ACTIVE"` is an author's claim; the gate is what turns it into a checked fact | Reviewer identity, review dates, unauthored-token state |
| stored `status` field → usability decision | The stored literal is an authored lifecycle value; time passing is not an authored event, so currency must be recomputed at the point of use | `reviewDueOn` vs. injected `now` |
| pinned `rulePackVersion` → resolved pack content | The join between an assessment and the rules it was computed under; if this drifts, the defensibility claim the whole product rests on fails | `(packId, version)` → pack content |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01 | Tampering | `loader.ts` | high | mitigate | `LoadableRulePackSchema.parse()` is the sole parse boundary; `z.strictObject` + closed enums reject unknown keys | closed |
| T-03-02 | Tampering | `validate.ts` | high | mitigate | Case-sensitive `findBannedWord` over `LEGAL_CONCLUSION_BANNED_WORDS`, wired into `pack:validate` and the test suite | closed |
| T-03-03 | Tampering | `loader.ts` directory glob | medium | mitigate | `NON_PACK_DIRECTORIES` excludes `src`/`scripts`/`node_modules`/`dist` | closed |
| T-03-04 | Information disclosure | pack-authored `basis`/`verificationNote` text | low | accept | No renderer exists this phase (D-20); deferred to Phase 3.2 (must use React default escaping, never `dangerouslySetInnerHTML`) | closed (accepted) |
| T-03-05 | Spoofing | stub pack `constraints`/`feePosture` | high | mitigate | `STUB_CONSTRAINTS` all-`null` (D-18), parsed via `StubConstraintsSchema` | closed |
| T-03-06 | Tampering | committed stub JSON | medium | mitigate | Drift test regenerates and compares every UNAUTHORED-tagged rule | closed |
| T-03-07 | Repudiation | stub pack `authoredBy`/`reviewedBy` | medium | mitigate | Both `null` on every stub, `status: DRAFT`; bound by `assertReviewerIdentity` | closed |
| T-03-08 | Spoofing | pack `status`/`reviewedBy` | high | mitigate | `assertReviewerIdentity` refuses ACTIVE without non-null reviewer fields | closed |
| T-03-09 | Tampering | UNAUTHORED marker | high | mitigate | `assertNoUnauthoredContent` scans categoryRules, requestorNoticeTemplate, and `flatFee.verificationNote` (CR-01 fix, commit `417aaa8`, confirmed live). Residual: author deletes marker + writes filler text — human review control, not claimed closed | closed |
| T-03-10 | Tampering | `constraints` narrowing | high | mitigate | ACTIVE-readiness ends in `RulePackSchema.parse()` — no hand-written key check to drift | closed |
| T-03-11 | Repudiation | `PROTOTYPE_COUNSEL` | medium | accept | Seeded prototype identity, non-routable address, deliberately not a real reviewer (D-17); fixed ULID for future joinability | closed (accepted) |
| T-03-12 | Tampering | stored `status` literal | high | mitigate | `deriveEffectiveStatus` recomputes from `reviewDueOn`/injected `now`, never trusts stored `ACTIVE` | closed |
| T-03-13 | Tampering | pinned version resolution | high | mitigate | `resolveRulePack` throws on packId/version mismatch | closed |
| T-03-14 | Information disclosure | `staleReason` text | low | mitigate | Names only dates; passes `findBannedWord` | closed |
| T-03-15 | Tampering | `@dsar/rulepacks` → `@dsar/engine` edge | medium | mitigate | **Gap confirmed**: root `depcruise` script targets only `packages/engine packages/schemas` — `packages/rulepacks` is never scanned, so a reversed edge (engine importing rulepacks) would not be caught despite the plan's stated mitigation. Below `block_on: high`, non-blocking. Recommend adding `packages/rulepacks` to the depcruise target list plus a `to: ^packages/rulepacks` forbidden rule from `packages/engine`. | open — below block_on |
| T-03-16 | Spoofing | authored `basis`/`treatment`/`cap` (HK-PDPO/SG-PDPA) | high | mitigate | Every value transcribed from a named PRD section, spot-checked in `authored-packs.test.ts`; unwritten categories are UNAUTHORED placeholders | closed |
| T-03-17 | Spoofing | `HK-PDPO.flatFee.amount` | high | mitigate | Post-plan legal-review round set a real figure (HK$100/`10000`, product-owner decision, not PRD-sourced, `NEEDS_VERIFICATION`, no UNAUTHORED token). Pack still cannot reach ACTIVE: `authoredBy`/`reviewedBy`/`reviewedOn` remain `null` → `MISSING_REVIEWER` fires first in `ACTIVE_READY_CHECK_ORDER`. Verified live. | closed |
| T-03-18 | Tampering | `packages/schemas` freeze | medium | mitigate | Additive-only `FlatFeeSchema.verificationNote`; JSON Schema artifacts regenerate byte-identical; recorded in `FREEZE.md` | closed |
| T-03-19 | Information disclosure | reference-pack `basis` text | medium | mitigate | WR-01 fix confirmed live (commit `9ae0a05`): HK's `OTHER_UNCLASSIFIED` basis reworded "Legal"→"Counsel". Case-sensitive scan of both packs' `basis`/`verificationNote`/`citation` found zero remaining unflagged banned-word instances. Residual "lawfully" inflection (PD-5 ii) explicitly signed off by product owner. | closed |
| T-03-SC (×5) | Tampering | npm/pip/cargo installs | low | accept | No new external package introduced across any of the 5 plans (one internal `workspace:*` relink in 03-04) | closed (accepted) |

*Status: open · closed · open — below block_on threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-04 | No pack-content renderer exists yet (D-20) — the XSS-adjacent risk of unescaped pack-authored text has no attack surface until Phase 3.2/5 build `apps/web`. Must use React default escaping when a renderer lands. | Phase 3 planning (D-20) | 2026-09-18 |
| AR-03-02 | T-03-11 | `PROTOTYPE_COUNSEL`'s seeded, non-routable identity is a deliberate prototype stand-in (D-17), not a real reviewer — acceptable for this milestone, must be swapped before pilot. | Phase 3 planning (D-17) | 2026-09-18 |
| AR-03-03 | T-03-SC | No new external dependency introduced by any of the 5 plans; no supply-chain legitimacy checkpoint required. | Phase 3 planning | 2026-09-18 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-18 | 20 | 19 | 1 (T-03-15, below block_on) | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-18
