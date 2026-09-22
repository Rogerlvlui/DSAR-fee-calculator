# Phase 4: Workflow and Audit Backbone - Research

**Researched:** 2026-09-19
**Domain:** Guarded state-machine execution + append-only audit logging, over an in-memory persistence backend that a later Postgres swap must be able to replace without touching a call site
**Confidence:** HIGH (this phase is almost entirely an internal architecture question over a codebase already read in full this session; no external library research was load-bearing)

## Summary

Phase 4 has two genuinely separable jobs. First, replace Phase 3.1's admitted stand-in (`apps/web/src/server/state.ts`, `assertTransition(from, to)` over an explicit edge table with no guard predicates) with a real guarded executor over PRD §5's full guard table, evaluated against the frozen `GuardInput` type. Second, author `packages/audit` — named in both `.claude/CLAUDE.md`'s architecture map and Phase 3.2's own `03.2-CONTEXT.md` as the integration point that phase's eventual Prisma-backed writer will fill in — as an interface plus in-memory implementation, following the exact repository pattern Phase 3.1 already established for `Matter`/`Assessment`. Neither job needs Docker, a real Postgres, or the LLM boundary; both are pure-function-and-in-memory-store work, which is why this phase can and should run now, ahead of Phase 3.2 in the numbering, exactly as `04-workflow-and-audit-backbone`'s own explicitly-out-of-scope note directs.

The guard logic belongs in a **new package, `packages/workflow`** — not folded into `apps/web/src/server/state.ts` in place, and not merged into `packages/audit`. It is pure (no I/O, no clock reads outside an injected `now`, no repository calls) in exactly the sense `packages/engine` already is, consumes only the frozen `GuardInput`, and should be protected by the identical dependency-cruiser purity pattern already proven against `packages/engine`. `packages/audit`, by contrast, is inherently I/O-shaped (it is a repository), so it takes the `MatterRepository`/`AssessmentRepository` shape instead: a plain interface plus a `memory/` implementation, with the same deep-copy discipline `apps/web/src/server/repositories/memory/*.ts` already uses.

The most consequential finding is a real spec/schema mismatch surfaced during Phase 3, not by this research: `AuditEvent.matterId` is a required, non-nullable field (`packages/schemas/src/audit-event.ts:53-56`, `prisma/schema.prisma:365-368`), but a `PACK_ACTIVATED`/`PACK_EDITED` event is about a `RulePackVersion`, which has no relationship to any `Matter`. Phase 3's `03-CONTEXT.md` already resolved this as **D-21**: pack-lifecycle events get a *separate* append-only stream keyed to `RulePackVersion`, not a widened `AuditEvent`. AUDIT-01's requirement text ("every state transition, line disposition, pack activation and sign-off emits an audit event") therefore spans two different tables/streams behind one architectural discipline, not one. Phase 4 should build both writer interfaces and prove the pack-lifecycle one with direct unit tests (there is no `/admin/rulepacks` screen yet to drive it from — that wiring is PACK-07, assigned to Phase 3.2).

**Primary recommendation:** Create `packages/workflow` (pure guard table + executor over `GuardInput`) and `packages/audit` (two writer interfaces — matter-scoped `AuditEventWriter` and pack-lifecycle `PackLifecycleEventWriter` — each with an in-memory implementation matching Phase 3.1's repository pattern). Delete `apps/web/src/server/state.ts` and rewire `apps/web/src/server/data/{matters,assessments}.ts` to call `packages/workflow`'s executor and `packages/audit`'s writer at every call site that currently calls `assertTransition` directly or mutates `.status`/`.lines`/`.signOff` — one call site at a time, running the full suite after each swap.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| STATE-02 | Every transition is evaluated by a guarded state machine implementing PRD §5's guard table, not by ad-hoc status writes | Architecture Patterns Pattern 1 (`packages/workflow`'s declared `TRANSITIONS` array + `evaluateTransition`); Pattern 2 (structural enforcement of no-direct-write); Validation Architecture's Wave 0 gap for one test per guard-table row |
| STATE-03 | Recompute before sign-off (`LEGAL_REVIEW` → `COMPUTING`) mutates the existing `Assessment` in place — same `id`, new pack and engine version, all dispositions cleared | Common Pitfalls Pitfall 3 (the "first opened" reset this transition must also trigger); `resubmitAfterInfoRequest` already implements the mutate-in-place mechanics (`[VERIFIED: apps/web/src/server/data/matters.ts:236-264]`) — Phase 4's job is routing its transition calls through `evaluateTransition` and adding the audit write, not re-deriving the mutation itself |
| STATE-04 | A write to a `SIGNED_OFF` assessment fails at the database, not only at the API, which returns 409 | Explicitly out of scope this phase (Environment Availability; Validation Architecture's Phase Requirements table marks it manual-only/deferred) — Docker/Postgres unavailable, deferred to Phase 3.2 per the phase brief |
| STATE-05 | A correction after sign-off creates a new assessment and marks the previous one `SUPERSEDED`, retaining it verbatim | Validation Architecture Wave 0 gap flags that no correction-after-sign-off function exists yet in `data/assessments.ts` — this phase likely needs to author it, not only audit it; Standard Stack's Alternatives table records why `SUPERSEDED` cannot share machinery with the in-place recompute (different guard-table row, `SIGNED_OFF`\|`CLOSED` → `SUPERSEDED`) |
| BOUND-05 | `AuditEvent.payload` stores only changed fields from the closed declared set; an undeclared key is a validation error | Architecture Patterns Pattern 3 (payload builders over the already-frozen, single `AuditPayloadSchema` — the per-event-kind-schema idea is superseded by the Phase 1 freeze) |
| AUDIT-01 | Every state transition, line disposition, pack activation and sign-off emits an audit event with actor, role, server timestamp, before and after, pack version and engine version | Architecture Patterns diagram and Pattern 3; Common Pitfalls Pitfall 1 (the pack-activation clause's overlap with Phase 3.2's PACK-07); Open Question 1 recommends building both writers this phase regardless |
| AUDIT-03 | Elapsed review time is recorded on every `LINE_DISPOSITIONED` and `SIGNED_OFF` event, measured from when the reviewer first opened the assessment | Architectural Responsibility Map ("first opened" tracking); Common Pitfalls Pitfall 3 (reset-on-recompute semantics); Assumptions Log A2 |
| AUDIT-04 | The DPO can export the audit log | Code Examples ("DPO export as a plain function"); Common Pitfalls Pitfall 4 (no `DPO_ADMIN` demo actor exists yet — must be added); Security Domain (role-check placement) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Guard evaluation (is `from → to` permitted given `GuardInput`?) | API / Backend (new `packages/workflow`, consumed from `apps/web/src/server`) | — | Pure business-rule logic over a typed snapshot, no different in kind from `packages/engine`'s `assess()` — must not become a Next.js-only concern, since a future non-demo backend consumes it too (PRD §15's package-boundary intent) |
| Status/assessment mutation (writing the *result* of an allowed transition) | API / Backend (`apps/web/src/server/data/*`) | Database / Storage (`packages/audit`, `apps/web/src/server/repositories/memory/*`) | The guard only decides; the data layer still owns calling the repository and the audit writer, matching the existing `requireRole` → validate → repository call shape every function in `data/matters.ts`/`data/assessments.ts` already follows |
| Audit event persistence (matter-scoped) | Database / Storage (`packages/audit`, in-memory now, Prisma later) | API / Backend (call sites in `data/*.ts`) | Append-only by construction (AC-34); the writer is the one place an `INSERT`-only discipline can be enforced structurally |
| Audit event persistence (pack-lifecycle) | Database / Storage (`packages/audit`, a second stream) | — | D-21: cannot share `AuditEvent`'s matter-scoped shape; needs its own table/store keyed to `RulePackVersion` |
| Elapsed-review-time tracking ("first opened") | API / Backend (an ephemeral session map, same tier as `apps/web/src/server/data/assessments.ts`'s existing `noticeSentAtByMatterId`) | — | Not a persisted domain entity — a derived timing signal computed at write time from an in-memory clock read, same risk class Phase 3.1 already accepted for all its throwaway state |
| DPO export | API / Backend (a plain exported function this phase; a route/UI is a later phase's job) | — | No DPO-facing screen exists yet (Phases 5–7 own screens); AUDIT-04 only requires the capability to exist and be callable under the DPO_ADMIN role |

## Standard Stack

This phase adds no new runtime dependency. It is pure TypeScript against already-pinned `zod@4.6.5`, the existing `pnpm` workspace, and the existing Vitest 5 `projects` array (`vitest.config.ts`).

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | 4.6.5 (already pinned, `package.json:32`) `[VERIFIED: package.json:32]` | `AuditPayloadSchema` parse-and-reject at the writer boundary; no new schema needed, the frozen one is reused | Already the project's sole validation library; BOUND-05's closed-set enforcement is this schema, already authored |
| TypeScript | project-pinned (`tsconfig.base.json`, workspace-wide) | Guard table, executor, writer interfaces | No version-sensitive feature used — plain discriminated unions and interfaces |

### Supporting
None. This phase needs no PDF, no HTTP client, no new test library — `fast-check` (already a devDependency, `@fast-check/vitest@0.5.0` per `package.json`) is available if a property test over the guard table proves useful, but the guard table is small and enumerable, so table-driven unit tests (one row per guard-table edge, as PRD §5 lists them) are the more direct fit and match `packages/engine`'s own five-treatment-table testing style.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A declared array of transition-spec objects (`{ from, to, event, guard }`) | A `switch` statement over `${from}:${event}` string keys | The declared-array shape already has two precedents in this exact codebase (`DERIVED_MATTER_FLAG_SPECS` in `packages/engine`, `ACTIVE_READY_CHECKS` in `packages/rulepacks` — both noted in `STATE.md`'s Phase 02/03 decision log as the chosen style over an if/switch chain) and is directly enumerable for a "every guard-table row has a test" completeness check |
| Two separate writer interfaces (`AuditEventWriter`, `PackLifecycleEventWriter`) | One `AuditEventWriter` with a nullable `matterId` | Rejected: `AuditEvent.matterId` is frozen non-nullable (Phase 1) and `03-CONTEXT.md`'s D-21 already closed this question in favour of a separate stream — reopening the frozen field's nullability is exactly the FREEZE.md D-10 escalation Phase 3's research flagged and declined to take |

**Installation:** none required.

## Package Legitimacy Audit

Not applicable — this phase installs no external package.

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────┐
   apps/web/src/server/   │   apps/web/src/server/data/  │
   data/matters.ts,       │   {matters,assessments}.ts   │
   assessments.ts         │   (role check → validate →   │
   (call sites)           │    guard → repository write   │
                          │    → audit write)             │
                          └──────────────┬───────────────┘
                                         │
                     ┌───────────────────┼────────────────────┐
                     ▼                   ▼                    ▼
        ┌────────────────────┐ ┌──────────────────┐ ┌──────────────────────┐
        │ packages/workflow   │ │ repositories/     │ │ packages/audit        │
        │ (pure, no I/O)      │ │ memory/*.ts        │ │                       │
        │                     │ │ (Matter/Assessment │ │ AuditEventWriter      │
        │ evaluateTransition( │ │  already exist)    │ │  .append()            │
        │  from, event,       │ │                     │ │  .listByMatter()      │
        │  input: GuardInput  │ │                     │ │  .exportAll()  (DPO)  │
        │ ) -> Allowed |       │ └──────────────────┘ │                       │
        │      Refused(reason)│                        │ PackLifecycleEvent-   │
        └─────────────────────┘                        │  Writer (D-21 stream) │
                                                          └───────────────────────┘
                                                                     │
                                                        in-memory now (globalThis-
                                                        anchored, deep-copy on
                                                        read/write) — Prisma-backed
                                                        later, same interface
                                                        (Phase 3.2, replanned)
```

Trace the primary use case (a lawyer signs off): the route calls `signOff()` in `data/assessments.ts` → `requireRole` → `requireAssessmentInLegalReview` → `packages/workflow`'s `evaluateTransition("LEGAL_REVIEW", "SIGN_OFF", guardInput)` returns `Allowed` or `Refused(reason)` → on `Allowed`, the existing sign-off validation (every line dispositioned, flags acknowledged, attestation affirmed) runs exactly as it does today → the assessment repository is updated → `packages/audit`'s `AuditEventWriter.append()` writes a `SIGNED_OFF` event carrying `elapsedReviewMs` computed from the session-open map → the matter repository is updated with the new status, itself derived from `evaluateTransition`'s returned `to`, never hand-written as a literal.

### Recommended Project Structure
```
packages/
├── workflow/                    # NEW — pure guard table + executor
│   ├── package.json             # @dsar/workflow, deps: @dsar/schemas only
│   ├── src/
│   │   ├── transitions.ts       # the declared TRANSITIONS array (PRD §5's table)
│   │   ├── evaluate-transition.ts   # evaluateTransition(from, event, input)
│   │   └── evaluate-transition.test.ts   # one test block per guard-table row
├── audit/                       # NEW — matches CLAUDE.md's named package
│   ├── package.json             # @dsar/audit, deps: @dsar/schemas only (no Prisma yet)
│   ├── src/
│   │   ├── interface.ts         # AuditEventWriter, PackLifecycleEventWriter
│   │   ├── memory/
│   │   │   ├── store.ts         # globalThis-anchored, mirrors repositories/memory/store.ts
│   │   │   ├── audit-event-writer.ts
│   │   │   └── pack-lifecycle-event-writer.ts
│   │   ├── payload-builders.ts  # one small builder fn per AuditEventType, all emitting
│   │   │                        # AuditPayloadSchema-valid shapes (see Pattern 3 below)
│   │   └── review-session.ts    # the "first opened" ephemeral map (AUDIT-03)
apps/web/src/server/
├── state.ts                     # DELETED — replaced by packages/workflow
├── data/
│   ├── matters.ts                # rewired: assertTransition(...) calls replaced by
│   │                              # evaluateTransition(...) + throw ConflictError on Refused
│   └── assessments.ts            # same rewiring, plus audit-event writes added at every
│                                  # site AUDIT-01 requires one
```

### Pattern 1: Declared transition-spec array, not a switch statement

**What:** PRD §5's guard table as an array of typed objects, each carrying its own guard predicate over `GuardInput`.
**When to use:** Any closed, enumerable rule table this codebase already has two precedents for treating this way.
**Example (design, not yet in the repo — informed by `packages/engine`'s existing `DERIVED_MATTER_FLAG_SPECS` style, `[VERIFIED: STATE.md Phase 02 P06 entry]`, quoting: `"Derived matter flags composed from a declared DERIVED_MATTER_FLAG_SPECS array (not a sequence of if-statements)"`):**
```typescript
// packages/workflow/src/transitions.ts
import type { GuardInput } from "@dsar/schemas/guard-input";
import type { MatterStatus } from "@dsar/schemas/matter-status";

export type TransitionEvent =
  | "SUBMIT"                 // DRAFT -> COMPUTING
  | "COMPUTE_SUCCEEDED"      // COMPUTING -> LEGAL_REVIEW
  | "COMPUTE_FAILED"         // COMPUTING -> DRAFT
  | "RAISE_QUERY"            // LEGAL_REVIEW -> INFO_REQUEST
  | "RESUBMIT"               // INFO_REQUEST -> COMPUTING
  | "RECOMPUTE"              // LEGAL_REVIEW -> COMPUTING (mutates in place, STATE-03)
  | "SIGN_OFF"               // LEGAL_REVIEW -> SIGNED_OFF
  | "MARK_SENT"              // SIGNED_OFF -> CLOSED
  | "SUPERSEDE";             // SIGNED_OFF | CLOSED -> SUPERSEDED

export type GuardResult = { allowed: true } | { allowed: false; reason: string };

interface TransitionSpec {
  from: MatterStatus;
  event: TransitionEvent;
  to: MatterStatus;
  guard: (input: GuardInput) => GuardResult;
}

// One row per PRD §5 guard-table line. Order matches the PRD table's own
// order so a reviewer can diff this array against §5 directly.
export const TRANSITIONS: readonly TransitionSpec[] = [
  {
    from: "DRAFT", event: "SUBMIT", to: "COMPUTING",
    guard: (input) => {
      if (input.expenseLineCount < 1) return { allowed: false, reason: "At least one expense line is required" };
      if (!input.pack) return { allowed: false, reason: "No active rule pack exists for this jurisdiction" };
      // ...remaining §5 preconditions (currency match, pack not stale, attestations)
      return { allowed: true };
    },
  },
  // ...remaining eight rows
];
```
```typescript
// packages/workflow/src/evaluate-transition.ts
import { TRANSITIONS, type TransitionEvent, type GuardResult } from "./transitions.ts";
import type { GuardInput } from "@dsar/schemas/guard-input";
import type { MatterStatus } from "@dsar/schemas/matter-status";

export interface TransitionOutcome extends GuardResult {
  to?: MatterStatus; // present only when allowed
}

export function evaluateTransition(
  from: MatterStatus,
  event: TransitionEvent,
  input: GuardInput
): TransitionOutcome {
  const spec = TRANSITIONS.find((t) => t.from === from && t.event === event);
  if (!spec) return { allowed: false, reason: `No transition '${event}' from '${from}'` };
  const result = spec.guard(input);
  return result.allowed ? { allowed: true, to: spec.to } : result;
}
```

### Pattern 2: Structural enforcement that "no code path writes a status field directly" (SC1)

**What:** `Matter.status` cannot be branded or made opaque — `Matter` is a frozen, additive-only schema (`packages/schemas/FREEZE.md`'s D-09 policy), and narrowing an existing field's type is exactly the kind of change that policy requires an explicit escalation for, not a silent Phase 4 workaround. Dependency-cruiser cannot help here either: it inspects the *import graph*, not object-literal keys, so it has no way to see `{ ...matter, status: "COMPUTING" }` inside `data/matters.ts` as a violation — this is a field-level constraint, not a module-boundary one, and dependency-cruiser is deliberately positioned in this codebase (`.dependency-cruiser.cjs`'s existing `no-io-in-engine`/`no-store-impl-in-repository-interface`/`no-server-imports-in-ui` rules) for import-target matching only.
**Recommendation:** A convention plus a **new bespoke ESLint rule**, following the exact precedent CLAUDE.md already names for the money-branding gate (AC-07a: "Hosts the bespoke `Minor`-branding lint rule"). Add a sibling rule — e.g. `no-restricted-syntax` targeting `Property[key.name='status']` and `AssignmentExpression > MemberExpression[property.name='status']` nodes — scoped to fire everywhere **except** `packages/workflow/src/**` (an ESLint `overrides` block disabling the rule only there, mirroring how the engine-purity dependency-cruiser rule is scoped to `^packages/engine`). This is a **design recommendation**, not something already built — flag it to the planner as a discrete task, not an assumed-done gate.
**When to use:** Only inside `apps/web/src/server/data/*.ts` and `packages/audit`'s payload builders need write access to `status`-shaped values at all, and only ever by taking `evaluateTransition(...).to` and passing it straight into `updateMatter({ ...matter, status: outcome.to })` — even that one call site is the sole permitted spread, everywhere else should read `matter.status`, never write it as a literal.
**Anti-pattern to avoid:** Writing `status: "SOME_LITERAL"` anywhere reachable without having called `evaluateTransition` first in the same function — the existing `apps/web/src/server/data/matters.ts` (`[VERIFIED: apps/web/src/server/data/matters.ts:202,208,212,249,259]`, quoting the five current sites: `status: "COMPUTING"`, `status: "LEGAL_REVIEW"`, `status: "DRAFT"`, `status: "COMPUTING"`, `status: "LEGAL_REVIEW"`) and `apps/web/src/server/data/assessments.ts` (`[VERIFIED: apps/web/src/server/data/assessments.ts:372,417]`, quoting `status: "SIGNED_OFF"` and `status: "INFO_REQUEST"`) already have exactly this pattern seven times over — every one of these seven literals is a call site Phase 4 must convert.

### Pattern 3: Payload builders over the frozen, single `AuditPayloadSchema` (BOUND-05)

**What:** The task brief anticipated "a per-event-kind payload schema union" as the way to keep BOUND-05 maintainable across several event kinds. That decision was **already made and frozen in Phase 1**, and it went the other way: `AuditPayloadSchema` is a single `z.strictObject` over five optional keys, deliberately generic across every event type (`[VERIFIED: packages/schemas/src/audit-event.ts:33-50]`, quoting: `export const AUDIT_PAYLOAD_KEYS = ["entityId", "field", "before", "after", "elapsedReviewMs"] as const;` and `export const AuditPayloadSchema = z.strictObject({ entityId: z.string().optional(), field: z.string().optional(), before: JsonSchema.optional(), after: JsonSchema.optional(), elapsedReviewMs: z.number().int().nonnegative().optional() });`). A per-event-kind zod union is neither available nor needed — reopening this shape is out of Phase 4's scope (additive-only freeze policy, D-09) and it already satisfies "reject an undeclared key" via `z.strictObject`.
**Recommendation:** Phase 4's own type safety belongs one layer up, as a set of small typed **builder functions**, one per audit event kind, each returning a value that is always valid against the already-frozen schema — the union-like structure the question anticipated lives in TypeScript overloads/argument shapes, not in a second zod schema:
```typescript
// packages/audit/src/payload-builders.ts
import type { AuditPayload } from "@dsar/schemas/audit-event";

export function transitionPayload(before: string, after: string): AuditPayload {
  return { field: "status", before, after };
}

export function dispositionPayload(args: {
  lineId: string;
  before: string; // prior disposition
  after: string;  // new disposition
  elapsedReviewMs: number;
}): AuditPayload {
  return {
    entityId: args.lineId,
    field: "disposition",
    before: args.before,
    after: args.after,
    elapsedReviewMs: args.elapsedReviewMs,
  };
}

export function signOffPayload(elapsedReviewMs: number): AuditPayload {
  return { field: "signOff", after: "SIGNED_OFF", elapsedReviewMs };
}
```
Every builder's return type is `AuditPayload` (the frozen `z.infer`), so a builder that tried to add a sixth key would fail TypeScript compilation before ever reaching the runtime `z.strictObject` rejection — two independent layers catching the same class of mistake, which is the same "compile error, not just a runtime one" discipline `guard-input.ts`'s own header note already asks for elsewhere in this codebase.

### Anti-Patterns to Avoid
- **Widening `AuditEvent.matterId` to nullable to fit pack-lifecycle events:** Already considered and declined in `03-CONTEXT.md`/`03-RESEARCH.md` (D-21) — this phase should not reopen it.
- **Guard functions that call the repository or write audit events themselves:** `GuardInput`'s own header (`packages/schemas/src/guard-input.ts:19-21`, `[VERIFIED]`, quoting: `"State-machine guard functions (STATE-02..05, Phase 4) are pure functions over this type; nothing parses a GuardInput value at runtime."`) already commits this phase to purity. `packages/workflow` must have zero imports of `../repositories`, `@prisma/client`, `next`, or `packages/audit` — mirror `.dependency-cruiser.cjs`'s existing `no-io-in-engine`/`no-infra-in-engine` rules with a new `no-io-in-workflow` rule anchored at `^packages/workflow`.
- **Treating the audit write as best-effort (fire-and-forget) inside the in-memory implementation:** Phase 3.2's own already-planned `packages/audit/src/write-event.ts` (`[VERIFIED: .planning/phases/03.2-database-boundary-and-audit-immutability/03.2-01-PLAN.md:289]`, quoting: `"It takes a transaction client rather than a global client specifically so the audit write cannot be made best-effort: if it fails, the enclosing write fails with it."`) establishes the intended semantics — Phase 4's in-memory writer should mirror this by having callers `await` the audit write *before* returning success from the enclosing `data/*.ts` function, and by making a repository/writer failure propagate (throw), not swallow.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deep-copy isolation for the in-memory audit store | A custom clone function | `structuredClone`, exactly as `apps/web/src/server/repositories/memory/matter-repository.ts` already does on every read and write | Already the proven, tested pattern in this codebase; a hand-rolled clone risks missing a nested field (e.g. `AuditEvent.payload`'s `Json`-typed `before`/`after` values) |
| A second globalThis-anchoring mechanism | A plain module-scoped `Map` | The `declare global { var __dsarX: ... }` pattern `repositories/memory/store.ts` and `data/matters.ts`'s `noticeSentAtByMatterId` already use | A plain module map is reset by Next's Fast Refresh and can duplicate across bundler chunks — already documented as a live risk in this codebase, not a hypothetical one |
| A generic "workflow engine" library (XState, etc.) | An external state-machine library | The declared `TRANSITIONS` array in `packages/workflow` | Nine transitions, a fixed guard shape, and a hard "no I/O in the guard" purity requirement (parallel to `packages/engine`) is smaller and more auditable as plain data than as a library's runtime interpreter — the whole point of this phase's audit trail is that "the engine applied rule X" is defensible in plain English, and a bespoke interpreter for nine rows serves that better than a general-purpose FSM library's abstraction |

**Key insight:** Every "don't hand-roll" temptation this phase might hit already has a proven, in-repo precedent from Phase 1–3.1 to copy rather than reinvent — the discipline here is consistency with what already exists, not introducing a new dependency.

## Runtime State Inventory

> Not a rename/refactor/migration phase — this section is omitted per its own trigger condition. (This phase does move code — `state.ts` is deleted and `data/*.ts` is rewired — but that is new-feature-shaped construction over frozen schemas and an existing repository interface, not a rename/rebrand/string-replacement operation touching stored keys, live service config, OS registrations, or installed artifacts. No such category applies here.)

## Common Pitfalls

### Pitfall 1: AUDIT-01's "pack activation" clause and PACK-07's Phase-3.2 assignment overlap without a Phase-4 UI to drive it
**What goes wrong:** AUDIT-01 (Phase 4) textually includes "pack activation" in its list of events that must be audited, but the actual pack-activation *write path* — the `/admin/rulepacks` activation gate, the sole-authorship confirmation (AC-41a), the audited event itself — is PACK-07, explicitly relocated to Phase 3.2 (ROADMAP.md: `"Requirements: ...plus PACK-06 and PACK-07, relocated here from Phase 3 by D-20"`). Phase 4 has no admin screen to call a pack-activation audit write from.
**Why it happens:** AUDIT-01 was written as one general audit-completeness requirement spanning several actions; the actions were later split across phases by real infrastructure constraints (no `apps/web` admin screen yet, no Docker).
**How to avoid:** Satisfy AUDIT-01's pack-activation clause structurally rather than by wiring a live screen: build `PackLifecycleEventWriter` (D-21's separate stream) in `packages/audit` this phase, with a unit/integration test that constructs a `PACK_ACTIVATED`-shaped event directly (no route, no UI) and proves it appends, is queryable, and rejects an undeclared payload key — the same proof-without-a-caller discipline Phase 3.1 already used for `AssessmentRepository.findByLineId()` before any route needed it. Document explicitly in the plan/summary that the *write path from a real admin action* remains PACK-07's job in Phase 3.2, so this is not silently marked "done" twice.
**Warning signs:** A plan that tries to build `/admin/rulepacks` UI to satisfy AUDIT-01 — that is Phase 3.2/PACK-07's scope creeping into Phase 4.

### Pitfall 2: Retrofitting the guard/audit layer under Phase 3.1's seven existing status-literal call sites without a regression
**What goes wrong:** `apps/web/src/server/data/matters.ts` and `data/assessments.ts` currently write `status: "..."` literals directly seven times (`[VERIFIED: apps/web/src/server/data/matters.ts:202,208,212,249,259; apps/web/src/server/data/assessments.ts:372,417]`) and call `assertTransition(from, to)` from `state.ts` around most of them. A blind refactor that swaps all seven at once, plus deletes `state.ts`, plus stands up two new packages in the same commit, makes any regression in the current 611/612-passing suite (`[VERIFIED: this session — `pnpm vitest run` produced `Test Files 1 failed | 69 passed (70)`, `Tests 1 failed | 611 passed (612)`, the one failure being a pre-existing 5000ms property-test timeout in `packages/engine/src/assess.property.test.ts` unrelated to this phase]`) hard to isolate.
**Why it happens:** Phase 3.1's own Assumption A5 already predicted this exact retrofit ("if Phase 4 lands first, this phase's transition code should be replaced by calling Phase 4's real guards rather than left as parallel logic" — `[VERIFIED: .planning/phases/03.1-demo-slice-in-memory-determination-pipeline/03.1-RESEARCH.md:437]`) but did not prescribe an order of operations.
**How to avoid:** Build `packages/workflow` and `packages/audit` standalone first, fully unit-tested against `GuardInput` fixtures and in-memory writer contract tests, with zero imports from `apps/web` in either direction. Only then touch `data/matters.ts`/`data/assessments.ts`, one function at a time (`createMatter` has no transition to touch; `submitForAssessment`, `resubmitAfterInfoRequest`, `dispositionLine`, `bulkAcceptLines`, `signOff`, `askHr` each own exactly one or two of the seven literals) — run `pnpm vitest run` after each function's swap, not only at the end. Re-baseline the pre-existing property-test timeout before starting (it is flaky/CPU-load-sensitive, not a real assertion failure) so it is not misattributed to this phase's changes partway through.
**Warning signs:** A single wave/plan that both deletes `state.ts` and rewires every call site — prefer sequencing this as its own plan/task boundary with a green-suite checkpoint per function.

### Pitfall 3: "First opened" timer semantics across a recompute (STATE-03)
**What goes wrong:** STATE-03 requires a recompute (`LEGAL_REVIEW → COMPUTING → LEGAL_REVIEW`) to clear every disposition — it is, in effect, a fresh review pass. If the "first opened" timestamp used for AUDIT-03's `elapsedReviewMs` is not also reset at that point, a lawyer's elapsed time on the *second* review pass is measured from the *first* pass's open time, silently inflating (or, if the recompute happens quickly, silently shrinking) the automation-bias signal AUDIT-03 exists to produce.
**Why it happens:** There is no existing precedent for this in the codebase — Phase 3.1 never persisted an "opened at" concept at all (`[VERIFIED: no `openedAt`/`first opened`/`OPENED` identifier exists anywhere under apps/web/src or packages/schemas/src, confirmed by grep this session]`), so this is new design surface, not a retrofit of an existing bug.
**How to avoid:** Reset (delete) the assessment's `openedAt` entry in the same code path that performs the in-place recompute mutation (`resubmitAfterInfoRequest` in `data/matters.ts`, `[VERIFIED: apps/web/src/server/data/matters.ts:236-264]`), so the next `getAssessmentForLegalReview` read re-establishes it. Record this as an explicit decision in the plan rather than leaving it implicit.
**Warning signs:** An `elapsedReviewMs` that is implausibly large immediately after a recompute-and-redisposition cycle in a manual walkthrough.

### Pitfall 4: No DPO_ADMIN demo actor exists to exercise the export function under
**What goes wrong:** `apps/web/src/server/data/auth.ts`'s `DEMO_USERS` record only has `HR_PREPARER` and `LEGAL_REVIEWER` keys (`[VERIFIED: apps/web/src/server/data/auth.ts:31-34]`, quoting: `export const DEMO_USERS: Record<"HR_PREPARER" | "LEGAL_REVIEWER", DemoActor> = { HR_PREPARER: ..., LEGAL_REVIEWER: ... };`). A DPO export function gated by `requireRole(actor, "DPO_ADMIN")` cannot be exercised end-to-end through the existing cookie-resolution path without adding a third demo actor.
**Why it happens:** `RulePackVersion`/pack-admin and DPO screens were both out of Phase 3.1's scope, so no DPO demo identity was ever needed before now.
**How to avoid:** Add a `DPO_ADMIN` entry to `DEMO_USERS` and widen `Record<"HR_PREPARER" | "LEGAL_REVIEWER", DemoActor>`'s key union and `resolveActorFromCookieHeader`'s cookie-value branch — a small, additive change to an already-non-frozen demo-only module (`auth.ts` is not one of the Phase 1 frozen schemas).
**Warning signs:** A DPO-export unit test that constructs a `DemoActor` by hand instead of going through the real `resolveActorFromCookieHeader` path — that would prove the function's own role check but not that a DPO_ADMIN cookie value actually reaches it.

## Code Examples

### The audit writer interface (design — not yet in the repo)
```typescript
// packages/audit/src/interface.ts
import type { AuditEvent, AuditEventType } from "@dsar/schemas/audit-event";

export type NewAuditEvent = Omit<AuditEvent, "id">;

export interface AuditEventWriter {
  append(event: NewAuditEvent): Promise<AuditEvent>;
  listByMatter(matterId: string): Promise<AuditEvent[]>;
  // AUDIT-04 — every matter-scoped event, chronological, no matter filter.
  exportAll(): Promise<AuditEvent[]>;
}

// D-21: pack-lifecycle events cannot share AuditEvent's matterId-keyed shape.
export interface PackLifecycleEvent {
  id: string;
  packId: string;
  packVersion: string;
  actor: AuditEvent["actor"];
  actorRole: AuditEvent["actorRole"];
  at: string;
  type: Extract<AuditEventType, "PACK_ACTIVATED" | "PACK_EDITED">;
  payload: AuditEvent["payload"];
}

export interface PackLifecycleEventWriter {
  append(event: Omit<PackLifecycleEvent, "id">): Promise<PackLifecycleEvent>;
  listByPack(packId: string, version: string): Promise<PackLifecycleEvent[]>;
  exportAll(): Promise<PackLifecycleEvent[]>;
}
```

### In-memory implementation, matching the existing repository deep-copy pattern
```typescript
// packages/audit/src/memory/audit-event-writer.ts — modelled directly on
// apps/web/src/server/repositories/memory/matter-repository.ts's
// structuredClone discipline.
import type { AuditEventWriter, NewAuditEvent } from "../interface.ts";
import { AuditEventSchema } from "@dsar/schemas/audit-event";
import { auditStore } from "./store.ts";

let nextId = 1;

export const memoryAuditEventWriter: AuditEventWriter = {
  async append(event) {
    const full = AuditEventSchema.parse({ ...event, id: String(nextId++) });
    const copy = structuredClone(full);
    auditStore.events.set(copy.id, copy);
    return structuredClone(copy);
  },
  async listByMatter(matterId) {
    return [...auditStore.events.values()]
      .filter((e) => e.matterId === matterId)
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((e) => structuredClone(e));
  },
  async exportAll() {
    return [...auditStore.events.values()]
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((e) => structuredClone(e));
  },
};
```

### DPO export as a plain function (this phase's shape — no route yet)
```typescript
// apps/web/src/server/data/audit.ts (new, small — mirrors data/matters.ts's shape)
import { requireRole, type DemoActor } from "./auth.ts";
import { memoryAuditEventWriter } from "@dsar/audit/memory/audit-event-writer";
import type { AuditEvent } from "@dsar/schemas/audit-event";

export async function exportAuditLog(actor: DemoActor): Promise<AuditEvent[]> {
  requireRole(actor, "DPO_ADMIN");
  return memoryAuditEventWriter.exportAll();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `apps/web/src/server/state.ts`'s explicit edge table with no guard predicates | `packages/workflow`'s declared `TRANSITIONS` array with a guard predicate per row | This phase | Every transition now enforces PRD §5's full precondition list, not just "is this edge in the allowed set" |
| No audit persistence at all (Phase 3.1 explicitly deferred it — `03.1-RESEARCH.md` Pitfall 7) | `packages/audit`'s in-memory `AuditEventWriter`/`PackLifecycleEventWriter` | This phase | AC-35's five audit-event types this phase owns (transitions, dispositions, sign-off, plus the pack-lifecycle stream) become real, queryable, exportable records for the first time — still in-memory, but structurally identical to what Phase 3.2 will make durable |

**Deprecated/outdated:**
- `apps/web/src/server/state.ts`: superseded in full by `packages/workflow`; do not extend it further, per its own header note ("Phase 4 replaces this; nothing should grow beside it" `[VERIFIED: apps/web/src/server/state.ts:7]`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A new bespoke ESLint `no-restricted-syntax` rule (mirroring the existing AC-07a money-branding rule) is the right static enforcement for "no direct status write outside `packages/workflow`" — not a dependency-cruiser rule, and not a type-level brand on `Matter.status` | Architecture Patterns, Pattern 2 | Medium — if the planner instead tries to force this through dependency-cruiser (which cannot see object-literal keys) or through a frozen-schema type change (which needs a FREEZE.md escalation this research did not raise), the enforcement mechanism will not actually catch a violation, or will require reopening a frozen type unnecessarily |
| A2 | "First opened" tracking should reset on recompute (`resubmitAfterInfoRequest`), treating each `LEGAL_REVIEW` entry as a fresh review pass for AUDIT-03's elapsed-time signal | Common Pitfalls, Pitfall 3 | Medium — PRD §6.5 does not explicitly state this; a product-owner confirmation would settle it definitively. If wrong, elapsed-time figures span review passes rather than measuring the pass in which a disposition/sign-off actually happened |
| A3 | `packages/workflow` should be a wholly new package (not folded into `packages/audit` or left inside `apps/web/src/server`) | Architecture Patterns, package location | Low — CLAUDE.md's architecture list does not name `packages/workflow` explicitly, only `packages/audit`; a reviewer could reasonably argue the guard table is small enough to live in `apps/web/src/server` directly since only one consumer (`apps/web`) exists today. The `packages/engine`-parity argument (pure, testable, potentially reused by a future non-demo backend) is this research's basis for recommending a package, but it is a design call, not a frozen requirement |
| A4 | The bulk-accept and single-line disposition flows (`bulkAcceptLines`, `dispositionLine` in `data/assessments.ts`) do not themselves cross a `MatterStatus` transition — they only require the matter already be in `LEGAL_REVIEW` — and therefore do not need a `packages/workflow` call, only an audit-event write | Architecture Patterns diagram; Code Examples | Low — confirmed by reading the frozen guard table (PRD §5) and the current implementation, neither of which lists a disposition as a status-changing event; if a future PRD revision changes this, the audit-only treatment would need to gain a guard call too |

## Open Questions

1. **Does AUDIT-01's "pack activation" clause require Phase 4 to build the `PackLifecycleEventWriter`, or is proving `AuditEventWriter` alone (with a note that pack-lifecycle events are structurally out of scope until Phase 3.2/PACK-07) sufficient to satisfy this phase's success criteria?**
   - What we know: D-21 (Phase 3, `03-CONTEXT.md`) already commits to a separate stream design; PACK-07 (the actual activation-audit *wiring*) is assigned to Phase 3.2, not Phase 4.
   - What's unclear: Whether "Phase 4" as scoped by this research task's own success-criteria language ("every transition, disposition, pack activation and sign-off emits an audit event") expects the writer to exist now (this research's recommendation) or only the matter-scoped half.
   - Recommendation: Build both writers this phase (low incremental cost — the pack-lifecycle writer is structurally identical to the matter-scoped one), proven by direct unit tests with no UI, so AUDIT-01 is genuinely discharged rather than partially discharged pending PACK-07.

2. **Should the guard executor's `TransitionEvent` union be exported from `@dsar/schemas` (alongside `MatterStatus`) rather than from the new `packages/workflow`?**
   - What we know: `MatterStatus` is a frozen schemas-level type; `TransitionEvent` (e.g. `"SUBMIT"`, `"SIGN_OFF"`) does not exist anywhere yet — it is new to this phase.
   - What's unclear: Whether a future consumer (e.g. a route handler needing to know which events are legal from a given status, for a UI affordance) would rather import it from `@dsar/schemas` (data-shape package) or `@dsar/workflow` (behavior package).
   - Recommendation: Keep it in `packages/workflow` — it describes *behavior* (an action a caller performs), not a *data shape* the way `MatterStatus`/`GuardInput` do, and `packages/schemas`' own freeze discipline (D-09, additive-only, escalation-gated) is a poor fit for a construct this phase will likely still be iterating on.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Running Vitest, building the new packages | ✓ | v24.19.0 | — |
| pnpm | Workspace install/build | ✓ | 11.27.0 (pinned, `[VERIFIED: package.json:5]`) | — |
| Docker / Postgres | STATE-04's DB-level immutability trigger | ✗ | — (`docker: command not found`, re-confirmed this session) | None — STATE-04 is explicitly deferred to Phase 3.2 per this phase's own out-of-scope note; no in-memory substitute is valid (would be a false proof) |
| Vitest | Running the new `workflow`/`audit` test suites | ✓ | 5.0.0 (`vitest.config.ts`'s `projects` array already extensible) | — |

**Missing dependencies with no fallback:**
- Docker/Postgres for STATE-04 — explicitly out of scope this phase, not a blocker for the other six requirements.

**Missing dependencies with fallback:**
- None beyond the above; everything else in scope is pure TypeScript plus the existing in-memory pattern.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.0, `test.projects` field in the single root `vitest.config.ts` |
| Config file | `vitest.config.ts` (add two new project entries: `workflow`, `audit` — mirroring the existing `engine`/`rulepacks` node-environment entries) |
| Quick run command | `pnpm vitest run --project workflow --project audit` |
| Full suite command | `pnpm vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STATE-02 | Every PRD §5 guard-table row evaluates correctly (allowed and refused cases) | unit | `pnpm vitest run --project workflow -t "evaluateTransition"` | ❌ Wave 0 |
| STATE-03 | Recompute mutates the existing `Assessment` in place (same id, dispositions cleared) | integration | `pnpm vitest run --project routes -t "resubmitAfterInfoRequest"` | ✅ (`apps/web` already has a resubmit test from 03.1-04; extend, do not replace) |
| STATE-04 | DB-level immutability | manual-only (deferred) | N/A — explicitly out of scope this phase | N/A |
| STATE-05 | Sign-off correction creates a new assessment, old one `SUPERSEDED` verbatim | unit + integration | `pnpm vitest run --project audit -t "SUPERSEDED"` | ❌ Wave 0 — no correction-after-sign-off flow exists in `data/assessments.ts` yet; this phase likely needs to add the function, not only the audit event |
| BOUND-05 | Undeclared payload key rejected | unit | `pnpm vitest run --project schemas -t "AuditPayloadSchema"` | ✅ (`packages/schemas/src/audit-event.test.ts` already covers this — Phase 4 reuses, does not re-test the schema itself, only that its own builders never violate it) |
| AUDIT-01 | Every transition/disposition/sign-off/pack-activation emits an audit event | integration | `pnpm vitest run --project routes -t "audit event"` | ❌ Wave 0 |
| AUDIT-03 | `elapsedReviewMs` present on every `LINE_DISPOSITIONED`/`SIGNED_OFF` event | unit + integration | `pnpm vitest run --project audit -t "elapsedReviewMs"` | ❌ Wave 0 |
| AUDIT-04 | DPO can export the audit log | unit | `pnpm vitest run --project routes -t "exportAuditLog"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run --project workflow --project audit` (fast, no jsdom/db projects touched)
- **Per wave merge:** `pnpm vitest run` (full suite — re-baseline the known pre-existing `assess.property.test.ts` timeout first, see Pitfall 2)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `packages/workflow/src/evaluate-transition.test.ts` — one test per PRD §5 guard-table row (9 rows), both allowed and at-least-one-refused case per row
- [ ] `packages/audit/src/memory/audit-event-writer.test.ts` — append/listByMatter/exportAll, plus a deep-copy-isolation test (mutate a returned event, prove the store is unaffected — same shape as the existing `matter-repository.test.ts` pattern if one exists, else newly authored following its style)
- [ ] `packages/audit/src/memory/pack-lifecycle-event-writer.test.ts` — same shape, proving D-21's separate-stream design holds
- [ ] New ESLint rule fixture pair (violating + compliant) for the "no direct status write" gate (Pattern 2), following the existing money-branding rule's own violating-fixture-plus-assertion precedent (Phase 2's "every gate ships with a fixture it must catch" discipline, `ROADMAP.md`'s Phase 2 "Gate integrity" note)
- [ ] `.dependency-cruiser.cjs` — new `no-io-in-workflow` rule, plus a violating fixture proving it fires (same pattern as `no-io-in-engine`)
- Framework install: none — Vitest, zod, TypeScript all already present

*(STATE-04 has no Wave 0 gap here — it is explicitly out of scope this phase.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Out of scope — stubbed identity per CLAUDE.md's Prototype framing, unchanged this phase |
| V3 Session Management | Partial | The "first opened" elapsed-review map is session-adjacent state but not an auth session; no new auth surface is added |
| V4 Access Control | Yes | Every new `data/*.ts` function (`exportAuditLog`, and the rewired transition call sites) must call `requireRole` first, exactly as every existing function in `data/matters.ts`/`data/assessments.ts` already does — this phase adds `DPO_ADMIN` as a role actually exercised for the first time |
| V5 Input Validation | Yes | `AuditPayloadSchema.parse()` (already frozen) is the validation boundary for every audit write; the payload builders (Pattern 3) are the only permitted way to construct a payload, keeping validation centralized |
| V6 Cryptography | No | Not touched this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Repudiation via a silently-dropped or best-effort audit write | Repudiation | Audit write must be `await`ed before the enclosing `data/*.ts` function returns success; a failed write must propagate as a thrown error, not be logged-and-ignored (mirrors Phase 3.2's own `writeAuditEvent(tx, event)` transaction-client design intent, `[VERIFIED: 03.2-01-PLAN.md:289]`) |
| Tampering via a payload key that later becomes a de-facto second audit channel | Tampering / Information Disclosure | `AuditPayloadSchema`'s `z.strictObject` (already frozen) rejects any key outside the five declared ones; Phase 4 must not add a sixth key to work around a builder's convenience |
| Elevation of privilege via a DPO export function callable without a role check | Elevation of Privilege | `requireRole(actor, "DPO_ADMIN")` as the literal first statement of `exportAuditLog`, following the existing "never in middleware, never only at page level" convention (`auth.ts`'s own header note) |

## Sources

### Primary (HIGH confidence — read directly this session)
- `docs/PRD-dsar-fee-agent.md` §5 (guard table), §6.5 (AuditEvent), §12.1 (payload closed-set), §3 (roles), AC-33/AC-34/AC-35 — read in full this session
- `packages/schemas/src/guard-input.ts`, `matter-status.ts`, `audit-event.ts`, `primitives.ts` (RoleSchema, AuditEventTypeSchema) — read in full this session
- `apps/web/src/server/state.ts`, `data/matters.ts`, `data/assessments.ts`, `data/auth.ts`, `current-actor.ts`, `errors.ts`, `repositories/interface.ts`, `repositories/memory/{store,matter-repository}.ts` — read in full this session
- `.dependency-cruiser.cjs`, `vitest.config.ts`, `prisma/schema.prisma` (RulePackVersion/AuditEvent models) — read in full this session
- `.planning/phases/03.1-demo-slice-in-memory-determination-pipeline/03.1-RESEARCH.md` (Pitfall 7, Assumption A5), `.planning/phases/03.2-database-boundary-and-audit-immutability/03.2-CONTEXT.md` and `03.2-01-PLAN.md`, `.planning/phases/03-rule-packs-and-pack-admin/03-CONTEXT.md` (D-21), `03-RESEARCH.md` — read in full this session
- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — read in full this session
- This session's own `pnpm vitest run` execution (611/612 passing, one pre-existing timeout) — directly observed

### Secondary (MEDIUM confidence)
- None — this phase required no external web research; every load-bearing claim traces to a file read or a command run this session.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency, everything already pinned and verified in `package.json`
- Architecture: HIGH — package location and pattern recommendations are directly modelled on three existing, working precedents in this exact codebase (`packages/engine`'s purity gate, the repository interface pattern, the declared-spec-array style)
- Pitfalls: HIGH for the ones sourced from already-decided cross-phase context (D-21, Assumption A5); MEDIUM for the two genuinely new design questions this phase introduces (elapsed-time reset semantics, DPO demo actor) — flagged in the Assumptions Log for product-owner or planner confirmation

**Research date:** 2026-09-19
**Valid until:** No external dependency to go stale; valid until the codebase itself changes (i.e., effectively until Phase 4 plans are written against it)
