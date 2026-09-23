# DSAR Fee Assessment Agent

A tool for deciding — defensibly, consistently, and in minutes rather than hours — what fee an employer may lawfully charge a former employee who has made a data subject access request.

> **Status: full workflow built, demo-ready.** `packages/schemas`, `packages/engine`, `packages/rulepacks`, and all four `apps/web` screens — HR intake, legal review, sign-off, and HR/internal outputs, including every §10.7 edge state — are built and tested end to end (Phases 1–7). It runs against an in-memory store: the durable Postgres layer and its two-role audit-immutability boundary (Phase 3.2) and the LLM boundary (Phase 8) are the two pieces still outstanding. See [Running the demo](#running-the-demo) to start it, and [Current state](#current-state) for the full picture.

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

## Running the demo

Phases 1–7 built the real HR intake → legal review → sign-off → outputs pipeline — every
screen and edge state in PRD §10 — against `packages/engine` and the real, committed rule
packs, with no persistence layer behind it yet. This is the actual product, not a
throwaway slice; the one piece it still needs before a pilot is the durable Postgres layer
(see [Current state](#current-state) for what that still needs).

**Prerequisites:** Node satisfying this repository's `engines.node` field (`>=20.9.0`), and
the exact package manager pinned in `package.json`'s `packageManager` field — **pnpm
11.27.0, not the 12.x line**, which crashes with `SIGILL` on at least one build machine this
project has run on (see `.claude/CLAUDE.md`'s Key Decisions).

```bash
pnpm install
pnpm dev
```

The app serves on **http://localhost:3000**.

**Not required, explicitly:**
- No database — matters and assessments live in an in-memory store for the life of the
  process (Phase 3.2 swaps in Postgres behind the same repository interface; no
  application code changes when it lands).
- No Docker — nothing runs in a container yet; `docker-compose.yml` provisions the
  Postgres service Phase 3.2 will use, not this build.
- No network — the dev server disables Next's telemetry ping (`apps/web/scripts/dev.mjs`)
  and no font or asset is fetched remotely.
- No environment file — no `.env` of any kind is read to start this build.

**What this build honestly is not, yet:**
- **No persistent data.** Everything typed into it is lost on restart or on any code
  change during `pnpm dev` — there is a permanent on-screen marker saying so.
- **The rule packs it computes against are drafts**, and the status strip on every screen
  says so — both `SG-PDPA` and `HK-PDPO` are `status: "DRAFT"`, pending full 21-category
  authoring and a named lawyer's sign-off. The engine computes against an in-memory copy
  coerced to `ACTIVE` for this build only; the committed pack files themselves are never
  edited.
- **Identity is stubbed.** There is no real login — a cookie-based role switcher stands in
  for HR/Legal/DPO identity, and the demo says so on every screen it switches on.

The audit backbone, sign-off gate, internal-record PDF, HR/requestor outputs, and every
§10.7 edge state (stale pack, no pack, currency mismatch, zero-fee outcome, and more) are
built and tested (Phases 4–7) — the three bullets above are the complete list of what is
genuinely still missing before a pilot.

**One figure that looks wrong and is not:** the review screen's "resting on unverified
rules" figure equals the *entire* supported baseline (SGD 266.40 for the reference
fixture), not the smaller figure PRD §14's own worked example publishes. This is the
correct output of the real, committed `SG-PDPA/2026.09.1.json` pack as authored today —
every one of its relevant category rules is still marked `NEEDS_VERIFICATION`, not a defect
in the engine or this demo. PRD §14's worked example assumed two of six rules were already
verified; none are yet. The bulk-accept control on the review screen reads `(0)` for the
same reason — see `docs/DEMO-WALKTHROUGH.md` for a full run of the numbers.

See `docs/DEMO-WALKTHROUGH.md` for a presenter's script: the six reference cost lines to
type in, the path through every screen, and the exact figures to expect at each stage.

## Current state

```
docs/PRD-dsar-fee-agent.md                   the spec — source of truth, 1,005 lines
docs/dsar-fee-agent-mockup.html              Annex A: HR intake + legal review screens
docs/dsar-fee-agent-mockup-simplified.html   interactive walkthrough of the review flow
Prompt for new PRD Sep 7.docx                the brief that produced the PRD
CLAUDE.md                                    working instructions for coding agents
```

The PRD is written to be built from directly, in a binding order:

1. `packages/schemas` — types and zod validators. Nothing else compiles until these exist. **Built.**
2. `packages/engine` — the deterministic evaluator, with its golden-file tests alongside. **Built.**
3. `packages/rulepacks` — the nine packs, plus loader and validator. **Built** — Hong Kong and Singapore are
   fully worked reference packs (both still `status: "DRAFT"`, pending full authoring and a lawyer's sign-off
   before either reaches `ACTIVE`); the other seven are correct-posture stubs, unusable until counsel authors
   them.
4. `apps/web` — the four production screens, against the Annex A mockup. **Built** (Phases 4–7): HR intake,
   legal review, sign-off, the internal-record PDF, HR/requestor outputs, and every §10.7 edge state, all
   running against an in-memory store — see [Running the demo](#running-the-demo). Phase 3.2 replaces the
   store with Postgres behind the same repository interface; no screen or route changes when it does.
5. `packages/agent` — the LLM boundary. **Last, not yet built.** Everything must work with the model stubbed
   out.

Stack actually in use: TypeScript, Postgres (Phase 3.2, not yet applied), Prisma, Next.js 16, Tailwind v4,
Vitest, pnpm workspaces. `apps/web`'s visual design now matches the mockup's actual styling (cards, warm
callouts, serif headings, maroon seal accent), not just its structure — the Tailwind pipeline that renders it
had silently never compiled from Phase 1 until it was fixed on 2026-09-22 (see `HANDOFF.md`). Playwright is
installed but not yet configured against `apps/web`. Deviation from any of this is fine; the package
boundaries are not.

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
