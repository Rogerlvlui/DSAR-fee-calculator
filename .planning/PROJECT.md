# DSAR Fee Assessment Agent

## What This Is

A web tool that works out what an employer may lawfully charge an ex-employee for responding to a data subject access request. HR itemises what the request actually cost them; a deterministic engine applies a versioned, lawyer-authored rule pack for the relevant jurisdiction; a named lawyer reviews the result line by line and signs it off. Only then does HR see a figure.

It is for HR Shared Services (who enter costs), qualified lawyers in nine Asian jurisdictions (who decide), the counsel who author the rule packs, and the DPO (who audits). The full specification is `docs/PRD-dsar-fee-agent.md` — 1,005 lines, and the source of truth for everything below.

## Core Value

A lawyer can defend the output by saying "the engine applied rule HK-PDPO.STAFF_TIME_REDACT_EXEMPT, version 2026.09.1, authored by X on date Y, and struck the line" — never "the model assessed the claim."

Everything else in this product exists to protect that sentence.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**The determination pipeline**

- [ ] HR can itemise claimed costs against a closed 21-code expense taxonomy, with no free-text category
- [ ] A deterministic engine computes a fee from a versioned rule pack — pure functions, no I/O, no network, no LLM
- [ ] Every line carries its applied rule ID, pack-authored basis, and citation, visible without interaction
- [ ] Unsettled rules and thin facts produce a FLAG that contributes nothing to any total until a lawyer dispositions it
- [ ] A lawyer reviews every line, dispositions each one, and signs off by name with a recorded attestation
- [ ] HR sees no draft assessment, verdict, rationale or figure before sign-off — enforced server-side by role

**Rule packs as versioned data**

- [ ] Nine jurisdiction packs as repository JSON: HK and SG authored in full, seven shipping as DRAFT stubs
- [ ] Pack lifecycle with named author and reviewer, `reviewDueOn`, and a hard STALE block on new matters past that date
- [ ] Rule pack admin screen with live validation, 21/21 category completeness, version diff, and an audited activation gate
- [ ] Hong Kong flat-fee option: the engine computes both an itemised baseline and the pack's flat figure, and the lawyer chooses — with the flat fee blocked where it exceeds itemised direct cost

**Governance and defensibility**

- [ ] Guarded state machine DRAFT to COMPUTING to LEGAL_REVIEW to SIGNED_OFF to CLOSED, with INFO_REQUEST and SUPERSEDED branches
- [ ] SIGNED_OFF records are immutable; a correction is a new assessment that supersedes, never an edit
- [ ] Append-only audit log, enforced at the database level, capturing every transition, disposition, activation and sign-off
- [ ] Anti-automation-bias controls: total hidden until every line is dispositioned, mandatory reasons, no bulk action on flagged lines, recorded review duration
- [ ] Four-layer risk disclosure: capability statement, persistent status strip, per-line provenance, output-embedded footer

**Outputs**

- [ ] Internal fee assessment record as a PDF, carrying pack version, engine version, lawyer name, qualification and verbatim attestation
- [ ] Requestor-facing fee notice draft as copy-to-clipboard text — no rule IDs, no citations, no mention of AI or of this tool
- [ ] A zero-fee outcome produces a valid notice stating no fee is charged — a common, correct result, not an error state

**The LLM boundary**

- [ ] Job 1 only: suggest a category for an OTHER_UNCLASSIFIED line, advisory, never changing a verdict or an amount
- [ ] Jobs 2 and 3 (rationale drafting, query summarising) use deterministic template text this milestone
- [ ] The product works fully with the model unavailable, and says so when it is

### Out of Scope

- **Anything in PRD §4.2, NS-1 through NS-10** — numbered in the spec specifically so a coding agent does not helpfully implement them
- **Outbound email of any kind (NS-3)** — the tool drafts a notice; a human sends it from their own mailbox
- **The requestor's actual personal data (NS-4)** — an architectural boundary, not a phasing decision. No file upload, no requestor name field anywhere, no HRIS or payroll integration. Compromise of this system exposes internal cost data, not employee personal data
- **Runtime legal research (NS-8)** — no web search, no reading statutes, no reasoning from first principles. The agent applies the rule pack, full stop
- **Automatic sign-off, confidence-gated approval, or bulk approval of flagged lines (NS-7)** — a rubber-stamped output has the appearance of legal review without the substance, which is worse than no tool
- **GDPR/EU pack (NS-10)** — noted in the schema so it is not later found to be EU-hostile; not built
- **Corporate SSO and IdP group role assignment** — deferred with the prototype framing. Authorisation itself is *not* deferred: role guards are server-side and tested, behind a stubbed identity provider
- **LLM Jobs 2 and 3** — deferred to keep the model's surface area minimal while the engine is being proven
- **Both documents as PDF** — the requestor notice stays text, which is how §10.4 says HR actually uses it
- **Flat-fee-only intake** — considered and rejected; you cannot show a flat fee stays below direct cost without itemising the direct cost

## Context

**This project is spec-first, not idea-first.** A complete PRD already exists and has been through revision (recompute semantics and the currency/jurisdiction guard were clarified in commit `c4fa192`). There is no application code yet — no `package.json`, no build tooling, no source tree. Planning work here is about sequencing and scoping a known specification, not discovering what to build.

**The asymmetry that shapes every default.** An over-claimed fee invites a regulator complaint, is evidence of obstruction if the DSAR precedes employment litigation, and is in some regimes itself a breach. An under-claimed fee costs a few hundred dollars. The product is deliberately biased toward under-claiming, and PRD R8 accepts under-claim as the cheaper error.

**Governance stance (PRD §3.1).** Legal makes every determination that reaches HR or the requestor; HR only supplies inputs for Legal to review. The PRD's analogy: this is an Airbnb-style workflow, not a Booking.com one — the host always makes the final call before a reply goes out, never an instant discretion-free confirmation. As further agents are added (identity verification, correspondence drafting, post-hoc audit), none may shortcut this.

**Automation bias is the risk most likely to make this product actively harmful.** PRD M2 instruments for it: a lawyer change rate near zero is a failure signal, not a success signal. Several UI requirements exist solely to force line-by-line engagement.

**Existing assets.** The Annex A mockup (`docs/dsar-fee-agent-mockup.html`) is what the PRD names and what the web screens are built against — match its information hierarchy, not its styling. A second, simplified interactive walkthrough (`docs/dsar-fee-agent-mockup-simplified.html`) is useful for the feel of the review interaction but is secondary where the two disagree, and is a self-extracting bundle that cannot be read or diffed as source.

**The critical path is legal, not code.** PRD §17 q.1 — named authoring counsel per jurisdiction — gates pack activation. For this milestone it is resolved for HK and SG; the other seven remain blocked by design, which is the correct behaviour and better than a plausible guess.

## Constraints

- **Governance**: The five non-negotiables in PRD §0 win over any other inference when the spec is ambiguous — LLM never does arithmetic; HR never sees an unreviewed assessment; nothing leaves without a named lawyer's sign-off; the engine flags rather than decides; every agent recommends, only a lawyer decides
- **Build order**: PRD §0 fixes it and it is binding — schemas, then engine, then rulepacks, then web, then agent. Nothing compiles before schemas; the LLM boundary is built last and everything must work without it
- **Package boundaries**: Must be preserved even if other structural choices change (PRD §15). `packages/engine` is pure — no I/O, no network, no LLM, no clock reads outside an injected `now`
- **Money**: Integer minor units end-to-end in a branded `Minor` type. No floats anywhere in the money path. `applyCap` rounds down
- **Currency**: Not a free choice. Each jurisdiction has exactly one designated currency (`JURISDICTION_CURRENCY`); a matter's currency must equal its jurisdiction's, blocked both at intake and as an engine precondition
- **Personal data**: The system must be *incapable* of holding requestor personal data. No upload endpoint, no requestor name field, short warned free-text fields, `evidenceRef` is a pointer and never a document
- **Language**: Engine output may never use "compliant", "legal", "lawful", "approved" or "safe". It describes what a rule says; it does not pronounce on legality
- **Accessibility**: WCAG 2.1 AA. No verdict conveyed by colour alone
- **Performance**: Engine assessment of 50 lines under 100ms; review screen interactive under 1.5s
- **Prototype framing**: Local or demo host, seeded users, stubbed identity — but real architecture underneath, so a pilot deployment is a step rather than a rewrite

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fee recovery stays the primary path; zero-fee is a first-class documented outcome | PRD §17 q.3 asked whether the honest answer is "we never charge". It is not — the company does charge. But documenting the decision either way carries real value, so the zero-fee path is built properly rather than treated as an edge case | — Pending |
| v1 is a working prototype, not an internal deployment | Prove the flow to Legal and HR and pressure-test the packs before committing to infrastructure and DPO sign-off | — Pending |
| Identity stubbed, authorisation real | "HR never sees an unreviewed assessment" is a PRD §0 non-negotiable and cannot be satisfied by hiding UI. Role guards are server-side and tested against seeded users behind an interface; only the IdP is deferred | — Pending |
| Postgres in Docker, not SQLite | AC-34 requires the application database role to have no UPDATE or DELETE on the audit table. That is a grant, and SQLite cannot express it — prototyping on SQLite would leave an acceptance criterion tested only in principle | — Pending |
| Product owner authors the HK and SG packs | Resolves PRD §17 q.1 for the two reference jurisdictions, so both can reach ACTIVE during the build. The other seven stay DRAFT, which is the intended day-one behaviour | — Pending |
| HK flat fee supported as itemise-then-choose | PRD §17 q.2. The HK guidance permits a flat fee where it stays below direct cost — and direct cost is only knowable by itemising. So the engine computes both figures and the lawyer chooses, with the flat fee blocked where it exceeds itemised cost. Rejected: flat-fee-only intake (loses the comparison that makes it defensible) and flat-fee-as-ceiling (already expressible as `aggregateCap`, and can only reduce a fee, never set one) | — Pending |
| Flat fee is the first RulePack schema change — record the outcome | PRD §16 Phase 2 predicted that needing an engine change would mean the schema was wrong, "and that is worth knowing early". This is that moment, arrived at deliberately. Worth recording whether the change was clean or invasive | — Pending |
| Internal record as PDF; requestor notice as text | The internal record is the archival artifact and needs to survive as a document. The notice is a business letter HR pastes into their own mail client — §10.4 already specifies a copy-to-clipboard block | — Pending |
| LLM Job 1 only this milestone | Category suggestion has the tightest schema and cannot touch a verdict or an amount (AC-27). Jobs 2 and 3 run on templates — which is the same code path as AC-28's LLM-down degradation, so that path gets exercised continuously rather than only in a test | — Pending |
| Horizontal layers, with a thin walking skeleton in Phase 1 | PRD §0 makes the build order binding, so a vertical slice would have to violate it to deliver an end-to-end capability early. The walking skeleton — Postgres with the migrator/runtime split, Prisma, one guarded route per role area, one audit event round-tripped — proves the layers connect without bringing engine logic forward. Explicitly throwaway-tolerant | — Pending |
| Aggregate cap residue: round each line down, leave the remainder unallocated | §8.1 step 5 says "pro-rata across allowed lines" and pro-rata across integers leaves a remainder the PRD never allocates. Rounding down matches `applyCap` (AC-07c) and R8's acceptance of under-claim as the cheaper error. Rejected: largest-remainder and by-sequence allocation, both of which hit the cap exactly but introduce an ordering rule a lawyer would have to defend | — Pending |
| Rule pack content frozen at ACTIVE | AC-40 stops a new version from altering existing assessments but leaves an in-place edit of an already-referenced version open — which would retroactively rewrite what a lawyer is recorded as having reviewed. Freezing at activation is simpler to state and enforce than freezing once referenced, and needs no runtime referenced-by check | — Pending |
| Reviewer queue and HR matter list added to v1 | Research found the PRD specifies the single-matter review screen but never how a lawyer learns a matter is waiting. Without them the prototype has no navigation — you would reach the review screen by pasting an ID. Bounded by NS-5: no SLA colouring, no escalation. Matter timeline and review draft persistence deferred to v1.x | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? Move to Out of Scope with reason
2. Requirements validated? Move to Validated with phase reference
3. New requirements emerged? Add to Active
4. Decisions to log? Add to Key Decisions
5. "What This Is" still accurate? Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-13 after initialization*
