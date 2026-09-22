# Stack Research

**Domain:** Legal-tech / regulated internal tool — deterministic rules engine + LLM-boundary web app (DSAR Fee Assessment Agent)
**Researched:** 2026-09-13
**Confidence:** MEDIUM overall (HIGH on architecture patterns and package choices cross-checked across multiple sources; MEDIUM/LOW on exact patch versions — pin at scaffold time via `npm view <pkg> version`, don't trust any date-stamped number here as final)

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

```bash
# Core
pnpm add zod@^4 @react-pdf/renderer typescript

# Prisma
pnpm add -D prisma@^7
pnpm add @prisma/client@^7

# Web
pnpm add next@^16 react react-dom tailwindcss@^4

# Testing
pnpm add -D vitest@^5 @vitest/ui fast-check @fast-check/vitest playwright@^1.63 @testcontainers/postgresql

# Architecture enforcement
pnpm add -D dependency-cruiser eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

---

## Answers to the 8 open questions

### 1. Monorepo tooling: pnpm workspaces, plain — not Turborepo, not Nx (yet)

**Recommendation: pnpm workspaces alone**, with `dependency-cruiser` doing the boundary enforcement. Do not add Turborepo or Nx for this milestone.

- This repo has one app and six packages. Turborepo's entire value proposition is caching across a large, slow CI matrix — at this scale there's nothing to cache yet, and adding it now is process weight with no payoff. It's a trivial, non-invasive addition later (`pnpm add -D turbo`, a `turbo.json`) if CI time becomes a problem post-Phase-2 (nine packs, more tests) — nothing about the package layout has to change to add it.
- Nx is the wrong tool here specifically *because* of its main selling point: it wants to own code generation, task graphs, and (via paid Nx Cloud) distributed execution. None of that is needed for a prototype with one contributor and no polyglot services. Nx's learning curve is real and buys nothing this milestone.
- Critically: **neither Turborepo nor Nx's built-in module-boundary features are the right tool for "packages/engine must be provably free of I/O, network and LLM imports."** Turborepo doesn't understand imports at all — it only sees declared task dependencies between package.json scripts, not what a file inside `packages/engine` actually imports. Nx's `enforce-module-boundaries` rule works off *tags* you assign per project (e.g., `type:pure`), not off actual import targets like `fs`, `node:net`, or `@prisma/client` — it's the wrong granularity for "no I/O," which is about specific external modules, not project-to-project layering.
- **`dependency-cruiser` is the right tool for this specific requirement.** It inspects the actual import graph, file by file, and can express exactly the rule you need:

```js
// .dependency-cruiser.cjs (root)
module.exports = {
  forbidden: [
    {
      name: 'engine-no-io',
      comment: 'packages/engine must be pure: no fs, no network, no Prisma, no LLM client',
      severity: 'error',
      from: { path: '^packages/engine' },
      to: {
        path: [
          '^node:(fs|net|http|https|dns|child_process)',
          '^(fs|net|http|https|dns|child_process)$',
          '@prisma/client',
          '^packages/agent',
          '^packages/audit',   // audit writer does I/O; engine must not import it
        ],
      },
    },
    {
      name: 'engine-no-clock',
      comment: 'engine must take `now` as an argument, never read the system clock',
      severity: 'error',
      from: { path: '^packages/engine' },
      to: { path: '^node:process$' }, // catches Date.now() indirection less reliably — pair with an ESLint no-restricted-globals rule for `Date.now`/`new Date()` inside packages/engine
    },
  ],
  options: { tsPreCompilationDeps: true },
};
```

  Run `npx depcruise packages/engine --config .dependency-cruiser.cjs` as its own CI step (not folded into ESLint) — it needs its own binary and its own failure mode ("architecture violation") distinct from a style lint failure, and it's the artifact you point to when defending "the engine is provably pure" the same way the PRD wants you to point to a pack version.
- Layer a lightweight ESLint `no-restricted-imports` rule on top for in-editor fast feedback (dependency-cruiser's feedback loop is a CLI run, not inline squiggles); keep dependency-cruiser as the CI gate of record since it's more expressive (path patterns, not just module specifiers) and doesn't require type-aware parsing.

**Confidence: HIGH** — the pnpm-vs-Turborepo-vs-Nx tradeoffs and dependency-cruiser's suitability are corroborated across multiple 2026 sources.

### 2. Branded `Minor` money type across the Prisma boundary

The type system alone cannot stop Prisma from returning a bare `number` — Prisma generates its client types from the schema, and an `Int` column is typed `number`, full stop. There is no Prisma configuration that makes it return a branded type. The brand has to be **re-asserted at a boundary you control**, not trusted to propagate through the ORM. Three layers, not one:

1. **Repository/mapper layer is mandatory, not optional.** Nothing outside a small `packages/db` (or a `repositories/` folder colocated with Prisma) may import `@prisma/client`'s generated model types directly. Every read goes through a mapper function that converts the raw Prisma row into the domain type from `packages/schemas`, calling a smart constructor at the money fields:

```ts
// packages/schemas/src/money.ts
declare const MinorBrand: unique symbol;
export type Minor = number & { readonly [MinorBrand]: true };

export function asMinor(n: number): Minor {
  if (!Number.isInteger(n)) {
    throw new Error(`Expected integer minor units, got ${n}`);
  }
  return n as Minor;
}

// packages/db/src/mappers/expenseLine.ts
import type { ExpenseLine as PrismaExpenseLine } from '@prisma/client';
import { asMinor } from '@dsar/schemas';

export function toDomainExpenseLine(row: PrismaExpenseLine): ExpenseLine {
  return {
    ...row,
    unitRate: asMinor(row.unitRate),
    claimedAmount: asMinor(row.claimedAmount),
  };
}
```

   Enforce "no raw `@prisma/client` model type outside `packages/db`" with the same dependency-cruiser config as Q1 — this is an import-graph rule, not a type-system rule, which is exactly why it's the layer that actually holds.

2. **Prisma schema uses `Int`/`BigInt`, never `Decimal`, for every money column.** `Decimal` (backed by `decimal.js` in the generated client) is for genuinely fractional values and is a strictly worse fit here — the PRD's whole point is integer minor units. Using `Decimal` would reintroduce exactly the float/precision ambiguity the branded type exists to prevent, and adds a second numeric library into the money path that the "no floats anywhere" constraint doesn't want. Pick `Int` for most fields; use `BigInt`/`Int` sized appropriately for VND/high-magnitude currencies where minor-unit values can exceed 2^31 in aggregate caps.

3. **The AC-07(a) lint rule is the belt-and-braces layer, and it has to be hand-written — no off-the-shelf package does this.** No existing ESLint rule bans "identifier name matches `/(amount|total|rate|fee|cap)$/i` and its resolved type is exactly `number`, not `Minor`." This needs a small type-aware custom rule built with `@typescript-eslint/utils`'s `RuleCreator`, living in a local `tools/eslint-local-rules` package loaded via `eslint-plugin-local-rules` (or `packages/eslint-config` if you prefer to fold it into a shared config package). Sketch:

```ts
// tools/eslint-local-rules/no-bare-money-number.ts
import { ESLintUtils } from '@typescript-eslint/utils';

const MONEY_NAME = /(amount|total|rate|fee|cap)$/i;

export const rule = ESLintUtils.RuleCreator(() => '')({
  name: 'no-bare-money-number',
  meta: { type: 'problem', schema: [], messages: { bareNumber: '{{name}} must be typed Minor, not number' } },
  defaultOptions: [],
  create(context) {
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();
    return {
      Identifier(node) {
        if (!MONEY_NAME.test(node.name)) return;
        const tsNode = services.esTreeNodeToTSNodeMap.get(node);
        const type = checker.getTypeAtLocation(tsNode);
        if (checker.typeToString(type) === 'number') {
          context.report({ node, messageId: 'bareNumber', data: { name: node.name } });
        }
      },
    };
  },
});
```

   This requires `parserOptions.project` (type-aware linting), which is slower — scope it to `packages/engine` and `packages/schemas` only (as AC-07(a) specifies), not the whole monorepo, to keep lint time reasonable.

**Confidence: MEDIUM.** The repository/mapper + `Int`-not-`Decimal` pattern is well-established and corroborated. The specific custom-ESLint-rule sketch is my own construction from `@typescript-eslint/utils` primitives (no ready package implements AC-07(a) verbatim) — treat the sketch as a starting point to test, not a verified snippet.

### 3. Postgres append-only audit table: two roles, hand-edited migration SQL

Prisma has no schema-language concept of `GRANT`/`REVOKE` — there is no way to express "no UPDATE/DELETE for this role" in `schema.prisma`. The grant has to be added as raw SQL inside a Prisma migration file, and the two roles are a deployment-time concern, not a Prisma concern.

**Two Postgres roles:**

```sql
-- Run once, by a superuser/admin connection, NOT via Prisma migrate
CREATE ROLE dsar_migrator LOGIN PASSWORD '...' NOCREATEDB NOCREATEROLE NOSUPERUSER;
CREATE ROLE dsar_runtime  LOGIN PASSWORD '...' NOCREATEDB NOCREATEROLE NOSUPERUSER;

GRANT ALL ON SCHEMA public TO dsar_migrator;      -- owns DDL: CREATE/ALTER/DROP TABLE
GRANT USAGE ON SCHEMA public TO dsar_runtime;     -- app only ever does DML
```

- `DATABASE_URL` used by `prisma migrate deploy` (CI/deploy step) connects as `dsar_migrator`.
- `DATABASE_URL` used by the running Next.js app connects as `dsar_runtime` — a **different** connection string, set as a separate env var (`RUNTIME_DATABASE_URL` or similar) that Prisma Client is instantiated with at request time. This is the part that's easy to get wrong: if the app boots with the migrator's connection string "because it's simpler," AC-34 is silently unenforced. Make this a startup assertion: on boot, run `SELECT current_user` and fail fast if it equals `dsar_migrator`.

**Wiring the grant into a Prisma migration** — generate an empty migration and hand-edit it:

```bash
npx prisma migrate dev --create-only --name audit_append_only
```

```sql
-- prisma/migrations/<timestamp>_audit_append_only/migration.sql
-- (Prisma applies this verbatim as part of the normal migration chain — it re-runs
--  on every fresh `migrate deploy`, so this survives a full reset, unlike a one-off
--  psql script would.)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO dsar_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dsar_runtime;

REVOKE UPDATE, DELETE ON "AuditEvent" FROM dsar_runtime;
GRANT  SELECT, INSERT ON "AuditEvent" TO dsar_runtime;

-- Belt-and-braces: also revoke DELETE on SIGNED_OFF-adjacent tables that must
-- never be hard-deleted (Assessment, SignOff) if the product's "immutable once
-- signed off" guarantee should also hold at the DB layer, not just app logic.
```

Because new tables created by *later* migrations won't automatically inherit these grants (`ALL TABLES IN SCHEMA public` only applies to tables that exist at the time the statement runs), **every future migration that adds a table needs its own `GRANT ... TO dsar_runtime` line** appended by hand, or you switch to `ALTER DEFAULT PRIVILEGES FOR ROLE dsar_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dsar_runtime;` (run once, as `dsar_migrator`) so it applies automatically to tables that role creates from then on — recommended, since it removes the "forgot to grant the new table" failure mode. Keep the explicit `REVOKE ... AuditEvent` as its own line in each migration that touches the audit table, since default-privilege revocation for a *specific* table isn't expressible the same way (default privileges apply per-role-per-object-type, not per-object).

**Testing the grant is in force (AC-34):** this must be an integration test against a real Postgres instance authenticated as `dsar_runtime` — not a unit test, not a mocked Prisma client, because the thing under test is a database-level privilege, invisible to Prisma's type system or query builder.

```ts
// tests/auth/audit-append-only.integration.test.ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';

test('dsar_runtime cannot UPDATE or DELETE AuditEvent', async () => {
  const runtimeClient = new Client({ connectionString: process.env.RUNTIME_TEST_DATABASE_URL });
  await runtimeClient.connect();

  await expect(
    runtimeClient.query(`UPDATE "AuditEvent" SET payload = '{}' WHERE id = $1`, [existingId])
  ).rejects.toMatchObject({ code: '42501' }); // insufficient_privilege

  await expect(
    runtimeClient.query(`DELETE FROM "AuditEvent" WHERE id = $1`, [existingId])
  ).rejects.toMatchObject({ code: '42501' });

  await runtimeClient.end();
});
```

Run this against either a `@testcontainers/postgresql` ephemeral instance (migrations + grants applied fresh each run — closest to production reality) or the same Docker Compose Postgres used for local dev, seeded with both roles. Testcontainers is the better choice for CI since it doesn't depend on a pre-existing compose stack being up.

**Confidence: HIGH** on the mechanism (GRANT/REVOKE via hand-edited migration SQL is the standard, only way to do this with Prisma — corroborated across Prisma's own docs and community sources). **MEDIUM** on the exact default-privileges recommendation — worth validating against the current Postgres version's exact `ALTER DEFAULT PRIVILEGES` semantics before relying on it in Phase 2 when more tables are added.

### 4. zod 4, and the native `.toJSONSchema()` — not `zod-to-json-schema`

Build on **zod 4** (current: 4.6.x) from day one — there's no version to migrate off since this is greenfield. Two things matter for the LLM boundary specifically:

- **Use `z.toJSONSchema()` (built into zod 4), not the `zod-to-json-schema` npm package.** `zod-to-json-schema` stopped being actively maintained (reported as of Nov 2025) once zod shipped first-party JSON Schema generation. Depending on an unmaintained package for the exact mechanism that constrains LLM output (§8.2) is a needless liability — use the native method:

```ts
import { z } from 'zod';
export const CategorySuggestionSchema = z.object({
  categoryCode: z.enum([...]),
  confidence: z.number().min(0).max(1),
});
export const categorySuggestionJsonSchema = z.toJSONSchema(CategorySuggestionSchema);
```

- **Ecosystem support for zod 4 is mature by Sept 2026** — tRPC v11+, `@tanstack/react-form`, Conform, and `react-hook-form` v8 (with `@hookform/resolvers` v4+) all support it. No blocker for `apps/web` form validation using the same schemas as `packages/schemas`.
- **Breaking changes worth knowing before writing schemas, not after:** `z.record()` now requires an explicit key schema (`z.record(z.string(), valueSchema)`, not `z.record(valueSchema)`) — relevant for `RulePack.rateSanityCeiling: Partial<Record<StaffGrade, number>>` and similar map-shaped PRD types. `z.input`/`z.output` inference around `.transform()`/defaults changed — audit any schema in `packages/schemas` that uses `.transform()` (e.g., deriving `claimedAmount`) for the inferred type actually matching intent.
- Zod 4 also claims materially faster parsing and a smaller bundle than v3 — a secondary benefit, irrelevant to the 50ms engine budget (AC-\* performance target) since validation happens at the boundary, not inside the hot `assess()` path, but a nice-to-have for the JSON Schema Admin/rule-pack-validation tooling.

**Confidence: HIGH** — corroborated across zod's own release notes and multiple third-party migration write-ups.

### 5. PDF generation: `@react-pdf/renderer` for the internal record

Compared against the PRD's implicit candidate set:

| Option | Serverless fit | Font/layout control | Verdict |
|---|---|---|---|
| **`@react-pdf/renderer`** | Small (~2MB added to bundle), fast (<500ms typical) | Declarative React components (`<Page>`, `<View>`, `<Text>`), custom font embedding via `Font.register`, `fixed` prop repeats an element (e.g. page footer) on every page automatically | **Recommended.** Fits a TS/React team, small footprint, footer-on-every-page is a one-line `fixed` prop, not a re-implementation. |
| `pdfkit` | Very small, very fast, most resource-efficient of the options | Imperative canvas-style API; you manage page-break/footer logic yourself (listen for `pageAdded` events to redraw a footer) | **Solid alternative**, not the primary pick. Choose this instead if `@react-pdf/renderer`'s table support (community-plugin, not built-in) proves too limited for the assessment line table's column layout — pdfkit gives lower-level, more predictable control at the cost of more code. |
| Puppeteer / Playwright print-to-PDF | Poor — Chromium binary (`@sparticuz/chromium` et al.) adds ~50MB to the deployment; slower cold starts | Best possible fidelity (real HTML/CSS engine), but that fidelity is not the bottleneck here | **Reject.** A ~50MB browser dependency and an entire rendering engine's attack surface is disproportionate for a data-table document with plain-language rationale text. Only worth it if the internal record needed pixel-perfect reproduction of complex web layout, which it doesn't (§10's mockup is tables and status text). |
| Typst / LaTeX via external service | Adds an external service dependency | Best-in-class typography | **Reject for this milestone.** Typographic polish isn't a requirement here (this is an internal compliance record, not a rendered publication), and an external rendering service is an unnecessary new dependency and a new thing to keep available for a prototype. Revisit only if a later phase needs the notice or record to look like a formal legal letter. |

**Confidence: MEDIUM** — the bundle-size and footprint numbers are drawn from third-party benchmark write-ups current to 2026, not vendor-published figures; treat the specific megabyte numbers as indicative, not exact.

### 6. Stubbed identity, real authorisation: the Data Access Layer pattern

This is now a named, documented pattern (Next.js's own guidance, reinforced after CVE-2025-29927 showed middleware-only auth is bypassable) — and it maps almost exactly onto the PRD's non-negotiable #2 ("HR never sees an unreviewed assessment — enforced server-side by role, not by hiding UI").

Structure it in three layers, with the identity source isolated to exactly one of them:

1. **`packages/auth` defines the interface, not the implementation.**

```ts
// packages/auth/src/session.ts
export type Session = { user: UserRef; role: Role };
export interface IdentityProvider {
  getSession(request: Request): Promise<Session | null>;
}
```

   The stubbed prototype implementation resolves a session from a signed cookie set by a `/dev-login` route that lets a developer/demo user pick one of the seeded users (`HR_PREPARER`, `LEGAL_REVIEWER`, etc.) — never real SSO. A later pilot swaps this one implementation (e.g., for an OIDC/SAML token verifier) without touching anything downstream, because everything downstream calls the interface, not the stub.

2. **A single `requireRole()` (or `withRole()` wrapper) is the only place authorization decisions are made, and it is called at the data-access point, not in the route/page shell.**

```ts
// packages/auth/src/guard.ts
export async function requireRole(request: Request, role: Role): Promise<Session> {
  const session = await identityProvider.getSession(request);
  if (!session || session.role !== role) {
    throw new ForbiddenError(); // maps to 403 at the route handler
  }
  return session;
}

// apps/web/app/api/assessments/[id]/route.ts
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await requireRole(request, 'LEGAL_REVIEWER'); // or role-set check per matter
  const assessment = await getAssessment(params.id, session); // data fetch itself re-checks, see below
  return Response.json(assessment);
}
```

   Crucially, the **data-fetching function itself** (e.g. `getAssessment`) should also assert the caller's role/permit against the matter's state — not just the route handler — so a Server Component that queries data directly (bypassing an API route) can't accidentally skip the check. This is what makes AC-01/AC-02 hold even if someone adds a new Server Component page later and forgets the route-handler-level guard: the guard lives with the data, not with the page.

3. **Middleware does routing convenience only — never authorization.** `middleware.ts` may redirect an unauthenticated request to `/login` for UX speed, but every Server Action and Route Handler re-checks independently. This is the explicit lesson from CVE-2025-29927 (a header-spoofing bypass of Next.js middleware-based auth checks that affected many apps relying on middleware as the sole gate) — treat middleware as advisory, `requireRole()` at the data layer as the actual boundary.

**Confidence: HIGH** — this is Next.js's own current published guidance, not a third-party pattern, and is corroborated by the CVE writeups and multiple 2026 auth guides.

### 7. Testing: Vitest workspace + fast-check + literal golden-file fixtures (not snapshot testing)

- **Vitest 5.0** workspace: a root config declaring per-package projects — `packages/engine`/`packages/schemas`/`packages/rulepacks` run in `node` environment (they're pure, no DOM), `apps/web` component tests run in `jsdom`/`happy-dom`. Vitest's workspace/`projects` API has moved between recent minors — confirm the current field name (`test.projects` vs a separate `vitest.workspace.ts` file) against the installed version's docs at scaffold time rather than trusting either name here.
- **fast-check** for AC-07(b)'s 10,000-run integer invariant: build a `fc.record`-based arbitrary for `ExpenseLine` (bounded `quantity`/`unitRate` ranges, valid `unit`/`categoryCode` enums) and one for a minimal `RulePack`, then:

```ts
import fc from 'fast-check';
import { assess } from '@dsar/engine';

test('every money field in Assessment is an integer', () => {
  fc.assert(
    fc.property(arbitraryExpenseLines, arbitraryRulePack, (lines, pack) => {
      const assessment = assess(matterFixture, lines, pack, fixedNow);
      for (const line of assessment.lines) {
        expect(Number.isInteger(line.engineAmount)).toBe(true);
      }
      expect(Number.isInteger(assessment.totals.draftBaseline)).toBe(true);
      // ...remaining Totals fields
    }),
    { numRuns: 10000 },
  );
});
```

  Add `@fast-check/vitest` only if you want `test.prop(...)` sugar for other, smaller property tests around `applyCap` boundary behaviour — not required for this specific AC.

- **Golden-file fixtures for rule packs are deliberately literal JSON files, not Vitest snapshots.** This is a direct instruction from §14 ("changing a pack must break its golden files — that is the point") and Vitest's built-in `toMatchSnapshot()`/`toMatchInlineSnapshot()` is the wrong mechanism for it: snapshots are designed to be regenerated with `vitest -u`, which is exactly the failure mode you don't want — a developer changing a pack and blindly accepting the new "expected" output defeats the entire point of a golden file as a deliberate, reviewed diff. Instead:

```
/tests/packs/HK-PDPO/allow-all/input.json
/tests/packs/HK-PDPO/allow-all/expected.json
/tests/packs/HK-PDPO/rate-sanity-flag/input.json
/tests/packs/HK-PDPO/rate-sanity-flag/expected.json
...
```

```ts
// tests/packs/run-golden.test.ts
import { readdirSync } from 'node:fs';
for (const packDir of readdirSync('tests/packs')) {
  for (const caseDir of readdirSync(`tests/packs/${packDir}`)) {
    test(`${packDir}/${caseDir}`, () => {
      const input = readJson(`tests/packs/${packDir}/${caseDir}/input.json`);
      const expected = readJson(`tests/packs/${packDir}/${caseDir}/expected.json`);
      const actual = assess(input.matter, input.lines, loadPack(packDir), input.now);
      expect(actual).toEqual(expected); // NOT toMatchSnapshot — expected.json is hand-authored/reviewed, not auto-generated
    });
  }
}
```

  A change to `expected.json` is then a normal, visible line in a PR diff — reviewable by the authoring lawyer alongside the pack change itself, which is exactly the audit trail the PRD wants for a pack version bump.

**Confidence: HIGH** on the golden-file-vs-snapshot argument (this is a direct, load-bearing reading of §14's own wording, not an external claim). **MEDIUM** on exact Vitest workspace API surface — verify at scaffold time.

### 8. Argue against: defaulting to Server Actions for state-changing writes

§15 lists `apps/web` as using "Next.js (App Router), TypeScript, server actions." Keep Server Actions for low-stakes, UI-local mutations (saving an in-progress expense-line edit before submission, for instance) — but **do not** use them for anything that crosses a `MatterStatus` transition, a disposition, or a sign-off. Use explicit Route Handlers under `/app/api/*` for those instead. Reasons:

- **The PRD's own acceptance criteria already assume Route Handlers for the sensitive paths** — AC-01 tests `GET /api/assessments/{id}` and AC-16 tests `POST /assessments/{id}/signoff` as plain HTTP endpoints with status codes and response bodies. A Server Action doesn't have an ordinary URL/method/status-code shape to assert against in the same way; testing it requires either invoking the action function directly (bypassing the HTTP layer entirely, which undermines an authorization test that's supposed to prove the *request* is rejected) or reverse-engineering Next.js's internal POST-with-a-special-header convention. Route Handlers give you a stable, literal contract to write AC-01/AC-03/AC-16/AC-33's tests against.
- **Server Actions are harder to independently rate-limit, log, and audit.** Every state transition needs an `AuditEvent` (AC-35) with actor, server timestamp, before/after. That's naturally a Route Handler's job — parse and validate a typed request body with zod, run `requireRole()`, perform the transition, write the audit event, return a typed response — a shape that maps directly onto §6.5's `AuditEvent` schema. Server Actions can do the same work, but the calling convention (an opaque form action or a `"use server"` function reference passed to client code) obscures where the request/response boundary actually is, making it easier for a future contributor to skip a step under review pressure.
- **Server Actions have had real security footguns of their own class** — accidentally-public server actions (any `"use server"` export is reachable, not just the ones a form calls) is a documented Next.js gotcha, the same category of "the framework's convenience feature quietly widens the attack surface" as the middleware-as-security-boundary issue in Q6. For a tool whose entire value proposition is defensibility ("the engine applied rule X... never the model assessed the claim"), the state-machine's write paths should be the most explicit, most literally testable part of the codebase, not the part relying on a framework convention to stay narrow.

Net effect on the package layout: `apps/web/app/api/matters/[id]/*`, `apps/web/app/api/assessments/[id]/*` route handlers own every state transition and every AC in §13's "Access control," "Human-in-the-loop," and "Immutability and audit" sections. Server Actions are fine for HR's intake-form field-level saves and Legal's in-progress (not-yet-submitted) disposition notes — anything that doesn't move the state machine or touch the audit log.

**Confidence: MEDIUM-HIGH.** The Server-Actions-security-footgun and DAL-pattern sourcing is solid (Q6); the specific recommendation to route *state-transition* writes through Route Handlers rather than Server Actions is my own synthesis against the PRD's ACs, not a claim lifted from an external source — treat it as an architectural argument to weigh, not an industry consensus.

---

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

**If CI time becomes a bottleneck once all nine rule packs and their golden-file suites exist (Phase 2):**
- Add Turborepo on top of the existing pnpm workspace (non-invasive — add `turbo.json`, no package moves required)
- Because at that point there's finally something worth caching (nine packs' worth of golden-file test runs, repeated on every PR)

**If a later phase (§16 Phase 3+) spins up the identity-verification agent as a genuinely separate deployable service:**
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

---
*Stack research for: DSAR Fee Assessment Agent (legal-tech, deterministic-engine + LLM-boundary web app)*
*Researched: 2026-09-13*
