---
phase: "2"
slug: "deterministic-fee-engine"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| ENGINE-01 | `assess()` is pure — no I/O, no LLM import, no bare clock read | static | `pnpm run lint && pnpm run depcruise` | ❌ W0 — new Date/Math.random rule |
| ENGINE-02 | Precondition errors: stale pack, controllerType, currency mismatch | unit | `pnpm vitest run --project engine -t "preconditions"` | ❌ W0 |
| ENGINE-03 | Posture gate — `PROHIBITED`, `NO_EXPRESS_AUTHORITY` | unit | `pnpm vitest run --project engine -t "posture gate"` | ❌ W0 |
| ENGINE-04 | Five treatments; `ALLOW_IF` → `CONDITIONS_NOT_MET` naming which failed | unit | `pnpm vitest run --project engine -t "per-line evaluation"` | ❌ W0 |
| ENGINE-05 | `applyCap` across all four cap types, rounding down (AC-07c) | unit | `pnpm vitest run --project engine -t "applyCap"` | ❌ W0 |
| ENGINE-06 | Cross-line checks raise a flag, never a silent adjustment | unit | `pnpm vitest run --project engine -t "cross-line"` | ❌ W0 |
| ENGINE-07 | Aggregate cap pro-rata; residue unallocated and flagged (**D-11**) | unit | `pnpm vitest run --project engine -t "aggregate cap"` | ❌ W0 |
| ENGINE-08 | `finalAmount` null pre-sign-off, never defaulted (AC-25) | unit + property | `pnpm vitest run --project engine -t "totals"` | ❌ W0 |
| ENGINE-09 | `FLAG` lines contribute 0 to `draftBaseline` (AC-11) | golden fixture | reference-fixture golden test | ❌ W0 |
| ENGINE-10 | `restingOnUnverifiedRules` ⊂ `draftBaseline` (AC-22) | golden + property | reference-fixture golden test | ❌ W0 |
| ENGINE-11 | Matter-level flags — `matterFlagRules` plus the three derived | golden fixture | reference-fixture golden test | ❌ W0 |
| ENGINE-12 | `OTHER_UNCLASSIFIED` always `FLAG` (AC-19) | unit | `pnpm vitest run --project engine -t "OTHER_UNCLASSIFIED"` | ❌ W0 |
| ENGINE-13 | Stored `claimedAmount` ≠ `quantity × unitRate` is a hard error (AC-08) | unit | `pnpm vitest run --project engine -t "claimedAmount"` | ❌ W0 — see note |
| ENGINE-15 | Suite passes identically under two TZ/locale combinations | purity test | `pnpm vitest run --project engine -t "tz-locale"` | ❌ W0 |
| ENGINE-16 | HK flat-fee comparison (**D-12**) | unit | `pnpm vitest run --project engine -t "flatFee"` | ❌ W0 — needs the schema field first |
| ENGINE-17 | 50-line assessment under 100ms | perf (median-of-N) | `pnpm vitest run --project engine -t "50 lines"` | ❌ W0 |

**Note on ENGINE-13:** `ExpenseLineSchema` already carries a `claimedAmount` `superRefine` from Phase 1. Confirm whether ENGINE-13 needs an *additional* engine-level check or is satisfied by re-parsing on load — do not duplicate the invariant in two places where they can drift apart.

---

## Wave 0 Requirements

- [ ] `packages/engine/src/assess.ts` and its step modules — nothing exists yet beyond a placeholder index and the cross-package boundary test
- [ ] `packages/engine/src/__fixtures__/reference-pack.ts` — the hand-built fixture pack that produces PRD §14's exact totals. **Build this first**, per §14's own instruction; it is the check on every formula that follows
- [ ] New ESLint rule for `packages/engine`: `no-restricted-globals` (`Date`) plus `no-restricted-properties` (`Math.random`), extending the existing money-brand block
- [ ] **Also ban `Intl` and `toLocale*` in `packages/engine`** — this is the locale half of Success Criterion 2, and it is a static rule rather than a runtime one for the reason in Environment Findings below
- [ ] Additive schema change to `packages/schemas/src/assessment.ts` for ENGINE-16's flat-fee output (D-12), and to `MatterFlagCode` for `AGGREGATE_CAP_APPLIED` (D-11)
- [ ] Re-point `assessment.property.test.ts` at real `assess()` output instead of hand-constructed arbitraries

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Every new gate ships with a violating fixture, and the plan shows it caught
- [ ] The reference-fixture golden test reproduces PRD §14's published totals exactly
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
