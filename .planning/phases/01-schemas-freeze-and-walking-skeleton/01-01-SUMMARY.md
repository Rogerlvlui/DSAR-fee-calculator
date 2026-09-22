---
phase: 01-schemas-freeze-and-walking-skeleton
plan: 01
subsystem: infra
tags: [pnpm, typescript, eslint, dependency-cruiser, vitest, toolchain]

requires: []
provides:
  - pnpm workspace (apps/*, packages/*) with exact-pinned toolchain versions
  - tsconfig.base.json (strict, nodenext, es2023) every package extends
  - packages/engine placeholder (ENGINE_VERSION) as a real target for later gates
  - vitest.config.ts with six named test.projects (schemas, routes, boundary, db, toolchain, web)
  - .dependency-cruiser.cjs purity gate (no-io-in-engine, no-infra-in-engine, no-fetch-in-engine)
  - eslint.config.js AC-07a money-branding no-restricted-syntax rule, scoped to packages/engine and packages/schemas
  - root package.json `lint` and `depcruise` scripts
affects: [01-02, 01-03, 01-05, 01-06, 01-07]

actuals:
  tokens: 4500
  tasks: 3
  commits: 4
plan_head_before: c84ec91604c4e889b5269b27fe25d9aa4af20c15

tech-stack:
  added: [pnpm@11.27.0 (substituted for the researched 12.4.1 — see Deviations), typescript@6.0.3, prisma@7.10.0, "@prisma/client@7.10.0", "@prisma/internals@7.10.0", zod@4.6.5, vitest@5.0.0, "@vitest/coverage-v8@5.0.0", eslint@10.10.0, typescript-eslint@8.70.0, dependency-cruiser@18.3.0, playwright@1.63.0, fast-check@4.10.0, "@fast-check/vitest@0.5.0", testcontainers@12.1.0, "@testcontainers/postgresql@12.1.0", tailwindcss@4.3.3, next@16.3.5, react@19.3.0, react-dom@19.3.0, "@types/node@26.5.1 (added, not in research list)", "jsdom@30.0.1 (added, not in research list)"]
  patterns:
    - "Root package.json has \"type\": \"module\"; .cjs extension used explicitly for CommonJS config files (.dependency-cruiser.cjs)"
    - "ESLint flat config scoped via `files` glob rather than repo-wide rules"
    - "dependency-cruiser's programmatic cruise() API used in tests instead of shelling out (avoids Windows .cmd subprocess issues)"

key-files:
  created:
    - package.json
    - pnpm-workspace.yaml
    - .npmrc
    - tsconfig.base.json
    - packages/engine/package.json
    - packages/engine/tsconfig.json
    - packages/engine/src/index.ts
    - vitest.config.ts
    - .dependency-cruiser.cjs
    - eslint.config.js
    - tests/toolchain/pins.test.ts
    - tests/toolchain/purity-gate.test.ts
    - tests/toolchain/lint-money-brand.test.ts
    - tests/fixtures/engine-io-violation/impure.ts
    - tests/fixtures/money-brand-violation.fixture.ts
  modified: []

key-decisions:
  - "pnpm 12.4.1 (the researched pin) crashes with SIGILL on every `pnpm install` on this machine — reproduced even in a blank scratch project with no packageManager field. Substituted pnpm 11.27.0 (newest 11.x), which has none of this bug. See Deviations."
  - "typescript-eslint peer range (>=4.8.4 <6.1.0) and prisma dist-tags (prev=7.10.0, latest=8.0.0-rc.15) both re-verified live at execution time and match RESEARCH.md's captured values exactly — no drift since 2026-09-14."
  - "VariableDeclarator selector corrected from research's proposed shape (VariableDeclarator[id.name=...] > TSTypeAnnotation) to VariableDeclarator > Identifier[name=...] > TSTypeAnnotation — the type annotation lives on the declarator's `id` Identifier, not the declarator itself. Caught by the RED-phase fixture exactly as research's Assumption A1 anticipated."
  - "Added @types/node and jsdom as devDependencies — both missing from RESEARCH.md's dependency list but required respectively for `tsc --noEmit` to typecheck tests/toolchain/*.ts and for the vitest \"web\" project's jsdom environment to resolve."

requirements-completed: [SCHEMA-02]

coverage:
  - id: D1
    description: "pnpm workspace + exact-pinned toolchain (TypeScript 6.0.3, Prisma/@prisma/client 7.10.0, and the rest) resolves deterministically via one `pnpm install`"
    requirement: "SCHEMA-02"
    verification:
      - kind: unit
        ref: "tests/toolchain/pins.test.ts"
        status: pass
      - kind: integration
        ref: "pnpm install && pnpm exec tsc --version && pnpm exec prisma --version"
        status: pass
    human_judgment: false
  - id: D2
    description: "packages/engine purity gate (dependency-cruiser) fires on a node:fs import and stays clean on the real package"
    requirement: "SCHEMA-02"
    verification:
      - kind: unit
        ref: "tests/toolchain/purity-gate.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "AC-07a money-branding ESLint rule fires on five money-named bare-number declarations and stays silent on three look-alikes"
    requirement: "SCHEMA-02"
    verification:
      - kind: unit
        ref: "tests/toolchain/lint-money-brand.test.ts"
        status: pass
      - kind: integration
        ref: "pnpm eslint packages/engine"
        status: pass
    human_judgment: false
  - id: D4
    description: "Six named Vitest projects exist and an empty/mis-globbed project fails loudly rather than passing vacuously"
    requirement: "SCHEMA-02"
    verification:
      - kind: integration
        ref: "pnpm vitest run --project schemas (exits 1, \"No test files found\")"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-09-14
status: complete
---

# Phase 1 Plan 1: Workspace, Toolchain Pins, and Two Standing Static Gates Summary

**pnpm workspace with exact-pinned TypeScript 6.0.3/Prisma 7.10.0, Vitest 5's six-project `test.projects` config, a dependency-cruiser purity gate, and the AC-07a money-branding ESLint rule — all three falsified by their own tests, not merely configured.**

## Performance

- **Duration:** 40 min
- **Started:** 2026-09-14T17:33:00Z (approx.)
- **Completed:** 2026-09-14T18:09:04Z
- **Tasks:** 3
- **Files modified:** 15 created

## Accomplishments

- Root `pnpm-workspace.yaml` (globs `apps/*`, `packages/*`) and `package.json` with every dependency exact-pinned (no `^`, `~`, or `latest`) — re-verified live against the npm registry immediately before pinning, matching RESEARCH.md exactly.
- `packages/engine` placeholder (`ENGINE_VERSION` constant) so the purity gate and lint rule have a real target from this plan onward.
- `vitest.config.ts` with `test.projects` declaring `schemas`, `routes`, `boundary`, `db`, `toolchain`, `web`, `passWithNoTests: false` — confirmed an empty project (`--project schemas`) exits 1 rather than passing vacuously.
- `.dependency-cruiser.cjs` with three `forbidden` rules; falsified via dependency-cruiser's programmatic `cruise()` API against both the clean real package and a widened rule over a deliberately-violating fixture.
- `eslint.config.js`'s AC-07a money-branding rule, built through a real RED→GREEN TDD cycle: the RED-phase fixture caught a genuine defect in the researched `VariableDeclarator` selector shape before it ever reached production code.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the pnpm workspace and pin the toolchain exactly** - `a528364` (feat)
2. **Task 2: Configure Vitest projects and the dependency-cruiser purity gate** - `1a80da2` (feat)
3. **Task 3 RED: Add failing test for AC-07a money-branding lint rule** - `e18f786` (test)
4. **Task 3 GREEN: Implement AC-07a money-branding ESLint rule** - `6efd623` (feat)

_No REFACTOR commit — the GREEN implementation was already minimal; no obvious cleanup existed._

## Files Created/Modified

- `package.json` - Root workspace manifest, exact-pinned deps, `lint`/`depcruise`/`test`/`typecheck` scripts
- `pnpm-workspace.yaml` - Workspace globs plus pnpm 11's auto-added `allowBuilds`/`minimumReleaseAgeExclude` supply-chain settings
- `.npmrc` - `save-exact=true`
- `tsconfig.base.json` - Shared strict compiler options
- `packages/engine/{package.json,tsconfig.json,src/index.ts}` - Placeholder engine package
- `vitest.config.ts` - Six named `test.projects`
- `.dependency-cruiser.cjs` - Purity gate rules
- `eslint.config.js` - AC-07a money-branding rule
- `tests/toolchain/pins.test.ts` - Asserts exact (non-ranged) toolchain versions
- `tests/toolchain/purity-gate.test.ts` - Falsifies the dependency-cruiser gate
- `tests/toolchain/lint-money-brand.test.ts` - Falsifies the ESLint rule
- `tests/fixtures/engine-io-violation/impure.ts` - Purity-gate violation fixture
- `tests/fixtures/money-brand-violation.fixture.ts` - Lint-rule violation + negative-control fixture

## Decisions Made

- Re-verified `typescript-eslint` peer range and `prisma` dist-tags live at execution time (both matched RESEARCH.md's 2026-09-14 snapshot exactly) before pinning `typescript@6.0.3` and `prisma@7.10.0`/`@prisma/client@7.10.0`.
- Corrected the `VariableDeclarator` ESLint selector (see Deviations) after the RED-phase fixture proved research's proposed shape only matched 4 of 5 cases.
- Added `@types/node@26.5.1` and `jsdom@30.0.1` as devDependencies — both missing from RESEARCH.md's dependency list, both required for the toolchain to actually typecheck/run as specified.
- Set root `package.json`'s `"type": "module"` (not explicit in the plan, but required for `tests/toolchain/*.ts`'s `import.meta.url` usage to typecheck under `nodenext`, and consistent with `.dependency-cruiser.cjs`'s deliberate `.cjs` extension).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] pnpm 12.4.1 (the plan's exact pin) crashes with SIGILL on every `pnpm install` in this execution environment**

- **Found during:** Task 1, immediately after authoring `package.json`
- **Issue:** `pnpm@12.4.1` (installed via `npm install -g pnpm@12.4.1 --allow-scripts=pnpm`, since `corepack enable` failed with `EPERM` writing to `C:\Program Files\nodejs\pnpx` — a Windows permission issue writing to `Program Files`) crashed with `Illegal instruction` (SIGILL, exit 132) on `pnpm install`, `pnpm doctor`, and `pnpm with -- <cmd>` (any code path that resolves "the currently running pnpm version"). `pnpm --version` and `pnpm store path` (which the pnpm changelog confirms skip that resolution path) ran fine. Reproduced identically:
  - With and without a `packageManager` field in `package.json` (a self-referential `"packageManager": "pnpm@12.4.1"` was NOT the root cause, though it also triggers the same code path).
  - On both `pnpm@12.4.0` and `pnpm@12.4.1` (the two most recent 12.x releases).
  - In a throwaway scratch project with a one-line `package.json` and zero repo-specific configuration — ruling out anything project-specific.
- **Fix:** Installed `pnpm@11.27.0` (the newest 11.x release) globally via `npm install -g pnpm@11.27.0 --allow-scripts=pnpm`. Confirmed it runs `install`, `--version`, and handles a `packageManager` field without crashing. Set root `package.json`'s `"packageManager": "pnpm@11.27.0"`.
- **Files modified:** `package.json` (packageManager field)
- **Verification:** `pnpm install`, `pnpm exec tsc --version`, `pnpm exec prisma --version`, and the full `tests/toolchain` suite all pass under pnpm 11.27.0.
- **Committed in:** `a528364` (Task 1 commit)
- **Impact / follow-up:** This is a real, reproducible bug in pnpm 12.4.x's Windows native binary on this machine, not a project configuration issue — worth reporting upstream and re-attempting the 12.x pin once a fixed release ships. Nothing in this phase's scope depends on a pnpm-12-specific feature; pnpm 11.27.0 supports every workspace/lockfile/exact-pin behavior this plan needs.

**2. [Rule 2 - Missing Critical] Added `@types/node` and `jsdom` — both absent from RESEARCH.md's dependency list**

- **Found during:** Task 1 (typecheck of `tests/toolchain/pins.test.ts` failed with `TS2688: Cannot find type definition file for 'node'`) and Task 2 (the `web` Vitest project's `jsdom` environment has no package to resolve)
- **Issue:** Neither package appeared in RESEARCH.md's "Installation" block, but both are load-bearing: without `@types/node`, `tsc --noEmit` cannot typecheck any file importing `node:fs`/`node:path`/etc.; without `jsdom`, the `web` project's declared `environment: "jsdom"` has nothing to resolve once `apps/web` tests exist.
- **Fix:** `pnpm add -D -w @types/node@26.5.1` and `pnpm add -D -w jsdom@30.0.1` (both latest at execution time, exact-pinned per `.npmrc`'s `save-exact=true`).
- **Files modified:** `package.json`, `pnpm-lock.yaml`
- **Verification:** `tsc --noEmit tests/toolchain/pins.test.ts` (and the rest of `tests/toolchain/`) typechecks clean.
- **Committed in:** `a528364` (Task 1), `1a80da2` (Task 2)

**3. [Rule 1 - Bug] `VariableDeclarator` ESLint selector, as proposed in RESEARCH.md, only matched 4 of 5 fixture cases**

- **Found during:** Task 3 GREEN phase — after wiring the rule exactly as RESEARCH.md's Code Examples section specified, `pnpm eslint` on a debug copy of the fixture reported 4 violations, not 5; the `flaggedTotal: number = 0` variable declaration was silently uncaught.
- **Issue:** RESEARCH.md's proposed selector `VariableDeclarator[id.name=/.../ ] > TSTypeAnnotation > TSNumberKeyword` assumes the type annotation is a direct child of the `VariableDeclarator` node. Per the installed `typescript-eslint` AST spec, `VariableDeclaratorBase.id` is a `BindingName` (an `Identifier`), and the type annotation is attached to that `Identifier`, not the declarator — so `VariableDeclarator > TSTypeAnnotation` never matches.
- **Fix:** Changed the selector to `VariableDeclarator > Identifier[name=/.../ ] > TSTypeAnnotation > TSNumberKeyword`, traversing through the Identifier. Verified all 5 fixture cases now report and the 3 negative controls stay silent.
- **Files modified:** `eslint.config.js`
- **Verification:** `tests/toolchain/lint-money-brand.test.ts` (exactly 5 reports, 0 for the three look-alikes); direct `pnpm eslint` on a debug copy of the fixture showing 5/5 violations at the expected lines.
- **Committed in:** `6efd623` (Task 3 GREEN commit)

---

**Total deviations:** 3 auto-fixed (1 blocking/environment substitution, 1 missing-critical dependency addition, 1 bug fix in a research-proposed selector)
**Impact on plan:** All three were necessary for the plan's own acceptance criteria to be satisfiable at all in this execution environment. No scope creep — nothing outside Task 1–3's declared files was touched, and the pnpm version substitution is the only deviation from an explicit RESEARCH.md pin (documented above with full reproduction).

## TDD Gate Compliance

Task 3 (`tdd="true"`) followed the full RED → GREEN cycle:

- **RED:** `test(01-01): add failing test for AC-07a money-branding lint rule` (`e18f786`) — `pnpm vitest run --project toolchain lint-money-brand.test.ts` exited 1 with the target test (`reports exactly five money-branding violations on the fixture`) failing on its assertion (expected 5, got 0). Confirmed via direct inspection of `--reporter=tap` output.
- **GREEN:** `feat(01-01): implement AC-07a money-branding ESLint rule` (`6efd623`) — both tests pass.
- **REFACTOR:** None — implementation was already minimal.

**Note on the strict `gsd_run check tdd-red-evidence` gate:** attempted but not usable as-is — its `parseNodeTestSummary`/`tapFailedTestNames` helpers expect Node's own `--test` runner TAP shape (`# tests N` / `# pass N` / `# fail N` summary comment lines), which Vitest's `--reporter=tap` output does not emit (it nests everything without a top-level summary). The check reported `zero_tests_discovered` against a genuinely valid RED. `workflow.tdd_mode` is not enabled in this project's `config.json`, so the strict gate is not mandatory here; RED validity was confirmed by direct inspection of the TAP output (see commit `e18f786`'s message for the full evidence). Flagging so a future Vitest-aware evidence parser (or a `--reporter=` choice this tool does understand) can be adopted if `workflow.tdd_mode` is ever enabled for this project.

## Known Stubs

None — `packages/engine/src/index.ts`'s `ENGINE_VERSION` placeholder is explicitly scoped by the plan itself as "assess() itself is Phase 2 and is explicitly not written here," not an undocumented stub.

## Issues Encountered

- Extensive debugging was required to isolate the pnpm 12.4.1 SIGILL crash (see Deviations #1) — confirmed reproducible independent of this repository's content, and confirmed it is specifically the "resolve currently running pnpm version" code path (exercised by `packageManager`-field checks, `pnpm doctor`, and `pnpm with`) that crashes, not pnpm generally.
- `node`/npm-installed native binaries and MSYS/git-bash path translation (`/tmp/...`) interact unpredictably on this Windows host — Windows-native absolute paths were used throughout instead of relying on `/tmp` inside `node -e` scripts.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The toolchain, both static gates, and the six-project Vitest config are in place and falsified — Plan 01-02 (schemas) and later plans in this phase can build directly on `tsconfig.base.json`, `vitest.config.ts`, and the `packages/engine` purity/lint scaffolding without re-deriving any of it.
- `pnpm run depcruise` (the script, not the plan-level `packages/engine`-only verification) will not succeed until `packages/schemas` exists — expected, not a gap; it is scoped to a later plan in this phase.
- No blockers for Plan 01-02.

## Self-Check: PASSED

- `package.json`, `pnpm-workspace.yaml`, `.npmrc`, `tsconfig.base.json`, `packages/engine/package.json`, `packages/engine/tsconfig.json`, `packages/engine/src/index.ts`, `vitest.config.ts`, `.dependency-cruiser.cjs`, `eslint.config.js`, `tests/toolchain/pins.test.ts`, `tests/toolchain/purity-gate.test.ts`, `tests/toolchain/lint-money-brand.test.ts`, `tests/fixtures/engine-io-violation/impure.ts`, `tests/fixtures/money-brand-violation.fixture.ts` — all FOUND on disk.
- Commits `a528364`, `1a80da2`, `e18f786`, `6efd623` — all FOUND in `git log --oneline --all`.
- All plan-level `<verification>` commands re-run and passing (see Performance / Accomplishments above).

---
*Phase: 01-schemas-freeze-and-walking-skeleton*
*Completed: 2026-09-14*
