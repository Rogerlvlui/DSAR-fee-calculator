# Architecture Research — Internal Decisions Within the Fixed Package Structure

**Domain:** Deterministic rules-engine web app with a strict LLM boundary (DSAR Fee Assessment Agent)
**Researched:** 2026-09-13
**Confidence:** MEDIUM overall (HIGH on Postgres/Prisma mechanics and TypeScript structural typing, which are well-established; LOW/unverified on library-specific claims sourced from a single web search pass — see Sources)

**Scope note:** `/apps/web`, `/packages/{schemas,engine,rulepacks,agent,documents,audit}`, `/prisma`, `/tests`, `/evals` are fixed by PRD §15 and are treated as given throughout. This document answers only what the PRD leaves open *inside* that structure.

---

## 1. Guarded state machine implementation

**Recommendation: hand-rolled typed transition table. Not XState.**

AC-15(b)'s requirement is unusual and specific: `GuardInput` must *structurally exclude* the advisory deadline fields (`feeNotificationDeadlineDays`, `responseDeadlineDays`) so that a guard referencing one is a **compile error**, while `reviewDueOn` (a pack-lifecycle date, not a matter deadline) is deliberately present. This is a property of TypeScript's structural typing over a hand-authored object type — it is not something any state-machine library's guard API is designed to express. XState v5's guards receive the machine's full `context`/`event` via a unified argument object; narrowing what a *specific* guard can see requires fighting the library's type inference (custom generics, `assertEvent`, per-guard param types) to simulate what a plain object-type omission gives you for free. XState also brings a real cost here for no offsetting benefit: this is a flat 7-state, 9-transition table with no hierarchy, no parallel regions, no actor model, no need for visual tooling — exactly the case where XState's value proposition doesn't apply, and where its API churn (v4→v5 typing rewrite) is added version-pinning risk for a component that has to be provably simple to defend in an audit.

**Shape of the typed `GuardInput` approach:**

```ts
// packages/schemas/src/workflow/guard-input.ts

// Deliberately composed field-by-field, never `Matter` or `RulePack` spread wholesale —
// spreading either type would silently re-admit feeNotificationDeadlineDays /
// responseDeadlineDays the next time someone adds a field to RulePack.constraints.
type GuardInput = Readonly<{
  matterId: string;
  currentStatus: MatterStatus;
  jurisdictionCode: JurisdictionCode;
  currency: CurrencyCode;
  isKnownDisputeOrLitigation: boolean;
  attestationsAddressed: boolean;
  lineCount: number;
  activePack: Readonly<{
    status: RulePack['status'];
    reviewDueOn: ISODate;        // pack lifecycle date — deliberately included (AC-15b)
    appliesTo: ControllerType[];
  }> | null;
  assessment: Readonly<{
    pendingLineCount: number;
    unacknowledgedRequiredFlagIds: string[];
    signedOffAt: ISODateTime | null;
  }> | null;
  actor: Readonly<{ userId: string; role: Role }>;
  // NOTE: no `feeNotificationDeadlineDays`, no `responseDeadlineDays`, no `Matter`/`RulePack`
  // spread. `RulePack['constraints']` (where those two fields live) is never a member of this
  // type or of any type composed into it — referencing one from a guard is TS2339, not a
  // runtime check.
}>;

type GuardResult = { ok: true } | { ok: false; reason: string };

type Transition = {
  from: MatterStatus;
  to: MatterStatus;
  guard: (input: GuardInput) => GuardResult;   // pure
};

const TRANSITIONS: readonly Transition[] = [
  { from: 'DRAFT', to: 'COMPUTING', guard: guardDraftToComputing },
  { from: 'COMPUTING', to: 'LEGAL_REVIEW', guard: guardComputingToLegalReview },
  { from: 'COMPUTING', to: 'DRAFT', guard: guardComputingToDraft },
  { from: 'LEGAL_REVIEW', to: 'INFO_REQUEST', guard: guardLegalReviewToInfoRequest },
  { from: 'INFO_REQUEST', to: 'COMPUTING', guard: guardInfoRequestToComputing },
  { from: 'LEGAL_REVIEW', to: 'COMPUTING', guard: guardLegalReviewRecompute },
  { from: 'LEGAL_REVIEW', to: 'SIGNED_OFF', guard: guardSignOff },
  { from: 'SIGNED_OFF', to: 'CLOSED', guard: guardMarkSent },
  { from: 'SIGNED_OFF', to: 'SUPERSEDED', guard: guardSupersede },
  { from: 'CLOSED', to: 'SUPERSEDED', guard: guardSupersede },
] as const;
```

A unit test asserts every `MatterStatus` value appears as a `from` in at least one row it should (or is a correctly-terminal state), closing the "exhaustiveness" gap a library's type system would otherwise buy you.

---

## 2. Where the state machine lives

**Split it: pure guards + transition table in `packages/schemas`; the DB-touching executor in `apps/web`.**

The guard functions themselves are pure (`GuardInput → GuardResult`, no I/O) and could theoretically live in a new standalone package — but the PRD names six packages and nothing else, and "preserve the package boundaries" is a stated constraint. Rather than adding a seventh package the PRD never anticipated, put `GuardInput`, the transition table, and the guard predicates in `packages/schemas` alongside `MatterStatus` and the rest of the data model. This is a legitimate fit, not a stretch: `packages/schemas` already contains logic, not just types — zod refinements *are* pure validation functions — and a guard predicate is the same shape of thing ("is this input valid for this transition?"). It costs a small blur to the package's stated scope ("types and validators" gains "and transition guards"), mitigated by keeping the guard code in its own `schemas/src/workflow/` subfolder with a distinct barrel export, so it reads as a clearly separated concern even though it ships in the same build unit. It does **not** belong in `packages/engine` — the engine is specifically "the deterministic fee evaluator," a different concern from matter lifecycle, and keeping it out avoids growing engine's public surface for something `assess()` never calls.

The part that *does* need I/O — reading the matter's current row, assembling `GuardInput` from it plus the active pack and assessment, calling the pure guard, and (only if it returns `ok`) writing the new status and emitting the audit event inside one transaction — is not pure and does not belong in `packages/schemas`. It lives in `apps/web`'s route handlers/server actions, which already own the DB session and already import `packages/schemas` and `packages/audit`. This keeps the guarantee "guards are pure and unit-testable in isolation" fully intact (test them with a synthetic `GuardInput`, no DB) while keeping I/O where the rest of the app already puts it.

---

## 3. Rule packs: repo JSON as source of truth, DB as cache

**Two separate mechanisms, not one script:**

1. **Build-time validation (AC-37), independent of any database.** A `packages/rulepacks` script walks every JSON file, runs it through the zod `RulePack` schema plus the business-rule checks that gate `ACTIVE` (§7.3: `reviewedBy`/`reviewedOn`/`reviewDueOn` present, all 21 `categoryRules` present — AC-38, AC-10). Wire this as its own CI job and a pre-commit hook, not just something the app happens to do on boot: a broken pack must fail the build, not fail silently at first deploy.

2. **Deploy-time sync (repo → DB "cache").** A separate, idempotent script (run as a release step — a `prisma db seed`-style hook or a dedicated `packages/rulepacks/src/sync.ts`) reads each validated JSON file, computes a content hash (sha256 of canonicalized JSON) per `(packId, version)`, and upserts into the DB keyed on that pair. Versions are supposed to be immutable once shipped, so treat a hash mismatch on an existing `(packId, version)` as a **hard error, not an overwrite** — silently rewriting an old version's content in the DB would corrupt the meaning of every assessment pinned to it (this is a sharper failure mode than AC-40's "activating a new version must not alter existing assessments," and the sync script should refuse it outright rather than rely on that AC catching it downstream).

3. **Drift detection.** Split pack storage into two logical pieces: a `RulePackContent` row (categoryRules, constraints, citations — everything authored in the JSON) and lifecycle fields (`status`, `reviewedBy`, `reviewedOn`, `activatedAt`) that the app's admin screen (§10.6) is allowed to change directly. Give the application's DB role `UPDATE` only on the lifecycle columns/table, never on content — the sync role is the only writer of content, mirroring the same REVOKE pattern used for the audit table (AC-34). With that split, "drift" becomes structurally near-impossible rather than something you have to detect after the fact: there is no code path in the running app that can write pack content at all. As a cheap secondary check, re-run the hash comparison in CI against a staging DB snapshot so a bypass (e.g., a manual `psql` edit) is caught before it reaches production.

---

## 4. Assessment recompute semantics in Prisma

**Enforce "impossible" with a DB trigger; enforce "the right operation" by giving recompute and supersede disjoint preconditions and no shared write path.**

- Add `Assessment.signedOffAt DateTime?` (null = still mutable). A Postgres `BEFORE UPDATE` trigger on `Assessment` does `RAISE EXCEPTION` whenever `OLD."signedOffAt" IS NOT NULL` — for **any** column, unconditionally. This is what makes a write to a signed-off assessment impossible rather than merely rejected by the API: it holds even against a raw-SQL escape hatch, a future service, or an application bug, the same posture PRD §12.2/AC-34 already takes for the audit table. Keep the app-level check too (AC-33 wants an explicit 409 with a clear message) — the trigger is the actual guarantee, the app check is the UX.

- Expose exactly two operations from one service module, with **mutually exclusive preconditions on `signedOffAt`**, and nothing more general:
  - `recomputeAssessment(assessmentId, newPack)` — requires `signedOffAt IS NULL` (enforced both as a runtime assertion and via Prisma's own `where: { id, signedOffAt: null }` compound clause, which doubles as an optimistic-concurrency check: if the row got signed off between read and write, zero rows match and the update is a no-op the caller must handle as a conflict). Rewrites `rulePackVersion`, `engineVersion`, `computedAt`, replaces the `lines` relation, and resets every line's `disposition` to `PENDING` — **same `id`**.
  - `supersedeAssessment(oldAssessmentId, newAssessmentInput)` — requires `signedOffAt IS NOT NULL` on the old row (throws otherwise). Runs as a `$transaction` that only ever *reads* the old row and *creates* a new one with a fresh id and `supersedesAssessmentId` pointing back at it, then repoints `Matter.currentAssessmentId`. It never calls `.update()` on the old row at all — "retained verbatim" falls out of the fact that no code path touches it, with the trigger as backstop if that ever changes.
  - Do not export a generic `updateAssessment`. The absence of a third, more-permissive function is what stops the two cases from being confused in practice — there is no path that lets a caller pick the wrong one by accident, only two named functions whose preconditions cannot both be satisfied by the same row at the same time.

- `Assessment.supersedesAssessmentId` (nullable self-relation) is the correction chain; the in-place recompute path never grows it, so "how many times was this assessment corrected after sign-off" and "how many times was it recomputed before sign-off" stay cleanly distinguishable from the data model alone.

---

## 5. Personal-data boundary as tests over generated artifacts

**AC-05 (no upload endpoint → 415) and AC-06 (deny-list over field/input names) should both be driven by introspection, not a hand-maintained list of endpoints or forms — so new routes are covered automatically.**

- **AC-05.** Rather than relying on every route handler individually declining `multipart/form-data`, enforce it once: a root `middleware.ts` inspects `Content-Type` for any request under `/api/*` and short-circuits with 415 if it starts with `multipart/`, so the guarantee doesn't depend on each new route "remembering." The test enumerates actual route files at test time (`fast-glob` over `app/api/**/route.ts`) and POSTs a multipart body to every one found — a generated artifact (the filesystem) drives the test, not a list someone has to update when a route is added.

- **AC-06.** Two generated artifacts, both introspected rather than hand-tracked:
  1. **Prisma's DMMF**, not the `schema.prisma` source text — `Prisma.dmmf.datamodel.models[].fields[].name` is what the client actually generated, so it also catches a deny-listed name reintroduced via a `@map` alias or a relation field that the source text might obscure.
  2. **Rendered DOM of every form route** — enumerate `app/**/page.tsx` under the `(hr)` and `(legal)` route groups by glob, render each with Playwright, collect every `input`/`textarea`/`select` `name`/`id` attribute.
  Normalize both sets identically (strip non-alphanumerics, lowercase) and check both against **one** exported deny-list constant defined in `packages/schemas` — the same "single exported constant used by client, server, and tests" pattern the PRD already uses for the banned-words list (AC-32) and the reason stop-list (AC-23). Two enforcement points sharing one constant means they cannot drift from each other, and both being glob-driven means the test suite widens automatically as the schema and UI grow, instead of relying on a developer remembering to add a new field or a new page to a checklist.

---

## 6. Engine/agent isolation boundary

**Layer four cheap, static mechanisms rather than one big one — each catches a different way the boundary could leak:**

1. **dependency-cruiser (or ESLint `import/no-restricted-paths`) rule in CI**, forbidding any import from `packages/engine/**` into `packages/agent/**` (and into `apps/web`, `packages/documents`, `packages/audit`, or any DB/network client). Cheap, fast, PR-time feedback. Catches import-level coupling only — doesn't stop inline I/O that doesn't require importing anything.
2. **A second dependency-cruiser/no-restricted-imports rule** specifically banning `fetch`, Node's `fs`/`net`/`http`, the Prisma client, and any LLM SDK package from `packages/engine/**` — this is what actually enforces "no network, no I/O," since a network call doesn't require importing `packages/agent` to violate the spirit of the boundary.
3. **A targeted ESLint rule (`no-restricted-globals` or custom) banning bare `Date`, `Date.now()`, and `Math.random()` inside `packages/engine/src/**`.** This is the one violation class import-graph tools can't see at all — "reads no clock outside the injected `now`" is a global-usage constraint, not an import constraint, so it needs its own rule.
4. **A one-line CI script asserting `packages/engine/package.json` has zero runtime dependencies beyond `packages/schemas` (plus a pure validation lib like zod if used there too).** Coarse but cheap, and it catches a transitive dependency a human reviewer might miss in a large diff — someone adding `packages/agent` or an HTTP client to engine's manifest fails the build even if they somehow evaded rules 1–2.

Skip a full bundler-graph introspection test (building engine's entrypoint with esbuild and asserting nothing forbidden appears in the resolved output) unless a leak is actually found in practice — it's the most rigorous check but the most expensive to maintain, and rules 1–4 together already cover the overwhelming majority of realistic mistakes at a fraction of the cost.

---

## 7. Build order dependency map

The PRD's five-step build order (schemas → engine → rulepacks → web → agent) is a **safe linear reading of the true dependency graph**, correct for a single coding agent working alone, but not the actual graph. The true graph has two hard serialization points and a wide parallel band between them — this is the shape that should drive phase decomposition if more than one workstream can run at once.

```
┌──────────────────────────────────────────────────────────────────────┐
│  SERIALIZATION POINT #1 — packages/schemas core types (§6.0–§6.4,     │
│  §7.2). Nothing below compiles until MatterStatus, Matter,            │
│  ExpenseLine, RulePack, Assessment, AssessmentLine are frozen.        │
└───────────────────────────────┬──────────────────────────────────────┘
                                 │
          ┌──────────────┬──────┼──────────────┬──────────────┬─────────────────┐
          ▼              ▼      ▼              ▼              ▼                 ▼
   packages/engine  rulepacks:   rulepacks:   packages/       packages/    packages/documents
   (assess(), built  loader +    HK/SG JSON   workflow        audit       (PDF templates
   & unit-tested     validator   authoring    (guards, §1–2   (event      against a fixture
   against hand-     (AC-37)     — LEGAL      above; needs    writer;     Assessment; doesn't
   written fixture   — code,     work, gated  only schemas    needs       need real engine
   packs; needs no   parallel    on named     types)          schemas +   output)
   real pack JSON    to engine   counsel —                    Prisma
   and no real                  the actual
   loader)                      critical path
                                 per PROJECT.md)
          │              │      │
          │              │      │   apps/web: /hr intake screen + /admin rule-pack
          │              │      │   screen shell — needs only schemas + the rulepack
          │              │      │   loader/validator, NOT engine (intake never calls
          │              │      └──▶ assess(); admin's live-validation UI wraps the
          │                          validator directly)
          │
          └──────────────┬───────────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│  SERIALIZATION POINT #2 — engine code AND real HK/SG pack JSON must   │
│  both exist before AC-09's golden-file tests can pass. If pack        │
│  authoring (a legal deliverable) is the slower path, engine           │
│  development should not wait on it — build and test engine against   │
│  fixture packs (PRD §14 already supplies one) and only gate the       │
│  golden-file suite on real content landing.                           │
└───────────────────────────────┬──────────────────────────────────────┘
                                 ▼
                    apps/web: /legal review screen + sign-off flow
                    (§10.3) — genuinely cannot be built or demoed
                    before this point: the review card is a direct
                    rendering of AssessmentLine, which only exists
                    once assess() runs against a real pack.
                                 │
                                 ▼
                    packages/agent (Job 1 has no real technical
                    dependency beyond the category taxonomy in
                    schemas — could be prototyped earlier — but Job
                    2's post-generation validation (AC-28/AC-36)
                    needs a real Assessment to check citations and
                    figures against, and the PRD's "build this last"
                    is a deliberate risk-sequencing choice, not just
                    a dependency artifact. Keep it last regardless.)
```

**What this means for phase decomposition:**
- Phase 1 is a true, unavoidable gate: schemas' core types only.
- The next wave can run as parallel workstreams rather than one sequential phase: engine (against fixtures), the rulepack loader/validator, HK/SG pack authoring (legal, likely the actual long pole — flag it for early kickoff since it doesn't block on any of the code work), the state-machine/workflow module, `packages/audit`, `packages/documents` (against a fixture `Assessment`), and the HR-intake + admin-shell slice of `apps/web`. None of these six items depend on each other's code.
- The second gate — engine code plus real pack JSON converging for AC-09 — is the point to schedule the legal-review screen after, not "after packages/rulepacks" generically; the review screen's real dependency is on `assess()` output shape plus a loadable pack, which is exactly what converges here.
- `packages/agent` stays last regardless of what's technically parallelizable, because the PRD's ordering reflects product risk management (prove the deterministic core, keep the model's surface minimal) rather than a hard technical dependency — don't use the parallel-graph finding as license to pull it forward.

---

## Sources

Findings below are single-pass web search results (confidence: LOW per the seam's unverified-web tier) used only to sanity-check the recommendations above against current library documentation; the recommendations themselves follow from the PRD's own stated constraints (AC-15(b), AC-33, AC-34, AC-05/06, AC-36/37) rather than from these sources.

- [XState v5 TypeScript docs](https://stately.ai/docs/typescript) — confirms typed-guard support via `setup({ guards })` with no documented compile-time field-exclusion mechanism.
- [XState v5 migration guide](https://stately.ai/blog/2024-02-02-migrating-machines-to-xstate-v5) — unified-argument pattern for guards/actions.
- [dependency-cruiser rules reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md) and [FAQ](https://github.com/sverweij/dependency-cruiser/blob/main/doc/faq.md) — forbidden-rule syntax for path-based import bans, monorepo usage.
- [Prisma dataguide — managing privileges with GRANT/REVOKE](https://www.prisma.io/dataguide/postgresql/authentication-and-authorization/managing-privileges) — confirms REVOKE is the standard mechanism for restricting an application role's UPDATE/DELETE on a table; Prisma has no built-in append-only/audit primitive.
- [PostgreSQL trigger functions documentation](https://www.postgresql.org/docs/current/plpgsql-trigger.html) — `BEFORE UPDATE` triggers can `RAISE EXCEPTION` to hard-block a write, vs. returning `NULL` to silently skip it (rejected as the pattern here — a silent skip would look like success to the caller).
