---
phase: 02-deterministic-fee-engine
plan: "02"
subsystem: engine
tags: [eslint, dependency-cruiser, determinism, lint, tdd, gate-integrity]

requires:
  - phase: 02-deterministic-fee-engine
    provides: "02-01's packages/engine/src tree (assess.ts, calendar-math.ts, etc.) — the surface these new gates protect"
provides:
  - "Engine-scoped ESLint block banning Date/Intl/crypto (no-restricted-globals), Math.random (no-restricted-properties), and toLocale* member calls (no-restricted-syntax), each with a distinct message, proven to fire against tests/fixtures/engine-determinism-violation.fixture.ts"
  - "A shared MONEY_BRAND_SELECTORS const spread into both the cross-package and engine-only no-restricted-syntax entries, proving AC-07a's money-brand rule survives the config split (T-2-08 regression guard)"
  - "no-money-formatting-in-engine, a fourth dependency-cruiser rule keeping packages/schemas/src/money.ts (the money path's only division, the only Intl call in packages/schemas) out of packages/engine, proven to fire against tests/fixtures/engine-money-format-violation/formats-money.ts"
  - "A by-name assertion that .dependency-cruiser.cjs declares all four forbidden rules, so a future rename/drop is caught explicitly rather than as a silently-still-zero exit code"
affects: [02-07-banned-word-and-tz-locale-tests]

actuals:
  tokens: 4429
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Shared selector/message consts lifted to module scope in eslint.config.js and spread into multiple flat-config entries, because ESLint flat config REPLACES a rule's options from the last matching config object rather than merging them"
    - "no-restricted-globals/no-restricted-properties messages are asserted by substring (message.includes(...)), not exact equality — both rules prepend their own fixed 'Unexpected use of X.'/'X is restricted from being used.' text ahead of the configured custom message; no-restricted-syntax does not"
    - "Fixtures needing a real cross-package import use the @dsar/schemas/* bare-specifier form (packages/engine's own convention), never a relative path reaching outside a tsconfig project's rootDir — a relative import crossing tests/tsconfig.json's rootDir boundary fails tsc TS6059/TS6307 even though it lints and cruises fine"

key-files:
  created:
    - tests/fixtures/engine-determinism-violation.fixture.ts
    - tests/fixtures/engine-money-format-violation/formats-money.ts
    - tests/toolchain/lint-engine-determinism.test.ts
  modified:
    - eslint.config.js
    - .dependency-cruiser.cjs
    - tests/toolchain/purity-gate.test.ts

key-decisions:
  - "Locale-formatting positive case uses (1234).toLocaleString() rather than a Date's .toLocaleDateString() — the plan's <action> text asks for 'a locale-formatting method call on a number', which only Number.prototype.toLocaleString satisfies without a type error; the ban's own selector (property name starting with toLocale) fires identically on either method name, so this is a representative choice, not a narrower rule"
  - "RED evidence for both TDD tasks captured via vitest's tap-flat reporter plus a hand-appended '# tests/# pass/# fail' summary line, continuing 02-01's documented workaround for gsd-tools check tdd-red-evidence's Node-test-runner-shaped TAP parser"

requirements-completed: []

coverage:
  - id: D1
    description: "Six determinism-ban constructs (new Date(), Date.now(), Math.random(), crypto.randomUUID(), Intl.DateTimeFormat, a toLocale* call) each reported with a distinct message on their own fixture line, located by searching source rather than a hard-coded line number"
    requirement: "ENGINE-01"
    verification:
      - kind: unit
        ref: "tests/toolchain/lint-engine-determinism.test.ts#reports each of the six determinism bans on its own dedicated fixture line"
        status: pass
    human_judgment: false
  - id: D2
    description: "Three negative controls (performance.now(), Math.floor, a plain string variable merely named like a banned global) produce zero reports"
    verification:
      - kind: unit
        ref: "tests/toolchain/lint-engine-determinism.test.ts#reports zero problems on the three negative-control lines"
        status: pass
    human_judgment: false
  - id: D3
    description: "AC-07a's money-brand rule still fires for packages/engine after the engine-scoped no-restricted-syntax entry was added (T-2-08 regression guard), and does not leak the determinism bans into packages/schemas"
    verification:
      - kind: unit
        ref: "tests/toolchain/lint-engine-determinism.test.ts#still reports the AC-07a money-brand message for a packages/engine virtual path"
        status: pass
      - kind: unit
        ref: "tests/toolchain/lint-engine-determinism.test.ts#does not report any determinism message for a packages/schemas virtual path, while still reporting the money-brand message"
        status: pass
    human_judgment: false
  - id: D4
    description: "no-money-formatting-in-engine fires against a fixture importing packages/schemas/src/money.ts, once its rule's from is widened to include the fixture directory; the real packages/engine tree stays clean"
    requirement: "ENGINE-01"
    verification:
      - kind: unit
        ref: "tests/toolchain/purity-gate.test.ts#reports no-money-formatting-in-engine over a violating fixture (gate proven to fire)"
        status: pass
    human_judgment: false
  - id: D5
    description: ".dependency-cruiser.cjs declares exactly four forbidden rules, asserted by name so a rename or drop is caught explicitly"
    verification:
      - kind: unit
        ref: "tests/toolchain/purity-gate.test.ts#declares exactly four forbidden rules, asserted by name"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-15
status: complete
---

# Phase 2 Plan 2: Engine Determinism Lint and Purity Gates Summary

**Six ESLint determinism bans (Date/Intl/crypto/Math.random/toLocale*) and a fourth dependency-cruiser rule keeping `packages/schemas/src/money.ts` out of `packages/engine`, each proven to fire against a deliberately violating fixture rather than merely inspecting a clean tree.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-09-15T06:25:00Z
- **Completed:** 2026-09-15T07:10:00Z
- **Tasks:** 3
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments

- `eslint.config.js` bans `Date`, `Intl`, `crypto` (via `no-restricted-globals`), `Math.random` (via `no-restricted-properties`), and any `toLocale*` member call (via `no-restricted-syntax`) inside `packages/engine` only — each with a distinct message, none of them disarming AC-07a's money-brand rule, which is spread into both entries from a single `MONEY_BRAND_SELECTORS` const
- `tests/toolchain/lint-engine-determinism.test.ts` proves all six bans fire on dedicated fixture lines, that three negative controls stay silent, that the money-brand rule survives the config split, and that none of the determinism bans leak into `packages/schemas`
- `.dependency-cruiser.cjs` gains a fourth forbidden rule, `no-money-formatting-in-engine`, keeping the one module with a division and an `Intl` call (`packages/schemas/src/money.ts`) out of `packages/engine`'s import graph — proven to fire against a violating fixture, with all four rule names asserted explicitly
- The static half of Success Criterion 2 (the locale leg, per `02-CONTEXT.md`'s "Claude's Discretion") is now enforced by construction rather than by an environment-variable flip verified not to move Node's `Intl` default locale on this machine

## Task Commits

Each task was committed atomically; the two TDD tasks followed RED → GREEN:

1. **Task 1: Ban the non-deterministic globals in packages/engine without disarming the money-brand rule**
   - `dad50c9` — feat(02-02): ban non-deterministic globals in packages/engine
2. **Task 2: Prove every determinism ban fires, with a violating fixture and negative controls**
   - `63df035` — test(02-02): add failing test for engine determinism-ban lint rules (RED)
   - `755a559` — feat(02-02): complete determinism-violation fixture, closing the RED gap (GREEN)
3. **Task 3: Keep the currency-formatting module out of the engine, and prove that gate fires too**
   - `842ad2c` — test(02-02): add failing test for no-money-formatting-in-engine gate (RED)
   - `82941ba` — feat(02-02): add no-money-formatting-in-engine dependency-cruiser rule (GREEN)

**Plan metadata:** committed alongside this SUMMARY (see final commit below).

## TDD Gate Compliance

| Task | RED commit | GREEN commit | RED evidence | Status |
|------|-----------|---------------|---------------|--------|
| 2 | `63df035` | `755a559` | `RED_EVIDENCE_OK` (3/4 named assertions failed on the RED-phase fixture stub missing positive cases and the money-brand line) | Pass |
| 3 | `842ad2c` | `82941ba` | `RED_EVIDENCE_OK` (2/2 new assertions failed — cruise exited 0 and the forbidden-names array had only 3 entries, since the rule did not exist yet) | Pass |

Task 1 is `type="auto"` (not `tdd="true"`) — the ESLint config change itself, verified directly against the acceptance criteria (`pnpm run lint` exit 0, the config-length probe printing 5) before Task 2 wrote a fixture proving each ban actually fires.

## Files Created/Modified

- `eslint.config.js` — `MONEY_BRAND_SELECTORS` lifted to a shared const; a new `packages/engine`-only flat-config entry adding `no-restricted-globals` (Date/Intl/crypto), `no-restricted-properties` (Math.random), and an extended `no-restricted-syntax` (money-brand selectors + toLocale*)
- `.dependency-cruiser.cjs` — fourth forbidden rule `no-money-formatting-in-engine`
- `tests/fixtures/engine-determinism-violation.fixture.ts` — six positive cases, three negative controls, one money-brand regression case
- `tests/fixtures/engine-money-format-violation/formats-money.ts` — one-import fixture pulling in `packages/schemas/src/money.ts` via the `@dsar/schemas/*` bare specifier
- `tests/toolchain/lint-engine-determinism.test.ts` — four assertions proving the determinism bans, negative controls, and money-brand survival
- `tests/toolchain/purity-gate.test.ts` — two new assertions: the widened-rule gate-fires proof, and the four-rule-names-by-identity check

## Decisions Made

- The "locale-formatting method call on a number" positive case uses `(1234).toLocaleString()`, not `.toLocaleDateString()` — the latter does not exist on `Number` and would fail `tsc`. The ban's selector matches any `toLocale*` property name, so this is a representative instance of the same construct, not a narrower rule.
- RED evidence for both TDD tasks was captured via `vitest --reporter=tap-flat` plus a hand-appended TAP summary line, continuing the tooling-gap workaround documented in 02-01's SUMMARY (`gsd-tools check tdd-red-evidence`'s classifier expects Node's native `--test` TAP summary line, which Vitest's tap reporters do not emit).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test's message matcher used exact equality against a message ESLint always prefixes**
- **Found during:** Task 2, GREEN phase (fixture completed, test still failing)
- **Issue:** `no-restricted-globals` and `no-restricted-properties` prepend their own fixed text (`"Unexpected use of 'X'. "` / `"'X' is restricted from being used. "`) ahead of the configured custom `message` option (confirmed against the installed `eslint@10.10.0` rule source). The test's `messagesFor()` helper compared `m.message === text` exactly, so it never matched the four bans reported through those two rules (only the two `no-restricted-syntax`-based bans, which do not get a prefix, matched).
- **Fix:** Changed the matcher to `m.message.includes(text)`, correct for both prefixed and unprefixed message shapes.
- **Files modified:** `tests/toolchain/lint-engine-determinism.test.ts`
- **Verification:** All four `it` blocks pass; `pnpm run lint` still exits 0 over the real tree.
- **Committed in:** `755a559` (Task 2 GREEN)

**2. [Rule 3 - Blocking] Fixture's relative import crossed tests/tsconfig.json's rootDir boundary**
- **Found during:** Task 3, GREEN phase, `pnpm run typecheck`
- **Issue:** `tests/fixtures/engine-money-format-violation/formats-money.ts` imported `packages/schemas/src/money.ts` and `primitives.ts` via a relative path (`../../../packages/schemas/src/...`). `tests/tsconfig.json`'s `rootDir: "."` (relative to `tests/`) rejects any local source file resolved from outside that root — TS6059/TS6307 — even though the same file linted and cruised cleanly (neither tool enforces a rootDir concept).
- **Fix:** Switched both imports to the `@dsar/schemas/money` / `@dsar/schemas/primitives` bare-specifier form — the same convention `packages/engine`'s own source already uses to reach `packages/schemas`. Resolution goes through the pnpm-linked `node_modules/@dsar/schemas` symlink, which TS treats as an external package boundary rather than a local rootDir violation.
- **Files modified:** `tests/fixtures/engine-money-format-violation/formats-money.ts`
- **Verification:** `pnpm run typecheck` clean; `pnpm vitest run --project toolchain -t "purity gate"` still 4/4 passing (both new assertions unaffected by the import-form change); `pnpm run depcruise` still exits 0 over the real tree.
- **Committed in:** `82941ba` (Task 3 GREEN)

---

**Total deviations:** 2 auto-fixed (1 bug — wrong assertion shape, 1 blocking — tsconfig rootDir violation)
**Impact on plan:** Both were caught and fixed within the same task's RED→GREEN cycle before that task's GREEN commit; no scope creep beyond the plan's own three tasks.

## Issues Encountered

None beyond the deviations above — all resolved within the RED→GREEN cycle of the task that found them.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Both new gates are proven to fire, not merely proven clean — the specific failure mode Phase 1 hit four times and this phase's `02-VALIDATION.md` gate-integrity requirement exists to prevent.
- `ENGINE-01` and `ENGINE-15` remain `Pending` in `REQUIREMENTS.md` — both are shared with sibling plan 02-07 (`ENGINE-01` also with 02-01, already `Complete`'s share resolved), still in flight, per the shared-ID gate (#2388): `gsd-tools query requirements.ready-ids` reports both `blocked` until 02-07 produces its `SUMMARY.md`.
- No blockers for the next plan in this phase. `packages/engine` now has both a static determinism guarantee (this plan) and the engine spine it protects (02-01) in place for 02-03 through 02-06 to build the remaining treatments, cross-line checks, and matter flags on top of.

## Self-Check: PASSED

- All 6 created/modified files verified present on disk (`[ -f ]`): `eslint.config.js`, `.dependency-cruiser.cjs`, `tests/fixtures/engine-determinism-violation.fixture.ts`, `tests/fixtures/engine-money-format-violation/formats-money.ts`, `tests/toolchain/lint-engine-determinism.test.ts`, `tests/toolchain/purity-gate.test.ts`.
- All 5 task commit hashes verified present in `git log --oneline --all`.
- `pnpm vitest run --project toolchain` — 14/14 passing (determinism: 4/4, purity-gate: 4/4, money-brand: 2/2, pins: 4/4).
- `pnpm test` — 200/200 passing (194 prior + 6 new).
- `pnpm run lint`, `pnpm run depcruise`, `pnpm run typecheck` all re-run clean over the real tree.
- `plan_head_before: 42de8cb4da9087dad467988f2af33bffc939f96c`, `commits: 5` (measured via `git rev-list --count`).

---
*Phase: 02-deterministic-fee-engine*
*Completed: 2026-09-15*
