# Feature Research — DSAR Fee Assessment Agent

**Domain:** Internal legal workflow / DSAR fee-assessment tool (mandatory human sign-off, deterministic engine)
**Researched:** 2026-09-13
**Confidence:** MEDIUM-HIGH — gaps and anti-features are reasoned directly from the PRD's own non-negotiables (HIGH confidence, primary source); comparisons to commercial DSAR platforms (OneTrust, Securiti) and general human-in-the-loop research are LOW-MEDIUM confidence (marketing-page level, general HITL literature, not vendor deep-dives)

**Scope note:** This document intentionally does not restate anything already specified in the PRD — the 21-code taxonomy, the four screens, the state machine, the 42 ACs, the j/k/a/r/s shortcuts, autosave-on-intake, DPO audit export, or the version-diff/activation-gate admin screen. It covers only what comparable products do that the PRD is silent on.

## Feature Landscape

### Table Stakes (PRD Is Missing)

These are gaps a lawyer or HR user of any comparable internal review tool would notice within a week of real use. None requires new architectural surface beyond what §6 already models — each is a read/UX layer over existing `Matter` and `AuditEvent` data.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Reviewer work queue** — a `/legal/queue` landing page listing matters in `LEGAL_REVIEW`/`INFO_REQUEST` for the lawyer's jurisdiction, sortable by advisory deadline and age | The PRD specifies the single-matter review screen (§10.3) but never says how a lawyer finds out a matter is waiting, or which of several waiting matters to open first. Without this, "Legal has been notified" (§10.2) has no landing surface. | LOW | Pure read query over existing `Matter.status`/`jurisdictionCode`/`requestReceivedOn` — no schema change. Sort by the same advisory deadline calculation already used in §10.3's left rail. Must keep the "advisory only, not a system of record" framing from NS-5/AC-15 — a sortable queue is a convenience, not a deadline-tracking feature; do not add SLA colouring, escalation rules, or anything NS-5 would recognise as case management. |
| **HR inbox equivalent** — a `/hr/matters` list showing the HR preparer's own matters and their status (`DRAFT`, `INFO_REQUEST` awaiting their reply, `SIGNED_OFF`) | This *is* the in-app substitute for the notification the PRD implies but never specifies. HR needs to know a matter came back as `INFO_REQUEST` without checking email — and NS-3 already bars the tool from emailing anyone, so the in-app list is the only compliant channel. | LOW | Same query pattern as the reviewer queue, filtered to `createdBy`. No new "notification" subsystem, no unread-state table — the filtered list itself is the notification. Building a separate notification/inbox data model would be over-engineering; don't. |
| **Matter history / "why was this decided" timeline** — a plain-language rendering of the `AuditEvent` stream for a single matter, readable by DPO and, post-sign-off, referenced in disputes | §6.5 already captures every transition, disposition and sign-off as structured audit events (AC-34) — but nothing in §10 renders them as a human-readable story. Comparable legal-workflow tools treat a case timeline as baseline, and this product's entire value proposition is defensibility, which a raw JSON audit table does not deliver to a non-technical reader. | LOW | The data already exists; this is a rendering layer, not new capture. Reuse for both the DPO's ad-hoc review and (redacted of `lawyerReason`, which is privileged per §12.1) any future dispute response. Do not expose `lawyerReason` text outside `/legal/*` — same boundary the PRD already draws for the internal record. |
| **In-progress review draft persistence (client-side)** — preserve a lawyer's half-typed reason text if they navigate away or the tab closes, mid-review | §10.2 already autosaves HR's *intake* every 10s; the review screen's reason fields (§10.3, mandatory ≥10 chars per AC-23) have no equivalent, and losing typed legal reasoning is a real annoyance in any form-heavy review tool. | LOW | Keep this **client-side only** (e.g. `localStorage` keyed by matter+line), not a server-persisted draft. A server-side draft would mean partially-formed legal reasoning enters the audit-adjacent data model before a disposition is actually committed — avoid that; it blurs AC-34's append-only, decision-only audit boundary. |
| **Search/filter across matters** (by reference, jurisdiction, status, date range) for `LEGAL_REVIEWER` and `DPO_ADMIN` | Once matter volume exceeds a handful, "scroll the list" stops working. Every comparable case-management or approval tool treats this as baseline. | LOW | Read-only filter over existing `Matter` fields; add an index on `reference`/`jurisdictionCode`/`status` if volume warrants. No schema change. |
| **Keyboard access to the queue and admin screens**, not just the review card | §10.1 specifies `j`/`k`/`a`/`r`/`s`/`?` for the review *card* only. Once a queue exists (above), a lawyer who never leaves the keyboard needs arrow/Enter to move into it, or the existing shortcut set becomes an island. | LOW | Extend the existing keyboard-help overlay; no new interaction model, just coverage. Bundle with WCAG 2.1 AA work already required by the PRD's constraints. |

### Differentiators (Worth Considering)

The PRD's core differentiator — per-line provenance forcing engagement rather than a headline verdict — is already the product's thesis and doesn't need restating. The two below extend that thesis rather than compete with it.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Private self-monitoring view for the reviewing lawyer** — their own change rate (M2) and median review duration, visible only to themselves, never compared to peers | Turns the automation-bias instrumentation the PRD already builds (§6.5's elapsed-time capture, §9.6's monthly report) into something the *lawyer* can use for their own practice — "am I rubber-stamping?" — without becoming the throughput-pressure tool that produces exactly that rubber-stamping. This is the one place a metrics UI is safe in this product's governance model. | LOW | Filtered version of the §9.6 query, scoped to `actor = current user`. Explicitly **not** a leaderboard (see anti-features) — no ranking, no peer comparison, no visibility to anyone but the lawyer and, in aggregate, the DPO/product owner as §9.6 already allows. |
| **Metadata-only "start similar matter"** — pre-fills jurisdiction, legal entity, controller type and requestor class from a prior matter, but never expense lines or amounts | Saves HR the five fields that are genuinely reusable (same entity, same jurisdiction) without touching the one thing that must never be reused: what this specific DSAR actually cost. Cuts real friction without reintroducing the copy-paste-claim risk described under anti-features below. | LOW | Straightforward form-prefill from a selected prior `Matter`; explicitly excludes `ExpenseLine` copying at the code level, not just by UI convention, so a future feature request can't quietly widen it. |

### Anti-Features (Deliberately Do Not Build)

The PRD already bars auto-approval, outbound email, requestor personal data, and runtime legal research (NS-3/4/7/8). These are the adjacent ones it does **not** already name — each is something a comparable DSAR or legal-workflow product genuinely ships, and each would quietly undermine this product's specific governance stance if it arrived here as an "obvious" enhancement.

| Feature | Why It Looks Appealing | Why It's Wrong Here | Alternative |
|---------|------------------------|----------------------|-------------|
| **Numeric confidence score displayed to the lawyer** (e.g. "87% confident" badge on a FLAG line or an LLM suggestion) | Feels informative; many AI-assisted review tools show one | The engine is deterministic — there is no statistical confidence to report, only a rule that fired or didn't. For the one place a confidence concept legitimately exists (LLM Job 1's `HIGH`/`MEDIUM`/`LOW`, §8.2), rendering it as a percentage manufactures false precision. General HITL research is consistent on this: confidence scores are poorly calibrated and don't correlate with correctness, and reviewers who see a high-confidence number anchor on it — precisely the vigilance decrement §9.4's design already works to prevent. | Keep the three-value categorical label, worded as advisory text ("the assistant suggests…"), exactly as §8.2 already specifies. Never round it into a number or a progress bar. |
| **"Similar past matters" / precedent-matching suggestions** shown during review | Genuinely useful in most case-management tools — "here's how this was handled before" | Two independent problems: (1) it is one short step from NS-8's barred "legal research at runtime" — a system that surfaces "prior outcome for this fact pattern" is doing comparative legal reasoning even if it never says so out loud; (2) it directly undercuts the §9.5 attestation ("I have applied my own judgement... I do not rely on the tool's calculation") by anchoring the lawyer on an outcome that isn't the versioned pack speaking. | If consistency across matters is the real goal, that's what §9.6's monthly QA report (flag rate, change rate by category) is for — aggregate, DPO-facing, not surfaced mid-review as a suggestion. |
| **Reviewer leaderboards or throughput metrics visible to reviewers** (assessments-per-day, fastest sign-off, etc.) | Standard in many ops/support tooling to drive throughput | This is the single fastest way to manufacture the exact failure mode M2 exists to catch. The PRD is explicit that a *low* change rate is a failure signal, not a success one (§2) — any visible speed or volume metric pushes lawyers toward the rubber-stamping behaviour §9.4's total-hidden-until-dispositioned and mandatory-reason rules were built to prevent. | The private self-monitoring view above (own numbers only, no ranking) captures the legitimate half of this idea. Aggregate metrics stay in the DPO/product-owner-only §9.6 report. |
| **Confidence-gated review routing** — auto-skip or fast-path lines below some computed "risk score", even without calling it bulk-approval | Sounds like a UX optimisation, not a governance change, so it's the version of NS-7 most likely to sneak in through a feature request that never uses the words "auto-approve" | It's NS-7 wearing different clothes: it hides a decision from the mandatory line-by-line disposition (§9.4) behind a scoring model, and the PRD's bulk-accept carve-out is already drawn precisely (`ALLOW` + `VERIFIED` only, AC-26) — a dynamic or ML-based skip rule is exactly the "confidence-gated approval" NS-7 names. | Do not widen AC-26's carve-out under any framing. If review time is the problem, the fix is a better queue and faster UI (table stakes above), not fewer lines reviewed. |
| **Open-ended AI chat over the matter** ("ask the assistant why this was flagged", general Q&A) | Feels like a natural extension once an LLM is in the product at all | Directly conflicts with the narrow, schema-constrained, three-job LLM boundary in §8.2 and with NS-8's "no reasoning from first principles" — a chat interface implies open-ended reasoning capability the architecture is specifically built not to have. It also risks an unconstrained prompt pulling in `lawyerReason` (privileged, §12.1) or matter context that was never meant to leave `/legal/*`. | Put more of the "why" into the rule pack itself — richer `basis` text, more complete `openQuestions` — rather than adding a conversational surface. The pack, not a chatbot, is the source of explanation. |
| **Auto-population of expense lines from a prior matter or a saved template** | Obvious time-saver for repeat requests against the same entity | Claimed amounts must reflect what was *actually* incurred for *this* DSAR (§6.2's `claimedAmount = quantity * unitRate`, recomputed and checked at load, AC-08). Pre-filling line items normalises copy-paste claiming — exactly the "loaded rate" / non-actual-cost risk the SG pack's own `openQuestions` flags (§7.6) — and quietly erodes the intake friction that's doing real work: forcing HR to itemise what genuinely happened this time. | The metadata-only clone above (jurisdiction/entity/controller type, never line items) captures the legitimate convenience without the claiming risk. |
| **Matter cloning that duplicates expense lines verbatim** | Same appeal as auto-population, framed as a "duplicate matter" button | Same problem as above, in a different UI wrapper — worth naming separately because "clone this matter" is a much more common feature request than "prefill from a template," and easy to approve without noticing it copies claimed costs, not just structure. | Metadata-only clone (differentiators, above). |

## Feature Dependencies

```
Reviewer Queue ──uses──> existing Matter.status / jurisdictionCode / requestReceivedOn (no new schema)
HR Inbox ──uses──> same query pattern as Reviewer Queue, filtered by createdBy

Matter History Timeline ──uses──> existing AuditEvent stream (§6.5, no new capture)
Matter History Timeline ──must exclude──> AssessmentLine.lawyerReason outside /legal/* (privilege boundary, §12.1)

Private Self-Monitoring View ──uses──> same §9.6 query infrastructure, scoped to actor=self
Private Self-Monitoring View ──conflicts──> Reviewer Leaderboard (anti-feature) — same underlying data, opposite visibility rule

Metadata-only "start similar matter" ──must exclude──> ExpenseLine copying (else becomes the Auto-population anti-feature)

In-progress Review Draft Persistence ──must stay client-side──> else contaminates AuditEvent append-only boundary (AC-34)
```

### Dependency Notes

- **Reviewer Queue and HR Inbox share one pattern:** a filtered, role-scoped list over `Matter`. Building them as the same underlying component (different filter, different route) avoids two parallel implementations of "list my matters."
- **Matter History Timeline is nearly free:** because §6.5 already captures everything needed, this is a rendering task, not a data-modelling one — but the privilege boundary around `lawyerReason` must be enforced in the same place it already is for the internal record, not re-derived.
- **Self-Monitoring View and Leaderboard are the same query with opposite access control.** This is worth stating explicitly in any future spec so an implementer doesn't build the query once and then get asked to "just add a team view" — that request is the anti-feature, not a natural extension.
- **The two anti-features around reuse (auto-population, matter cloning) both fail for the same underlying reason** (claimed cost must be this-matter-actual, not templated) — a single guard at the `ExpenseLine` creation boundary ("lines are never created by copying another matter's lines, only by a human typing quantity × rate for this matter") closes both at once.

## MVP Definition

Given the milestone is greenfield and the PRD already fixes the v1 feature set (§4.1/§4.2), the additions above are not MVP-blocking — they are quality-of-life gaps that will surface in the first weeks of real HR/Legal use. Recommended sequencing if adopted:

### Launch With (v1)
- Nothing from this document is required to ship the PRD's own scope. The PRD's Active requirements stand as the MVP.

### Add After Validation (v1.x)
- [ ] Reviewer work queue — becomes necessary the moment more than one matter is in `LEGAL_REVIEW` at once, which will be immediately
- [ ] HR inbox equivalent — same trigger, HR side
- [ ] Matter history timeline — trigger: first time a signed-off assessment is questioned and someone has to reconstruct "why," which §14's own test strategy implies will happen early
- [ ] In-progress review draft persistence — trigger: first reported case of lost typed reasoning

### Future Consideration (v2+)
- [ ] Search/filter across matters — defer until matter volume makes list-scrolling actually painful
- [ ] Private self-monitoring view — defer until §9.6's monthly report has run long enough to have numbers worth surfacing per-lawyer
- [ ] Metadata-only "start similar matter" — nice-to-have, not urgent; low risk if deferred indefinitely

## Sources

- `docs/PRD-dsar-fee-agent.md` (primary source, HIGH confidence) — all gap analysis and anti-feature reasoning is derived from the PRD's own §0 non-negotiables, §4.2 NS-list, §6/§7 data model, §9.4 anti-automation-bias requirements, and §10 UI spec
- [OneTrust DSAR Portal announcement](https://www.onetrust.com/news/onetrust-launches-first-to-market-data-subject-access-request-dsar-portal-to-simplify-gdpr-compliance/) — LOW confidence, marketing page; used only to confirm that commercial DSAR platforms compete on data-discovery/identity-verification breadth, which this product deliberately excludes (NS-1, NS-4) rather than to source specific UI patterns
- [Securiti DSAR approach](https://technologymatch.com/blog/onetrust-vs-trustarc-vs-securiti-comparing-data-privacy-management-platforms) — LOW confidence, same caveat
- General human-in-the-loop / automation-bias literature (Zapier, Redis, Galileo, Databricks blog posts, 2026) — MEDIUM confidence, consistent across sources on two points used directly above: reviewer vigilance decrement under high-approval-rate conditions, and poor correlation between displayed confidence scores and actual correctness

---
*Feature research for: DSAR fee assessment internal legal tool*
*Researched: 2026-09-13*
