# DSAR Fee Assessment Agent

A tool for deciding — defensibly, consistently, and in minutes rather than hours — what fee an employer may lawfully charge a former employee who has made a data subject access request.

> **Status: specification only.** There is no application code in this repository yet. What exists is a complete, build-ready PRD and a UI mockup. See [Current state](#current-state).

## The problem

When an ex-employee makes a DSAR, HR incurs real costs collating the data: staff time, photocopying, secure delivery, and third-party charges — usually the payroll vendor. Several Asian privacy regimes let the employer recover some of those costs. Others permit nothing at all. The regimes differ on *whether* a fee may be charged, *which* items are recoverable, *what standard* applies ("reasonable", "not excessive", "actual cost"), and *when* the fee must be notified.

Today a lawyer redoes that analysis every time — 45 to 120 minutes of the same statutory reasoning applied to a new list of line items, producing no reusable work product and no consistency between matters or between lawyers. The judgement is genuinely legal, so it cannot simply be handed to HR.

The risk is also lopsided. Under-claiming costs the company a few hundred dollars. Over-claiming invites a regulator complaint, is evidence of obstruction if the DSAR precedes employment litigation, and in some regimes is itself a breach. **The product is deliberately biased towards under-claiming and towards flagging.**

## How it works

HR enters claimed expenses. A deterministic engine applies a versioned, lawyer-authored rule pack for the jurisdiction. A named lawyer reviews every line and signs off — and only then does HR see a figure.

```
DRAFT ──submit──▶ COMPUTING ──▶ LEGAL_REVIEW ──sign off──▶ SIGNED_OFF ──▶ CLOSED
  ▲                                  │                       (immutable)
  └──────── INFO_REQUEST ◀───────────┘
```

Two design decisions carry most of the weight:

**The engine computes; the model never touches money.** `packages/engine` is a pure function — `assess(matter, lines, pack, now) → Assessment` — applying a rule pack that is versioned JSON data authored by a lawyer, not prompt text. The LLM's entire job is to suggest a category for an unclassified line, draft plain-language rationale, and summarise clarification queries; its output is rejected and replaced with a template if it introduces any number or citation the engine did not produce. This exists so that counsel can defend *"the engine applied rule `HK-PDPO.STAFF_TIME_REDACT_EXEMPT`, version 2026.09.1, authored by X on date Y"* rather than *"the model assessed the claim"*.

**Legal owns the pipeline; HR only feeds it.** Every determination that reaches HR or the requestor is made by a named lawyer. The PRD's analogy is an Airbnb-style workflow rather than a Booking.com one: the traveller (HR) submits freely, but the host (Legal) always makes the final call before anything goes out — never an instant, discretion-free confirmation. This stance binds future agents too. As identity verification, correspondence drafting, and post-hoc audit are added around this core, each hands its output to Legal for review; none acts autonomously or notifies HR or the requestor directly.

Where a regime confers no express fee right, or prohibits charging, the engine does not produce a figure at all — every line is flagged or disallowed and the baseline is zero. A lawyer may still allow a line, but only with a written reason on the record.

## What this deliberately does not do

The PRD numbers these NS-1 to NS-10 so they can be cited in review. The ones most often assumed to be present:

- **No outbound email, ever.** The tool drafts a fee notice; a human sends it from their own mail client.
- **No requestor personal data.** The system never retrieves, stores, or processes it. This is an architectural boundary, not a phase-one simplification — identity verification is a boolean attestation entered by HR, nothing more.
- **No auto-approval.** No "sign off if confidence is high", no bulk-approving flagged lines.
- **No legal research at runtime.** The agent does not search the web, read statutes, or reason from first principles. It applies the rule pack. Full stop.
- **No invoicing, payment, or case management.** Deadlines are displayed as advisory only.

## Jurisdictions

Nine rule packs in v1, one per jurisdiction, each with its own lifecycle and a review-due date that hard-blocks new matters once passed.

| | Jurisdiction | v1 state |
|---|---|---|
| Worked | Hong Kong (PDPO), Singapore (PDPA) | Reference packs, fully specified |
| Stub | Australia, New Zealand, Japan, South Korea, China, India, Vietnam | Correct posture and skeleton; every category flagged until local counsel authors it |
| Future | EU/EEA (GDPR) | Out of scope (NS-10); recorded only so the schema is not later found to be EU-hostile |

A stub pack is unusable until counsel authors it. That is the intended behaviour, and better than a plausible guess.

> **The repository ships drafts, not legal advice.** Every posture and category treatment in the PRD is a starting point for the authoring lawyer, not a determination. Nothing activates until named local counsel has confirmed or corrected it and is recorded in the pack — a pack cannot reach `ACTIVE` while its `authoredBy` and `reviewedBy` fields are empty.

## Current state

```
docs/PRD-dsar-fee-agent.md                   the spec — source of truth, 1,005 lines
docs/dsar-fee-agent-mockup.html              Annex A: HR intake + legal review screens
docs/dsar-fee-agent-mockup-simplified.html   interactive walkthrough of the review flow
Prompt for new PRD Sep 7.docx                the brief that produced the PRD
CLAUDE.md                                    working instructions for coding agents
```

No `package.json`, build tooling, or source tree exists yet, so there is nothing to install or run. The PRD is written to be built from directly, in a binding order:

1. `packages/schemas` — types and zod validators. Nothing else compiles until these exist.
2. `packages/engine` — the deterministic evaluator, with its golden-file tests alongside.
3. `packages/rulepacks` — the nine packs, plus loader and validator.
4. `apps/web` — the four screens, against the Annex A mockup.
5. `packages/agent` — the LLM boundary. **Last.** Everything must work with the model stubbed out.

Suggested stack: TypeScript, Postgres, Prisma, Next.js, Tailwind, Vitest, Playwright. Deviation is fine; the package boundaries are not.

## Reading the spec

The PRD is long because it is meant to be built from without a follow-up conversation. Useful entry points:

| Looking for | Section |
|---|---|
| Why this exists, and what success looks like | §1–§2 |
| Roles, and the governance stance | §3, §3.1 |
| What is out of scope, and why | §4.2 |
| Workflow and state machine | §5 |
| Data model | §6 |
| Rule pack schema, lifecycle, and the nine jurisdictions | §7 |
| Engine algorithm, step by step | §8.1 |
| Constraints on the LLM | §8.2 |
| Risk disclosure and literal warning copy | §9 |
| Screen-by-screen UI spec | §10 |
| Acceptance criteria (AC-01..AC-42) | §13 |
| Test strategy and the canonical fixture | §14 |

## The critical path

It is not the code. Nothing can be activated in any jurisdiction until a named lawyer has authored and reviewed that jurisdiction's pack — so **who authors each of the nine** is the first question to answer, and it is one of six open items recorded for the product owner in §17. The others worth knowing about before a build starts: whether a flat fee is preferable to itemisation in Hong Kong, whose cost rates feed the sanity ceilings, retention periods for signed-off records, whether charging a fee affects the response clock in any of the nine — and the honest one, whether the organisation would ever charge at all in practice. If the usual answer is zero, this tool's real value is *documenting the decision not to charge*, which is a different emphasis and a cheaper build.

## Contributing

If you are working on this with a coding agent, read [CLAUDE.md](CLAUDE.md) first — it carries the non-negotiables, the out-of-scope list, and the architectural boundaries in the form an agent needs them.

One rule governs the rest: **if you cannot satisfy a requirement in the PRD, stop and raise it rather than inventing a legal rule.**

---

Product owner: Roger Lui (Legal). PRD v0.1, 7 September 2026.
