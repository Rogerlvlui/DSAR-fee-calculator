# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication preferences

- Be concise. No preamble, no restating the task, no trailing "what I did" summary unless asked — token budget matters to Roger.
- Don't ask clarifying/Socratic questions by default. Make the reasonable call yourself (naming, structure, non-legal implementation details) and note the decision briefly inline; keep moving.
- The one exception: stop and ask when a question is a **critical legal or privacy-law point** — e.g. it risks the Non-negotiables or the NS-1..NS-10 out-of-scope list below, a rule-pack legal judgment call (citation, category treatment, jurisdiction constraint), or anything where an invented answer would misstate the law. Flag those explicitly as legal/privacy questions rather than folding them into ordinary implementation questions.

## Current state of this repository

There is no application code yet. The repository currently contains only the spec:

- [`docs/PRD-dsar-fee-agent.md`](docs/PRD-dsar-fee-agent.md) — the full product requirements document (1,005 lines). This is the source of truth for everything about the product: data model, rule-pack schema, engine algorithm, LLM boundary, UI spec, acceptance criteria, and test strategy.
- [`docs/dsar-fee-agent-mockup.html`](docs/dsar-fee-agent-mockup.html) — a static HTML mockup of the HR-intake and legal-review screens. This is the one the PRD's Annex A names, and the one to build against: match its structure and hierarchy, not necessarily its exact styling.
- [`docs/dsar-fee-agent-mockup-simplified.html`](docs/dsar-fee-agent-mockup-simplified.html) — added 11 Sep 2026, not referenced by the PRD. An interactive walkthrough of the legal-review flow (two disposition questions, then a running fee tally, then the sign-off gate). Useful as a feel for the review interaction; secondary to Annex A where the two disagree. Note it is a self-extracting bundle — 830 KB of base64-gzipped assets behind an inline unpacker — so it renders in a browser but cannot be read or diffed as source.
- [`README.md`](README.md) — human-facing orientation: the problem, the governance stance, jurisdiction status, and where to start reading. Derived from the PRD; if the two ever disagree, the PRD wins and the README needs fixing.
- `Prompt for new PRD Sep 7.docx` — the brief that produced the PRD. Not a spec; do not build from it.
- Roger's working notes (`To do*.docx`) are gitignored by design — they exist on his disk but never in the repository, and they are not a spec.

No `package.json`, build tooling, or source tree exists yet. **Read the PRD in full before writing any code** — §0 of the PRD ("How to build from this document") gives the required build order, and it is binding:

1. `packages/schemas` — types and zod validators (PRD §6, §7). Nothing else compiles until these exist.
2. `packages/engine` — the deterministic fee evaluator (PRD §8.1). Pure functions, no I/O, no network, no LLM. Write the golden-file tests (§14) alongside it.
3. `packages/rulepacks` — jurisdiction rule packs (§7.4) plus loader and validator.
4. `apps/web` — the four screens (§10), matched against the Annex A mockup.
5. `packages/agent` — the LLM boundary (§8.2). **Build this last.** Everything must work with the LLM stubbed out.

Once code exists, update this file with the real build/lint/test commands (the PRD's suggested stack is TypeScript, Postgres, Prisma, Next.js, Tailwind, Playwright, and Vitest — §15 — but treat that as a starting point to confirm, not a settled fact until it's actually scaffolded).

## Non-negotiables (PRD §0)

When the PRD is ambiguous or silent, these five rules win over any other inference, in priority order:

1. **The LLM never does arithmetic.** All money is computed by `packages/engine`.
2. **HR never sees an unreviewed assessment.** Enforced server-side by role, not by hiding UI.
3. **No output leaves the system without a named lawyer's sign-off**, recorded in the audit log.
4. **When in doubt, the engine flags rather than decides.** A flagged line contributes nothing to any total until a lawyer dispositions it.
5. **Every agent in the pipeline recommends; only a named lawyer decides** (PRD §3.1). As more agents are added around the fee engine (identity verification, correspondence drafting, post-hoc audit — PRD §16), none of them may act autonomously or notify HR/the requestor directly.

If you cannot satisfy a requirement in the PRD, stop and raise it rather than inventing a legal rule.

## Explicitly out of scope — do not build (PRD §4.2)

The PRD numbers these (NS-1..NS-10) specifically so a coding agent doesn't "helpfully" implement them. The ones most likely to be tempting:

- **NS-3**: no outbound email of any kind. The tool produces a draft notice only; a human sends it.
- **NS-4**: the system must never retrieve, store, or process the requestor's actual personal data — this is an architectural boundary (§12.1), not a phasing decision.
- **NS-7**: no automatic sign-off, "auto-approve if confidence high", or bulk approval of flagged lines.
- **NS-8**: the agent never does legal research at runtime (no web search, no reading statutes, no first-principles reasoning). It only applies the versioned rule pack.

## Architecture (as specified — not yet built)

**Package boundaries** (PRD §15), which must be preserved even if other structural choices change:

```
/apps/web                   Next.js (App Router) — role-scoped routes /hr/*, /legal/*, /admin/*
/packages/schemas           zod schemas, shared types, generated JSON Schema
/packages/engine            pure evaluator — no I/O, no LLM, no network
/packages/rulepacks         versioned JSON rule packs (one dir per jurisdiction) + loader + validator
/packages/agent             LLM boundary only — versioned prompts, zod-validated output
/packages/documents         PDF generation (internal record + requestor-facing notice)
/packages/audit             append-only event writer
/prisma/schema.prisma       Postgres
/tests/{engine,packs,auth,e2e}
/evals                      LLM evals — gate deploys of packages/agent only
```

**Why the engine/agent split is the core architectural idea.** The engine (`packages/engine`) is a pure, deterministic function — `assess(matter, lines, pack, now) → Assessment` — that applies a lawyer-authored, versioned "rule pack" (JSON data, not prompt text) to compute a fee. The LLM (`packages/agent`) never touches money: it only suggests a category for unclassified lines, drafts plain-language rationale text (which is rejected and replaced with a template if it introduces any number or citation not already in the engine's output), and summarizes clarification queries. This split exists so a lawyer can defend "the engine applied rule X, version Y, authored by Z" rather than "the model assessed the claim" (PRD §8.3).

**State machine, not status fields.** A `Matter` moves through `DRAFT → COMPUTING → LEGAL_REVIEW → SIGNED_OFF → CLOSED` (with `INFO_REQUEST` and `SUPERSEDED` branches) as a guarded state machine (PRD §5). `SIGNED_OFF` records are immutable — a correction is a new assessment that supersedes the old one, never an edit. The mirror-image rule is easy to get wrong: recomputing against a newer pack *before* sign-off (`LEGAL_REVIEW → COMPUTING`) mutates the existing `Assessment` in place — same `id`, dispositions cleared — rather than creating a new row. `SUPERSEDED` exists only for corrections after sign-off (PRD §5, AC-33).

**Rule packs are versioned data, not code.** Each jurisdiction (SG, HK, AU, NZ, JP, KR, CN, IN, VN) has its own JSON rule pack under `packages/rulepacks`, with a lifecycle (draft → active → stale) and a `reviewDueOn` date that hard-blocks new matters once passed. Only HK and SG are fully worked in v1; the other seven are stubs (PRD §7.4).

**Money is integer minor units end-to-end**, using a branded `Minor` type — no floats anywhere in the money path. Currency is not free choice: each jurisdiction has exactly one designated currency (`JURISDICTION_CURRENCY`, PRD §6.0), a matter's `currency` must equal its jurisdiction's, and the mismatch is blocked both at intake and as an engine precondition (AC-42).

## Where to look for detail

Rather than duplicating the PRD here, go to the relevant section directly:

- Data model / types: PRD §6
- Rule pack schema and lifecycle: PRD §7
- Engine algorithm (step-by-step): PRD §8.1
- LLM boundary constraints: PRD §8.2
- UI/UX spec per screen: PRD §10
- Acceptance criteria (AC-01..): PRD §13
- Test strategy, including the canonical reference fixture: PRD §14
