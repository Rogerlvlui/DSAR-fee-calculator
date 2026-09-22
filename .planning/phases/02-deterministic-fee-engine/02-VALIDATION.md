---
phase: "2"
slug: "deterministic-fee-engine"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-15"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `02-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.0. Plus ESLint, `dependency-cruiser` and `tsc --build` as separate CI gates Vitest does not subsume |
| **Config file** | `vitest.config.ts` (root) — an `engine` project is already declared, `include: ["packages/engine/src/**/*.test.ts"]` |
| **Quick run command** | `pnpm vitest run --project engine` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~2s for the engine project; the full suite is currently ~2.2s across 19 files |

---

## Sampling Rate

- **After every task commit:** `pnpm vitest run --project engine` — fast, no DB or network in this package
- **After every plan wave:** `pnpm test && pnpm run lint && pnpm run depcruise && pnpm run typecheck`
- **Before `/gsd-verify-work`:** full suite green, **plus the reference-fixture golden test reproducing PRD §14's published totals exactly**
- **Max feedback latency:** 10 seconds for the quick command

---

## Per-Task Verification Map

Task IDs are assigned by the planner. Each row's command must reach the matching task's `<verify><automated>` block with a `<fails_when>` sibling.

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| ENGINE-01 | `assess()` is pure — no I/O, no LLM import, no bare clock read | static | `pnpm run lint && pnpm run depcruise` | ✅ `tests/toolchain/lint-engine-determinism.test.ts` |
| ENGINE-02 | Precondition errors: stale pack, controllerType, currency mismatch | unit | `pnpm vitest run --project engine -t "checkPreconditions"` | ✅ `preconditions.test.ts` |
| ENGINE-03 | Posture gate — `PROHIBITED`, `NO_EXPRESS_AUTHORITY` | unit | `pnpm vitest run --project engine -t "posture gate"` | ✅ `posture-gate.test.ts` |
| ENGINE-04 | Five treatments; `ALLOW_IF` → `CONDITIONS_NOT_MET` naming which failed | unit | `pnpm vitest run --project engine -t "per-line evaluation"` | ✅ `evaluate-line.test.ts` |
| ENGINE-05 | `applyCap` across all four cap types, rounding down (AC-07c) | unit | `pnpm vitest run --project engine -t "applyCap"` | ✅ `apply-cap.test.ts` |
| ENGINE-06 | Cross-line checks raise a flag, never a silent adjustment | unit | `pnpm vitest run --project engine -t "cross-line"` | ✅ `cross-line-checks.test.ts` |
| ENGINE-07 | Aggregate cap pro-rata; residue unallocated and flagged (**D-11**) | unit | `pnpm vitest run --project engine -t "aggregate cap"` | ✅ `aggregate-cap.test.ts` |
| ENGINE-08 | `finalAmount` null pre-sign-off, never defaulted (AC-25) | unit + property | `pnpm vitest run --project engine -t "totals"` | ✅ `assess.property.test.ts` |
| ENGINE-09 | `FLAG` lines contribute 0 to `draftBaseline` (AC-11) | golden fixture | reference-fixture golden test | ✅ `reference-fixture.golden.test.ts` |
| ENGINE-10 | `restingOnUnverifiedRules` ⊂ `draftBaseline` (AC-22) | golden + property | reference-fixture golden test | ✅ `reference-fixture.golden.test.ts` |
| ENGINE-11 | Matter-level flags — `matterFlagRules` plus the three derived | golden fixture | reference-fixture golden test | ✅ `matter-flags.test.ts` |
| ENGINE-12 | `OTHER_UNCLASSIFIED` always `FLAG` (AC-19) | unit | `pnpm vitest run --project engine -t "OTHER_UNCLASSIFIED"` | ✅ `evaluate-line.test.ts` |
| ENGINE-13 | Stored `claimedAmount` ≠ `quantity × unitRate` is a hard error (AC-08) | unit | `pnpm vitest run --project engine -t "claimedAmount"` | ✅ `preconditions.test.ts` |
| ENGINE-15 | Suite passes identically under two TZ/locale combinations | purity test | `pnpm vitest run --project engine -t "tz"` | ✅ `purity.tz.test.ts` |
| ENGINE-16 | HK flat-fee comparison (**D-12**) | unit | `pnpm vitest run --project engine -t "lat.?[Ff]ee"` | ✅ `flat-fee.test.ts` |
| ENGINE-17 | 50-line assessment under 100ms | perf (median-of-N) | `pnpm vitest run --project engine -t "50 lines"` | ✅ `perf.test.ts` |

**Note on ENGINE-13:** `ExpenseLineSchema` already carries a `claimedAmount` `superRefine` from Phase 1. Confirm whether ENGINE-13 needs an *additional* engine-level check or is satisfied by re-parsing on load — do not duplicate the invariant in two places where they can drift apart.

---

## Wave 0 Requirements

*(All complete — phase executed.)*

- [x] `packages/engine/src/assess.ts` and its step modules — nothing exists yet beyond a placeholder index and the cross-package boundary test
- [x] `packages/engine/src/__fixtures__/reference-pack.ts` — the hand-built fixture pack that produces PRD §14's exact totals. **Build this first**, per §14's own instruction; it is the check on every formula that follows
- [x] New ESLint rule for `packages/engine`: `no-restricted-globals` (`Date`) plus `no-restricted-properties` (`Math.random`), extending the existing money-brand block
- [x] **Also ban `Intl` and `toLocale*` in `packages/engine`** — this is the locale half of Success Criterion 2, and it is a static rule rather than a runtime one for the reason in Environment Findings below
- [x] Additive schema change to `packages/schemas/src/assessment.ts` for ENGINE-16's flat-fee output (D-12), and to `MatterFlagCode` for `AGGREGATE_CAP_APPLIED` (D-11)
- [x] Re-point `assessment.property.test.ts` at real `assess()` output instead of hand-constructed arbitraries

---

## Environment Findings

Verified empirically on this machine during research — both change how Success Criterion 2 must be tested:

- **Node re-reads `process.env.TZ` dynamically**, so the timezone leg of the purity test needs no subprocess and no `cross-env`.
- **`LANG` does not move Node's `Intl` default locale on Windows.** An env-var flip would pass while testing nothing — exactly the failure mode Phase 1 hit four times. The locale leg is therefore enforced by static analysis (banning `Intl`/`toLocale*` in the engine) rather than by a runtime flip.

---

## Gate-Integrity Requirement

Phase 1 found four checks passing while inspecting nothing: an ESLint selector matching no AST node, a `pnpm typecheck` printing help text and exiting 0, 173 tests never exercising a cross-package import, and a probe whose `sed` matched no line.

**Every gate this phase adds ships with a violating fixture it must catch**, and the plan must show the fixture being caught — not merely that the gate runs clean. That applies to the new `Date`/`Math.random`/`Intl` rules specifically.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The §14 reference fixture's expected numbers are legally right, not merely arithmetically consistent | AC-09 | The fixture encodes a proposed SG reading. Arithmetic can be verified; whether `STAFF_TIME_ASSESS_EXEMPTIONS` should be `DISALLOW` is a legal judgment | Confirmed by the authoring counsel via the SG pack worksheet (`docs/sg-pack-authoring-worksheet.md`), not by this phase |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Every new gate ships with a violating fixture, and the plan shows it caught
- [x] The reference-fixture golden test reproduces PRD §14's published totals exactly
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-09-16 via `/gsd-validate-phase 02`

## Validation Audit 2026-09-16

| Metric | Count |
|--------|-------|
| Requirements audited | 16 |
| COVERED on entry | 12 |
| Gaps found | 5 |
| Resolved | 5 |
| Escalated | 0 |

**Gaps and resolutions.** Three were gate-integrity defects of exactly the kind the
Gate-Integrity Requirement above was written against — a documented `-t` filter matching
**zero** of the engine project's 182 tests, so a CI runner invoking it would report green
while inspecting nothing. The tests themselves existed and passed throughout; only the
recorded commands were wrong.

| # | Req | Defect | Measured | Resolution |
|---|-----|--------|----------|------------|
| 1 | ENGINE-02 | `-t "preconditions"` matched 0/182 — the describe is `checkPreconditions` (capital P; `-t` is case-sensitive) | 0 → 8 tests | command corrected |
| 2 | ENGINE-15 | `-t "tz-locale"` matched 0/182 — commit 238f215 renamed the describes to say `tz` but this map was not updated with them | 0 → 4 tests | command corrected |
| 3 | ENGINE-16 | `-t "flatFee"` matched 0/182 — real describes are `computeFlatFeeComparison` and `flat-fee` | 0 → 8 tests | command corrected to the regex `lat.?[Ff]ee`, which spans both spellings |
| 4 | calendar-math antisymmetry property | Flaky: `expect(numB - numA).toBe(-(numA - numB))`. `.toBe` is `Object.is`, which separates `-0` from `+0`, and `-(numA - numB)` is `-0` whenever the two drawn dates coincide — which fast-check reaches deliberately, since it biases toward repeated values | Reproduced live (1 failure in 6 full-suite runs; then deterministically with two equal dates) | assertion changed to `===`, which is the mathematical claim itself and treats the signed zeros as equal |
| 5 | `toolchain` vitest project | Flaky gate: the project declared no `testTimeout`, so it ran on Vitest's 5s default while its two cold-ESLint tests cost ~750ms each on their own. Under full-suite contention across all seven projects they intermittently exceeded it — twice in this session — reddening `pnpm test` with every assertion in them still holding | Root cause proven by running the project at `--testTimeout=700`, which failed **exactly** those two tests and nothing else, reproducing the intermittent signature precisely | explicit `testTimeout: 30000` on the toolchain project, matching the pattern `db` already uses |

**On gap 5:** found while verifying the other four, not present in the map — a gate that
reddens CI for load rather than for a real violation trains people to re-run it, which is how
a gate stops being read at all. The two tests' own violating fixtures still fire (`gate proven
to fire` cases re-confirmed green), so the longer budget masks nothing.

**On gap 4:** `civilToDayNumber` was never wrong — the implementation is correct and unchanged.
The assertion was wrong. No engine file was modified by this audit.

**Gate integrity of the repair itself.** Per the requirement that every gate ship with a
violating fixture it must catch, the replacement assertion was checked against a deliberately
non-antisymmetric pair and rejected it, and against the equal-date case that had been failing
and accepted it — so it is not passing vacuously.
