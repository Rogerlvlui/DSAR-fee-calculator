# Phase 1: Schemas Freeze and Walking Skeleton - Context

**Gathered:** 2026-09-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Freeze every core type from PRD §6 and §7.2 so no downstream package has to re-open it, and prove the layers actually connect with a deliberately thin route through each role-scoped area: Postgres-in-Docker with the `dsar_migrator`/`dsar_runtime` split, Prisma, the server-side role guard, and one audit event written and made un-updatable.

**In scope:** SCHEMA-01..07, STATE-01, ACCESS-01, ACCESS-06, ACCESS-08, BOUND-01, BOUND-02, AUDIT-02.

**Not in scope:** any engine logic (`assess()` is Phase 2), any real rule-pack content or loader (Phase 3), the guarded transition executor (Phase 4), the intake form and disclosure shell (Phase 5), the review screen (Phase 6), sign-off and documents (Phase 7), anything touching the LLM (Phase 8).

</domain>

<decisions>
## Implementation Decisions

### Prisma schema scope

- **D-01:** Phase 1 models and migrates **all six core entities** — `Matter`, `ExpenseLine`, `Assessment`, `AssessmentLine`, `RulePackVersion`, `AuditEvent` (plus the `User`/`UserRef` shape the role guard and audit actor need). The database freeze rides along with the type freeze. Phases 2 through 7 add data, routes and behaviour — not tables. This is the strongest reading of Success Criterion 1 ("nothing downstream has to re-open it") and it keeps Phases 2, 3, 4 and 5 — which run concurrently — from colliding on `prisma/schema.prisma` and on migration ordering. — **Reversibility:** one-way — undoing this means rewriting migrations that Phases 2–5 have already built against, across four concurrent workstreams.

- **D-02:** The frozen `RulePack` schema must already carry the **HK flat-fee extension** (PACK-12) at freeze time, as a schema extension that leaves the other eight packs unchanged. Neither Phase 2 nor Phase 3 may re-open the freeze to add it. PROJECT.md records this as the first deliberate RulePack schema change, and wants the outcome (clean or invasive) recorded. — **Reversibility:** one-way — it is a migration plus a change to the pack JSON contract that Phase 3's authored HK pack depends on.

- **D-03:** Accepted trade-off, stated explicitly: `Assessment` and `AssessmentLine` are committed to before `assess()` has ever run. The mitigation is D-06's additive-only rule plus the reference fixture in PRD §14, which fully specifies the expected `Assessment` field-by-field (`claimedTotal`, `draftBaseline`, `disallowedTotal`, `flaggedTotal`, `restingOnUnverifiedRules`, `finalAmount`) before any code exists.

### Walking-skeleton routes

- **D-04:** The skeleton is **one read per role area plus one write that audits**:
  - `/hr/matters`, `/legal/queue`, `/admin/rulepacks` each read through Prisma as `dsar_runtime`. Empty result sets are a passing outcome — the point is that the query executes under the restricted role.
  - One POST creates a `DRAFT` matter and emits a `MATTER_CREATED` audit event.

  This proves guard → Prisma → runtime role → audit write end to end over real HTTP, rather than proving the guard and the database separately. The three list surfaces are Phase 3/5/6 deliverables anyway (`/hr/matters` is INTAKE-09's matter list, `/legal/queue` is NAV-01's reviewer queue, `/admin/rulepacks` is PACK-07's admin screen), so part of the skeleton survives rather than being discarded. — **Reversibility:** reversible.

- **D-05:** Skeleton scope discipline holds regardless: the POST is a bare typed endpoint, **not** Phase 5's intake form. No disclosure shell, no capability statement, no status strip, no repeater, no autosave — those are DISC-01..03 and INTAKE-01..09, and belong to Phase 5. Phase 5 is expected to rewrite this POST against the real form and its validation.

### Database-level invariants

- **D-06:** Phase 1 writes **every DB-level invariant derivable from a frozen type**, on the principle that if a rule follows from the freeze it lands with the freeze:
  - Two roles, with `UPDATE`/`DELETE`/`TRUNCATE` revoked from `dsar_runtime` on the audit table (AUDIT-02 / AC-34), in hand-edited migration SQL.
  - `MatterStatus` as a real Postgres enum — STATE-01's "no other status value exists anywhere in the system" enforced at the database, not only in zod.
  - A check constraint that a `Matter`'s `currency` equals `JURISDICTION_CURRENCY[jurisdictionCode]` — AC-42's second enforcement layer, alongside intake validation.
  - No ORM-level cascade deletes anywhere near audit or signed-off records (PRD §15).
  — **Reversibility:** one-way — each is a migration; loosening a constraint later needs a new migration and an explanation of why the invariant stopped holding.

- **D-07:** The **`SIGNED_OFF` immutability trigger stays in Phase 4**, not Phase 1. It needs the assessment lifecycle to be meaningful, and writing it here would ship it untested for three phases. STATE-04 and AC-33 are Phase 4's to deliver.

- **D-08:** The runtime must **fail fast on boot** if `SELECT current_user` returns `dsar_migrator` — the split is silently unenforced otherwise, and AC-34 would pass in principle while being false in practice. Separate env vars for the two connection strings.

### The freeze is additive-only

- **D-09:** After Phase 1 ships, later phases may **add optional fields and new tables. They may not rename, retype, or remove a frozen field.** Any breaking change escalates to the product owner as an explicit decision before that phase continues — it does not get made inside a phase. This exists because Phases 2, 3, 4 and 5 run concurrently against one `packages/schemas` and one `prisma/schema.prisma`; a silent retype in one invalidates the other three's in-flight work and is not caught until merge. — **Reversibility:** reversible as a policy, but it is the guardrail protecting D-01's one-way commitment.

- **D-10:** The accepted cost of D-09 is named: a genuinely wrong early type gets worked around rather than fixed. The escape valve is escalation, not a workaround chosen quietly. PRD §16 Phase 2 already says an engine-forcing schema change means the schema was wrong "and that is worth knowing early" — an escalation under D-09 is that signal firing, and the outcome belongs in PROJECT.md's Key Decisions table.

### Claude's Discretion

The user skipped three areas. They are Claude's to decide, grounded in the PRD and the stack research already in `.claude/CLAUDE.md`. Research and planning should resolve them without returning to the user unless something genuinely contradicts a locked decision:

- **Zod authoring shape.** Zod-first (`z.infer`) vs types-first with validators alongside; where `.parse()` actually runs given the engine's 100ms/50-line budget (AC-07 performance target) — the stack research already notes validation belongs at the boundary, not inside the hot `assess()` path. Note the specific awkwardness: PRD §6.0's `Condition.field: keyof ExpenseLine | keyof Matter` has no clean zod expression — either enumerate a literal union of permitted field names or loosen it, and the choice should be recorded.
- **Stubbed identity ergonomics.** ACCESS-06 requires a swappable provider seeded with test users and no guard depending on which provider is in use. How a developer selects who they are (env var, dev-only role switcher, seeded fake login page) is open, but it shapes every Playwright test and every demo from Phase 5 onward, so pick deliberately and record it.
- **Standing test harnesses.** Success Criterion 4 requires the AC-05 (multipart → 415) and AC-06 (deny-list) tests to **enumerate generated artifacts** so routes and fields added in Phases 3–8 are covered without anyone editing the test. Same for ACCESS-08's every-endpoint × every-role obligation, which the roadmap calls a standing obligation every later phase inherits. Filesystem glob over `app/**/route.ts`, a central route registry that fails CI when a route is unregistered, or a crawl — choose one and make the failure mode loud.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The specification (source of truth)
- `docs/PRD-dsar-fee-agent.md` — 1,005 lines; source of truth for everything. Where it and any other document disagree, the PRD wins.
- `docs/PRD-dsar-fee-agent.md` §0 — "How to build from this document": the binding build order and the five non-negotiables. These win over any other inference when the PRD is ambiguous.
- `docs/PRD-dsar-fee-agent.md` §5 — Workflow and state machine; the seven `MatterStatus` values and the guard table (STATE-01 here; STATE-02..05 in Phase 4).
- `docs/PRD-dsar-fee-agent.md` §6 — Data model. §6.0 declares the shared primitives (`Minor`, `ULID`, `JurisdictionCode`, `CurrencyCode`, `JURISDICTION_CURRENCY`, `Role`, `StaffGrade`, `Condition`, `FlagReason*`, `MatterFlag*`, `AuditEventType`); §6.1–§6.5 the six core entities. This is what Phase 1 transcribes into zod. **The freeze is transcription, not design.**
- `docs/PRD-dsar-fee-agent.md` §7.2 — RulePack schema, including everything the freeze must carry before Phase 3 authors against it.
- `docs/PRD-dsar-fee-agent.md` §12.1 — The personal-data boundary. Sources BOUND-01 (no upload, multipart → 415) and BOUND-02 (deny-list over Prisma field names and rendered form inputs), and the explicit instruction to reject any later suggestion to add a requestor-name field.
- `docs/PRD-dsar-fee-agent.md` §13 — Acceptance criteria. Phase 1 touches AC-05, AC-06, AC-07a, AC-07b, AC-15b, AC-34, AC-42.
- `docs/PRD-dsar-fee-agent.md` §14 — Test strategy, including **the reference fixture, which §14 says to build first**. §10.3 and Annex A are both drawn from it, and it pins the expected `Assessment` shape field-by-field — directly relevant to D-03.
- `docs/PRD-dsar-fee-agent.md` §15 — Technical shape: the package layout that must be preserved even if other structural choices change.

### Project planning
- `.planning/PROJECT.md` — Constraints and the Key Decisions table. Relevant here: Postgres-in-Docker over SQLite (AC-34 needs a real GRANT), identity stubbed but authorisation real, horizontal layers with a throwaway-tolerant Phase 1 skeleton, HK flat fee as itemise-then-choose, and the standing instruction to record the outcome of the flat-fee schema change (D-02).
- `.planning/REQUIREMENTS.md` — The 14 requirements in this phase, each traced to a PRD section or AC.
- `.planning/ROADMAP.md` §"Phase 1" — Goal, the five success criteria, and the scope-discipline note naming ACCESS-08 as a standing obligation every later phase inherits.
- `.claude/CLAUDE.md` — The full stack research. Already settles: pnpm 12 workspaces (no Turborepo/Nx yet), TypeScript 5.9, Next.js 16 App Router, Postgres 17/18 in Docker, Prisma 7 (deliberately **not** 8), zod 4 with native `z.toJSONSchema()` (**not** `zod-to-json-schema`), Tailwind 4, Vitest 5, Playwright 1.63, `fast-check` 4 for AC-07(b)'s 10,000-run invariant, `dependency-cruiser` as the CI gate for engine purity, `@testcontainers/postgresql` for the AC-34 GRANT test, Route Handlers over Server Actions, and the Data Access Layer `requireRole()` pattern rather than `middleware.ts`. Do not re-litigate these.
- `CLAUDE.md` (repo root) — Build order, the five non-negotiables, and the NS-1..NS-10 out-of-scope list.

### UI (for later phases; noted so it is not lost)
- `docs/dsar-fee-agent-mockup.html` — The Annex A mockup the PRD names. Match its information hierarchy, not its styling. Not a Phase 1 deliverable.
- `docs/dsar-fee-agent-mockup-simplified.html` — Interactive walkthrough of the legal-review flow. Secondary to Annex A where they disagree, and a self-extracting base64 bundle that cannot be read or diffed as source.

</canonical_refs>

<code_context>
## Existing Code Insights

**There is no application code.** No `package.json`, no build tooling, no source tree, no `.planning/codebase/` maps. The repository contains the PRD, two HTML mockups, the README, and `.planning/`. Phase 1 scaffolds everything from zero.

### Reusable Assets
- None in code. The reusable asset is the **specification itself**: PRD §6 and §7.2 give every field of every type, so the freeze is transcription. The PRD §14 reference fixture gives a fully worked expected `Assessment` to shape the schema against before any engine exists.

### Established Patterns
- None in code. The patterns are **inherited from the stack research** in `.claude/CLAUDE.md` and from PRD §15's package layout — both treated as locked.

### Integration Points
- `prisma/schema.prisma` and `prisma/migrations/` — the single file four concurrent phases share, which is why D-09's additive-only rule exists.
- `packages/schemas` — every other package imports from here and nothing compiles before it.
- The `requireRole()` data-access boundary and the audit writer (`packages/audit`) are the two seams Phases 3–8 all connect through. Phase 1 establishes both.

</code_context>

<specifics>
## Specific Ideas

- **"Empty is a pass."** The three skeleton reads return empty result sets in Phase 1 and that is a successful outcome — what is being proven is that the query executes under the `dsar_runtime` role through the guard, not that there is data to show.
- **"If a rule is derivable from a frozen type, it lands with the freeze."** The stated principle behind D-06's choice of DB-level invariants.
- **Fail fast on `current_user`.** The migrator/runtime split is the kind of thing that is silently unenforced if the app boots with the wrong connection string "because it's simpler" — hence D-08's startup assertion rather than trusting configuration.
- **The escalation is the signal.** D-10: when the additive-only rule forces an escalation, that escalation *is* PRD §16's "the schema was wrong and that is worth knowing early" firing. It should be recorded in PROJECT.md's Key Decisions, not quietly worked around.

</specifics>

<deferred>
## Deferred Ideas

- **`SIGNED_OFF` immutability trigger** (STATE-04, AC-33) — deliberately left to Phase 4, where the assessment lifecycle makes it testable. Phase 1 writes the tables it will act on, not the trigger.
- **Disclosure shell, capability statement, status strip** (DISC-01..03) — Phase 5. The Phase 1 routes carry none of it.
- **Real intake form, validation and autosave** (INTAKE-01..09) — Phase 5. Phase 1's POST is a bare typed endpoint that Phase 5 is expected to rewrite.
- **Rule-pack loader, validator and authored content** (PACK-01..12) — Phase 3. Phase 1 freezes the `RulePack` schema including the HK flat-fee extension; it authors no pack content.
- **Corporate SSO / IdP group role assignment** — out of scope for the whole milestone per PROJECT.md. Identity is stubbed; authorisation is real.

</deferred>

---

*Phase: 1-Schemas Freeze and Walking Skeleton*
*Context gathered: 2026-09-13*
