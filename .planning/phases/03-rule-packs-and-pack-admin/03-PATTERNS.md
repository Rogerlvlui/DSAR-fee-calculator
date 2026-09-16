# Phase 3: Rule Packs and Pack Admin - Pattern Map

**Mapped:** 2026-09-16
**Files analyzed:** 13 (package scaffold + source modules; scope per D-20 excludes admin screen, Prisma, audit)
**Analogs found:** 13 / 13

**Scope note (D-20):** `/admin/rulepacks`, PACK-06, PACK-07 moved to Phase 3.2. This map covers only `packages/rulepacks` (loader, validator, stub generators, staleness derivation, nine pack JSON files, fixtures), the additive `FlatFee.verificationNote` widening in `packages/schemas/src/rule-pack.ts`, and root wiring (`vitest.config.ts`, `tsconfig.json`, `package.json`).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/rulepacks/package.json` | config | N/A | `packages/schemas/package.json` | exact |
| `packages/rulepacks/tsconfig.json` | config | N/A | `packages/schemas/tsconfig.json` / `packages/engine/tsconfig.json` | exact |
| `packages/rulepacks/src/loader.ts` | utility | file-I/O | `packages/schemas/scripts/generate-json-schema.ts` (read→transform, no hidden state) | role-match |
| `packages/rulepacks/src/stub-constraints.ts` | model/utility | transform | `packages/schemas/src/rule-pack.ts` (`RulePackConstraintsSchema`) | role-match |
| `packages/rulepacks/src/stub-category-rules.ts` | utility | batch/transform (generator) | `packages/schemas/src/json-schema.ts` (`toJsonSchemaArtifacts`, generator producing committed artifact) | exact |
| `packages/rulepacks/src/stub-category-rules.test.ts` | test | file-I/O (drift/golden) | `packages/schemas/src/json-schema.test.ts` | exact |
| `packages/rulepacks/src/stale.ts` | utility | transform (derived status) | `packages/engine/src/preconditions.ts` (`daysUntil` staleness check) + `packages/engine/src/calendar-math.ts` | exact |
| `packages/rulepacks/src/validate.ts` | service (build-time gate) | batch/transform | `packages/engine/src/preconditions.ts` (throws typed failure on first violation) | role-match |
| `packages/rulepacks/src/validate.test.ts` | test | batch | `tests/toolchain/purity-gate.test.ts` (real-target pass + violating-fixture-fires pattern) | exact |
| `packages/rulepacks/src/__fixtures__/*.fixture.json` | test fixture | file-I/O | `tests/fixtures/money-brand-violation.fixture.ts` (deliberately-violating fixture, lives outside the real scan path) | exact |
| `packages/rulepacks/scripts/validate-cli.ts` | config/script | batch | `packages/schemas/scripts/generate-json-schema.ts` (thin script wrapping a `src/` function, wired as a root `pnpm run`) | exact |
| `packages/schemas/src/rule-pack.ts` (modify: `FlatFeeSchema.verificationNote`) | model | transform | same file's existing `CategoryRuleSchema.verificationNote` field | exact |
| `vitest.config.ts` (modify: add `rulepacks` project) | config | N/A | existing `schemas`/`engine` project entries in same file | exact |
| `package.json` (modify: add `pack:validate` script) | config | N/A | existing `schema:json` script entry | exact |

## Pattern Assignments

### `packages/rulepacks/package.json` (config)

**Analog:** `packages/schemas/package.json`

```json
{
  "name": "@dsar/rulepacks",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./*": "./src/*.ts"
  },
  "dependencies": {
    "@dsar/schemas": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "26.5.1"
  }
}
```
Subpath-export convention (`"./*": "./src/*.ts"`), no barrel `index.ts` — matches `packages/schemas`. `packages/engine/package.json` uses `"main"` instead, but `loader.ts`/`stale.ts` need per-module subpath imports the way `calendar-math.ts` needs an `exports` entry added per RESEARCH.md Pattern 3 — follow `schemas`' shape, not `engine`'s.

### `packages/rulepacks/tsconfig.json` (config)

**Analog:** `packages/schemas/tsconfig.json` (identical to `packages/engine/tsconfig.json`)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "src",
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
```
Copy verbatim; add as a project reference wherever the root `tsconfig.json` composite-references `packages/schemas`/`packages/engine` (root `typecheck` runs `tsc --build tsconfig.json`).

### `packages/rulepacks/src/loader.ts` (utility, file-I/O)

**Analog:** `packages/schemas/scripts/generate-json-schema.ts` (read source → transform → no hidden state) and the engine's "no clock reads outside injected `now`" discipline

**Core pattern** — pure, synchronous, no I/O beyond `node:fs`, throws on any shape violation via `RulePackSchema.parse()`:
```typescript
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
Never reads a clock itself — `stale.ts` takes `now` as an explicit parameter, matching `packages/engine/src/assess.ts`'s discipline.

### `packages/rulepacks/src/stub-constraints.ts` and stub JSON authoring

**Analog:** `packages/schemas/src/rule-pack.ts`'s `RulePackConstraintsSchema`

D-18/Pitfall 4: the frozen `RulePackConstraintsSchema` is all-non-nullable `boolean`. RESEARCH.md's Assumption A1 recommends widening the fields to `.nullable()` additively (a change to `packages/schemas/src/rule-pack.ts` itself, not a new parallel schema) so `null` means "not researched" per D-18, while an ACTIVE pack's validator gate (`validate.ts`) refuses any pack still carrying a `null`. This must be confirmed at plan time (Assumption A1) — do not silently assume a parallel `StubRulePackConstraintsSchema` without recording the choice.

Excerpt of the field being widened (existing shape to modify, additively):
```typescript
// packages/schemas/src/rule-pack.ts — existing, non-nullable
export const RulePackConstraintsSchema = z.strictObject({
  noChargeForMakingRequest: z.boolean(),
  estimateRequiredBeforeCharging: z.boolean(),
  feeNotificationDeadlineDays: z.number().int().nonnegative().nullable(), // already nullable
  ...
  profitElementPermitted: z.boolean(),
  ...
});
```

### `packages/rulepacks/src/stub-category-rules.ts` + `.test.ts` (generator + drift test)

**Analog:** `packages/schemas/src/json-schema.ts` / `packages/schemas/src/json-schema.test.ts` — the exact "regenerate and compare, byte-identical to committed artifact" pattern D-19 names.

**Imports/test-structure pattern** (from `json-schema.test.ts` lines 1-20):
```typescript
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { toJsonSchemaArtifacts } from "./json-schema.ts"; // -> generateStubCategoryRules() for rulepacks

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = path.resolve(__dirname, "..", "schema"); // -> the stub pack's JSON directory

describe("toJsonSchemaArtifacts", () => {
  it("generates all three schemas without throwing, including branded Minor fields and the discriminated Cap union", () => {
    let artifacts: ReturnType<typeof toJsonSchemaArtifacts> | undefined;
    expect(() => { artifacts = toJsonSchemaArtifacts(); }).not.toThrow();
    expect(artifacts).toBeDefined();
  });
  // ... byte-identity comparison against the committed file follows this pattern
});
```
Apply the same structure to `generateStubCategoryRules(jurisdictionCode)`: run in memory, `readFileSync` the committed stub JSON, assert deep/byte equality. Per CONTEXT.md's Discretion #1, scope the comparison per-rule to rules whose `verificationNote` still carries the `UNAUTHORED` token (a rule a lawyer has since rewritten leaves the generator's scope).

### `packages/rulepacks/src/stale.ts` (PACK-04 derived staleness)

**Analog:** `packages/engine/src/preconditions.ts` lines 47-64, reusing `packages/engine/src/calendar-math.ts`

**Core pattern — do not reimplement, reuse verbatim logic:**
```typescript
// packages/engine/src/preconditions.ts:57-64 — the exact check to mirror
// AC-39: "past", not "on" — a pack due exactly today still passes. The
// 30-day advance warning is a matter flag (plan 02-06), not a precondition.
if (daysUntil(now, pack.reviewDueOn) < 0) {
  throw new AssessPreconditionFailure(
    { code: "PACK_PAST_REVIEW_DUE", detail: { reviewDueOn: pack.reviewDueOn, now } },
    packPastReviewDueMessage(pack.reviewDueOn, now)
  );
}
```
`stale.ts` should export something like `deriveEffectiveStatus(pack: RulePack, now: string): "ACTIVE" | "STALE" | pack.status`, importing `daysUntil` from `@dsar/engine/calendar-math` (RESEARCH.md Pattern 3 notes `packages/engine/package.json` currently has no `exports` map and needs one added — `"./calendar-math": "./src/calendar-math.ts"` — mirroring `packages/schemas/package.json`'s `"./*"` pattern). Never re-derive day arithmetic; never trust the stored `status` literal alone (Pitfall 1).

### `packages/rulepacks/src/validate.ts` (PACK-01/02/03/11 build-time gate)

**Analog:** `packages/engine/src/preconditions.ts` — throws a typed failure on the first violation found; no partial success.

**Error handling / core pattern:**
```typescript
export function checkPreconditions(input: CheckPreconditionsInput): void {
  const { matter, lines, pack, now } = input;
  if (pack.status !== "ACTIVE") {
    throw new AssessPreconditionFailure(
      { code: "PACK_NOT_ACTIVE", detail: { actualStatus: pack.status } },
      packNotActiveMessage(pack.status)
    );
  }
  // ... one check per requirement, first failure wins
}
```
`validate.ts`'s gates (mirror this shape): PACK-02 exhaustiveness — `EXPENSE_CATEGORY_CODES` (closed 21-code set, `packages/schemas/src/taxonomy.ts`) compared via `Set` against `pack.categoryRules.map(r => r.categoryCode)`; PACK-03 ACTIVE-readiness — `reviewedBy`/`reviewedOn`/`reviewDueOn` non-null and no `UNAUTHORED` token anywhere; PACK-11 banned-word scan — reuse the matcher below verbatim.

**Banned-word matcher to reuse (PACK-11), verbatim from `packages/engine/src/engine-language.test.ts`:**
```typescript
import { LEGAL_CONCLUSION_BANNED_WORDS } from "@dsar/schemas/constants";

function findBannedWord(text: string): string | null {
  for (const word of LEGAL_CONCLUSION_BANNED_WORDS) {
    const pattern = new RegExp(`\\b${word}\\b`); // case-sensitive, word-boundary anchored
    if (pattern.test(text)) return word;
  }
  return null;
}
```
Case-sensitive matching is deliberate (a case-insensitive matcher broke 6/21 legitimate templates using "Legal" as a proper noun) — apply this identical function to every `CategoryRule.basis` and `FlatFee.basis`, do not author a second matcher.

### `packages/rulepacks/src/validate.test.ts` (gate-fires-on-fixture test)

**Analog:** `tests/toolchain/purity-gate.test.ts`

**Core pattern — real-target pass, then a widened/violating-fixture run proving the gate actually inspects something:**
```typescript
describe("dependency-cruiser purity gate (T-1-PURITY)", () => {
  it("reports zero violations over the real packages/engine", async () => {
    const cfg = loadConfig();
    const { exitCode } = await runCruise([path.join(ROOT, "packages/engine")], { forbidden: cfg.forbidden });
    expect(exitCode).toBe(0);
  });

  it("reports no-io-in-engine over a violating fixture (gate proven to fire)", async () => {
    const cfg = loadConfig();
    const widenedForbidden = cfg.forbidden.map((rule) => /* widen `from` to include the fixture dir */);
    // ... assert the rule DOES fire against the fixture
  });
});
```
Translate directly: one `it` per gate (PACK-01 malformed JSON, PACK-02 missing category, PACK-03 missing `reviewedBy`, PACK-11 banned basis word) — each loads its own `__fixtures__/*.fixture.json` and asserts `validate.ts` throws with the expected error code, per CONTEXT.md's binding "every gate ships with a violating fixture."

### `packages/rulepacks/src/__fixtures__/*.fixture.json`

**Analog:** `tests/fixtures/money-brand-violation.fixture.ts`

**Convention:**
```typescript
// Deliberately-violating (and deliberately-clean) fixture proving the ...
// gate fires ... Lives under tests/fixtures/, not packages/engine/ or
// packages/schemas/, so a real `pnpm eslint ...` run never sees it — it is
// only ever linted through a path remap inside tests/toolchain/....test.ts.
```
Apply the same isolation rule: fixtures live under `packages/rulepacks/src/__fixtures__/`, loaded only by `validate.test.ts` via an explicit path, never under a real pack directory the loader globs (`loadAllRulePacks()` must never see them).

### `packages/rulepacks/scripts/validate-cli.ts`

**Analog:** `packages/schemas/scripts/generate-json-schema.ts`, wired as root `package.json`'s `"schema:json"` script

**Root `package.json` wiring pattern:**
```json
"scripts": {
  "schema:json": "node packages/schemas/scripts/generate-json-schema.ts",
  "pack:validate": "node packages/rulepacks/scripts/validate-cli.ts"
}
```
Thin script, wraps `loadAllRulePacks()` + `validate.ts`, no new CLI framework.

### `vitest.config.ts` (add `rulepacks` project)

**Analog:** the existing `schemas`/`engine` project entries in the same file

```typescript
{
  test: {
    name: "schemas",
    environment: "node",
    include: ["packages/schemas/src/**/*.test.ts"],
  },
},
```
Add an identical `rulepacks` entry with `include: ["packages/rulepacks/src/**/*.test.ts"]`. `pnpm test` already fails the whole suite on any project failure — this is "the build fails" per PRD §7.3/Success Criterion 1; no separate CI wiring needed.

### `packages/schemas/src/rule-pack.ts` (modify: `FlatFeeSchema.verificationNote`)

**Analog:** the same file's `CategoryRuleSchema.verificationNote` field (already frozen, already nullable)

```typescript
// CategoryRuleSchema — existing precedent for the field being added to FlatFeeSchema
export const CategoryRuleSchema = z.strictObject({
  ...
  verificationStatus: VerificationStatusSchema,
  verificationNote: z.string().nullable(),
});
```
D-22: widen `FlatFeeSchema` additively:
```typescript
export const FlatFeeSchema = z.strictObject({
  amount: MinorSchema,
  basis: z.string().max(BASIS_MAX_LENGTH),
  citation: CitationSchema,
  verificationStatus: VerificationStatusSchema,
  verificationNote: z.string().nullable(), // NEW — D-22, carries UNAUTHORED token
});
```
Purely additive to an already-additive (non-PRD-transcribed) schema — no FREEZE.md escalation needed per D-22's own text, unlike the `AuditEvent.matterId`/`RulePackConstraintsSchema` items flagged as Open Questions in RESEARCH.md (out of this phase's scope per D-20/D-21).

## Shared Patterns

### "Regenerate and compare, byte-identical to committed artifact" (drift test)
**Source:** `packages/schemas/src/json-schema.ts` + `packages/schemas/src/json-schema.test.ts`
**Apply to:** `stub-category-rules.ts`/`.test.ts` (D-19's 147-rule generator)

### "Gate fires on a violating fixture, not just a clean pass"
**Source:** `tests/toolchain/purity-gate.test.ts`, `tests/fixtures/money-brand-violation.fixture.ts`
**Apply to:** every check inside `validate.ts` (PACK-01/02/03/11), each needing its own fixture under `packages/rulepacks/src/__fixtures__/`

### Banned-word matcher (case-sensitive, word-boundary)
**Source:** `packages/engine/src/engine-language.test.ts` lines 27-33
**Apply to:** `validate.ts`'s PACK-11 scan of every `CategoryRule.basis` / `FlatFee.basis`

### Derived-not-stored status via injected `now`
**Source:** `packages/engine/src/preconditions.ts` lines 57-64, `packages/engine/src/calendar-math.ts`
**Apply to:** `stale.ts`'s PACK-04 derivation — never trust `pack.status === "ACTIVE"` alone; always re-check `daysUntil(now, pack.reviewDueOn) < 0`

### Package scaffold: subpath exports, no barrel, `.ts`-extension nodenext imports
**Source:** `packages/schemas/package.json`, `packages/schemas/tsconfig.json`
**Apply to:** `packages/rulepacks/package.json`, `packages/rulepacks/tsconfig.json`

## No Analog Found

None — every file in this phase's in-scope surface (per D-20) has a strong existing analog from Phase 1 (`packages/schemas`) or Phase 2 (`packages/engine`, `tests/toolchain`, `tests/fixtures`).

Out-of-scope files with no analog needed this phase (moved to Phase 3.2 per D-20/D-21, not mapped here): `/admin/rulepacks` screen (no `apps/web` shell exists), `PACK_ACTIVATED`/`PACK_EDITED` audit stream, PACK-06's DB trigger/grant.

## Metadata

**Analog search scope:** `packages/schemas/`, `packages/engine/`, `tests/toolchain/`, `tests/fixtures/`, root `vitest.config.ts`/`package.json`/`tsconfig.json`
**Files scanned:** ~20 (directory listings + targeted reads of `rule-pack.ts`, `json-schema.ts`/`.test.ts`, `preconditions.ts`, `calendar-math.ts`, `engine-language.test.ts`, `purity-gate.test.ts`, `money-brand-violation.fixture.ts`, both package.json/tsconfig pairs, `vitest.config.ts`, root `package.json`)
**Pattern extraction date:** 2026-09-16
