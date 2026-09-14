# Phase 1: Schemas Freeze and Walking Skeleton - Research

**Researched:** 2026-09-14
**Domain:** Monorepo scaffold — zod 4 schema freeze, Prisma 7 two-role Postgres, Next.js 16 App Router role guards, dependency-cruiser purity boundary, Vitest 5 workspace
**Confidence:** MEDIUM (HIGH on version-pinning facts verified this session against the npm registry; MEDIUM on library mechanics drawn from official docs via search; LOW/ASSUMED on hand-authored design patterns — GuardInput shape, Condition-field enum, route registry — that are this agent's synthesis, not a citable external source)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Prisma schema scope**
- **D-01:** Phase 1 models and migrates **all six core entities** — `Matter`, `ExpenseLine`, `Assessment`, `AssessmentLine`, `RulePackVersion`, `AuditEvent` (plus the `User`/`UserRef` shape the role guard and audit actor need). The database freeze rides along with the type freeze. Phases 2–7 add data, routes and behaviour — not tables. Reversibility: one-way.
- **D-02:** The frozen `RulePack` schema must already carry the **HK flat-fee extension** (PACK-12) at freeze time, as a schema extension that leaves the other eight packs unchanged. Neither Phase 2 nor Phase 3 may re-open the freeze to add it. Reversibility: one-way.
- **D-03:** Accepted trade-off: `Assessment` and `AssessmentLine` are committed to before `assess()` has ever run. Mitigated by D-06's additive-only rule plus the PRD §14 reference fixture.

**Walking-skeleton routes**
- **D-04:** The skeleton is **one read per role area plus one write that audits**: `/hr/matters`, `/legal/queue`, `/admin/rulepacks` each read through Prisma as `dsar_runtime` (empty result sets are a passing outcome). One POST creates a `DRAFT` matter and emits a `MATTER_CREATED` audit event. Reversibility: reversible.
- **D-05:** The POST is a bare typed endpoint, **not** Phase 5's intake form. No disclosure shell, no capability statement, no status strip, no repeater, no autosave.

**Database-level invariants**
- **D-06:** Phase 1 writes **every DB-level invariant derivable from a frozen type**: two roles with `UPDATE`/`DELETE`/`TRUNCATE` revoked from `dsar_runtime` on the audit table (AUDIT-02/AC-34) in hand-edited migration SQL; `MatterStatus` as a real Postgres enum; a check constraint that `Matter.currency` equals `JURISDICTION_CURRENCY[jurisdictionCode]` (AC-42); no ORM-level cascade deletes near audit or signed-off records. Reversibility: one-way.
- **D-07:** The `SIGNED_OFF` immutability trigger stays in **Phase 4**, not Phase 1.
- **D-08:** The runtime must **fail fast on boot** if `SELECT current_user` returns `dsar_migrator`. Separate env vars for the two connection strings.

**The freeze is additive-only**
- **D-09:** After Phase 1 ships, later phases may add optional fields and new tables. They may **not** rename, retype, or remove a frozen field. Any breaking change escalates to the product owner before that phase continues.
- **D-10:** The accepted cost of D-09 is named: a genuinely wrong early type gets worked around rather than fixed. The escape valve is escalation, recorded in PROJECT.md's Key Decisions table.

### Claude's Discretion

- **Zod authoring shape.** Zod-first (`z.infer`) vs types-first with validators alongside; where `.parse()` runs given the engine's 100ms/50-line budget. `Condition.field: keyof ExpenseLine | keyof Matter` has no clean zod expression — enumerate a literal union or loosen it, and record the choice.
- **Stubbed identity ergonomics.** ACCESS-06 requires a swappable provider seeded with test users, no guard depending on which provider is in use. Selection mechanism (env var, dev-only role switcher, seeded fake login page) is open but shapes every Playwright test from Phase 5 onward — pick deliberately.
- **Standing test harnesses.** AC-05/AC-06/ACCESS-08 tests must enumerate generated artifacts so routes and fields added in Phases 3–8 are covered without anyone editing the test. Filesystem glob, central route registry, or a crawl — choose one and make the failure mode loud.

### Deferred Ideas (OUT OF SCOPE)

- `SIGNED_OFF` immutability trigger (STATE-04, AC-33) — Phase 4.
- Disclosure shell, capability statement, status strip (DISC-01..03) — Phase 5.
- Real intake form, validation, autosave (INTAKE-01..09) — Phase 5.
- Rule-pack loader, validator, authored content (PACK-01..12) — Phase 3.
- Corporate SSO / IdP group role assignment — out of scope for the whole milestone.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCHEMA-01 | Every core type is a zod schema with inferred type (§6, §7.2) | zod-first authoring pattern (Architecture Patterns §1), field-by-field PRD transcription table |
| SCHEMA-02 | Branded `Minor` integer type; lint bans bare `number` for money-named identifiers in `packages/engine`/`packages/schemas` | `z.number().int().brand<'Minor'>()` pattern; ESLint `no-restricted-syntax` selector design (Don't Hand-Roll + Code Examples) |
| SCHEMA-03 | `MINOR_UNIT_DECIMALS` map, currency-aware formatting for JPY/KRW/VND (0dp) vs SGD/HKD (2dp) | Explicit map, not `Intl` defaults — see Common Pitfalls #6 |
| SCHEMA-04 | `JURISDICTION_CURRENCY` map, matter currency must equal jurisdiction's | Transcription from PRD §6.0; DB check constraint mirrors it (D-06) |
| SCHEMA-05 | JSON Schema generated from zod for the LLM boundary | `z.toJSONSchema()` native method (Code Examples) |
| SCHEMA-06 | `GuardInput` structurally excludes advisory deadline fields — compile error if a guard reaches for one | Literal hand-authored type, not `Omit<>` derivation (Architecture Patterns §3) |
| SCHEMA-07 | 10,000-run property test asserts every `Assessment` money field is an integer | `fast-check` arbitraries over `ExpenseLine`/`RulePack` (Validation Architecture) |
| STATE-01 | `MatterStatus` closed seven-value set, no other value exists anywhere | zod `z.enum([...])` + Postgres native enum (D-06) |
| ACCESS-01 | Role-scoped routes `/hr/*`, `/legal/*`, `/admin/*`, server-side authorisation | Data Access Layer `requireRole()` pattern (already locked in `.claude/CLAUDE.md`); route registry cross-check |
| ACCESS-06 | Swappable identity provider seeded with test users, no guard depends on which is active | Cookie/header-based `getSession()` seam (Architecture Patterns §6) |
| ACCESS-08 | Every endpoint tested against every role, asserting on bodies | Central route registry + glob cross-check, standing obligation (Validation Architecture) |
| BOUND-01 | No upload endpoint; multipart POST to any route returns 415 | Route-handler factory intercepting `content-type`; glob-driven standing test (Architecture Patterns §5, Code Examples) |
| BOUND-02 | No Prisma field / rendered form input matches deny-list | `@prisma/internals.getDMMF()` reading `schema.prisma` directly (Common Pitfalls #1 — bypasses the client-engine DMMF simplification); canary-fixture test for the (currently form-less) DOM half |
| AUDIT-02 | `dsar_runtime` has no UPDATE/DELETE/TRUNCATE on audit table; enforced at the database | Two-role Postgres migration + `@testcontainers/postgresql` falsification test (Architecture Patterns §4) |

</phase_requirements>

## Summary

Phase 1 is a transcription-plus-plumbing phase: every type in PRD §6/§7.2 becomes a zod schema (the freeze), and a deliberately thin route proves Postgres-in-Docker (two roles), Prisma, the server-side role guard, and the audit writer connect end to end. Almost nothing here is a design decision this agent gets to make freely — the PRD specifies every field, and `.claude/CLAUDE.md` has already locked the stack (pnpm workspaces, TypeScript, Next.js 16, Postgres, Prisma 7, zod 4, Vitest 5, Playwright, fast-check, dependency-cruiser, testcontainers, Route Handlers + DAL). This research is about **mechanics**: the exact zod 4 API surface for branding and JSON Schema, how to hand-edit a Prisma migration to create a second, restricted Postgres role, how to make the AC-05/AC-06/ACCESS-08 "standing obligation" tests self-extending so nobody has to remember to update them in Phases 3–8, and — the highest-value correction this research turned up — that Prisma 7's Rust-free default client simplifies the runtime `Prisma.dmmf`, so BOUND-02's "every Prisma field name" test must read the schema directly via `@prisma/internals.getDMMF()`, not the generated client's `Prisma.dmmf`.

Two findings materially change what `.claude/CLAUDE.md` assumed and must be corrected before scaffolding starts. First, **TypeScript's `latest` npm tag now resolves to `7.0.2`, a new Go-based compiler rewrite** — but `typescript-eslint@8.70.0` (the only current major, and the one that gates the AC-07a lint rule) declares `peerDependencies.typescript: ">=4.8.4 <6.1.0"` and does not support it. Installing `typescript@latest` breaks the toolchain immediately. Pin explicitly to the `6.0.x` line (`6.0.3` at time of writing), not `5.9.x` (superseded) and not `latest`/`7.x` (unsupported by the lint tooling this phase depends on). Second, **the `prisma` CLI package's `latest` dist-tag is `8.0.0-rc.15`** — an unreleased major — while the last stable 7.x is tagged `prev` (`7.10.0`). `@prisma/client@latest` is correctly `7.10.0`. Both the CLI and the client package must be pinned to the exact `7.10.0` version string in `package.json`, never `^7` or `latest`, or a routine `pnpm install` after this phase ships could silently pull Prisma 8.

**Primary recommendation:** Author schemas zod-first (`z.infer`, not types-first with validators bolted on); pin `typescript@6.0.3` and `prisma@7.10.0`/`@prisma/client@7.10.0` explicitly; read Prisma's field names for BOUND-02 via `@prisma/internals.getDMMF()` against `schema.prisma` directly, not the runtime client; drive the AC-05/AC-06/ACCESS-08 standing tests off a filesystem glob over `apps/web/app/**/route.ts` cross-checked against a hand-maintained route registry that fails CI when the two disagree; and confirm Docker availability before starting any plan that touches Postgres — it was not found in this research environment and there is no fallback (SQLite is explicitly excluded by PROJECT.md).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Core type definitions & validation (zod schemas) | API/Backend (`packages/schemas`, shared library) | — | Consumed by every other tier; not itself a runtime service |
| Money branding (`Minor`) and currency-aware formatting | API/Backend (`packages/schemas`) | Frontend Server (SSR renders formatted amounts) | Validation/formatting must be identical wherever money is displayed or computed — a single source of truth prevents drift |
| Role-scoped route authorisation (`/hr/*`, `/legal/*`, `/admin/*`) | API/Backend (Route Handlers + Data Access Layer) | — | PRD non-negotiable #2 requires server-side enforcement; Next.js `middleware.ts` is explicitly rejected (CVE-2025-29927-class bypass risk, already noted in `.claude/CLAUDE.md`) |
| Identity resolution (stubbed provider) | Frontend Server (SSR reads cookie/header) | API/Backend (Route Handlers call the same `getSession()`) | Must be one seam both server components and route handlers call — never duplicated logic per tier |
| Postgres role separation (`dsar_migrator` / `dsar_runtime`) | Database/Storage | API/Backend (boot assertion reads `current_user`) | The GRANT/REVOKE boundary is meaningless unless enforced at the database; the app-side assertion is a second, weaker check that catches misconfiguration early |
| Audit event writing | Database/Storage (append-only table, no UPDATE/DELETE grant) | API/Backend (`packages/audit` writer) | AUDIT-02 requires the guarantee to hold even if application code is compromised — DB-level revoke, not application discipline |
| JSON Schema generation for the LLM boundary | API/Backend (`packages/schemas`, build-time artifact) | — | Consumed by `packages/agent` in Phase 8; Phase 1 only generates and freezes the shape |
| Route/field enumeration for standing tests (AC-05, AC-06, ACCESS-08) | CI/Test tooling (cross-cutting, not a runtime tier) | — | Must run against the same filesystem/DMMF artifacts every later phase produces, without a human remembering to update a list |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| TypeScript | **6.0.3** (pin exact, not `^5.9` and not `latest`) | Language, everywhere | `.claude/CLAUDE.md` locked "5.9.x", which is now stale. `npm view typescript version` returns `7.0.2` under `latest` [VERIFIED: npm registry, this session] — a new Go-based compiler rewrite. `typescript-eslint@8.70.0`'s `peerDependencies.typescript` is `">=4.8.4 <6.1.0"` [VERIFIED: `npm view typescript-eslint peerDependencies`, this session] — it does not support 7.x. `6.0.3` is the newest release inside that supported range. **This is a required correction to the locked stack research, not a re-litigation of the choice to use TypeScript** — flagged in Assumptions Log. |
| zod | **4.6.5** | Schemas, validation, JSON Schema generation | Confirmed current [VERIFIED: `npm view zod version`, this session]. Native `.brand()`, `.toJSONSchema()`, `z.iso.date()`/`z.iso.datetime()`, `z.ulid()`, `z.partialRecord()` all present in 4.x [CITED: zod.dev/api, zod.dev/json-schema, zod.dev/v4/changelog]. |
| Next.js | **16.3.5** (App Router) | `apps/web` | Confirmed current [VERIFIED: `npm view next version`, this session]. `engines.node >= 20.9.0` [VERIFIED: `npm view next@16.3.5 engines`]. Peer range `react`/`react-dom`: `^19.0.0` [VERIFIED: `npm view next@16.3.5 peerDependencies`]. |
| React / React DOM | **19.3.0** | UI runtime | Matches Next 16's peer range [VERIFIED: npm registry, this session]. |
| Postgres | 17.x or 18.x (Docker) | Primary datastore | Locked in `.claude/CLAUDE.md`; not re-researched. Two-role GRANT/REVOKE pattern (D-06) is standard SQL, unaffected by 17 vs 18 choice. |
| Prisma / `@prisma/client` | **7.10.0** exact pin (both packages) | ORM / migrations | `prisma`'s `latest` dist-tag is `8.0.0-rc.15`; the last stable 7.x is dist-tagged `prev` = `7.10.0` [VERIFIED: `npm view prisma dist-tags`, this session]. `@prisma/client`'s `latest` is correctly `7.10.0` [VERIFIED: `npm view @prisma/client dist-tags`, this session]. **Pin the exact version string in `package.json` (`"7.10.0"`, not `"^7.10.0"` or `"latest"`)** — a caret range would happily jump to `8.x` the day it stabilizes. Prisma 7 defaults to the Rust-free `prisma-client` generator (`engineType: "client"`), which has a load-bearing consequence for BOUND-02 — see Common Pitfalls #1. |
| Tailwind CSS | 4.3.3 | `apps/web` styling | Confirmed current [VERIFIED: `npm view tailwindcss version`, this session]. Not exercised by Phase 1's bare routes but installed now per package layout. |
| Vitest | **5.0.0** | Unit/integration test runner | Confirmed current [VERIFIED: `npm view vitest version`, this session]. Monorepo config uses **`test.projects`** in a single root `vitest.config.ts` — the separate `vitest.workspace.ts` file form is deprecated since 3.2 [CITED: vitest.dev/guide/projects]. |
| Playwright | 1.63.0 | E2E (`/tests/e2e`) | Confirmed current [VERIFIED: `npm view playwright version`, this session]. Not exercised until Phase 5+ but scaffold now. |
| pnpm | **12.4.1** via Corepack | Package manager / workspaces | Confirmed current [VERIFIED: `npm view pnpm version` and `corepack pnpm --version`, this session — Corepack 0.35.0 ships with Node 24 and resolves pnpm 12.4.1 without a separate global install]. |
| ESLint (flat config) | **10.10.0** | Linting, hosts AC-07a's custom rule | Confirmed current [VERIFIED: `npm view eslint version`, this session]. `typescript-eslint@8.70.0` is the umbrella package (replaces `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser` as separate installs) [VERIFIED: `npm view typescript-eslint version`, this session]. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fast-check` | 4.10.0 [VERIFIED: npm registry] | Property-based testing | SCHEMA-07's 10,000-run integer invariant. Build a `fc.record`-based arbitrary for `ExpenseLine` and a minimal `RulePack`, then assert `Number.isInteger()` over every money field of the returned `Assessment`. Phase 1 only needs the arbitraries and the harness in place — the assertion itself runs meaningfully once `packages/engine` exists in Phase 2; Phase 1's job is to prove the money fields on the hand-committed `Assessment`/`AssessmentLine` schemas are branded `Minor` and therefore typecheck as integers. |
| `@fast-check/vitest` | 0.5.0 [VERIFIED: npm registry] | fast-check + Vitest ergonomics | Optional `it.prop` sugar; not required for SCHEMA-07 itself. |
| `dependency-cruiser` | 18.3.0 [VERIFIED: npm registry] | Enforce `packages/engine` (and, per SCHEMA-01, effectively `packages/schemas`) purity | CI-gate step, independent of ESLint — see Don't Hand-Roll and Code Examples. |
| `@testcontainers/postgresql` / `testcontainers` | 12.1.0 (both) [VERIFIED: npm registry] | Real-Postgres integration test for AC-34 | The only way to prove `dsar_runtime` actually fails at the database — cannot be done against SQLite or a mocked client. |
| `@prisma/internals` | matches installed `prisma` version (`7.10.0`) | Read full DMMF directly from `schema.prisma` | **Required**, not optional, for BOUND-02. See Common Pitfalls #1. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Route Handlers + DAL `requireRole()` | Server Actions | Already argued against in `.claude/CLAUDE.md` §8 — Server Actions have no stable HTTP contract to assert AC-01/AC-16 against, and their "any `use server` export is reachable" footgun is the same class of risk as middleware-as-boundary. Not re-litigated here. |
| Filesystem glob over `app/**/route.ts` | A hand-maintained list of routes | A hand-maintained list silently rots the moment Phase 3/5 add a route and forget to update it — the whole point of ACCESS-08 as a "standing obligation." Recommend glob **cross-checked against** a registry (Architecture Patterns §5), not glob alone or registry alone. |
| `@prisma/internals.getDMMF()` reading `schema.prisma` | Runtime `Prisma.dmmf` from the generated client | Prisma 7's default Rust-free `engineType: "client"` returns a "drastically simplified" DMMF at runtime missing per-field metadata [CITED: github.com/prisma/prisma issue #28348]. Reading the schema file directly sidesteps this entirely and is also faster to test (no client instantiation needed). |

**Installation:**
```bash
corepack enable
corepack use pnpm@12.4.1
pnpm init -w
pnpm add -D typescript@6.0.3 eslint@10.10.0 typescript-eslint@8.70.0 \
  vitest@5.0.0 @vitest/coverage-v8 playwright@1.63.0 \
  fast-check@4.10.0 @fast-check/vitest@0.5.0 \
  dependency-cruiser@18.3.0 \
  testcontainers@12.1.0 @testcontainers/postgresql@12.1.0
pnpm add zod@4.6.5
pnpm add prisma@7.10.0 @prisma/client@7.10.0 @prisma/internals@7.10.0
pnpm add next@16.3.5 react@19.3.0 react-dom@19.3.0
pnpm add -D tailwindcss@4.3.3
```

**Version verification:** All version strings above were checked with `npm view <package> version` and, where the `latest` dist-tag was suspect (TypeScript, Prisma), with `npm view <package> dist-tags` on 2026-09-14. Re-run these commands at actual scaffold time — this table has a short shelf life on the TypeScript/Prisma major-version fronts specifically, since both are mid-transition (TS 7's Go rewrite, Prisma 8's imminent GA).

## Package Legitimacy Audit

Ran `gsd_run query package-legitimacy check --ecosystem npm` [VERIFIED: package-legitimacy seam, this session] against every Phase-1 package. Every package below is a package **already named in `.claude/CLAUDE.md`'s prior, already-completed stack research** — per the package-name provenance rule, that means the names themselves are `[ASSUMED]` (WebSearch/training-data provenance), regardless of what the registry check returns. The registry check below confirms *existence and non-malicious signals*, not the wisdom of the choice (already locked).

| Package | Registry | Age (latest publish) | Weekly Downloads | Source Repo | Verdict | Disposition |
|---------|----------|----|----|----|---------|-------------|
| zod | npm | 2026-09-13 | 209M | github.com/colinhacks/zod | SUS ("too-new") | **Approved — false positive.** 209M weekly downloads and the canonical repo; "too-new" fires on the *latest patch's* publish date, not package age. No `checkpoint:human-verify` warranted. |
| prisma | npm | 2026-09-14 | 12.7M | github.com/prisma/prisma-cli | SUS ("too-new") | Same false-positive pattern. Approved, with the separate version-pin warning above (do not install `latest`). |
| @prisma/client | npm | 2026-08-25 | 12.2M | github.com/prisma/prisma | SUS ("too-new") | Approved, same reasoning. |
| next | npm | 2026-09-11 | 43.4M | github.com/vercel/next.js | SUS ("too-new") | Approved. |
| react / react-dom | npm | 2026-09-09 | 128M / 121M | github.com/react/react | SUS ("too-new") | Approved. |
| vitest / @vitest/coverage-v8 | npm | 2026-09-03 | 77M / 29M | github.com/vitest-dev/vitest | SUS ("too-new") | Approved. |
| playwright | npm | 2026-09-04 | 69M | github.com/microsoft/playwright | SUS ("too-new") | Approved. |
| fast-check / @fast-check/vitest | npm | 2026-09-11 | 28M / 0.27M | github.com/dubzzz/fast-check | SUS ("too-new") | Approved. |
| dependency-cruiser | npm | 2026-09-13 | 2.8M | github.com/sverweij/dependency-cruiser | SUS ("too-new") | Approved. |
| eslint | npm | 2026-09-04 | 114M | github.com/eslint/eslint | SUS ("too-new") | Approved. |
| typescript-eslint | npm | 2026-09-07 | 62M | github.com/typescript-eslint/typescript-eslint | SUS ("too-new") | Approved. |
| @testcontainers/postgresql / testcontainers | npm | 2026-08-04 | 2.5M / 4.7M | github.com/testcontainers/testcontainers-node | **OK** | Approved. |
| tailwindcss | npm | 2026-07-16 | 92.7M | github.com/tailwindlabs/tailwindcss | **OK** | Approved. |
| pino | npm | 2026-02-09 | 36.3M | github.com/pinojs/pino | **OK** | Approved — not needed until routes emit structured logs beyond audit events; install now if the route-handler factory (Architecture Patterns §5) wants request logging. |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** all "SUS" verdicts above are attributable to the legitimacy check's "too-new" heuristic keying off the *latest patch's publish date* rather than the package's founding date — every one of these is a multi-year-old, top-tier-download package with a canonical, matching GitHub repository. None requires a `checkpoint:human-verify` gate before install; the planner should not insert one for these specifically. If a genuinely new/obscure package is proposed in a later phase, apply the checkpoint there.

## Architecture Patterns

### System Architecture Diagram

```
                        ┌──────────────────────────────┐
                        │   Browser (seeded test user)  │
                        └───────────────┬───────────────┘
                                        │ HTTP (cookie/header carries
                                        │ stub identity — ACCESS-06)
                                        ▼
        ┌───────────────────────────────────────────────────────────┐
        │  Next.js 16 App Router — apps/web                          │
        │                                                             │
        │  /hr/matters   /legal/queue   /admin/rulepacks  (Server     │
        │   Components — render only after guard passes)              │
        │                                                             │
        │  /app/api/matters  (POST — Route Handler)                   │
        │      │                                                      │
        │      ▼                                                      │
        │  createRouteHandler({ roles, handler })  ◄── every route    │
        │      │        │                              built through  │
        │      │        └─ 1. content-type check → 415 (BOUND-01)     │
        │      │        └─ 2. requireRole(session, roles) → 403       │
        │      │           (ACCESS-01, Data Access Layer — not         │
        │      │            middleware.ts)                            │
        │      ▼                                                      │
        │  getSession(request) ── stub identity provider (ACCESS-06)  │
        └──────────────────────┬──────────────────────────────────────┘
                                │ Prisma Client, connected as
                                │ RUNTIME_DATABASE_URL (dsar_runtime)
                                ▼
        ┌───────────────────────────────────────────────────────────┐
        │  Postgres (Docker)                                          │
        │                                                             │
        │   dsar_runtime role:                                        │
        │     SELECT/INSERT on Matter, ExpenseLine, Assessment,       │
        │     AssessmentLine, RulePackVersion                         │
        │     INSERT-only on AuditEvent — UPDATE/DELETE/TRUNCATE       │
        │     revoked (AUDIT-02)                                      │
        │                                                             │
        │   dsar_migrator role (used only by `prisma migrate deploy`, │
        │     a separate connection string, never the running app)    │
        └───────────────────────────────────────────────────────────┘

Boot-time side-channel: on app start, run `SELECT current_user` against
RUNTIME_DATABASE_URL and crash immediately if it equals `dsar_migrator` (D-08).
```

### Recommended Project Structure

```
/apps/web
  /app/(hr)/matters/page.tsx        # read-only list, dsar_runtime, empty = pass
  /app/(legal)/queue/page.tsx
  /app/(admin)/rulepacks/page.tsx
  /app/api/matters/route.ts         # POST — creates DRAFT matter + audit event
  /lib/auth/session.ts              # getSession(): stub identity seam (ACCESS-06)
  /lib/auth/require-role.ts         # requireRole(): DAL guard, ACCESS-01
  /lib/api/route-handler.ts         # createRouteHandler(): 415 + role guard factory
/packages/schemas
  /src/primitives.ts                # ULID, ISODate, ISODateTime, Minor, JurisdictionCode...
  /src/matter.ts /expense-line.ts /assessment.ts /rule-pack.ts /audit-event.ts
  /src/guard-input.ts               # SCHEMA-06's literal GuardInput type
  /src/money.ts                     # MINOR_UNIT_DECIMALS, format helpers
/packages/audit
  /src/write-event.ts               # the one INSERT path into AuditEvent
/prisma
  /schema.prisma
  /migrations/0001_init/migration.sql
  /migrations/0002_roles/migration.sql   # hand-edited GRANT/REVOKE (D-06)
/tests
  /routes/route-registry.ts         # hand-maintained {path, roles}[] — ACCESS-08
  /routes/enumerate-routes.test.ts  # glob cross-check against the registry
  /boundary/prisma-field-denylist.test.ts   # BOUND-02, via @prisma/internals
  /boundary/dom-denylist.test.ts    # BOUND-02, canary fixture (no real forms yet)
  /boundary/multipart-415.test.ts  # BOUND-01, glob-driven
  /db/audit-role.test.ts            # AUDIT-02, @testcontainers/postgresql
.dependency-cruiser.cjs
vitest.config.ts                    # test.projects: node env for packages/*, jsdom for apps/web
```

### Pattern 1: Branded `Minor` across the Prisma boundary

**What:** PRD §6.0 defines `Minor = number & { __brand: 'Minor' }`. Express this in zod 4 as:
```ts
// packages/schemas/src/primitives.ts
import { z } from 'zod';

export const MinorSchema = z.number().int().brand<'Minor'>();
export type Minor = z.infer<typeof MinorSchema>;
// z.infer yields: number & z.BRAND<'Minor'>  — structurally equivalent to the PRD's
// `number & { __brand: 'Minor' }`, and just as unassignable from a bare `number`
// without going through MinorSchema.parse().
export const toMinor = (n: number): Minor => MinorSchema.parse(n);
```
[CITED: zod.dev/api — `.brand()` accepts an optional directional argument (`'in' | 'out' | 'inout'`); the plain form used above brands the output type, matching the PRD's declared-type intent.]

**At the Prisma boundary:** Postgres columns for money are `Int` (Prisma scalar `Int` → Postgres `integer`, 4 bytes, max ≈2.147 billion minor units ≈ SGD 21M — comfortably above any plausible DSAR fee). Prisma Client returns a plain `number` for an `Int` column; there is no way to make Prisma itself return the branded type. **Assert the brand once, at the repository/mapper layer** that turns a Prisma row into a domain object — never scatter `as Minor` casts through the codebase:
```ts
// packages/schemas' toMinor(), called only where a Prisma row becomes a domain object
const line = await prisma.expenseLine.findUniqueOrThrow({ where: { id } });
const domainLine: ExpenseLine = {
  ...line,
  unitRate: toMinor(line.unitRate),
  claimedAmount: toMinor(line.claimedAmount),
};
```
This is deliberate design synthesis for this project, not a library-documented pattern — `[ASSUMED]`, but it is the direct, narrow consequence of "integer minor units end-to-end" (PRD §15) plus Prisma's lack of a branding mechanism.

**`z.record()` breaking change (zod 4), relevant to `RulePack.rateSanityCeiling: Partial<Record<StaffGrade, number>>`:** the single-argument form is gone [CITED: zod.dev/v4/changelog]. Use `z.partialRecord()`, zod 4's purpose-built replacement for "optional-key record":
```ts
export const RateSanityCeilingSchema = z.partialRecord(StaffGradeSchema, MinorSchema);
```
[CITED: gist.github.com/imaman — Zod v4 migration guide notes `z.partialRecord(z.enum([...]), z.number())` as the direct replacement for the old implicit-optional `z.record(valueSchema)` shorthand.]

**`z.input`/`z.output` and `.transform()` — relevant to `ExpenseLine.claimedAmount`:** do **not** derive `claimedAmount` with a zod `.transform()`. PRD §6.2 says it is "computed, never typed" by the UI, but ENGINE-13/AC-08 requires that a *stored* value be checked against `quantity × unitRate` **on load**, raising a hard error on mismatch — that is a load-time invariant check, not a schema-level derivation. Author `claimedAmount` as an ordinary required `Minor` field in the zod schema, and enforce the invariant with `.superRefine()` (or a plain function call at the data-access layer) rather than a transform:
```ts
export const ExpenseLineSchema = z.object({
  // ...
  quantity: z.number().positive(),
  unitRate: MinorSchema,
  claimedAmount: MinorSchema,
}).superRefine((line, ctx) => {
  if (line.claimedAmount !== line.quantity * line.unitRate) {
    ctx.addIssue({ code: 'custom', message: 'claimedAmount does not match quantity × unitRate' });
  }
});
```
This sidesteps zod 4's changed `z.input`/`z.output` inference around `.transform()` and defaults entirely, because no transform is used on this field. `[ASSUMED]` — design synthesis grounded in the AC-08 requirement text, not a library doc citation.

### Pattern 2: `Condition.field: keyof ExpenseLine | keyof Matter` has no clean zod expression

zod cannot express `keyof SomeType` as a runtime schema — `keyof` is a compile-time-only construct. Enumerate a literal, TypeScript-checked union of the specific field names conditions are allowed to reference, and validate against that closed set at runtime:
```ts
// packages/schemas/src/condition.ts
const CONDITION_FIELDS = [
  // ExpenseLine fields conditions may reference
  'categoryCode', 'quantity', 'unit', 'unitRate', 'claimedAmount',
  'incurredByGrade', 'isThirdPartyInvoiced', 'vendorName', 'evidenceRef',
  // Matter fields conditions may reference
  'jurisdictionCode', 'controllerType', 'currency', 'requestorClass',
  'isKnownDisputeOrLitigation', 'isRepeatRequestWithin12Months',
] as const satisfies readonly (keyof ExpenseLine | keyof Matter)[];

export type ConditionField = (typeof CONDITION_FIELDS)[number];
export const ConditionFieldSchema = z.enum(CONDITION_FIELDS);
```
The `satisfies readonly (keyof ExpenseLine | keyof Matter)[]` clause makes it a **compile error** to list a field name that doesn't actually exist on either type, closing the loop between the PRD's type-level constraint and a runtime-checkable zod enum. `[ASSUMED]` — standard TypeScript idiom, not a zod-specific documented feature, but directly resolves the ambiguity CONTEXT.md flags as Claude's discretion. **Record this choice explicitly** (per CONTEXT.md's instruction) rather than silently picking one of the two options — the alternative (loosening `Condition.field` to `string`) was rejected because it defeats the entire point of "machine-evaluable only, no free-text predicates" (PRD §6.0).

### Pattern 3: `GuardInput` structurally excludes advisory deadline fields (SCHEMA-06, AC-15b)

Do **not** derive `GuardInput` via `Omit<Matter, 'someField'>` or `Pick<Matter, ...>` from a wider type. `Omit`/`Pick` still describe a structural subtype of `Matter`, so a refactor that widens `Matter` later can silently make an omitted field re-appear via a different route (e.g., a spread). Author `GuardInput` as its own **literal object type** that never names an advisory deadline field at all:
```ts
// packages/schemas/src/guard-input.ts
export type GuardInput = {
  matterStatus: MatterStatus;
  expenseLineCount: number;
  jurisdictionCode: JurisdictionCode;
  currency: CurrencyCode;
  controllerType: ControllerType;
  pack: { status: RulePack['status']; reviewDueOn: ISODate; appliesTo: ControllerType[] } | null;
  attestationsAddressed: boolean;
  pendingLineCount: number;
  matterLevelFlagsRequiringAck: string[];
  acknowledgedFlags: string[];
  lawyerIdentity: UserRef | null;
};
```
`reviewDueOn` (the **pack's** lifecycle date) is deliberately present — AC-15b explicitly calls this out as belonging inside `GuardInput`. No field for the matter's advisory *fee-notification* deadline is ever named, so a guard function that reaches for `input.feeNotificationDeadline` (or any similarly-named field) fails with `Property 'feeNotificationDeadline' does not exist on type 'GuardInput'` — a compile error, satisfying AC-15b literally. `[ASSUMED]` — design synthesis; the "literal type, not derived" recommendation is this agent's reasoning about how to make the exclusion *structural* rather than incidental, since a PRD-described requirement ("a compile error if a guard reaches for one") has no single canonical library pattern.

### Pattern 4: Two-role Postgres migration, hand-edited SQL

Prisma's declarative schema has no first-class concept of database roles or GRANT/REVOKE — express this as **hand-edited SQL inside a Prisma migration**, generated via `--create-only` so Prisma doesn't try to apply it immediately:
```bash
npx prisma migrate dev --create-only --name add_runtime_role
```
Then hand-edit the generated (initially empty) `migration.sql` [CITED: prisma.io/docs/orm/v7/prisma-migrate/workflows/customizing-migrations — "all generated SQL migration files are fully customizable... enabling you to run custom SQL to make use of native database features"]:
```sql
-- prisma/migrations/0002_roles/migration.sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'dsar_runtime') THEN
    CREATE ROLE dsar_runtime LOGIN PASSWORD 'set-via-env-in-real-deploys';
  END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON "Matter", "ExpenseLine", "Assessment", "AssessmentLine", "RulePackVersion" TO dsar_runtime;
GRANT SELECT, INSERT ON "AuditEvent" TO dsar_runtime;   -- no UPDATE, DELETE, TRUNCATE
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO dsar_runtime;
```
**Common pitfall — `CREATE ROLE` is not idempotent** and Postgres has no `CREATE ROLE IF NOT EXISTS` syntax; the `DO $$ ... IF NOT EXISTS ... END $$` guard above is required, or the shadow-database replay (used by `prisma migrate dev` to detect drift) can fail with "role already exists" if the shadow database shares a Postgres cluster with a database where the role was already created by a previous run. `[ASSUMED]` — this is a well-known Postgres/Prisma community gotcha reasoned from how `migrate dev`'s shadow-database drift detection works (it replays every migration from scratch against a fresh, ephemeral database in the same server); it was not confirmed against a specific doc page this session (the official customizing-migrations page does not address roles/shadow-DB interaction directly — see Common Pitfalls #4).

**Two connection strings, boot assertion (D-08):**
```ts
// apps/web/lib/db/assert-runtime-role.ts
export async function assertRuntimeRole(prisma: PrismaClient) {
  const [{ current_user: user }] = await prisma.$queryRaw<{ current_user: string }[]>`SELECT current_user`;
  if (user === 'dsar_migrator') {
    throw new Error('FATAL: app booted with the migrator connection string — dsar_runtime split is unenforced');
  }
}
```
Call this once at app startup (e.g. `instrumentation.ts`'s `register()` hook in Next.js, or the first request if no startup hook is wired yet in Phase 1) — the goal per D-08 is that a misconfigured `RUNTIME_DATABASE_URL` fails loudly rather than "working" while silently defeating AUDIT-02.

**Falsifying AC-34 with `@testcontainers/postgresql`:**
```ts
// tests/db/audit-role.test.ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';

const container = await new PostgreSqlContainer('postgres:17').start();
// 1. run all migrations (including the hand-edited roles migration) against
//    container.getConnectionUri() using the migrator role
// 2. connect a second Prisma Client / raw `pg` client as dsar_runtime
// 3. assert the UPDATE fails at the database:
await expect(
  runtimeClient.$executeRawUnsafe(`UPDATE "AuditEvent" SET payload = '{}' WHERE id = 1`)
).rejects.toThrow(/permission denied for table "?AuditEvent"?/i);
```
`[ASSUMED]` — standard Testcontainers usage pattern; `@testcontainers/postgresql` itself is `[VERIFIED: npm registry]` to exist and be current, but the specific test shape above is this agent's synthesis of the standard "provision role via raw SQL, connect a second client, assert permission-denied" pattern, not quoted from Testcontainers' own docs (the web search this session did not surface a Postgres-specific role-provisioning example in Testcontainers' official guide).

### Pattern 5: Route-handler factory as the single seam for BOUND-01 + ACCESS-01

Rather than relying on every route author to remember to check `content-type` and call `requireRole()`, wrap every Route Handler in one factory that does both, so a route *cannot* be added without the checks:
```ts
// apps/web/lib/api/route-handler.ts
type RouteConfig<T> = {
  roles: Role[];
  handler: (req: NextRequest, ctx: { session: Session }) => Promise<NextResponse<T>>;
};

export function createRouteHandler<T>({ roles, handler }: RouteConfig<T>) {
  return async (req: NextRequest) => {
    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Unsupported Media Type' }, { status: 415 });
    }
    const session = await getSession(req);
    if (!session || !roles.includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return handler(req, { session });
  };
}
```
[CITED: pattern derived from a general Next.js Route Handler example showing content-type inspection → 415 (oneuptime.com/blog — community source, illustrative only, not an official Next.js doc); the 415-on-multipart behaviour itself is a project-specific requirement (AC-05), not a Next.js built-in.]

Every `route.ts` under `apps/web/app/api/**` is required to export handlers built through `createRouteHandler`, never a bare `async function POST(req)`. The standing test (Code Examples, below) enumerates every `route.ts` on disk and can additionally assert (via static import + a runtime marker property set by the factory) that every exported handler actually went through the factory — catching a route that bypasses it entirely, not just one that fails the 415/403 check at request time.

### Pattern 6: Stubbed identity provider (ACCESS-06) — recommendation

**Recommend: cookie-based session, set by a dev-only route, read by a single `getSession()` seam that Playwright can also drive via a request header.**

```ts
// apps/web/lib/auth/session.ts
export async function getSession(req: NextRequest): Promise<Session | null> {
  // Playwright / API tests: fast, headless, parallel-safe
  const testUserId = req.headers.get('x-dev-user-id');
  // Interactive/manual QA: cookie set by a NODE_ENV-gated /dev/switch-user route
  const cookieUserId = req.cookies.get('dsar_dev_user')?.value;
  const userId = testUserId ?? cookieUserId;
  if (!userId) return null;
  return lookupSeededUser(userId); // reads a small seeded fixture table/array
}
```
`requireRole()` and every guard depend only on the `Session` shape `getSession()` returns — never on cookies, headers, or env vars directly — so **replacing the stub identity provider changes no guard**, satisfying ACCESS-06's explicit test. The `/dev/switch-user` route and the `x-dev-user-id` header path must both be compiled out (or hard-fail) when `NODE_ENV === 'production'`.

Rationale for choosing this over a pure env-var-fixed user or a full fake-login page: Playwright tests from Phase 5 onward need to switch identity *per test*, in parallel, without a shared mutable env var (which would race across parallel workers) and without navigating a login UI on every test (slow). A header the test harness sets per-request is the only option satisfying both "parallel-safe" and "fast." `[ASSUMED]` — this is this agent's synthesis in response to CONTEXT.md's explicit invitation to decide and record; not drawn from an external source.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| JSON Schema generation for LLM boundary | A custom zod→JSON-Schema walker | `z.toJSONSchema()` (native, zod 4) | [CITED: zod.dev/json-schema] First-party, handles `.meta()` registry integration, `io: 'input'` vs output-type distinction, multiple JSON Schema draft targets. `zod-to-json-schema` (the npm package) is unmaintained since ~Nov 2025 per `.claude/CLAUDE.md`'s prior research — not re-litigated here, just reaffirmed as still correct. |
| Currency-aware money formatting | A bespoke currency-decimals lookup reimplementing ISO 4217 | The project's own explicit `MINOR_UNIT_DECIMALS` map (SCHEMA-03) — **not** `Intl.NumberFormat`'s implicit currency defaults | See Common Pitfalls #6 — relying on `Intl`'s built-in per-currency default decimal count is itself something not to hand-roll around; author the map once, pass `minimumFractionDigits`/`maximumFractionDigits` explicitly every time. |
| Package/module import-graph enforcement ("no I/O in `packages/engine`") | A custom AST walker over import statements, or repurposing Nx's tag-based `enforce-module-boundaries` | `dependency-cruiser` | Already established in `.claude/CLAUDE.md` — Nx's boundary feature works on project *tags*, not actual import targets (`fs`, `@prisma/client`); it is the wrong granularity for "no I/O," which is a specific-module question. Not re-litigated, only reaffirmed for Phase 1's specific config need. |
| Reading Prisma's field names for BOUND-02 | Regex-scraping `schema.prisma` text, or trusting the runtime client's `Prisma.dmmf` | `@prisma/internals.getDMMF({ datamodel })` | Regex-scraping is fragile against comments/formatting changes; the runtime client's DMMF is simplified under Prisma 7's default Rust-free engine (see Common Pitfalls #1). `getDMMF()` is the first-party API that returns full, structured field metadata regardless of `engineType`. |
| ULID/ISO date/datetime validation | Custom regexes for ULID format or ISO 8601 date parsing | `z.ulid()`, `z.iso.date()`, `z.iso.datetime()` (all top-level in zod 4) | [CITED: zod.dev/api] First-party, already handles the ULID case-insensitivity nuance and the ISO 8601 offset/precision options the PRD's `ISODate`/`ISODateTime` comments imply (`"2026-08-20"` and "server-generated, UTC" respectively — use `z.iso.date()` and `z.iso.datetime()` with default `offset: false` to match "no timezone offsets"). |

**Key insight:** every "don't hand-roll" item above exists because Phase 1 is explicitly the schema-and-plumbing phase — the temptation here is not to build a bad engine (there is no engine yet) but to build bespoke validation/enforcement machinery that a first-party tool already does correctly and that this project's own non-negotiables (defensibility, auditability) depend on being *provably* correct, not merely "probably fine."

## Common Pitfalls

### Pitfall 1: Reading Prisma field names via the runtime client, not the schema
**What goes wrong:** BOUND-02's test ("no column in the Prisma schema... matches the deny-list") is implemented against `Prisma.dmmf.datamodel.models` from the generated client, and silently under-covers fields once the project (following `.claude/CLAUDE.md`'s locked choice) adopts Prisma 7's default Rust-free `prisma-client` generator.
**Why it happens:** Under `engineType: "client"` (the Prisma 7 default), the runtime `Prisma.dmmf` is a "drastically simplified" structure missing per-field metadata compared to the Rust-engine era [CITED: github.com/prisma/prisma issue #28348]. The test may still pass (field *names* might still be present) but this is fragile and version-sensitive — do not depend on undocumented behaviour of a known-simplified structure.
**How to avoid:** Call `@prisma/internals`'s `getDMMF({ datamodel: readFileSync('prisma/schema.prisma', 'utf-8') })` directly in the test, which parses the schema source and returns the full DMMF regardless of the configured `engineType` [CITED: github.com/prisma/prisma issue #28348, quoting the documented workaround].
**Warning signs:** A BOUND-02 test that imports `PrismaClient`/`Prisma` from the generated client output rather than importing `getDMMF` from `@prisma/internals` and reading `schema.prisma` off disk.

### Pitfall 2: `typescript@latest` silently installs an unsupported major
**What goes wrong:** `pnpm add -D typescript@latest` (or an unpinned `"typescript": "*"`) installs `7.0.2`, whose peer compatibility with `typescript-eslint@8.70.0` (`>=4.8.4 <6.1.0`) is violated — ESLint's type-aware rules (including AC-07a's custom rule, if written type-aware) may fail outright or produce silently wrong results.
**Why it happens:** TypeScript's `latest` npm dist-tag moved to a new major (a Go-based compiler rewrite) faster than the wider tooling ecosystem's peer ranges caught up.
**How to avoid:** Pin `typescript` to `6.0.3` exactly (or re-check `npm view typescript-eslint peerDependencies` at actual scaffold time for a newer compatible ceiling) — do not use a caret range or `latest`.
**Warning signs:** `pnpm install` printing a peer-dependency warning about `typescript-eslint` and `typescript`; ESLint crashing on TS syntax it should understand.

### Pitfall 3: `prisma@^7` or `prisma@latest` in `package.json`
**What goes wrong:** A caret range on the `prisma` CLI package (not `@prisma/client`) will happily upgrade to `8.0.0` the moment it's tagged `latest` (it already carries an RC under that tag as of this research) — a major-version jump the project has deliberately deferred.
**Why it happens:** `npm`/`pnpm`'s default caret-range semantics follow the `latest` dist-tag's major version once it publishes a non-prerelease `8.0.0`.
**How to avoid:** Pin `"prisma": "7.10.0"` and `"@prisma/client": "7.10.0"` as exact strings.
**Warning signs:** A `pnpm-lock.yaml` diff showing an unexpected Prisma major bump after a routine `pnpm install`.

### Pitfall 4: `CREATE ROLE` inside a Prisma migration is not idempotent, and the shadow database replays every migration
**What goes wrong:** `prisma migrate dev` uses a shadow database to detect drift by replaying the full migration history from scratch. A bare `CREATE ROLE dsar_runtime ...;` (without an existence guard) succeeds the first time but fails with "role already exists" on a subsequent `migrate dev`/`migrate reset` if the shadow database shares a Postgres server/cluster with a database where the role persists (roles are cluster-wide in Postgres, not per-database).
**Why it happens:** Postgres has no `CREATE ROLE IF NOT EXISTS` syntax, unlike `CREATE TABLE IF NOT EXISTS`.
**How to avoid:** Wrap role creation in a `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '...') THEN CREATE ROLE ...; END IF; END $$;` block (Architecture Patterns §4).
**Warning signs:** `migrate dev` or `migrate reset` failing with `role "dsar_runtime" already exists` on the second or later run in local dev.

### Pitfall 5: Docker unavailable in the execution environment
**What goes wrong:** Any plan touching Postgres, `@testcontainers/postgresql`, or the two-role migration cannot execute.
**Why it happens:** Docker was not found in this research session's environment (`docker: not found`, daemon unreachable) [VERIFIED: this session's environment probe]. This may differ from the actual execution environment, but it is worth confirming *before* Phase 1 execution starts rather than discovering it mid-plan.
**How to avoid:** Confirm Docker Desktop (with WSL2 backend, on Windows) or an equivalent Docker daemon is available before starting any plan/task that provisions Postgres or runs `@testcontainers/postgresql` tests. There is no fallback — SQLite is explicitly excluded per PROJECT.md (cannot express the GRANT/REVOKE role boundary AC-34 requires).
**Warning signs:** `docker info` failing; `testcontainers` tests timing out waiting for a container to start.

### Pitfall 6: Relying on `Intl.NumberFormat`'s implicit per-currency decimal defaults
**What goes wrong:** `Intl.NumberFormat(locale, { style: 'currency', currency: 'JPY' })` does correctly default to 0 fraction digits and `currency: 'SGD'` to 2 [CITED: developer.mozilla.org/.../Intl/NumberFormat — "the default for maximumFractionDigits is... the number of minor unit digits provided by the ISO 4217 currency code list"] — but this behaviour depends on the JS engine's bundled ICU currency-digits table, which can vary between a `small-icu` and `full-icu` Node.js build, and is opaque to a reader of the code (nothing in the call site states "JPY is 0dp").
**Why it happens:** SCHEMA-03 explicitly wants an authored, explicit, testable `MINOR_UNIT_DECIMALS` map — not implicit reliance on runtime ICU data — precisely so the zero-decimal/two-decimal behaviour is deterministic and visible in source, and testable without needing to trust the runtime's ICU build.
**How to avoid:** Author `MINOR_UNIT_DECIMALS: Record<CurrencyCode, 0 | 2>` explicitly (`JPY: 0, KRW: 0, VND: 0`, all others `2`) [CITED: ISO 4217 minor-unit exponents, cross-checked via localization.guide and MDN], and always pass `minimumFractionDigits`/`maximumFractionDigits` explicitly to `Intl.NumberFormat` derived from that map — never rely on the currency-code default path.
**Warning signs:** A formatting helper that calls `new Intl.NumberFormat(locale, { style: 'currency', currency })` without also passing `minimumFractionDigits`/`maximumFractionDigits`.

### Pitfall 7: A "standing" DOM deny-list test with nothing to scan yet
**What goes wrong:** BOUND-02's DOM half ("no rendered form input name matches the deny-list") is written against `apps/web/app/**/page.tsx` via glob, but Phase 1 (per D-05) ships zero HTML forms — the intake form is explicitly Phase 5's. A glob-only test vacuously passes today and could keep vacuously passing indefinitely if the scanning mechanism itself has a bug that would only surface once a real form exists.
**Why it happens:** The standing-test obligation (Success Criterion 4) demands the test "enumerate generated artifacts... without anyone editing the test" — but an artifact-enumeration test with zero artifacts proves nothing about whether the scanner works.
**How to avoid:** Pair the glob-driven integration test (currently vacuous, "0 routes found, 0 violations" is the correct Phase 1 result) with a **unit test against an in-file canary fixture** — a small HTML/JSX string constructed only inside the test file, containing a deliberately deny-listed input name (e.g., `<input name="requestorName" />`), asserting the scanning function detects it. This proves the mechanism works today, independent of whether real forms exist yet.
**Warning signs:** A BOUND-02 DOM test with only one assertion path and no red-case fixture; a test that would pass identically whether the scanner is correct or entirely broken.

## Code Examples

### AC-07a lint rule (bare `number` for money-named identifiers)

Recommend a purely syntactic (non-type-aware) `no-restricted-syntax` configuration, scoped to `packages/engine` and `packages/schemas` only via ESLint flat config's `files` glob — this avoids the overhead of `parserOptions.project` type-aware linting and naturally excludes Prisma-generated code (which lives outside those two package paths):
```js
// eslint.config.js (flat config), scoped block
{
  files: ['packages/engine/**/*.ts', 'packages/schemas/**/*.ts'],
  rules: {
    'no-restricted-syntax': ['error',
      {
        selector: "TSPropertySignature[key.name=/(amount|total|rate|fee|cap)$/i] > TSTypeAnnotation > TSNumberKeyword",
        message: 'Money-named fields must use the branded `Minor` type, not `number`.',
      },
      {
        selector: "VariableDeclarator[id.name=/(amount|total|rate|fee|cap)$/i] > TSTypeAnnotation > TSNumberKeyword",
        message: 'Money-named variables must use the branded `Minor` type, not `number`.',
      },
      {
        selector: ":matches(TSParameterProperty, FunctionDeclaration, ArrowFunctionExpression) Identifier[name=/(amount|total|rate|fee|cap)$/i] > TSTypeAnnotation > TSNumberKeyword",
        message: 'Money-named parameters must use the branded `Minor` type, not `number`.',
      },
    ],
  },
}
```
[CITED: eslint.org/docs/latest/rules/no-restricted-syntax — the rule accepts AST selector objects with a custom message; typescript-eslint's parser produces `TS*`-prefixed node names (`TSTypeAnnotation`, `TSNumberKeyword`, `TSPropertySignature`) queryable the same way as any ESTree node, and ESLint selectors support `/pattern/flags` regex literals in attribute matchers.] This is deliberately **not** type-aware (no `parserOptions.project` needed): it matches on the literal written `number` keyword, which is sufficient because the branded type is spelled `Minor` in source, never `number`. **What it must not catch:** Prisma-generated client code, which is excluded by the `files` glob never matching `node_modules/` or a generated-client output directory — scope the rule to the two named package paths only, never repo-wide.

### `z.toJSONSchema()` for the LLM boundary (SCHEMA-05)

```ts
import { z } from 'zod';
import { AssessmentLineSchema } from './assessment';

export const AssessmentLineJsonSchema = z.toJSONSchema(AssessmentLineSchema);
// Target defaults to draft-2020-12; pass { target: 'openapi-3.0' } etc. if a later
// phase's LLM provider needs a different draft.
```
[CITED: zod.dev/json-schema] Phase 1 only needs this to exist and be exercised by a test that snapshots the generated JSON Schema shape for at least one frozen type — `packages/agent` (Phase 8) is the actual consumer.

### Enumerating every route for the standing tests (ACCESS-08, BOUND-01)

```ts
// tests/routes/enumerate-routes.ts
import { glob } from 'node:fs/promises' /* or the `glob` package */;
import path from 'node:path';

export async function discoverRoutes(): Promise<string[]> {
  const files = await glob('apps/web/app/**/route.ts', { cwd: process.cwd() });
  return files.map((f) => path.resolve(f));
}
```
```ts
// tests/routes/route-registry.ts — hand-maintained, one entry per route
export const ROUTE_REGISTRY: { filePath: string; roles: Role[] }[] = [
  { filePath: 'apps/web/app/api/matters/route.ts', roles: ['HR_PREPARER'] },
  // Phase 3/5/6/7/8 append here as routes are added.
];
```
```ts
// tests/routes/enumerate-routes.test.ts
test('every discovered route.ts is registered, and vice versa', async () => {
  const discovered = new Set((await discoverRoutes()).map(toRelative));
  const registered = new Set(ROUTE_REGISTRY.map((r) => r.filePath));
  expect([...discovered].sort()).toEqual([...registered].sort());
  // asymmetric failure messages: a route on disk but not in the registry,
  // or vice versa, both fail loudly and name the offending path.
});
```
This is the mechanism CONTEXT.md's discretion note names directly ("a central route registry that fails CI when a route is unregistered"), combined with the glob so the registry itself can't silently drift from disk either.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `zod-to-json-schema` npm package | `z.toJSONSchema()` native method | zod 4 (2025) | Already reflected in `.claude/CLAUDE.md`; reaffirmed here, not re-researched. |
| Prisma Rust query engine (`prisma-client-js`) | Rust-free `prisma-client` generator, `engineType: "client"` default | Prisma ORM v7.0.0 (2025-11-19) [CITED: prisma.io/changelog/2025-11-19] | Runtime `Prisma.dmmf` is simplified — see Common Pitfalls #1. Driver adapters are now mandatory for all databases under this default. |
| `vitest.workspace.ts` separate file | `test.projects` field inside root `vitest.config.ts` | Deprecated since Vitest 3.2 [CITED: vitest.dev/guide/projects] | The workspace-file form still works but is deprecated; author new configs with `test.projects` directly. |
| TypeScript 5.x (tsc, JS-based compiler) | TypeScript 7.x (Go-based compiler rewrite) | `latest` dist-tag moved to `7.0.2` [VERIFIED: npm registry, this session] | **Not yet safe to adopt for this project** — `typescript-eslint@8.70.0`'s peer range excludes it. Revisit once typescript-eslint (or its eventual replacement/major bump) declares TS 7 support. |

**Deprecated/outdated:**
- `zod-to-json-schema`: unmaintained since ~Nov 2025 per `.claude/CLAUDE.md`'s prior research.
- `prisma-client-js` generator: superseded by `prisma-client` as the v7 default; the old provider name still works but is slated for removal in a future Prisma release [CITED: prisma.io/docs/guides/upgrade-prisma-orm/v7].

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `TSPropertySignature`/`TSNumberKeyword` AST selector syntax exactly matches the current typescript-eslint parser's node names for the ESLint version pinned here | Code Examples — AC-07a lint rule | Low-moderate: the rule fails to fire or throws a config error at ESLint startup; caught immediately in CI, not a silent gap. Confirm node names against `typescript-eslint`'s AST Spec at scaffold time if the rule doesn't fire on a deliberately-broken test fixture. |
| A2 | `CREATE ROLE` inside a Prisma migration needs an existence guard because of shadow-database replay | Architecture Patterns §4, Common Pitfalls #4 | Moderate: if wrong, the guard is harmless extra code; if the underlying mechanism differs (e.g., Prisma 7's shadow DB behaves differently from assumed), the actual failure mode may be something else entirely (untested this session) — verify by actually running `prisma migrate dev` twice locally against the same Postgres server once Docker is available. |
| A3 | The `Minor`-brand-assertion-at-the-mapper-layer pattern (assert once, where Prisma rows become domain objects) is the right place to convert, rather than at every read site | Architecture Patterns §1 | Low: this is an architectural convention, not a correctness question — worst case, the convention gets refined during Phase 1 execution without changing the frozen schema. |
| A4 | The `GuardInput` literal-type (not `Omit<Matter,...>`-derived) approach is the best way to satisfy AC-15b's "compile error" requirement | Architecture Patterns §3 | Low-moderate: an alternative (branded/opaque wrapper type for advisory-deadline fields) could also satisfy AC-15b; if the planner or a reviewer prefers that alternative, no rework of frozen types is needed — only of the guard-input mapping function. |
| A5 | The cookie + `x-dev-user-id`-header stubbed-identity design is the right ACCESS-06 ergonomics choice | Architecture Patterns §6 | Moderate: this shapes every Playwright test from Phase 5 onward per CONTEXT.md's own framing — if the product owner or a later reviewer prefers a different mechanism (e.g., a fully separate dev-login page with no header path), the `getSession()` seam itself doesn't need to change, only its internals, so the blast radius is contained. |
| A6 | `CONDITION_FIELDS` literal-array-with-`satisfies` is preferable to loosening `Condition.field` to `string` | Architecture Patterns §2 | Low: PRD explicitly says "machine-evaluable only, no free-text predicates" (§6.0), which argues strongly against loosening; this assumption mainly concerns *how* to keep it closed, not *whether* to. |

**If this table is empty:** N/A — see entries above. Every claim tagged `[VERIFIED]` or `[CITED]` elsewhere in this document was either confirmed via a registry/tool call this session or traced to an official-docs URL found via search; the entries above are this agent's design syntheses where the PRD states a requirement but not a specific implementation mechanism.

## Open Questions

1. **Does Prisma 7's shadow database actually choke on a hand-authored `CREATE ROLE` migration, guarded or not?**
   - What we know: `migrate dev` replays the full migration history against an ephemeral shadow database to detect drift [CITED: prisma.io/docs/orm/v7/prisma-migrate]; roles are cluster-wide in Postgres.
   - What's unclear: whether Prisma's shadow database, by default, lives in the *same* Postgres server/cluster as the dev database (making a bare `CREATE ROLE` genuinely collide) or a logically separate one Prisma manages per-run in a way that avoids the collision even without a guard.
   - Recommendation: write the `DO $$ IF NOT EXISTS $$` guard regardless (it's cheap insurance) and verify empirically by running `migrate dev` twice in a row against the local Docker Postgres once Docker is confirmed available — this is a `checkpoint:human-verify`-worthy empirical check, not something resolvable from documentation alone in this session.

2. **Is Docker actually available in the environment where Phase 1 will execute?**
   - What we know: not available in this research session's probe environment.
   - What's unclear: whether the actual execution environment (a different machine/container than this research session) has it.
   - Recommendation: the planner should insert an explicit environment-check task at the start of any plan touching Postgres/testcontainers, and treat "Docker unavailable" as a hard blocker with no fallback (per Environment Availability below and PROJECT.md's SQLite exclusion).

3. **Exact TypeScript ceiling for `typescript-eslint` may have moved again by actual scaffold time.**
   - What we know: as of this session, `typescript-eslint@8.70.0` declares `typescript: ">=4.8.4 <6.1.0"`.
   - What's unclear: whether a newer `typescript-eslint` (or TypeScript itself) has shipped a compatible pairing above `6.0.3`/below `8.70.0` by the time scaffolding actually happens.
   - Recommendation: re-run `npm view typescript-eslint peerDependencies` and `npm view typescript versions` immediately before running `pnpm add`, not from this document's cached numbers.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Everything (`next`, `pnpm`, tooling) | ✓ | v24.19.0 [VERIFIED: `node --version`, this session] | — (well above Next 16's `>=20.9.0` floor) |
| Corepack / pnpm | Package manager per locked stack decision | ✓ (via Corepack) | Corepack 0.35.0 → pnpm 12.4.1 [VERIFIED: `corepack --version`, `corepack pnpm --version`, this session] | `npm install -g pnpm@12.4.1` if Corepack is disabled in the actual execution environment |
| Docker | Postgres-in-Docker (D-01, D-06), `@testcontainers/postgresql` (AUDIT-02/AC-34) | ✗ | — [VERIFIED: `docker --version` and `docker info` both failed, this session] | **None.** SQLite is explicitly excluded (cannot express the GRANT/REVOKE role boundary) — this is a hard blocker for any Postgres-touching plan until confirmed available in the real execution environment |
| git | Version control | ✓ | 2.55.0.windows.5 [VERIFIED: `git --version`, this session] | — |

**Missing dependencies with no fallback:**
- Docker — blocks D-01 (Prisma schema + migration against a real Postgres), D-06 (DB-level invariants), D-08 (boot assertion, requires a live connection to test against), and AUDIT-02/AC-34 (the `@testcontainers/postgresql` falsification test). The planner should sequence plans so schema-only work (`packages/schemas`, zod authoring, ESLint rule, dependency-cruiser config) can proceed and be verified independently of Docker availability, with the Postgres-touching plans gated on a confirmed-available Docker daemon.

**Missing dependencies with fallback:**
- None beyond pnpm's Corepack fallback (already resolved locally).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.0 |
| Config file | `vitest.config.ts` (root), using `test.projects` — none exists yet, this is a Wave 0 gap |
| Quick run command | `pnpm vitest run --project schemas` (or the equivalent project name once configured) |
| Full suite command | `pnpm vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| SCHEMA-01 | Every core type parses valid PRD-shaped fixtures and rejects invalid ones | unit | `pnpm vitest run packages/schemas/src/*.test.ts` | ❌ Wave 0 |
| SCHEMA-02 | Bare `number` on a money-named identifier in `packages/engine`/`packages/schemas` fails lint | lint (CI gate, not Vitest) | `pnpm eslint packages/engine packages/schemas` | ❌ Wave 0 (eslint config) |
| SCHEMA-03 | Formatting the same integer as JPY and SGD yields 0dp and 2dp respectively | unit | `pnpm vitest run packages/schemas/src/money.test.ts` | ❌ Wave 0 |
| SCHEMA-04 | A `Matter` with mismatched currency/jurisdiction fails zod validation and the DB check constraint | unit + integration | `pnpm vitest run packages/schemas/src/matter.test.ts` (unit); `tests/db/*.test.ts` (constraint, needs Docker) | ❌ Wave 0 |
| SCHEMA-05 | `z.toJSONSchema()` output for at least one frozen type matches a committed snapshot | unit | `pnpm vitest run packages/schemas/src/json-schema.test.ts` | ❌ Wave 0 |
| SCHEMA-06 | A guard function referencing a non-existent `GuardInput` field fails `tsc`, not a unit test | typecheck | `pnpm tsc --noEmit -p packages/schemas` (plus a `// @ts-expect-error` fixture proving the exclusion) | ❌ Wave 0 |
| SCHEMA-07 | 10,000-run property test: every `Assessment` money field is an integer | property | `pnpm vitest run packages/schemas/src/assessment.property.test.ts` | ❌ Wave 0 |
| STATE-01 | `MatterStatus` zod enum + Postgres enum both reject a value outside the seven | unit + integration | `pnpm vitest run` (unit); migration-applied Postgres check (needs Docker) | ❌ Wave 0 |
| ACCESS-01 | An unauthenticated/wrong-role request to any route returns 403/401, body contains no data | integration | `pnpm vitest run tests/routes/*.test.ts` | ❌ Wave 0 |
| ACCESS-06 | Swapping the identity-provider implementation requires zero guard-code changes | structural/manual | `pnpm tsc --noEmit` (guard code only imports `getSession()`'s return type, not its internals) | ❌ Wave 0 |
| ACCESS-08 | Every discovered route is in the registry and vice versa; every route × every role combination asserted | integration | `pnpm vitest run tests/routes/enumerate-routes.test.ts` | ❌ Wave 0 |
| BOUND-01 | Multipart POST to every discovered route returns 415 | integration | `pnpm vitest run tests/boundary/multipart-415.test.ts` | ❌ Wave 0 |
| BOUND-02 | No `@prisma/internals`-read field name, no rendered form input name, matches the deny-list | integration + canary unit | `pnpm vitest run tests/boundary/prisma-field-denylist.test.ts tests/boundary/dom-denylist.test.ts` | ❌ Wave 0 |
| AUDIT-02 | `UPDATE`/`DELETE`/`TRUNCATE` against `AuditEvent` from `dsar_runtime` fails at the database | integration (Testcontainers) | `pnpm vitest run tests/db/audit-role.test.ts` | ❌ Wave 0 (needs Docker) |

### Sampling Rate
- **Per task commit:** the relevant project's quick command, e.g. `pnpm vitest run --project schemas`
- **Per wave merge:** `pnpm vitest run` (full suite) plus `pnpm eslint .` and `pnpm depcruise packages/engine packages/schemas`
- **Phase gate:** full suite green, `tsc --noEmit` clean across all packages, and (Docker available) the Testcontainers AUDIT-02 test green, before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` with `test.projects` — node env for `packages/*`, jsdom for `apps/web` — framework install/config, none exists yet
- [ ] `.dependency-cruiser.cjs` forbidding `fs`/`net`/`http`/`fetch`/`@prisma/client` imports from `packages/engine` and `packages/schemas`
- [ ] `eslint.config.js` flat config with the AC-07a custom selector rule scoped to `packages/engine`/`packages/schemas`
- [ ] `tests/routes/route-registry.ts` + `enumerate-routes.test.ts` — the ACCESS-08/BOUND-01 standing harness
- [ ] `tests/boundary/dom-denylist.test.ts` — must include the canary fixture (Common Pitfalls #7), not just a glob over currently-nonexistent forms
- [ ] `tests/db/audit-role.test.ts` — depends on Docker availability (Environment Availability, above); if Docker is confirmed unavailable, this becomes a blocking gap, not merely a Wave 0 todo

*(All gaps above are genuine — nothing exists yet; this is a from-zero scaffold.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | Partial | ACCESS-06's stubbed provider is explicitly not real authentication (SSO deferred to v2/out of scope) — but the *session-shape* seam (`getSession()`) must be built as if it will be swapped for real auth later, per ACCESS-06's own wording |
| V3 Session Management | Yes | Cookie-based dev session (Architecture Patterns §6) should still follow basic session hygiene (httpOnly, sameSite) even though it is a stub, so the swap to real SSO doesn't also require fixing cookie handling |
| V4 Access Control | Yes | `requireRole()` Data Access Layer pattern, called at the data-fetching function itself, never `middleware.ts` — already the project's locked, non-negotiable design (PRD §0 non-negotiable #2; `.claude/CLAUDE.md` explicitly names the CVE-2025-29927-class middleware bypass risk) |
| V5 Input Validation | Yes | zod schemas at every API boundary; `.superRefine()` for the `claimedAmount` cross-field invariant (Architecture Patterns §1) |
| V6 Cryptography | No | No cryptographic operations introduced in Phase 1 — TLS/encryption-at-rest are deployment concerns (§12.2), not this phase's code |
| V9 Communications | Partial | Not exercised locally (no TLS in local Docker Postgres); note for later phases that production deployment needs TLS in transit per §12.2, out of scope here |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Role-check bypass via `middleware.ts`'s documented Next.js gap (CVE-2025-29927-class) | Elevation of Privilege | Data Access Layer `requireRole()` called at the data-fetching function itself, never in middleware — already locked |
| SQL injection via raw queries | Tampering | Prisma parameterized queries throughout; the one place raw SQL appears in Phase 1 is the hand-edited migration SQL (Architecture Patterns §4) and the `$queryRaw`/`$executeRawUnsafe` calls in the boot assertion and AUDIT-02 test — both use fixed, non-user-controlled strings, never string-concatenated user input |
| Privilege escalation via a misconfigured runtime DB connection string | Elevation of Privilege | D-08's boot-time `SELECT current_user` assertion — fails fast rather than silently running as `dsar_migrator` |
| Audit-log tampering post-write | Repudiation | AUDIT-02's DB-level `REVOKE UPDATE, DELETE, TRUNCATE` from `dsar_runtime` — the application role structurally cannot alter or erase an audit event, regardless of application-layer bugs |
| Mass-assignment / IDOR on the one POST endpoint | Tampering / Information Disclosure | The POST body should be parsed against a narrow zod schema accepting only the exact fields a `DRAFT` matter creation needs — never a raw `req.json()` spread into Prisma's `create()` call |

## Sources

### Primary (HIGH confidence)
- `npm view <package> version` / `dist-tags` / `peerDependencies` / `engines` — run directly this session for: zod, prisma, @prisma/client, next, react, react-dom, vitest, @vitest/coverage-v8, playwright, fast-check, @fast-check/vitest, dependency-cruiser, @testcontainers/postgresql, testcontainers, eslint, typescript-eslint, tailwindcss, typescript, pnpm.
- `gsd_run query package-legitimacy check --ecosystem npm ...` — run this session against all Phase-1 packages.
- Local environment probes (`node --version`, `corepack pnpm --version`, `docker --version`/`docker info`, `git --version`) — run this session.
- `docs/PRD-dsar-fee-agent.md` §0, §5, §6, §7.2, §8.1–8.3, §10.1, §12.1, §13, §14, §15 — read in full this session.
- `.planning/phases/01-schemas-freeze-and-walking-skeleton/01-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/config.json` — read in full this session.

### Secondary (MEDIUM confidence)
- zod.dev/api, zod.dev/json-schema, zod.dev/v4/changelog — official docs, retrieved via WebSearch summaries this session.
- vitest.dev/guide/projects — official docs, retrieved via WebFetch this session.
- prisma.io/docs/orm/v7/prisma-migrate/workflows/customizing-migrations, prisma.io/changelog/2025-11-19, prisma.io/docs/guides/upgrade-prisma-orm/v7 — official docs, retrieved via WebFetch/WebSearch this session.
- eslint.org/docs/latest/rules/no-restricted-syntax — official docs, retrieved via WebSearch this session.
- developer.mozilla.org — Intl.NumberFormat constructor page, retrieved via WebSearch this session.
- github.com/prisma/prisma issue #28348 (DMMF simplification under `engineType: "client"`) — retrieved via WebFetch this session; a maintainer-acknowledged GitHub issue, treated as MEDIUM (community-reported, not a docs page, but directly on-point and internally consistent with the v7 changelog's Rust-free-by-default claim).

### Tertiary (LOW confidence)
- oneuptime.com/blog — community blog post on Next.js Route Handlers, used only as an illustrative content-type-check code shape, not as authority for any specific behavior claim.
- gist.github.com/imaman (Zod v4 migration guide gist) and dev.to/pockit_tools (Zod 4 migration article) — community summaries of zod 4 breaking changes, cross-checked against the official zod.dev/v4/changelog page where cited.

## Metadata

**Confidence breakdown:**
- Standard stack (version pins): HIGH — every version number was checked against the live npm registry this session, not carried over from training data.
- Architecture patterns (Minor branding, GuardInput, Condition enum, route registry, identity seam): MEDIUM/LOW — these are this agent's design synthesis responding to PRD requirements and CONTEXT.md's explicit discretion grants; grounded in the PRD's stated requirements but not themselves drawn from an external authoritative source, so treat as a strong starting proposal for the planner, not settled fact.
- Pitfalls: MEDIUM — the Prisma-7-DMMF-simplification and TypeScript-7/typescript-eslint-incompatibility findings are HIGH confidence (directly tool/doc verified); the shadow-database `CREATE ROLE` idempotency pitfall is LOW/ASSUMED (reasoned, not directly confirmed against a Prisma doc page).

**Research date:** 2026-09-14
**Valid until:** 7 days for the TypeScript/Prisma major-version-transition facts specifically (both ecosystems are mid-major-bump and dist-tags can move); 30 days for the rest (zod 4, Vitest 5 `test.projects`, dependency-cruiser config shape, and the PRD-transcription patterns are all stable).
