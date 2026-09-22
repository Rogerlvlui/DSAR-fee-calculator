---
phase: "05"
slug: "hr-intake-and-disclosure-shell"
status: planned
nyquist_compliant: true
wave_0_complete: false
created: "2026-09-19"
populated: "2026-09-19"
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Written at plan time —
> every row below is `⬜ pending` until `/gsd-execute-phase 5` runs; `nyquist_compliant: true` here
> reflects the STRUCTURAL property (every task carries an `<automated>` verify with a `<fails_when>`
> sibling) checkable at plan time, not an execution result — the executor of the last plan (05-06)
> re-confirms every row reads green before flipping `status` to `executed`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.0 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `pnpm vitest run --project web --project routes --project boundary --project schemas` (the four projects this phase's work touches) |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~10-12s (current baseline 732/732 per STATE.md, plus this phase's new test files) |

---

## Sampling Rate

- **After every task commit:** Run the relevant project filter, scoped by `-t` to the feature tag named in that task's `<verify>` block
- **After every plan wave:** Run `pnpm test` — Plan 05-03 in particular retrofits the SG-only jurisdiction fallback every downstream plan builds on, so a full-suite check after wave 2 is load-bearing, not optional
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-T1 | 05-01 | 1 | DISC-01 | T-05-01 | A malformed/legacy stored acknowledgement value can only read as "not acknowledged," never as a false positive | unit | `pnpm vitest run --project web -t "CAPABILITY"` | ✅ (extends existing file) | ⬜ pending |
| 05-01-T2 | 05-01 | 1 | DISC-02 | T-05-02 | The Phase 3.1 pack-status warn-only disclosure is untouched by the two additive AC-31 cells | unit | `pnpm vitest run --project web -t "STATUS-STRIP"` | ✅ (extends existing file) | ⬜ pending |
| 05-01-T3 | 05-01 | 1 | DISC-01, DISC-02 | — | Gate mounted once at the layout, not per page; a route-group layout never attempts a per-matter strip it cannot correctly compute | unit + regression | `pnpm vitest run --project web -t "CAPABILITY"` · `pnpm test` | ❌ (new layout test files) | ⬜ pending |
| 05-02-T1 | 05-02 | 1 | BOUND-04 | T-05-03 | Pure, total, never-throwing function; digit-run check does not false-positive on invoice-shaped references | unit | `pnpm vitest run --project schemas -t "personal-data-pattern"` | ❌ (new file) | ⬜ pending |
| 05-02-T2 | 05-02 | 1 | BOUND-03, BOUND-04 | T-05-04 | The warning is presentational only — no code path lets it reach submit-gating logic | unit | `pnpm vitest run --project web -t "REPEATER"` · `pnpm vitest run --project web -t "ATTESTATIONS"` | ⚠️ (repeater extends existing; attestations is a new test file) | ⬜ pending |
| 05-03-T1 | 05-03 | 2 | INTAKE-02 | T-05-05 | The defensive "no usable pack" branch is proven with a hand-built fixture, not assumed from the real nine packs alone | unit (tracer) | `pnpm vitest run --project web -t "JURISDICTION-PACKS"` | ❌ (new file) | ⬜ pending |
| 05-03-T2 | 05-03 | 2 | INTAKE-02, INTAKE-03 | T-05-07 | Expense entry is structurally withheld (component absent from the tree), not merely warned alongside | unit | `pnpm vitest run --project web -t "INTAKE-FORM"` · `pnpm vitest run --project web -t "MATTER-DETAILS"` · `pnpm vitest run --project boundary` | ⚠️ (intake-form extends existing; matter-details is new) | ⬜ pending |
| 05-03-T3 | 05-03 | 2 | DISC-02 | T-05-06 | Every HR screen with one specific matter in view carries the reconciled strip, sourced from that matter's own jurisdiction | integration | `pnpm vitest run --project routes -t "INTAKE"` · `pnpm test` | ✅ (existing route test extended implicitly via full suite) | ⬜ pending |
| 05-04-T1 | 05-04 | 3 | DISC-05 | — | Pure relocation, proven byte-identical against the pre-existing fixture values — no behavior drift from the extraction | unit + regression | `pnpm vitest run --project web -t "ADVISORY-DEADLINE"` · `pnpm vitest run --project web -t "matter-rail"` | ❌ (new domain module) | ⬜ pending |
| 05-04-T2 | 05-04 | 3 | NAV-02 | T-05-08, T-05-09 | Ownership filter proven against two distinct actors, not the single seeded identity; the HR status label is an exhaustive, no-default lookup | unit + integration | `pnpm vitest run --project web -t "hr-matter-status-label"` · `pnpm vitest run --project routes -t "listMattersForPreparer"` | ❌ (new files) | ⬜ pending |
| 05-04-T3 | 05-04 | 3 | NAV-02, DISC-05 | T-05-10 | The list page imports nothing from `assessments.ts` — no leak-channel regression of the AC-02/AC-04 class | integration | `pnpm vitest run --project routes -t "hr-matters-list"` · `pnpm vitest run --project boundary` | ❌ (new route + page) | ⬜ pending |
| 05-05-T1 | 05-05 | 3 | INTAKE-09 | T-05-12 | A failed storage write surfaces as a distinct, visible status rather than being swallowed | unit (timer-driven, jsdom) | `pnpm vitest run --project web -t "use-draft-autosave"` | ❌ (new file, first hook in this codebase) | ⬜ pending |
| 05-05-T2 | 05-05 | 3 | INTAKE-09 | T-05-11 | Draft data never leaves the browser; no restore-on-read path exists to widen this mechanism's exposure | unit | `pnpm vitest run --project web -t "AUTOSAVE-INDICATOR"` · `pnpm vitest run --project web -t "INTAKE-FORM"` | ❌ (new component) | ⬜ pending |
| 05-06-T1 | 05-06 | 4 | DISC-03 | T-05-13 | The scanner is proven non-vacuous by a canary it must catch and a character-count floor it cannot pass by scanning nothing | unit (render + scan) | `pnpm vitest run --project boundary -t "UI-BANNED-WORDS"` | ❌ (new file + fixture) | ⬜ pending |
| 05-06-T2 | 05-06 | 4 | INTAKE-01, 04, 05, 06, 07, 08 | — | The strengthened AC-42 assertion would fail if either currency code silently dropped from the validation message | integration + regression | `pnpm vitest run --project routes -t "INTAKE"` · `pnpm test` · `pnpm run lint` · `pnpm run typecheck` · `pnpm run depcruise` | ✅ (extends existing file) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Phase not yet executed.** All 15 task rows across 6 plans are pending. No checkpoint tasks exist in this phase — every task is `autonomous: true` with at least one automated verify.

**Sampling continuity:** no 3 consecutive tasks lack an automated verify — every one of the 15 rows carries at least one `<automated>` command.

**Baseline caveat:** per prior-phase precedent (04-VALIDATION.md), two pre-existing failures are already known and excluded from every `pnpm test` gate in this phase's plans: a CPU-load-sensitive property-test timeout in `packages/engine/src/assess.property.test.ts`, and the line-ending drift failure in the schemas JSON-schema test (WINDOWS.md entry 1). Confirm this set is still current at the start of Plan 05-01 (per this project's standing precondition discipline) before treating any new `pnpm test` failure as this phase's own regression.

---

## Wave 0 Requirements

Wave 0 gaps are distributed across this phase's first two waves rather than concentrated in a single tracer plan, since Phase 5's net-new surface splits into independent concerns (disclosure-shell wiring, jurisdiction-status resolution, personal-data field discipline) with no single artifact all three depend on.

- [ ] `apps/web/src/server/jurisdiction-packs.test.ts` — covers INTAKE-02, tagged `JURISDICTION-PACKS` (Plan 05-03 Task 1, this phase's own tracer task)
- [ ] `packages/schemas/src/personal-data-pattern.test.ts` — covers BOUND-04 (Plan 05-02 Task 1)
- [ ] `apps/web/src/ui/intake/attestations-panel.test.tsx` — first test file for this component (Plan 05-02 Task 2)
- [ ] `apps/web/src/ui/intake/matter-details-fields.test.tsx` — first dedicated test file for this component (Plan 05-03 Task 2)
- [ ] `apps/web/src/ui/intake/use-draft-autosave.test.ts` — covers INTAKE-09, the first timer-driven hook test in this codebase (Plan 05-05 Task 1)
- [ ] `apps/web/src/domain/hr-matter-status-label.test.ts`, `tests/routes/hr-matters-list.test.ts` — cover NAV-02 (Plan 05-04 Tasks 2-3)
- [ ] `tests/boundary/ui-banned-words.test.ts`, `tests/fixtures/banned-word-canary.fixture.tsx` — cover DISC-03 (Plan 05-06 Task 1)
- Framework install: none — Vitest, zod, React and TypeScript are all already present; this phase adds no external dependency (confirmed in 05-RESEARCH.md's Package Legitimacy Audit: not applicable, no new packages proposed)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| A live click-through of the intake screen, `/matters`, and the jurisdiction `<select>`'s five status states in a real browser | INTAKE-02, INTAKE-03, NAV-02 | `pnpm dev`/`next build` remain unable to start on this build machine (WINDOWS.md entries 3-4, still open — a Tailwind v4 native-binary crash, not a code defect this phase can fix) | N/A this phase — verification relies on the route-handler test suite (real `Request` objects through real handlers) plus direct code reads, per the precedent Phase 04's own phase-goal verification already used successfully |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify with a `<fails_when>` sibling — every one of the 15 tasks across all 6 plans carries at least one runnable command
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references — each gap above names the plan and task that closes it
- [x] No watch-mode flags — every command is `vitest run`, never bare `vitest`
- [x] Feedback latency < 30s — no new project or heavy fixture is introduced that would change this phase's baseline runtime materially
- [x] `nyquist_compliant: true` set in frontmatter — the structural property (every task automated) is true at plan time; execution-time greenness is the executor's job to confirm, not this document's at write time
- [ ] Every row above reads green — pending execution
- [ ] `wave_0_complete: true` — pending execution of Plan 05-02 Task 1 and Plan 05-03 Task 1, this phase's two independent Wave 0 anchors

**Approval:** planned, not yet executed — awaiting `/gsd-execute-phase 5`.
