<!-- GSD:project-start source:PROJECT.md -->

## Project

**DSAR Fee Assessment Agent**

A web tool that works out what an employer may lawfully charge an ex-employee for responding to a data subject access request. HR itemises what the request actually cost them; a deterministic engine applies a versioned, lawyer-authored rule pack for the relevant jurisdiction; a named lawyer reviews the result line by line and signs it off. Only then does HR see a figure.

It is for HR Shared Services (who enter costs), qualified lawyers in nine Asian jurisdictions (who decide), the counsel who author the rule packs, and the DPO (who audits). The full specification is `docs/PRD-dsar-fee-agent.md` — 1,005 lines, and the source of truth for everything below.

**Core Value:** A lawyer can defend the output by saying "the engine applied rule HK-PDPO.STAFF_TIME_REDACT_EXEMPT, version 2026.09.1, authored by X on date Y, and struck the line" — never "the model assessed the claim."

Everything else in this product exists to protect that sentence.

### Constraints

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

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | 5.9.x | Language, everywhere | PRD baseline; confirmed — no reason to deviate. Verify exact patch with `npm view typescript version` at scaffold time (LOW confidence on patch digit only). |
| Next.js | 16.3.x (App Router) | `apps/web` | Current stable major as of Sept 2026; App Router is now the only router (Pages Router is legacy). 16.3.3/16.3.4 received an active security patch in Aug 2026 — start on latest patch, not an older 16.x. Confirms PRD §15. MEDIUM confidence (cross-checked across 3 sources). |
| Postgres | 17.x or 18.x (Docker) | Primary datastore | PROJECT.md already locks this in over SQLite specifically because AC-34 needs a real GRANT/REVOKE boundary, which SQLite cannot express. 18.6 is current; 17.x is the safer bet if you expect to move off local Docker to a managed host later (broader managed-Postgres support). Either works identically for the role/grant pattern below — this choice doesn't gate anything else. HIGH confidence. |
| Prisma ORM | 7.x (latest 7.10.x) | ORM / migrations | **Deliberately not Prisma 8.** Prisma 8 appears to have gone GA (or very near it) in the same week as this research — too fresh to build a compliance/audit-sensitive project on. Prisma 7 already ships the Rust-engine-removal work (faster, smaller) and is fully supported as `prisma@prev` with ~12 months of continued updates. Re-evaluate the jump to 8 once it has a few months of field use. MEDIUM confidence (conflicting signals on exact GA date across sources). |
| zod | 4.x (latest 4.6.x) | Schemas, validation, JSON Schema generation | See dedicated section below (Q4). HIGH confidence — greenfield project, no reason to start on zod 3. |
| Tailwind CSS | 4.x (stable, ~4.3.x+) | `apps/web` styling | v4's CSS-first config (`@theme`, no `tailwind.config.js` needed) is stable through 2026. Confirms PRD §15. MEDIUM confidence on exact patch. |
| Playwright | 1.63.x | E2E (`/tests/e2e`) | Current 2026 line defaults to UI Mode for authoring and has materially better trace/network inspection than the 1.4x era. Confirms PRD §15. MEDIUM confidence. |
| Vitest | 5.0.x | Unit/integration test runner | Current major; workspace support for a monorepo with a pure package (`packages/engine`, node env) plus a Next.js app (jsdom/happy-dom env) is first-class via per-package `vitest.config.ts` + a root `vitest.workspace.ts` (or the newer `projects` field — check current docs at scaffold time, this surface has moved between minors). Confirms PRD §15. MEDIUM confidence. |
| pnpm | 12.x | Package manager / workspaces | See Q1. HIGH confidence on the *choice*, MEDIUM on the exact major (pnpm rewrote its core in Rust mid-2026; 12.x is current). |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fast-check` | 4.x | Property-based testing | AC-07(b)'s 10,000-random-input `Number.isInteger()` invariant test over `Assessment` money fields. Core dependency — 80+ built-in arbitraries cover the `ExpenseLine`/`Cap`/`Condition` shapes with custom arbitraries. |
| `@fast-check/vitest` | 0.4.x | fast-check + Vitest ergonomics | Optional sugar (`it.prop`) for property tests scattered outside the one AC-07 invariant test. Not required for AC-07 itself — plain `fc.assert(fc.property(...), { numRuns: 10000 })` from `fast-check` is enough. |
| `dependency-cruiser` | current (`npx depcruise --init`) | Enforce `packages/engine` purity | See Q1. Run in CI as a standalone `depcruise` step, independent of ESLint. |
| `@react-pdf/renderer` | 4.x | Internal assessment record PDF | See Q5. |
| `pino` (or similar) | current | Structured server logging | Not in PRD but needed to log audit-adjacent server events without becoming a second, unaudited log — keep audit events in Postgres per AC-35, use app logs only for ops/debugging. |
| `@testcontainers/postgresql` | current | Integration tests against real Postgres | Required to test AC-34 (the GRANT boundary) — this cannot be verified against SQLite or a mocked Prisma client, only a real Postgres instance with the restricted role's actual credentials. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| dependency-cruiser | Static architecture enforcement | See Q1 — primary tool for the "no I/O in `packages/engine`" boundary. |
| ESLint (flat config) + `@typescript-eslint` | Linting, type-aware rules | Hosts the bespoke `Minor`-branding lint rule (Q2) and the AC-32(a) banned-words rule. |
| Docker Compose | Local Postgres + app | Matches "Postgres in Docker, not SQLite" decision already in PROJECT.md; keep the compose file minimal (one `postgres:17` or `:18` service, seeded via Prisma seed script). |

## Installation

# Core

# Prisma

# Web

# Testing

# Architecture enforcement

## Answers to the 8 open questions

### 1. Monorepo tooling: pnpm workspaces, plain — not Turborepo, not Nx (yet)

- This repo has one app and six packages. Turborepo's entire value proposition is caching across a large, slow CI matrix — at this scale there's nothing to cache yet, and adding it now is process weight with no payoff. It's a trivial, non-invasive addition later (`pnpm add -D turbo`, a `turbo.json`) if CI time becomes a problem post-Phase-2 (nine packs, more tests) — nothing about the package layout has to change to add it.
- Nx is the wrong tool here specifically *because* of its main selling point: it wants to own code generation, task graphs, and (via paid Nx Cloud) distributed execution. None of that is needed for a prototype with one contributor and no polyglot services. Nx's learning curve is real and buys nothing this milestone.
- Critically: **neither Turborepo nor Nx's built-in module-boundary features are the right tool for "packages/engine must be provably free of I/O, network and LLM imports."** Turborepo doesn't understand imports at all — it only sees declared task dependencies between package.json scripts, not what a file inside `packages/engine` actually imports. Nx's `enforce-module-boundaries` rule works off *tags* you assign per project (e.g., `type:pure`), not off actual import targets like `fs`, `node:net`, or `@prisma/client` — it's the wrong granularity for "no I/O," which is about specific external modules, not project-to-project layering.
- **`dependency-cruiser` is the right tool for this specific requirement.** It inspects the actual import graph, file by file, and can express exactly the rule you need:
- Layer a lightweight ESLint `no-restricted-imports` rule on top for in-editor fast feedback (dependency-cruiser's feedback loop is a CLI run, not inline squiggles); keep dependency-cruiser as the CI gate of record since it's more expressive (path patterns, not just module specifiers) and doesn't require type-aware parsing.

### 2. Branded `Minor` money type across the Prisma boundary

### 3. Postgres append-only audit table: two roles, hand-edited migration SQL

- `DATABASE_URL` used by `prisma migrate deploy` (CI/deploy step) connects as `dsar_migrator`.
- `DATABASE_URL` used by the running Next.js app connects as `dsar_runtime` — a **different** connection string, set as a separate env var (`RUNTIME_DATABASE_URL` or similar) that Prisma Client is instantiated with at request time. This is the part that's easy to get wrong: if the app boots with the migrator's connection string "because it's simpler," AC-34 is silently unenforced. Make this a startup assertion: on boot, run `SELECT current_user` and fail fast if it equals `dsar_migrator`.

### 4. zod 4, and the native `.toJSONSchema()` — not `zod-to-json-schema`

- **Use `z.toJSONSchema()` (built into zod 4), not the `zod-to-json-schema` npm package.** `zod-to-json-schema` stopped being actively maintained (reported as of Nov 2025) once zod shipped first-party JSON Schema generation. Depending on an unmaintained package for the exact mechanism that constrains LLM output (§8.2) is a needless liability — use the native method:
- **Ecosystem support for zod 4 is mature by Sept 2026** — tRPC v11+, `@tanstack/react-form`, Conform, and `react-hook-form` v8 (with `@hookform/resolvers` v4+) all support it. No blocker for `apps/web` form validation using the same schemas as `packages/schemas`.
- **Breaking changes worth knowing before writing schemas, not after:** `z.record()` now requires an explicit key schema (`z.record(z.string(), valueSchema)`, not `z.record(valueSchema)`) — relevant for `RulePack.rateSanityCeiling: Partial<Record<StaffGrade, number>>` and similar map-shaped PRD types. `z.input`/`z.output` inference around `.transform()`/defaults changed — audit any schema in `packages/schemas` that uses `.transform()` (e.g., deriving `claimedAmount`) for the inferred type actually matching intent.
- Zod 4 also claims materially faster parsing and a smaller bundle than v3 — a secondary benefit, irrelevant to the 50ms engine budget (AC-\* performance target) since validation happens at the boundary, not inside the hot `assess()` path, but a nice-to-have for the JSON Schema Admin/rule-pack-validation tooling.

### 5. PDF generation: `@react-pdf/renderer` for the internal record

| Option | Serverless fit | Font/layout control | Verdict |
|---|---|---|---|
| **`@react-pdf/renderer`** | Small (~2MB added to bundle), fast (<500ms typical) | Declarative React components (`<Page>`, `<View>`, `<Text>`), custom font embedding via `Font.register`, `fixed` prop repeats an element (e.g. page footer) on every page automatically | **Recommended.** Fits a TS/React team, small footprint, footer-on-every-page is a one-line `fixed` prop, not a re-implementation. |
| `pdfkit` | Very small, very fast, most resource-efficient of the options | Imperative canvas-style API; you manage page-break/footer logic yourself (listen for `pageAdded` events to redraw a footer) | **Solid alternative**, not the primary pick. Choose this instead if `@react-pdf/renderer`'s table support (community-plugin, not built-in) proves too limited for the assessment line table's column layout — pdfkit gives lower-level, more predictable control at the cost of more code. |
| Puppeteer / Playwright print-to-PDF | Poor — Chromium binary (`@sparticuz/chromium` et al.) adds ~50MB to the deployment; slower cold starts | Best possible fidelity (real HTML/CSS engine), but that fidelity is not the bottleneck here | **Reject.** A ~50MB browser dependency and an entire rendering engine's attack surface is disproportionate for a data-table document with plain-language rationale text. Only worth it if the internal record needed pixel-perfect reproduction of complex web layout, which it doesn't (§10's mockup is tables and status text). |
| Typst / LaTeX via external service | Adds an external service dependency | Best-in-class typography | **Reject for this milestone.** Typographic polish isn't a requirement here (this is an internal compliance record, not a rendered publication), and an external rendering service is an unnecessary new dependency and a new thing to keep available for a prototype. Revisit only if a later phase needs the notice or record to look like a formal legal letter. |

### 6. Stubbed identity, real authorisation: the Data Access Layer pattern

### 7. Testing: Vitest workspace + fast-check + literal golden-file fixtures (not snapshot testing)

- **Vitest 5.0** workspace: a root config declaring per-package projects — `packages/engine`/`packages/schemas`/`packages/rulepacks` run in `node` environment (they're pure, no DOM), `apps/web` component tests run in `jsdom`/`happy-dom`. Vitest's workspace/`projects` API has moved between recent minors — confirm the current field name (`test.projects` vs a separate `vitest.workspace.ts` file) against the installed version's docs at scaffold time rather than trusting either name here.
- **fast-check** for AC-07(b)'s 10,000-run integer invariant: build a `fc.record`-based arbitrary for `ExpenseLine` (bounded `quantity`/`unitRate` ranges, valid `unit`/`categoryCode` enums) and one for a minimal `RulePack`, then:
- **Golden-file fixtures for rule packs are deliberately literal JSON files, not Vitest snapshots.** This is a direct instruction from §14 ("changing a pack must break its golden files — that is the point") and Vitest's built-in `toMatchSnapshot()`/`toMatchInlineSnapshot()` is the wrong mechanism for it: snapshots are designed to be regenerated with `vitest -u`, which is exactly the failure mode you don't want — a developer changing a pack and blindly accepting the new "expected" output defeats the entire point of a golden file as a deliberate, reviewed diff. Instead:

### 8. Argue against: defaulting to Server Actions for state-changing writes

- **The PRD's own acceptance criteria already assume Route Handlers for the sensitive paths** — AC-01 tests `GET /api/assessments/{id}` and AC-16 tests `POST /assessments/{id}/signoff` as plain HTTP endpoints with status codes and response bodies. A Server Action doesn't have an ordinary URL/method/status-code shape to assert against in the same way; testing it requires either invoking the action function directly (bypassing the HTTP layer entirely, which undermines an authorization test that's supposed to prove the *request* is rejected) or reverse-engineering Next.js's internal POST-with-a-special-header convention. Route Handlers give you a stable, literal contract to write AC-01/AC-03/AC-16/AC-33's tests against.
- **Server Actions are harder to independently rate-limit, log, and audit.** Every state transition needs an `AuditEvent` (AC-35) with actor, server timestamp, before/after. That's naturally a Route Handler's job — parse and validate a typed request body with zod, run `requireRole()`, perform the transition, write the audit event, return a typed response — a shape that maps directly onto §6.5's `AuditEvent` schema. Server Actions can do the same work, but the calling convention (an opaque form action or a `"use server"` function reference passed to client code) obscures where the request/response boundary actually is, making it easier for a future contributor to skip a step under review pressure.
- **Server Actions have had real security footguns of their own class** — accidentally-public server actions (any `"use server"` export is reachable, not just the ones a form calls) is a documented Next.js gotcha, the same category of "the framework's convenience feature quietly widens the attack surface" as the middleware-as-security-boundary issue in Q6. For a tool whose entire value proposition is defensibility ("the engine applied rule X... never the model assessed the claim"), the state-machine's write paths should be the most explicit, most literally testable part of the codebase, not the part relying on a framework convention to stay narrow.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| pnpm workspaces + dependency-cruiser | Turborepo (added later) | Once CI time across engine/rulepacks/web/agent test suites becomes a real bottleneck (post-Phase-2, nine packs). Layer on top, don't replace. |
| pnpm workspaces + dependency-cruiser | Nx | Only if the project later grows into multiple genuinely separate services/languages (e.g. the Phase-3 identity-verification service becomes its own deployable with its own stack) and you need generators/distributed task execution across them. |
| `@react-pdf/renderer` | `pdfkit` | If the assessment-line table's column/row layout outgrows react-pdf's community table plugins and you want lower-level, more predictable pagination control. |
| Prisma 7 | Prisma 8 | Once 8.0.0 has a few months of field use and its migration notes are stable — re-evaluate at the start of Phase 2, not now. |
| Route Handlers for state transitions | Server Actions everywhere (as §15 literally suggests) | If the team strongly prefers the Server Actions DX and is willing to write an equivalent, explicit test harness that invokes action functions directly with mocked request context — technically possible, just more friction against AC-01/AC-16's literal HTTP-shaped wording. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| `zod-to-json-schema` (npm package) | Unmaintained since ~Nov 2025; zod 4 ships the same capability natively | `z.toJSONSchema()` (built into zod 4) |
| Prisma `Decimal` for money columns | Reintroduces a second numeric representation (`decimal.js`) into a codebase whose entire design goal is "integer minor units, no floats anywhere" | Prisma `Int`/`BigInt` + the `Minor` brand asserted at the mapper layer |
| SQLite for any environment, including local dev | Cannot express the GRANT/REVOKE role separation AC-34 requires — already correctly excluded in PROJECT.md's Key Decisions | Postgres in Docker (local) matching whatever's used in the demo/pilot host |
| Middleware (`middleware.ts`) as the actual authorization boundary | Documented Next.js footgun (CVE-2025-29927-class bypass risk); PRD non-negotiable #2 explicitly requires server-side role enforcement, not "hiding UI," and middleware-only checks are closer to hiding UI than to a real boundary | The Data Access Layer pattern (Q6) — `requireRole()` called at the data-fetching function itself |
| Vitest `toMatchSnapshot()` for rule-pack golden files | Designed to be blindly regenerated with `-u`, which is the exact failure mode §14 is warning against | Hand-authored `expected.json` fixtures compared with `toEqual()` |
| Puppeteer/Playwright print-to-PDF for the internal record | ~50MB Chromium layer for a data-table document that doesn't need HTML/CSS-engine fidelity; serverless-hostile | `@react-pdf/renderer` (or `pdfkit` as the fallback) |
| Nx or Turborepo's module-boundary features for the "no I/O in engine" requirement | Neither inspects the actual import graph at the granularity needed (specific modules like `fs`/`@prisma/client`), only task graphs or project tags | `dependency-cruiser` |

## Stack Patterns by Variant

- Add Turborepo on top of the existing pnpm workspace (non-invasive — add `turbo.json`, no package moves required)
- Because at that point there's finally something worth caching (nine packs' worth of golden-file test runs, repeated on every PR)
- Reconsider Nx at that point, specifically for its cross-service generators and dependency graph across what would then be a polyglot or multi-deployable repo
- Because that's the actual scenario Nx is built for — not this milestone's single Next.js app plus internal packages

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| Next.js 16.x | React 19.x, TypeScript 5.9.x | Standard current pairing; verify exact React peer range in `next@16`'s package.json at scaffold time. |
| zod 4.x | tRPC v11+, react-hook-form v8 + `@hookform/resolvers` v4+, `@tanstack/react-form` | If any of these libraries end up in `apps/web`, pin to the versions that declare zod 4 support explicitly — some transitional releases supported both v3 and v4 peer ranges. |
| Prisma 7.x | Postgres 14–18 | No version-specific risk for the GRANT/REVOKE pattern in Q3 — standard SQL privilege commands, unchanged across these Postgres majors. |
| Vitest 5.x | `@fast-check/vitest` 0.4.x | Confirm `@fast-check/vitest`'s peer range covers Vitest 5 at install time — it was last published a few months before Vitest 5's release per the source checked, so verify rather than assume. |

## Sources

- [How to Pick a Monorepo Tool in 2026](https://dev.to/yobox/how-to-pick-a-monorepo-tool-in-2026-kko) — MEDIUM
- [Monorepo Strategy 2026: Turborepo vs Nx Decision Guide](https://www.digitalapplied.com/blog/monorepo-strategy-2026-turborepo-nx-decision-matrix) — MEDIUM
- [dependency-cruiser: Restrict Imports in JavaScript](https://spin.atomicobject.com/dependency-cruiser-imports/) — MEDIUM
- [Taking Frontend Architecture Serious With Dependency-cruiser (Xebia)](https://xebia.com/blog/taking-frontend-architecture-serious-with-dependency-cruiser/) — MEDIUM
- [Three Ways to Enforce Module Boundaries in an Nx Monorepo](https://www.stefanos-lignos.dev/posts/nx-module-boundaries) — MEDIUM
- [Prisma Docs — Fields & types (Decimal)](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types) — HIGH (vendor docs)
- [Prisma Docs — Managing privileges with GRANT/REVOKE](https://www.prisma.io/dataguide/postgresql/authentication-and-authorization/managing-privileges) — HIGH (vendor docs)
- [Prisma Docs — About the shadow database](https://www.prisma.io/docs/orm/v7/prisma-migrate/understanding-prisma-migrate/shadow-database) — HIGH (vendor docs)
- [Zod — Release notes v4](https://zod.dev/v4) — HIGH (vendor docs)
- [Zod v4 & Gemini: Fix Structured Output with z.toJSONSchema](https://www.buildwithmatija.com/blog/zod-v4-gemini-fix-structured-output-z-tojsonschema) — MEDIUM
- [Migrating to Zod 4: Breaking Changes Guide](https://pockit.tools/blog/zod-v4-migration-guide-breaking-changes-new-features/) — MEDIUM
- [PDF Generation on the Server: Puppeteer vs @react-pdf/renderer](https://dev.to/iurii_rogulia/pdf-generation-on-the-server-puppeteer-vs-react-pdfrenderer-a-production-comparison-44cg) — MEDIUM
- [Best JavaScript PDF libraries 2026 (Nutrient.io)](https://www.nutrient.io/blog/javascript-pdf-libraries/) — MEDIUM
- [Building authentication in Next.js App Router: 2026 guide (WorkOS)](https://workos.com/blog/nextjs-app-router-authentication-guide-2026) — MEDIUM
- [Next.js App Router authentication demands defense in depth](https://nhimg.org/articles/nextjs-app-router-authentication-demands-defense-in-depth/) — MEDIUM (discusses CVE-2025-29927)
- [fast-check official documentation](https://fast-check.dev/) — HIGH (vendor docs)
- [@fast-check/vitest — npm](https://www.npmjs.com/package/@fast-check/vitest) — MEDIUM
- [Next.js blog / changelog](https://nextjs.org/blog) — HIGH (vendor)
- [Next.js May/Aug 2026 security releases (Vercel changelog)](https://vercel.com/changelog/next-js-may-2026-security-release) — HIGH (vendor)
- [PostgreSQL — Release notes / versioning](https://www.postgresql.org/docs/release/) — HIGH (vendor)
- npm registry version lookups (zod, vitest, pnpm, playwright, prisma) via web search snapshots dated 2026-09-13 — MEDIUM (cross-checked, but re-verify exact patch numbers with `npm view <pkg> version` before pinning `package.json`)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
