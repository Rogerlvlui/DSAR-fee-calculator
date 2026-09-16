# Phase 3: Rule Packs and Pack Admin - Research

**Researched:** 2026-09-16
**Domain:** Versioned-data rule engine inputs (zod-schema-governed JSON), build-time validation gates, and an audited admin workflow over a package that has no database or web app yet
**Confidence:** HIGH on schema/loader/validator/content questions (everything traces to code already read this session or PRD text quoted verbatim); MEDIUM-LOW on the `/admin/rulepacks` screen and PACK-06's DB enforcement, both of which depend on infrastructure (`apps/web`, Docker) that does not exist yet — this is a fact, not a research gap, and CONTEXT.md already names it as Claude's Discretion.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Numbering continues from Phase 2's D-11..D-13 so decision IDs stay unique across the project.

**Who authors the pack content**

- **D-14:** Authoring is **hybrid**. Claude authors as real content only the rules the PRD actually specifies — HK's §7.5 extract and SG's five named rules in §7.6 — extrapolating nothing from outside the document (NS-8 forbids runtime legal research, and the same discipline applies at authoring time). The remaining ~37 HK and SG rule bodies ship as visibly unauthored placeholders for the product owner to write.
- **D-15:** A rule declares itself unauthored through a fixed **`UNAUTHORED` token in `verificationNote`**, followed by the PRD §7.4 note for that jurisdiction. The validator refuses ACTIVE for any pack still carrying the token.
- **D-16:** "HK and SG reach ACTIVE" (Success Criterion 2) is satisfied at Phase 6, not here. The product owner authors **SG's six §14-fixture categories now** — the floor Phase 3.1's demo needs — plus whatever else comes easily. SG reaches ACTIVE only if all 21 are done; otherwise both packs stay DRAFT and **full HK and SG authoring is an explicit obligation discharged before Phase 6's convergence gate**, where AC-09's golden files must pass against real pack content.
- **D-17:** A pack's `authoredBy` / `reviewedBy` name a **seeded prototype user** — a fixed ULID in the seed script, a `displayName` naming the product owner as authoring counsel, and a non-routable address (`example.invalid`). Author and reviewer being the same person is **intentional and is not a conflict** — PACK-07 / AC-41a still applies and is not weakened by it.

**Stub pack values for the seven unauthored jurisdictions**

- **D-18:** Stub `constraints` ship as a **`StubConstraints` shape: all eleven keys present, every value `null`** — `null` meaning "not researched", not "false". A pack carrying any `null` constraint cannot reach ACTIVE. This is a new additive type, not a modification of the frozen `RulePackConstraintsSchema`.
- **D-19:** The 147 stub `categoryRules` (21 × 7) are **literal committed JSON, guarded by a regenerate-and-compare test** that re-runs the generator in memory and asserts byte-equality against the committed files — the same drift-test pattern Phase 1 already uses for its three JSON Schema artifacts.

**Carried forward — still binding, not to be re-litigated**

- **D-02 / D-09 [informational]:** The schemas freeze is additive-only. `RulePack` already carries `flatFee` (no `currency` sub-field, per PRD §6.0), so PACK-12 needs no schema change to add the field itself (though see Pitfall 5 below — it may need one additive field). Any breaking change escalates to the product owner before the phase continues.
- **Pack content frozen at ACTIVE [informational]:** Already decided in PROJECT.md — frozen at activation, not once referenced. Simpler to state and enforce, and needs no runtime referenced-by check.
- **PACK-11's banned words [informational]:** `LEGAL_CONCLUSION_BANNED_WORDS` already exists in `packages/schemas/src/constants.ts`, and Phase 2 proved a case-sensitive word-boundary matcher against real message text. Reuse both; do not author a second list or a second matcher.
- **PACK-08 [informational]:** The sign-off-side block is Phase 7's. Not this phase's to build.

### Claude's Discretion

**1. Releasing a stub file from D-19's drift test.** Leaning: scope the test by D-15's `UNAUTHORED` token — regenerate and compare only rules whose `verificationNote` still carries it, so a rule leaves the test's scope the moment counsel writes real reasoning into it. One marker then governs both the ACTIVE gate and the drift test.

**2. Phase shape against missing infrastructure — the area with the largest planning consequence.** Hard facts: `apps/web` does not exist (confirmed this session — see Environment Availability); Docker is unavailable (confirmed this session: `docker: command not found`); Phase 3.1's demo depends on this phase for SG pack content only. Bounds: PACK-01/02/03/09/10/11/12 are fully deliverable today with no web app and no database, and must not sit behind infrastructure work. PACK-06's database enforcement cannot be completed here; if deferred, it is deferred **explicitly to Phase 3.2** with the reason recorded, never marked done on a service-layer substitute. Whether `/admin/rulepacks` is scaffolded here or waits is genuinely open.

**3. Where the build-time gates run, and where STALE is determined.** No build step for packs exists yet — `package.json` has `test`, `typecheck`, `lint`, `depcruise`, `schema:json` and `db:*` only. The binding constraint: every gate ships with a violating fixture proving it fires. Separately: `status` is a stored enum in the pack JSON, but STALE is a function of `reviewDueOn` against the current date — this session found **Phase 2 has already made this exact call** (see Pitfall 1 / Architecture Pattern 3 below): deriving STALE at read time from an injected `now`, never trusting a stored status literal alone.

**4. Smaller items resolvable from the PRD, recorded so they are not re-opened.** `rateSanityCeiling` is `z.partialRecord`, so an empty `{}` already means "no ceiling researched". An unresearched public-agency posture takes `NO_EXPRESS_AUTHORITY` (PRD §7.4's own convention for HK, extended to JP/KR's "counsel to determine" rows). `requestorNoticeTemplate` on a stub is a required string that can never be selected for a matter; an empty string is defensible with a comment explaining why.

### Deferred Ideas (OUT OF SCOPE)

- **Full HK and SG authoring across all 21 categories** (D-16) — scheduled, not dropped: discharged before Phase 6's convergence gate.
- **PACK-06's database-level enforcement of ACTIVE-content immutability** — cannot be completed here; Docker is unavailable. If deferred, goes to **Phase 3.2** with the reason recorded. Must never be marked done on a service-layer substitute.
- **PACK-08's sign-off-side block** — Phase 7.
- **Authoring the remaining seven packs** — V2-PACK-01, each gated on named local counsel. Day-one DRAFT is intended, not a gap.
- **Swapping the seeded prototype identity for real counsel details** (D-17) — before pilot deployment, not before the demo.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PACK-01 | Packs load from repository JSON, validate against the schema, and fail the build on any error (AC-37) | Architecture Pattern 1 (loader), Pattern 4 (validator-as-vitest-gate); reuses `RulePackSchema` unmodified |
| PACK-02 | Every `ExpenseCategoryCode` resolves to a `CategoryRule` for every `ACTIVE` pack, missing category fails at build time (AC-10) | Architecture Pattern 4; `EXPENSE_CATEGORY_CODES` (21-code closed set) already frozen in `taxonomy.ts` — exhaustiveness check is a `Set` comparison over it |
| PACK-03 | A pack cannot reach `ACTIVE` without `reviewedBy`, `reviewedOn`, `reviewDueOn`, and all 21 categories authored (AC-38) | Architecture Pattern 4; also gates on D-15's `UNAUTHORED` token (a category present but unauthored must not count as "authored") |
| PACK-04 | A pack past `reviewDueOn` is `STALE` — 409 naming the reason; in-flight review continues under notice (AC-39) | Pitfall 1 / Pattern 3 — the engine's `checkPreconditions` already implements the exact staleness check this requirement needs; the loader/validator should expose the same derived-not-stored status |
| PACK-05 | Activating a new pack version does not alter any existing assessment's pinned version, verdicts or amounts (AC-40) | Already true by construction: `Assessment.rulePackVersion` is pinned at compute time and never re-derived; `RulePackVersion` rows are additive (new row per version) per the frozen Prisma model. No new engine/schema work — a regression test belongs in Phase 3.2 once assessments persist |
| PACK-06 | Pack content frozen once `ACTIVE`; enforced at the database, not service-layer discipline | Pitfall 2 / Open Question 1 — genuinely cannot be completed without Docker; must be explicitly deferred to Phase 3.2, not silently substituted |
| PACK-07 | Activation blocked where activator was last editor, unless `RULEPACK_AUTHOR` + sole-authorship confirmation, audited (AC-41a) | Pitfall 3 (audit event schema gap) is load-bearing here — the confirmation must be recorded in `AuditEvent`, whose `payload` and `matterId` shapes have a real gap for pack-scoped events |
| PACK-09 | `HK-PDPO` and `SG-PDPA` authored in full across 21 categories, reach `ACTIVE` (§7.5, §7.6) | D-16 defers full completion to Phase 6; this phase authors HK's §7.5 extract (9 categories) + SG's 5 named + `OTHER_UNCLASSIFIED` (6 categories, the §14 fixture floor) verbatim from the PRD, remaining ~28 as `UNAUTHORED` placeholders |
| PACK-10 | Seven stub packs ship `DRAFT`, every category `FLAG`/`NEEDS_VERIFICATION` | D-18 (`StubConstraints`), D-19 (generated-then-committed 147 rules); Architecture Pattern 2 |
| PACK-11 | No pack-authored `basis` contains a banned word (AC-32a) | Direct reuse of `LEGAL_CONCLUSION_BANNED_WORDS` + Phase 2's case-sensitive word-boundary matcher (`engine-language.test.ts`) — apply the identical matcher to every `CategoryRule.basis` and `FlatFee.basis` in the validator |
| PACK-12 | HK pack expresses flat-fee figure in a schema extension leaving other 8 packs unchanged | `FlatFeeSchema` already exists (Phase 1, optional field) — but Pitfall 5 flags that the PRD supplies no actual HK flat-fee figure anywhere, only advisory prose, which conflicts with D-14's "extrapolate nothing" discipline |
</phase_requirements>

## Summary

This phase's code surface is small and almost entirely deliverable without a database or a web app: a new `packages/rulepacks` workspace package holding nine directories of versioned JSON, a loader that reads and `RulePackSchema.parse()`s them, and a build-time validator (a new `pnpm run` script plus a new vitest project) that enforces the ACTIVE-readiness gates PACK-02/03/11 describe. None of this requires anything this repo doesn't already have pinned. The two genuinely hard parts are not technology choices — they are (a) authoring real legal content under D-14's "extrapolate nothing from outside the PRD" discipline, where the PRD is silent on some things this phase is asked to produce (HK's flat-fee figure — see Pitfall 5), and (b) two places where the frozen Phase 1 schemas do not cleanly fit a pack-admin concept that didn't exist when they were designed: `AuditEvent.matterId` is a required, non-nullable foreign key to `Matter` in both the zod schema and the already-committed Prisma schema, but a `PACK_ACTIVATED`/`PACK_EDITED` audit event is about a `RulePackVersion`, which has no relationship to any `Matter` at all (Pitfall 3). This is exactly the "genuinely wrong early type" scenario `packages/schemas/FREEZE.md`'s D-10 escalation valve exists for, and it was not caught by Phase 1 or Phase 2 because neither phase writes pack-lifecycle audit events.

The STALE-determination question CONTEXT.md leaves to research/planning discretion is already answered by Phase 2's own code: `packages/engine/src/preconditions.ts` derives past-review-date staleness from `daysUntil(now, pack.reviewDueOn) < 0` at the point of use, independent of whatever the pack's stored `status` field says — it does not require anyone to have flipped `status` to the literal `"STALE"` value. Phase 3's loader and validator should follow the identical discipline (derived, not stored, using an injected `now`), reusing `packages/engine/src/calendar-math.ts`'s `daysUntil` rather than re-deriving day arithmetic a second time.

**Primary recommendation:** Split Phase 3 into two independent tranches. Tranche A (no web, no DB) — `packages/rulepacks` package, the nine JSON packs, the loader, and the build-time validator wired as a new `vitest` project plus a new `pnpm run pack:validate` script — discharges PACK-01/02/03/04/09/10/11 completely and unblocks Phase 3.1's demo dependency immediately. Tranche B — the `/admin/rulepacks` screen (PACK-07's UI half) — genuinely requires `apps/web` to exist, which nothing in Phase 3's own dependency chain provides (only Phase 1, which does not build a web shell); recommend building the smallest possible standalone Next.js scaffold scoped to `/admin/rulepacks` inside this phase rather than waiting on Phase 3.1 (which itself depends on this phase's PACK-09 output — waiting on 3.1 would be a soft circular dependency). PACK-06's DB-level enforcement and PACK-07's audited sole-authorship confirmation's persistence layer are explicitly out of reach without Docker; both must be named, not silently dropped, and follow Phase 1's precedent of moving Docker-dependent work intact to Phase 3.2.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rule pack JSON storage & versioning | Database / Storage (repository JSON is the source of truth; DB is a cache per PRD §7.3) | — | Files under `packages/rulepacks/<packId>/<version>.json`; DB persistence is Phase 3.2's `RulePackVersion` table |
| Pack schema validation (parse + ACTIVE-readiness gates) | API / Backend (build-time, not request-time) | — | Runs as a `pnpm` script / vitest project, not inside any request path — PRD §7.3's "fail the build, not the runtime" |
| Pack content authoring (basis/citation/treatment text) | N/A — data, not code | — | Lawyer-authored JSON; the loader and validator only enforce shape, never author or infer content (NS-8) |
| `/admin/rulepacks` list + detail + activation gate | Frontend Server (SSR) / API | Browser (client-side form interactivity for the diff/checklist) | Requires `apps/web` and server-side role enforcement (`RULEPACK_AUTHOR`) per the Data Access Layer pattern already adopted project-wide, not middleware |
| Activation audit event | API / Backend | Database / Storage (append-only write) | `PACK_ACTIVATED` written via the same audit-writer discipline `packages/audit` will use elsewhere — Phase 3 defines the payload shape, Phase 3.2/4 wire the actual append-only table |
| ACTIVE-content immutability (PACK-06) | Database / Storage | — | PROJECT.md already decided this is a DB-level constraint (trigger/grant), not service-layer discipline — cannot be built without Docker |
| STALE derivation for a matter's submission gate | API / Backend (server-side check at submit time) | — | Already implemented once, correctly, in `packages/engine/src/preconditions.ts`; the loader/admin screen must expose the same derived value, not reinvent it |

## Standard Stack

No new external packages are required for this phase. Everything needed is already pinned in the root `package.json` (verified this session by reading it directly):

| Library | Pinned Version | Purpose in this phase | Source |
|---------|-----------------|------------------------|--------|
| `zod` | 4.6.5 | `RulePackSchema.parse()` in the loader; `StubConstraints` and any additive schema extensions | `[VERIFIED: package.json:29]` |
| `vitest` | 5.0.0 | New `rulepacks` project in `vitest.config.ts`; the pack-validator gate itself | `[VERIFIED: package.json:48]` |
| `dependency-cruiser` | 18.3.0 | No new rule strictly required (the loader/validator are not on the engine's purity-restricted path), but see Architecture Pattern 5 for an optional addition | `[VERIFIED: package.json:39]` |
| `fast-check` | 4.10.0 | Not required for this phase's own gates (pack validation is deterministic exhaustiveness/shape checking, not a property-test target), available if a planner wants one | `[VERIFIED: package.json:44]` |
| `typescript` | 6.0.3 | `packages/rulepacks` follows the same `tsconfig.base.json`-extending pattern as `packages/engine`/`packages/schemas` | `[VERIFIED: package.json:41]` |
| `next` | 16.3.5 | Only if Tranche B (the admin screen) is scoped into this phase — already a root dependency, `apps/web` itself does not exist yet | `[VERIFIED: package.json:20]` |

### Installation

None. No `pnpm add` is needed for this phase's core scope (loader, validator, pack content). If the admin screen is scoped in, no new dependency is needed either — Next.js/React are already root dependencies; only new files under a new `apps/web` are created.

## Package Legitimacy Audit

**Not applicable this phase.** No new external packages are introduced — the loader, validator, and (if scoped in) the admin screen scaffold are all built from already-pinned, already-audited dependencies (`zod`, `vitest`, `next`, `react`). If a planner elects to add a JSON-diffing library for the admin screen's version-diff view (PRD §10.6), run the Package Legitimacy Gate at that time; Architecture Pattern 6 below recommends a hand-rolled, typed diff instead, precisely because a generic deep-diff package would need to be legitimacy-checked and would produce a worse, less domain-shaped diff than 21 rows compared by `categoryCode`.

## Architecture Patterns

### System Architecture Diagram

```
 repository (git)                 build time                    consumers
┌───────────────────┐        ┌───────────────────────┐      ┌─────────────────────┐
│ packages/          │        │ packages/rulepacks/   │      │ packages/engine      │
│  rulepacks/         │  read  │  loader.ts            │      │  assess({ pack, ... })│
│   HK-PDPO/          │───────▶│   → RulePackSchema     │─────▶│  (Phase 2, unchanged) │
│    2026.09.1.json   │        │     .parse() each file │      └─────────────────────┘
│   SG-PDPA/…         │        │   → Map<packId,        │
│   AU-…/ (stub) …    │        │       RulePack[]>       │      ┌─────────────────────┐
│   (9 dirs total)    │        │                         │─────▶│ pnpm run             │
└───────────────────┘        │ packages/rulepacks/       │      │  pack:validate        │
                              │  validate.ts              │      │ (new vitest project,  │
                              │   → exhaustiveness (PACK-02)│    │  fails the BUILD)     │
                              │   → ACTIVE preconditions   │      └─────────────────────┘
                              │     (PACK-03: reviewedBy/  │
                              │      On, reviewDueOn,       │      ┌─────────────────────┐
                              │      no UNAUTHORED token)   │─────▶│ (later) /admin/       │
                              │   → banned-word scan        │      │  rulepacks screen      │
                              │     (PACK-11, reused matcher)│     │  (needs apps/web)      │
                              │   → derived STALE (PACK-04, │      └─────────────────────┘
                              │      injected `now`,        │
                              │      daysUntil() reused      │
                              │      from packages/engine)   │
                              └───────────────────────┘
```

A reader traces the primary use case (a lawyer edits a pack JSON file → CI runs `pnpm test`/`pnpm run pack:validate` → a build failure blocks merge if any gate fails → the engine only ever sees packs that already passed every gate) entirely left to right, top to bottom.

### Recommended Project Structure

```
packages/rulepacks/
├── package.json              # "@dsar/rulepacks", exports "./*": "./src/*.ts" (mirrors schemas)
├── tsconfig.json             # extends tsconfig.base.json (mirrors engine/schemas)
├── HK-PDPO/
│   └── 2026.09.1.json
├── SG-PDPA/
│   └── 2026.09.1.json
├── AU-PRIVACY-ACT/2026.09.1.json      # stub
├── NZ-PRIVACY-ACT/2026.09.1.json      # stub
├── JP-APPI/2026.09.1.json             # stub
├── KR-PIPA/2026.09.1.json             # stub
├── CN-PIPL/2026.09.1.json             # stub
├── IN-DPDP/2026.09.1.json             # stub
├── VN-PDPL/2026.09.1.json             # stub
├── src/
│   ├── loader.ts             # reads + parses every packId/version.json under this dir
│   ├── stub-constraints.ts   # D-18's StubConstraints type + the null-safe constant
│   ├── stub-category-rules.ts# D-19's generator (147 rules) — the source the drift test re-runs
│   ├── stale.ts              # PACK-04: derives ACTIVE|STALE at read time from injected `now`
│   ├── validate.ts           # PACK-01/02/03/11's build-time gate, throws on any violation
│   ├── validate.test.ts      # vitest project "rulepacks" — one violating fixture per gate
│   └── __fixtures__/
│       ├── missing-category.fixture.json      # PACK-02 violation
│       ├── missing-reviewed-by.fixture.json    # PACK-03 violation
│       └── banned-word-basis.fixture.json      # PACK-11 violation
└── scripts/
    └── validate-cli.ts        # entry point for `pnpm run pack:validate`, wraps validate.ts
```

### Pattern 1: The loader is a pure, synchronous, injected-clock function — mirroring the engine's own discipline

**What:** `loadRulePack(packId: string, version: string): RulePack` reads one JSON file with `node:fs`'s `readFileSync`, `JSON.parse`s it, and calls `RulePackSchema.parse()` — throwing a zod error (which is what "fail the build" means for PACK-01/AC-37) on any shape violation. A second function, `loadAllRulePacks(): Map<string, RulePack[]>`, globs `packages/rulepacks/*/*.json` and loads every file it finds.

**When to use:** At build/CI time (via the validator script) and at eventual runtime load (Phase 3.2, once there's a DB to cache into) — the same function, one call site each.

**Why this shape:** It mirrors `packages/schemas/scripts/generate-json-schema.ts`'s established pattern exactly — read source, transform, no hidden state — and it never reads a clock itself (unlike `stale.ts`, which needs `now` injected explicitly, matching `packages/engine/src/assess.ts`'s "no clock reads outside an injected `now`" discipline that Phase 2 already established for this exact codebase).

```typescript
// Pattern, not verbatim source — packages/rulepacks/src/loader.ts
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { RulePackSchema, type RulePack } from "@dsar/schemas/rule-pack";

const RULEPACKS_ROOT = path.resolve(import.meta.dirname, "..");

export function loadRulePackFile(filePath: string): RulePack {
  const raw = readFileSync(filePath, "utf-8");
  return RulePackSchema.parse(JSON.parse(raw)); // throws on ANY shape violation — PACK-01/AC-37
}

export function loadAllRulePacks(): RulePack[] {
  const packDirs = readdirSync(RULEPACKS_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "src" && d.name !== "scripts");
  return packDirs.flatMap((dir) => {
    const versionsDir = path.join(RULEPACKS_ROOT, dir.name);
    return readdirSync(versionsDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => loadRulePackFile(path.join(versionsDir, f)));
  });
}
```

### Pattern 2: `StubConstraints` and the 147 stub `categoryRules` — additive types, generated-then-committed content

**What:** D-18's `StubConstraints` is a new zod schema (all eleven `RulePackConstraintsSchema` keys, every value `.nullable()`, no defaults) used ONLY at authoring time to produce the seven stub packs' `constraints` blocks — the actual committed JSON still validates against the frozen `RulePackConstraintsSchema` shape only once a real value replaces every `null` (a stub pack's `constraints` block, once written into the committed JSON, is `{ noChargeForMakingRequest: null, ... }`, which the frozen `RulePackConstraintsSchema` — all-`boolean`, no-`.nullable()` — will REJECT). This is a real design fork the planner must resolve, not a detail: either (a) the *stub* packs validate against a widened variant schema (`RulePackConstraintsSchema.nullable()` mapped field-by-field, i.e. a parallel `StubRulePackConstraintsSchema`) while DRAFT, and the loader/validator picks the schema variant by `status`, or (b) `RulePackConstraintsSchema` itself is additively loosened (each field becomes `.nullable()`, no default) — a broader, but arguably simpler, change consistent with D-09's additive-only rule (nullable is a widening, not a retype). Recommend (b): one constraints schema, always parseable, with `null` meaning "not researched" as D-18 states — this avoids the loader needing to know which of two schemas to apply based on the very field (`status`) it hasn't validated yet, and it matches D-18's own reasoning ("the frozen schema offers no way to write 'we don't know'" — fixing that at the frozen schema is more honest than working around it with a second parallel type).

**What (the 147 rules):** D-19's generator (`stub-category-rules.ts`) programmatically builds, for each of the 7 stub jurisdictions, 21 `CategoryRule` objects: `treatment: "FLAG"`, `verificationStatus: "NEEDS_VERIFICATION"`, `ruleId` following the established `<packId>.<categoryCode>` convention (e.g. `AU-PRIVACY-ACT.STAFF_TIME_SEARCH`), `cap: null`, `conditions: []`, `basis` a short generic string, `citation` pointing at the pack's `instruments[0]`, and `verificationNote` carrying the D-15 `UNAUTHORED` token plus the PRD §7.4 note for that jurisdiction. Running this generator and writing its output to each stub's committed JSON is a one-time authoring step; the drift test (`validate.test.ts`) re-runs the SAME generator function in memory at test time and asserts byte-equality against the committed file — exactly `packages/schemas/src/json-schema.test.ts`'s already-proven pattern (`[VERIFIED: packages/schemas/src/json-schema.test.ts:1-10]`, quoted in Code Examples below).

**When to use:** Once, to produce the seven stub files; the drift test then runs on every CI run to catch anyone editing a stub file by hand instead of through the generator (or, per CONTEXT.md's Claude's Discretion #1, editing a specific rule to remove its `UNAUTHORED` token and thereby exit the generator's scope for that one rule).

### Pattern 3: STALE is derived at read time from an injected `now`, not trusted from the stored `status` literal — already Phase 2's convention, reuse it

**What:** `[VERIFIED: packages/engine/src/preconditions.ts:47-64]` — the engine's `checkPreconditions` does exactly this today:
```
if (pack.status !== "ACTIVE") {
  throw new AssessPreconditionFailure({ code: "PACK_NOT_ACTIVE", ... }, packNotActiveMessage(pack.status));
}
// AC-39: "past", not "on" — a pack due exactly today still passes. The
// 30-day advance warning is a matter flag (plan 02-06), not a precondition.
if (daysUntil(now, pack.reviewDueOn) < 0) {
  throw new AssessPreconditionFailure({ code: "PACK_PAST_REVIEW_DUE", detail: { reviewDueOn: pack.reviewDueOn, now } }, packPastReviewDueMessage(pack.reviewDueOn, now));
}
```
This proves the codebase's own established answer to CONTEXT.md's open discretion item 3: an ACTIVE pack whose `reviewDueOn` has passed is refused **regardless of whether anyone edited its stored `status` field to the literal `"STALE"` value** — the check is independent of `status` (once `status === "ACTIVE"` passes the first gate) and depends only on `reviewDueOn` vs. the injected `now`. PRD §7.3's own words support this: "the repository is the source of truth; the database copy is a cache" — repository JSON files cannot flip their own `status` field when a date passes, so any design that trusted a stored `"STALE"` literal would require an external process (a cron job, a DB trigger) to write it, which does not exist and is not planned. `packPastReviewDueMessage` already produces the AC-39-shaped reason string: `` `Rule pack reviewDueOn '${reviewDueOn}' is before now '${now}' — the pack is past its review date.` `` `[VERIFIED: packages/engine/src/messages.ts:38-40]`.

**When to use:** Phase 3's loader/validator and (if scoped in) the admin screen's list view must expose a **derived** `effectiveStatus` (`ACTIVE` vs `STALE`, computed the same way as the engine) rather than reading `pack.status` directly for anything user-facing about currency. The literal stored `status` enum (`DRAFT`/`ACTIVE`/`STALE`/`WITHDRAWN`) remains meaningful for lifecycle transitions an admin explicitly makes (e.g. `WITHDRAWN`), but "is this pack currently usable" must always re-check `reviewDueOn` against `now`, matching the engine precondition exactly. **Reuse, do not reimplement:** `daysUntil` and `parseIsoCalendarParts` in `packages/engine/src/calendar-math.ts` are the only calendar arithmetic in the codebase and are proven timezone-invariant by an existing Phase 2 test — `packages/engine/package.json` currently has no `exports` map (only `"main": "src/index.ts"`), so subpath import of `calendar-math.ts` from another package is not currently possible; the additive fix is adding an `exports` entry (e.g. `"./calendar-math": "./src/calendar-math.ts"`) to `packages/engine/package.json`, mirroring `packages/schemas/package.json`'s existing `"./*": "./src/*.ts"` pattern. Do not copy the ~40-line day-counting algorithm into `packages/rulepacks` — CONTEXT.md's own stated lesson ("Phase 1 lost four gates to exactly the 'two places that must agree' failure mode") applies directly here.

### Pattern 4: The build-time validator is a vitest project instantiating real checks against real files — the established gate pattern, not a bespoke CLI

**What:** `[VERIFIED: vitest.config.ts:1-56]` — the repo already has a `toolchain` vitest project whose tests instantiate a real ESLint / real `dependency-cruiser` `cruise()` call and assert on the result, with a documented 30s timeout because "these gates instantiate a real ESLint and a real dependency-cruiser rather than asserting against a stub". A new `rulepacks` project (or reusing/extending `toolchain`) that calls `loadAllRulePacks()` and `validatePack()` against the real `packages/rulepacks/*` directory is the same pattern: `pnpm test` (already the repo's CI entry point via `vitest run`) fails the whole suite — i.e. "fails the build" per PRD §7.3 and Success Criterion 1 — the moment any pack fails any gate. A separate `pnpm run pack:validate` script (mirroring `schema:json`'s existing pattern of a thin script wrapping a `src/` function) gives a fast, single-purpose command for CI or a pre-commit hook, while the vitest project gives the "prove the gate fires" fixture coverage CONTEXT.md requires.

**Why not a bespoke non-vitest CLI as the primary gate:** the repo has zero CI workflow files (`[VERIFIED: no .github/workflows/* found this session]`) — "the build" in this repository currently means the already-wired `pnpm test`/`pnpm typecheck`/`pnpm lint`/`pnpm depcruise` scripts, run by whatever CI is eventually configured. A vitest project is picked up by the existing `test` script with zero new wiring; a bespoke CLI would need a new script AND a new CI step that does not yet exist to hook into, and Phase 1/2 never introduced one for their own gates (money-brand lint, purity gate, JSON Schema drift) even though all three could have been bespoke CLIs too.

**Every gate needs a violating fixture** (CONTEXT.md, carried from Phase 2): for PACK-02, a fixture pack JSON missing one category; for PACK-03, one missing `reviewedBy`; for PACK-11, one whose `basis` contains "compliant"; for PACK-01 generally, a syntactically-invalid JSON file. Each fixture must live outside `packages/rulepacks/` (so a real load never sees it) and be loaded only through the test file — matching `tests/fixtures/money-brand-violation.fixture.ts`'s established convention `[VERIFIED: tests/fixtures/money-brand-violation.fixture.ts:1-8]`.

### Pattern 5: `RulePackConstraintsSchema`'s widening (Pattern 2) is the one place this phase's work could brush against `packages/engine`

Because `packages/engine/src/preconditions.ts` and other engine modules already destructure `pack.constraints.*` as non-null booleans, widening `RulePackConstraintsSchema` to `.nullable()` fields (Pattern 2, option b) is a type-level ripple into `packages/engine` even though engine's own logic is unchanged (a DRAFT stub with `null` constraints never reaches `assess()`, which requires `status === "ACTIVE"` first, and an ACTIVE pack's validator-enforced precondition means constraints are never `null` by the time `assess()` runs). Confirm this at plan time with a targeted `pnpm run typecheck` after the schema change, before assuming it is risk-free — this is exactly the kind of cross-package ripple `packages/schemas/FREEZE.md` asks a later phase to notice, even when the change is additive.

### Pattern 6: The admin screen's version diff — hand-roll it, do not add a generic JSON-diff dependency

**What:** PRD §10.6 asks for "a diff against the previous version" in the pack detail view. Because `RulePack` is a closed, typed shape (21 `categoryRules` keyed by `categoryCode`, a handful of top-level scalar/enum fields, a `constraints` object with 11 named keys), a generic deep-object-diff library (e.g. a `microdiff`/`deep-object-diff`-shaped dependency) would produce a path-keyed diff blob that the UI would then have to re-interpret back into "this category's treatment changed from X to Y" — the exact shape a hand-rolled, typed diff function already produces directly, with no re-interpretation step and no new dependency to legitimacy-check.

**Don't Hand-Roll — the boundary this DOESN'T cross:** this is not "don't hand-roll diffing" in general (diffing arbitrary JSON well is genuinely hard); it is "don't hand-roll a generic diff algorithm when the two objects being compared share one exhaustively-known, 21-key shape" — a `for (const code of EXPENSE_CATEGORY_CODES)` comparison of `oldPack.categoryRules.find(r => r.categoryCode === code)` against the new pack's equivalent is a ~15-line function, not an algorithm.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Banned-word scanning of pack `basis` strings (PACK-11) | A second word-boundary regex matcher | The exact matcher already proven in `packages/engine/src/engine-language.test.ts` (`[VERIFIED: packages/engine/src/engine-language.test.ts:34-40]`), applied to `CategoryRule.basis` / `FlatFee.basis` instead of `messages.ts` exports | CONTEXT.md is explicit: "a case-insensitive matcher was empirically shown to break 6 of 21 real message templates" — that lesson is paid for once; a second matcher risks re-discovering it |
| Day-past-due / 30-day-warning arithmetic (PACK-04) | A second calendar module, or `Date`-based comparison | `daysUntil`/`parseIsoCalendarParts` from `packages/engine/src/calendar-math.ts` (needs an `exports` entry added — see Pattern 3) | Proven timezone-invariant by an existing test; a `Date`-based reimplementation risks exactly the TZ bug that module was written to avoid |
| Sole-authorship / activation audit trail shape (PACK-07) | A bespoke pack-specific audit table or a new event schema | `AuditEvent`'s existing `payload` shape (`entityId`/`field`/`before`/`after`) — record the confirmation as `field: "soleAuthorshipConfirmed"`, `before: false`, `after: true` | Matches the closed `AUDIT_PAYLOAD_KEYS` set exactly with no new key (see Pitfall 3 for the one genuine gap — `matterId` — that this reuse does NOT solve) |
| Generic JSON diff for the admin screen | A `deep-object-diff`/`microdiff`-class dependency | A typed, 21-category-keyed comparison function (Pattern 6) | The shape being compared is closed and known; a generic diff produces a worse output for this specific UI need and adds an unaudited dependency for no gain |

**Key insight:** every "don't hand-roll" item in this phase is actually "don't hand-roll a SECOND one" — Phase 1 and 2 already built the correct primitive (the banned-word matcher, the calendar math, the closed audit-payload set); Phase 3's job is almost entirely reuse, and the risk this phase specifically needs to guard against is a subtly-different second implementation drifting from the first.

## Common Pitfalls

### Pitfall 1: Trusting the stored `status` field instead of deriving currency from `reviewDueOn`

**What goes wrong:** A pack JSON's `status: "ACTIVE"` is only ever updated when a human edits the file (or, once Phase 3.2's DB exists, when an admin action runs) — nobody flips it to `"STALE"` automatically when `reviewDueOn` passes, because the repository is the source of truth (PRD §7.3) and files don't self-update. A loader or admin screen that reads `pack.status` naively and treats `"ACTIVE"` as "currently usable" will silently accept a pack that AC-39 requires to be refused.
**Why it happens:** `status` looks like the obvious single source of truth because it's a stored enum with a literal `"STALE"` value — but that value exists for *authored* lifecycle transitions (e.g. an admin explicitly withdrawing a pack), not for the passage of time.
**How to avoid:** Follow Pattern 3 exactly — `packages/engine/src/preconditions.ts` already got this right; reuse its logic (`daysUntil(now, pack.reviewDueOn) < 0` checked independently of `status`), don't reinvent it.
**Warning signs:** Any code path that checks `pack.status === "ACTIVE"` and stops there, without also checking `reviewDueOn` against a current-time value.

### Pitfall 2: PACK-06 cannot be "done" without Docker — do not accept a service-layer substitute as satisfying it

**What goes wrong:** Under schedule pressure, it is tempting to enforce "an ACTIVE version's content cannot change" by simply never writing an update-path for `RulePackVersion.content` in application code (service-layer discipline) and calling PACK-06 satisfied. PROJECT.md already rejected this reasoning generally (it's why AC-34's audit immutability is DB-level, not app-level) and CONTEXT.md explicitly reiterates it for PACK-06 by name.
**Why it happens:** It is the only enforcement mechanism actually buildable this phase (no Docker means no migration means no trigger/grant), so it's an easy substitution to reach for.
**How to avoid:** Follow the exact precedent Phase 1 already set for its own three Docker-dependent plans — name the deferral explicitly, move the concrete DB-level work (a Postgres trigger or a `content`-column check, applied in Phase 3.2's migration) to Phase 3.2, and do not mark PACK-06 "done" in this phase's SUMMARY/state tracking. A service-layer check can exist as a defense-in-depth backstop (comment it as such, following `packages/engine/src/errors.ts`'s own precedent: "Phase 3's pack validator should also reject this combination at build time; this runtime refusal is a backstop") but is never the requirement's actual discharge.
**Warning signs:** A plan or SUMMARY.md marking PACK-06 "complete" with no Postgres migration, trigger, or grant statement anywhere in the diff.

### Pitfall 3: `AuditEvent.matterId` is a required, non-nullable foreign key to `Matter` — but a pack-lifecycle event has no `Matter`

**What goes wrong:** PACK-07/AC-41a requires activation (and the sole-authorship confirmation) to be audited, and `AuditEventTypeSchema` already has `PACK_ACTIVATED`/`PACK_EDITED` members reserved for exactly this (`[VERIFIED: packages/schemas/src/primitives.ts:224-243]`, quoting the enum: `"...PACK_ACTIVATED", "PACK_EDITED",...`). But both the zod schema and the already-committed Prisma schema make `matterId` mandatory and non-null:
- `[VERIFIED: packages/schemas/src/audit-event.ts:53-56]` — `` export const AuditEventSchema = z.object({ id: z.string(), matterId: z.string(), actor: UserRefSchema, ... `` (no `.nullable()`, no `.optional()` on `matterId`).
- `[VERIFIED: prisma/schema.prisma:365-368]` — `` model AuditEvent { id BigInt @id @default(autoincrement()) matterId String matter Matter @relation(fields: [matterId], references: [id], onDelete: Restrict, onUpdate: Restrict) `` — a real, enforced foreign key at the database level, once Phase 3.2 applies this migration.

A `RulePackVersion` (the pack-lifecycle entity being activated/edited) has no relationship to any `Matter` at all — `[VERIFIED: prisma/schema.prisma:337-355]` shows `RulePackVersion`'s full field list (`id`, `packId`, `version`, `status`, `jurisdictionCode`, `authoredById`, `reviewedById`, `reviewedOn`, `reviewDueOn`, `content`, `createdAt`) with no `matterId` anywhere. There is therefore no value that can honestly populate `AuditEvent.matterId` for a `PACK_ACTIVATED`/`PACK_EDITED` event without either (a) violating the FK constraint, or (b) inventing a fake `Matter` row purely to satisfy it, which is worse.
**Why it happens:** `AuditEvent` was frozen in Phase 1 against PRD §6.5, which is written with matter-scoped events in mind (`LINE_DISPOSITIONED`, `SIGNED_OFF`, etc.); pack-lifecycle events were added to the `AuditEventType` enum (also Phase 1) without anyone re-checking whether the rest of the row shape actually fits a non-matter-scoped event. Neither Phase 1 nor Phase 2 wrote a `PACK_ACTIVATED`/`PACK_EDITED` event, so the mismatch was never exercised.
**How to avoid:** This is exactly the scenario `packages/schemas/FREEZE.md`'s D-10 escalation valve describes ("If you are a later-phase implementer and you believe a frozen field is wrong: stop, write down what's wrong... and escalate before you touch the frozen module"). Recommend escalating before implementing PACK-07's audit write: the additive-safe fix is widening `AuditEvent.matterId` to nullable (a narrowing-to-widening change, consistent with D-09's "may add optional fields" — though `matterId` becoming optional is a change to an EXISTING frozen field's nullability, not a new field, so it likely still needs the explicit escalation D-09 describes, not a silent workaround) and updating the Prisma FK to `onDelete: Restrict` with a nullable column — or alternatively, treating pack-lifecycle audit events as a distinct concern that does not flow through the `AuditEvent`/`Matter`-scoped table at all (a separate `RulePackVersionAuditEvent`-shaped model), which avoids touching the frozen table but duplicates the append-only/audit-writer machinery Phase 4 is building once, elsewhere. **This is an Open Question below, not a decision this research makes** — the planner should surface it for product-owner sign-off before the executor starts PACK-07, per the same rule that governed D-11/D-12 in Phase 2.
**Warning signs:** Any code that populates `AuditEvent.matterId` with the pack's `packId` (silently repurposing the column) or a placeholder string like `"N/A"` to route around the type checker without addressing the underlying FK mismatch.

### Pitfall 4: `RulePackConstraintsSchema`'s all-required-`boolean` shape rejects D-18's `null`-valued stub constraints as written

**What goes wrong:** D-18 says stub `constraints` ship as "all eleven keys present, every value `null`". But `[VERIFIED: packages/schemas/src/rule-pack.ts:168-185]` shows `RulePackConstraintsSchema` with every boolean field non-`.nullable()` (e.g. `` noChargeForMakingRequest: z.boolean(), ``, `` profitElementPermitted: z.boolean(), // always false in every regime known to this product``). A stub pack's `constraints` block, written literally as D-18 describes, will fail `RulePackSchema.parse()` — meaning PACK-01's loader would reject every one of the seven stub packs at load time, which is the opposite of PACK-10's requirement that they "ship as DRAFT" and load successfully.
**Why it happens:** D-18 was decided in the CONTEXT.md discussion without re-reading `rule-pack.ts`'s actual field types line by line — the discussion's own text acknowledges the tension ("the frozen schema offers no way to write 'we don't know'") but frames the resolution as "keys present" without spelling out that the frozen types don't accept `null` values, only `StubConstraints`-typed authoring-time objects do.
**How to avoid:** See Architecture Pattern 2 — this needs an explicit resolution at plan time (widen `RulePackConstraintsSchema` fields to `.nullable()`, additively, OR introduce a separate schema variant the loader picks based on context). Flag this for the same escalation-or-explicit-decision treatment as Pitfall 3, since it is also a "the frozen shape doesn't fit a new requirement" situation, just lower-severity (it's a straightforward additive widening, not a structural FK mismatch).
**Warning signs:** A stub pack JSON file committed with `null` constraint values that the loader test suite never actually round-trips through `RulePackSchema.parse()` (i.e. a gate that "passes" because it was never really exercised against the stub files — the exact Phase 1 failure mode CONTEXT.md warns about generally).

### Pitfall 5: The PRD supplies no actual HK flat-fee figure — PACK-12/SC-2 as literally worded may be unsatisfiable under D-14's authoring discipline

**What goes wrong:** PRD §7.5's HK extract contains only an advisory `matterFlagRule` ("HK.FLAT_FEE_CHECK": "A flat fee may be charged... Consider whether a flat fee is preferable") — nowhere does the PRD state a concrete flat-fee amount, currency-agnostic minor-units figure, or even a formula for HK. `FlatFeeSchema` (`[VERIFIED: packages/schemas/src/rule-pack.ts:153-159]`) requires `amount: MinorSchema` (a non-nullable integer) if the optional `flatFee` key is present at all — there is no way to write "not yet known" the way D-18 does for constraints (`FlatFeeSchema` has no `verificationNote` field, only `verificationStatus`). Roadmap Success Criterion 2 nonetheless states "the HK pack carries its flat-fee figure in a schema extension" as a phase-completion condition.
**Why it happens:** PACK-12 (the `flatFee` schema extension itself) was Phase 1/2's design work (D-02); actually populating it with a real number for HK is content-authoring work that D-14 restricts to "only the rules the PRD actually specifies" — and the PRD does not specify this one.
**How to avoid:** Flag this explicitly as an Open Question (below) rather than inventing a number. One resolution consistent with the project's own precedent (the PHOTOCOPY_PRINT cap in §7.5 ships a concrete illustrative figure — `150` minor units/page — explicitly marked `NEEDS_VERIFICATION` with a note that it is "an entity-specific figure... to be set by counsel") is to add an additive, optional `verificationNote: z.string().nullable()` to `FlatFeeSchema` (paralleling `CategoryRule`'s existing field) and populate HK's `flatFee` with an illustrative placeholder amount, `verificationStatus: "NEEDS_VERIFICATION"`, and a `verificationNote` carrying D-15's `UNAUTHORED` token plus an explicit "no PRD-supplied figure; counsel must set the actual entity-specific flat fee before this can be VERIFIED" sentence. This keeps SC2's schema-capability claim true (the extension exists, HK's pack has a populated `flatFee` field, the other eight packs are untouched) while not overstating what was actually authored.
**Warning signs:** A committed HK pack JSON with a `flatFee.amount` that looks precise (e.g. a specific currency-realistic figure) with no `verificationNote`/comment explaining it has no PRD or counsel source — this is indistinguishable, to a future reader, from an actually-researched figure, which is the exact "unnamed lawyer's confidence" failure mode D-14/D-15 exist to prevent.

## Code Examples

### The established "regenerate and compare" drift-test pattern (D-19's model)

```typescript
// Source: packages/schemas/src/json-schema.test.ts — read this session, verbatim structure
// (packages/rulepacks/src/stub-category-rules.test.ts should follow the identical shape)
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { toJsonSchemaArtifacts } from "./json-schema.ts"; // -> generateStubCategoryRules() for rulepacks

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = path.resolve(__dirname, "..", "schema");

describe("toJsonSchemaArtifacts", () => {
  it("generates all three schemas without throwing, including branded Minor fields and the discriminated Cap union", () => {
    let artifacts: ReturnType<typeof toJsonSchemaArtifacts> | undefined;
    expect(() => { artifacts = toJsonSchemaArtifacts(); }).not.toThrow();
    expect(artifacts).toBeDefined();
  });
  // ... byte-identity comparison against the committed file follows this pattern
});
```

### The established "gate fires on a violating fixture" pattern (every Phase 3 validator check needs one of these)

```typescript
// Source: tests/toolchain/purity-gate.test.ts — read this session, verbatim structure
it("reports no-io-in-engine over a violating fixture (gate proven to fire)", async () => {
  const cfg = loadConfig();
  const widenedForbidden = cfg.forbidden.map((rule) => /* widen `from` to include the fixture dir */);
  // ... assert the rule DOES fire against the fixture, proving the gate inspects something real
});
```

### The existing engine precondition PACK-04 must match (already correct — do not diverge from this)

```typescript
// Source: packages/engine/src/preconditions.ts, lines 57-64 — quoted verbatim this session
// AC-39: "past", not "on" — a pack due exactly today still passes. The
// 30-day advance warning is a matter flag (plan 02-06), not a precondition.
if (daysUntil(now, pack.reviewDueOn) < 0) {
  throw new AssessPreconditionFailure(
    { code: "PACK_PAST_REVIEW_DUE", detail: { reviewDueOn: pack.reviewDueOn, now } },
    packPastReviewDueMessage(pack.reviewDueOn, now)
  );
}
```

## State of the Art

Not applicable in the usual "library X superseded library Y" sense — this phase adds no new external dependency. The one relevant "state of the art" fact is internal: Phase 2 already solved the STALE-derivation question this phase's CONTEXT.md poses as open (see Pattern 3) — the correct approach already exists in the codebase and simply needs to be reused, not re-researched.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Widening `RulePackConstraintsSchema`'s boolean fields to `.nullable()` is the right resolution for D-18 (vs. a parallel `StubRulePackConstraintsSchema`) | Architecture Pattern 2 / Pitfall 4 | If the product owner or plan-checker prefers a parallel-schema approach instead, the loader/validator design (which schema to `.parse()` against, keyed on what) changes meaningfully — this should be confirmed at plan time, not assumed silently through implementation |
| A2 | `AuditEvent.matterId` should be widened to nullable (rather than routing pack-lifecycle events through a separate model) to resolve Pitfall 3 | Pitfall 3 | This is a frozen-schema change to an EXISTING field (not a new additive field), which FREEZE.md's own rule says should escalate to the product owner before it's made — this research surfaces the problem and one candidate fix, but does not decide it |
| A3 | Adding an optional `verificationNote` field to `FlatFeeSchema` (paralleling `CategoryRule`) is the right way to mark HK's flat fee `UNAUTHORED`, and an illustrative placeholder amount is preferable to omitting `flatFee` from the HK pack entirely | Pitfall 5 | If the product owner instead wants `flatFee` omitted from HK's Phase-3 pack (deferring PACK-12's content, not just its schema, to Phase 6 alongside D-16's other deferrals), Success Criterion 2's wording ("the HK pack carries its flat-fee figure") would need to be read as satisfied by the schema capability alone, which is a materially different scope decision |
| A4 | The admin screen's version diff should be hand-rolled rather than backed by a diff library | Architecture Pattern 6 | Low risk — reversible, and no dependency is added either way, so getting this "wrong" costs at most a refactor, not a new legitimacy audit |
| A5 | `/admin/rulepacks` should be scaffolded as a minimal standalone Next.js app within Phase 3, rather than waiting for Phase 3.1's demo-slice app or Phase 3.2's walking skeleton | Summary / Primary recommendation | This is explicitly left to research/planning discretion by CONTEXT.md; if the planner instead sequences Phase 3's admin-screen wave to depend on Phase 3.1 completing first, that changes Phase 3's own dependency graph (currently "Depends on: Phase 1" only, per ROADMAP.md) and should be recorded as a roadmap change, not assumed silently |

**If this table is empty:** N/A — see rows above. Every entry here is a design judgment made in the absence of an explicit CONTEXT.md decision or a PRD-supplied fact, not a verified claim about the external world.

## Open Questions

1. **How should `PACK_ACTIVATED`/`PACK_EDITED` audit events populate the required, non-nullable `AuditEvent.matterId` field, given `RulePackVersion` has no relationship to any `Matter`?**
   - What we know: `AuditEventTypeSchema` already reserves both event types (Phase 1); `AuditEvent.matterId` is required and FK-constrained to `Matter` in both the zod schema and the already-committed Prisma schema (this session, `packages/schemas/src/audit-event.ts:53-56` and `prisma/schema.prisma:365-368`); `RulePackVersion` (`prisma/schema.prisma:337-355`) has no `matterId`-shaped field.
   - What's unclear: whether the product owner wants `AuditEvent.matterId` widened to nullable (a frozen-field change requiring D-10 escalation), or wants pack-lifecycle events to bypass the shared `AuditEvent` table entirely via a second model.
   - Recommendation: surface this to the product owner before PACK-07 implementation begins — do not let the executor discover it mid-task and route around it silently (the exact anti-pattern FREEZE.md's escalation valve exists to prevent).

2. **What is the actual figure — or explicit "not researched" marker — for HK's flat fee (PACK-12)?**
   - What we know: PRD §7.5 supplies only advisory prose, no number; D-14 forbids extrapolating figures the PRD doesn't state; the PHOTOCOPY_PRINT cap precedent shows the PRD is comfortable shipping an illustrative, clearly-flagged `NEEDS_VERIFICATION` figure in at least one other case.
   - What's unclear: whether Success Criterion 2's "carries its flat-fee figure" is satisfied by an illustrative placeholder (clearly marked unauthored) or requires the schema capability alone with the field omitted from HK's actual Phase-3 JSON.
   - Recommendation: resolve at plan time, ideally with an explicit product-owner check-in given it directly affects whether SC-2 is read as met.

3. **Is `/admin/rulepacks` scaffolded within Phase 3, or does this phase stop at the loader/validator and leave the screen for a later, better-timed phase?**
   - What we know: `apps/web` does not exist anywhere in the repository yet (confirmed this session); nothing in Phase 3's own dependency chain (only Phase 1) provides it; Phase 3.1 (which will build a demo-grade app skeleton) itself depends on this phase's PACK-09 output, so waiting for 3.1's skeleton creates a soft ordering problem; Phase 5 also plans to add routes to `apps/web`, which STATE.md flags as "low collision risk... but worth sequencing... if both run concurrently."
   - What's unclear: whether a minimal, Phase-3-owned Next.js scaffold (built once, then shared/extended by Phase 3.1 and Phase 5) is preferable to each phase independently deciding when to first touch `apps/web`.
   - Recommendation: this is CONTEXT.md's own named largest-consequence discretion item; this research's Primary Recommendation take is stated above, but the plan should record whichever choice is made and why, since it is genuinely reversible either way but expensive to re-decide mid-implementation.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All of `packages/rulepacks`, the validator, any admin-screen scaffold | ✓ | v24.19.0 | — |
| pnpm | Workspace install/build/test commands | ✓ | 11.27.0 (pinned; do not upgrade to 12.x — verified crash-prone on this machine per Phase 1's own finding, unrelated to this phase) | — |
| Docker | PACK-06's DB-level enforcement; any Prisma migration touching `RulePackVersion`/`AuditEvent` | ✗ | — (`docker: command not found`, re-confirmed this session) | None — PACK-06's DB-level piece is explicitly deferred to Phase 3.2, per CONTEXT.md and PROJECT.md precedent. No workaround substitutes for it (a service-layer check is NOT a valid fallback per Pitfall 2) |
| `apps/web` (Next.js app) | PACK-07's `/admin/rulepacks` screen (Success Criterion 4) | ✗ (does not exist anywhere in the repo yet) | — | Build a minimal scaffold within this phase (see Open Question 3), or explicitly descope the screen to a later phase — either is acceptable, but the choice must be recorded, not silently assumed |

**Missing dependencies with no fallback:**
- Docker — PACK-06's database-level content-immutability enforcement cannot be completed in this phase. Must be named as an explicit deferral to Phase 3.2, matching Phase 1's precedent for its own three Docker-dependent plans.

**Missing dependencies with fallback:**
- `apps/web` — the admin screen (part of Success Criterion 4) has no shell to build into yet, but unlike Docker this is buildable from scratch within the phase if the planner chooses to (Open Question 3); it is not a hard external blocker the way Docker is.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.0, workspace `projects` field in root `vitest.config.ts` (`[VERIFIED: vitest.config.ts:1-56]`) |
| Config file | `vitest.config.ts` (root) — needs one new project entry, e.g. `{ test: { name: "rulepacks", environment: "node", include: ["packages/rulepacks/src/**/*.test.ts"] } }` |
| Quick run command | `pnpm vitest run --project rulepacks` |
| Full suite command | `pnpm test` (runs `vitest run` over every project, root `package.json:11`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PACK-01 | Malformed pack JSON fails to load | unit | `pnpm vitest run --project rulepacks -t "PACK-01"` | ❌ Wave 0 |
| PACK-02 | ACTIVE pack missing a category fails validation | unit | `pnpm vitest run --project rulepacks -t "PACK-02"` | ❌ Wave 0 |
| PACK-03 | ACTIVE pack missing `reviewedBy`/`reviewedOn`/`reviewDueOn` fails validation | unit | `pnpm vitest run --project rulepacks -t "PACK-03"` | ❌ Wave 0 |
| PACK-04 | Pack past `reviewDueOn` is refused (derived, not stored) | unit | `pnpm vitest run --project rulepacks -t "PACK-04"` | ❌ Wave 0 — note `packages/engine/src/preconditions.ts`'s existing `PACK_PAST_REVIEW_DUE` test already partially covers the engine-side behavior; this is the loader/validator-side equivalent |
| PACK-09 | HK/SG packs parse and their authored categories match PRD §7.5/§7.6 text | golden-file / unit | `pnpm vitest run --project rulepacks -t "HK-PDPO"` / `"SG-PDPA"` | ❌ Wave 0 |
| PACK-10 | Seven stub packs load as DRAFT, all-FLAG, all-`NEEDS_VERIFICATION` | unit | `pnpm vitest run --project rulepacks -t "PACK-10"` | ❌ Wave 0 |
| PACK-11 | No pack `basis` contains a banned word | unit | `pnpm vitest run --project rulepacks -t "PACK-11"` | ❌ Wave 0 — reuses `LEGAL_CONCLUSION_BANNED_WORDS` + the matcher pattern from `packages/engine/src/engine-language.test.ts` |
| PACK-12 | HK's `flatFee` populated, other 8 packs' JSON unchanged by the schema extension | unit | `pnpm vitest run --project rulepacks -t "PACK-12"` | ❌ Wave 0 — pending Open Question 2's resolution |

### Sampling Rate

- **Per task commit:** `pnpm vitest run --project rulepacks` (fast — no Docker, no network, pure file reads + zod parsing)
- **Per wave merge:** `pnpm test && pnpm typecheck && pnpm lint && pnpm depcruise` (the full existing gate suite, unchanged in shape, now covering the new package)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/rulepacks/package.json` + `tsconfig.json` — new package scaffold, mirroring `packages/schemas`'s pattern
- [ ] `packages/rulepacks/src/loader.ts` + `validate.ts` + their `.test.ts` files — covers PACK-01/02/03/11
- [ ] `packages/rulepacks/src/stale.ts` — covers PACK-04, reusing `packages/engine`'s calendar-math (requires the `exports` addition noted in Pattern 3)
- [ ] `vitest.config.ts` — new `rulepacks` project entry
- [ ] `tsconfig.json` (root) — new `{ "path": "./packages/rulepacks" }` reference
- [ ] `packages/engine/package.json` — additive `exports` map entry for `calendar-math.ts`, if Pattern 3's reuse recommendation is accepted
- [ ] Nine pack JSON files under `packages/rulepacks/<packId>/<version>.json`
- [ ] `tests/fixtures/` — one violating fixture per validator gate (missing category, missing reviewedBy, banned-word basis, malformed JSON)

*(No existing test infrastructure covers any of this — `packages/rulepacks` does not exist yet; everything above is new.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (this phase, directly) | Deferred to Phase 3.2/4's IdP/SSO wiring; the admin screen (if scoped in) assumes an authenticated session context the same way Phase 5's routes will |
| V3 Session Management | No (this phase, directly) | Same as above |
| V4 Access Control | Yes — PACK-07's activation gate | Server-side role check for `RULEPACK_AUTHOR` at the data-fetching/action layer (the Data Access Layer pattern `.claude/CLAUDE.md` already mandates project-wide — `requireRole()` called at the point of use, never a middleware-only check) |
| V5 Input Validation | Yes — every pack JSON file is untrusted input at load time, even though it's repository-controlled | `RulePackSchema.parse()` is the validation boundary (already built, Phase 1); the validator adds ACTIVE-readiness checks on top, never loosens the zod boundary |
| V6 Cryptography | No | Not applicable to this phase's scope |

### Known Threat Patterns for this phase's stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A malformed or maliciously-crafted pack JSON committed to the repo (e.g. a `categoryRules` entry with a `treatment` the engine doesn't expect, or a `conditions` array referencing a field outside `CONDITION_FIELDS`) | Tampering | Already closed by the frozen `RulePackSchema`/`ConditionSchema` — the loader's `.parse()` call rejects any shape or enum value outside the closed sets; no free-text `Condition.field` exists to widen this into an expression-evaluation risk (`condition.ts`'s own module comment: "a free-text field name is one step away from a free-text expression") |
| An activating user bypassing the same-editor block by using a second, colluding account rather than their own | Elevation of privilege / repudiation | Out of scope for automated enforcement (a social/process control, not a technical one) — PACK-07's audited confirmation at least creates a durable record naming who activated what, which is the defensibility property PRD §7.1 cares about |
| A pack's `basis`/`verificationNote` text used as an injection vector into the (future) admin screen's rendered HTML | Tampering / information disclosure | Standard React/Next.js auto-escaping of interpolated text handles this by default — no `dangerouslySetInnerHTML` should ever be used to render pack-authored text; flag this explicitly if/when the admin screen is built |

## Sources

### Primary (HIGH confidence)
- `docs/PRD-dsar-fee-agent.md` §7 (rule pack schema/lifecycle/nine jurisdictions/HK+SG extracts), §10.6 (admin screen), §13 (AC-10, AC-32a, AC-37 through AC-42), §14 (test strategy, reference fixture) — read in full this session
- `packages/schemas/src/rule-pack.ts`, `taxonomy.ts`, `constants.ts`, `primitives.ts`, `condition.ts`, `audit-event.ts`, `FREEZE.md` — read in full this session
- `packages/engine/src/preconditions.ts`, `errors.ts`, `calendar-math.ts`, `engine-language.test.ts`, `assess.ts`, `index.ts` — read in full this session
- `prisma/schema.prisma` (lines 337-386, `RulePackVersion`/`AuditEvent` models) — read this session
- `.planning/phases/03-rule-packs-and-pack-admin/03-CONTEXT.md`, `.planning/ROADMAP.md` (Phase 3/3.1/3.2 sections), `.planning/STATE.md`, `.planning/REQUIREMENTS.md` — read in full this session
- `vitest.config.ts`, `package.json`, `.dependency-cruiser.cjs`, `tsconfig.base.json`, `pnpm-workspace.yaml`, `tests/toolchain/*.test.ts`, `tests/fixtures/money-brand-violation.fixture.ts`, `packages/schemas/src/json-schema.test.ts`, `packages/schemas/scripts/generate-json-schema.ts` — read in full this session

### Secondary (MEDIUM confidence)
- None used — no web search was needed this session; every material finding traces to a file read directly or the PRD's own text.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, every version confirmed by reading `package.json` directly this session
- Architecture: HIGH for the loader/validator/gate design (directly follows Phase 1/2's own established, already-proven patterns); MEDIUM for the `/admin/rulepacks` screen (genuinely undecided infrastructure sequencing, correctly left to planner discretion)
- Pitfalls: HIGH — Pitfalls 1, 3, and 4 are grounded in exact line-cited code read this session, not inference; Pitfall 5 is grounded in the PRD's absence of a figure, confirmed by reading §7.5 in full

**Research date:** 2026-09-16
**Valid until:** Stable — this phase's findings are internal-codebase facts (frozen schemas, existing engine behavior) that do not drift on their own; re-verify only if Phase 1/2's frozen modules change before Phase 3 executes (which FREEZE.md's own policy makes unlikely without an explicit escalation), or after ~30 days if planning is delayed and the codebase has moved on.
